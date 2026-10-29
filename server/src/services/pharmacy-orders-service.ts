/**
 * Pharmacy purchase orders and over-the-counter sales.
 *
 * Both sides move stock in opposite directions and were previously mockups
 * with no backend at all:
 *   - Receiving a purchase order INCREASES pharmacy stock.
 *   - Completing a sale DECREASES it and raises a Pharmacy bill.
 */
import {
  purchaseOrdersRepo,
  purchaseOrderItemsRepo,
  pharmacySalesRepo,
  pharmacySaleItemsRepo,
  pharmacyRepo,
  patientsRepo,
  billsRepo,
} from "@/repositories";
import {
  toPurchaseOrderDTO,
  toPharmacySaleDTO,
} from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import {
  type BillRow,
  type PharmacyItemRow,
  type PurchaseOrderRow,
  type PurchaseOrderItemRow,
  type PharmacySaleRow,
  type PharmacySaleItemRow,
} from "@/db/tables";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { displayDate, nextCode, isoDate } from "@/services/helpers";
import { computePharmacyStatus } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { nextNumber } from "@/services/id-service";

export const PO_STATUSES = ["Pending", "Received", "Cancelled"] as const;
export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Insurance"] as const;

// ── Purchase orders ─────────────────────────────────────────────────────────

export const PO_LIST_CONFIG = {
  searchColumns: ["po_number", "supplier"],
  filterable: ["status", "supplier"],
  sortable: ["order_date", "po_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

const poSchema = {
  supplier: { type: "string", required: true, min: 2, max: 160 },
  expectedDate: { type: "string", required: false, max: 40, default: "" },
  notes: { type: "string", required: false, max: 500, default: "" },
} as const;

export async function listPurchaseOrders(options: QueryOptions, actor: Session) {
  const { rows, total } = await purchaseOrdersRepo.listRows(scopeToHospital(options, actor));
  const withItems = await Promise.all(
    rows.map(async (r) => toPurchaseOrderDTO(r, await poItems(r.id))),
  );
  return { rows: withItems, total };
}

async function poItems(id: number): Promise<PurchaseOrderItemRow[]> {
  const { rows } = await purchaseOrderItemsRepo.listRows({
    filters: [{ column: "purchase_order_id", op: "eq", value: id }],
    unpaged: true,
  });
  return rows;
}

export async function getPurchaseOrder(id: number, actor: Session) {
  const row = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Purchase order");
  return toPurchaseOrderDTO(row, await poItems(id));
}

interface POLine { medicineName: string; quantity: number; unitCost?: number; pharmacyItemId?: number }

export async function createPurchaseOrder(input: unknown, actor: Session) {
  const data = validate(poSchema, input);
  const lines = ((input as { items?: POLine[] })?.items ?? []).filter(
    (l) => l?.medicineName?.trim() && Number(l.quantity) > 0,
  );
  if (lines.length === 0) {
    throw new BadRequestError("Add at least one medicine with a quantity");
  }

  const { rows: existing } = await purchaseOrdersRepo.listRows(
    scopeToHospital({ unpaged: true }, actor),
  );
  const poNumber = await nextNumber("purchase_order", actor, existing.map((r) => r.po_number), { prefix: "PO-", pad: 4 });

  const total = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitCost ?? 0),
    0,
  );

  const row = await purchaseOrdersRepo.create({
    hospital_id: actor.hospitalId,
    po_number: poNumber,
    supplier: data.supplier,
    order_date: displayDate(),
    expected_date: isoDate(data.expectedDate),
    item_count: lines.length,
    total,
    status: "Pending",
    notes: data.notes,
  });

  for (const l of lines) {
    await purchaseOrderItemsRepo.create({
      purchase_order_id: row.id,
      pharmacy_item_id: l.pharmacyItemId ?? null,
      medicine_name: l.medicineName.trim(),
      quantity: Number(l.quantity),
      unit_cost: Number(l.unitCost ?? 0),
    });
  }

  await audit(actor, "create", "purchase-order", row.id, { poNumber });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(row.id));
}

/** Receiving a PO adds its quantities to pharmacy stock. */
export async function receivePurchaseOrder(id: number, actor: Session) {
  const row = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Purchase order");
  if (row.status === "Received") {
    throw new ConflictError("This purchase order has already been received");
  }
  if (row.status === "Cancelled") {
    throw new ConflictError("A cancelled purchase order cannot be received");
  }

  const items = await poItems(id);
  const applied: { name: string; added: number; to: number }[] = [];
  const unmatched: string[] = [];

  await transactional("pharmacy.receivePO", async (uow) => {
  for (const item of items) {
    const byId = item.pharmacy_item_id
      ? await pharmacyRepo.getRow(item.pharmacy_item_id)
      : null;
    const stock =
      (byId && byId.hospital_id === actor.hospitalId ? byId : null) ??
      (await pharmacyRepo.findRow([
        { column: "name", op: "eq", value: item.medicine_name },
        { column: "hospital_id", op: "eq", value: actor.hospitalId },
      ]));

    if (!stock) {
      unmatched.push(item.medicine_name);
      continue;
    }
    const newStock = stock.stock + item.quantity;
    await uow.update(TABLES.pharmacyItems, stock.id, {
      stock: newStock,
      status: computePharmacyStatus(newStock, stock.min_stock, stock.expiry_date),
    });
    applied.push({ name: stock.name, added: item.quantity, to: newStock });
  }
  await uow.update(TABLES.purchaseOrders, id, { status: "Received" });
  });

  const updated = await purchaseOrdersRepo.getRow(id);
  await audit(actor, "receive", "purchase-order", id, { applied, unmatched });
  return {
    ...toPurchaseOrderDTO(updated as PurchaseOrderRow, items),
    receipt: { applied, unmatched },
  };
}

export async function updatePurchaseOrderStatus(id: number, status: string, actor: Session) {
  if (!PO_STATUSES.includes(status as (typeof PO_STATUSES)[number])) {
    throw new BadRequestError(`status must be one of: ${PO_STATUSES.join(", ")}`);
  }
  if (status === "Received") return receivePurchaseOrder(id, actor);
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  const row = await purchaseOrdersRepo.update(id, { status });
  await audit(actor, "update", "purchase-order", id, { status });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

const poEditSchema = {
  supplier: { type: "string", required: false, min: 2, max: 160 },
  expectedDate: { type: "string", required: false, max: 40 },
} as const;

/**
 * Full content edit (supplier, expected date, line items) — distinct from
 * `updatePurchaseOrderStatus`. Once a PO has been received, its items already
 * moved stock, so editing is restricted to Pending orders only.
 */
export async function updatePurchaseOrder(id: number, input: unknown, actor: Session) {
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  if (existing.status !== "Pending") {
    throw new ConflictError("Only a pending purchase order can be edited");
  }

  const data = validatePartial(poEditSchema, input);
  const lines = (input as { items?: POLine[] })?.items?.filter(
    (l) => l?.medicineName?.trim() && Number(l.quantity) > 0,
  );
  if (lines && lines.length === 0) {
    throw new BadRequestError("Add at least one medicine with a quantity");
  }

  const patch: Record<string, unknown> = {};
  if ("supplier" in data) patch.supplier = data.supplier;
  if ("expectedDate" in data) patch.expected_date = isoDate(data.expectedDate);
  if (lines) {
    patch.item_count = lines.length;
    patch.total = lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitCost ?? 0), 0);
  }

  const row = await purchaseOrdersRepo.update(id, patch);
  if (!row) throw new NotFoundError("Purchase order");

  if (lines) {
    for (const i of await poItems(id)) await purchaseOrderItemsRepo.remove(i.id);
    for (const l of lines) {
      await purchaseOrderItemsRepo.create({
        purchase_order_id: id,
        pharmacy_item_id: l.pharmacyItemId ?? null,
        medicine_name: l.medicineName.trim(),
        quantity: Number(l.quantity),
        unit_cost: Number(l.unitCost ?? 0),
      });
    }
  }

  await audit(actor, "update", "purchase-order", id, patch);
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

export async function deletePurchaseOrder(id: number, actor: Session) {
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  const items = await poItems(id);
  for (const i of items) await purchaseOrderItemsRepo.remove(i.id);
  await purchaseOrdersRepo.remove(id);
  await audit(actor, "delete", "purchase-order", id);
}

// ── Sales ───────────────────────────────────────────────────────────────────

export const SALES_LIST_CONFIG = {
  searchColumns: ["sale_number", "patient_name", "rx_number"],
  filterable: ["payment_mode", "patient_id"],
  sortable: ["sale_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

async function saleItems(id: number): Promise<PharmacySaleItemRow[]> {
  const { rows } = await pharmacySaleItemsRepo.listRows({
    filters: [{ column: "sale_id", op: "eq", value: id }],
    unpaged: true,
  });
  return rows;
}

export async function listSales(options: QueryOptions, actor: Session) {
  const { rows, total } = await pharmacySalesRepo.listRows(scopeToHospital(options, actor));
  const withItems = await Promise.all(
    rows.map(async (r) => toPharmacySaleDTO(r, await saleItems(r.id))),
  );
  return { rows: withItems, total };
}

const saleSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: false, max: 120, default: "Walk-in" },
  rxNumber: { type: "string", required: false, max: 40, default: "" },
  paymentMode: { type: "enum", required: false, values: PAYMENT_MODES, default: "Cash" },
  discount: { type: "number", required: false, min: 0, default: 0 },
} as const;

interface SaleLine { pharmacyItemId?: number; medicineName: string; quantity: number; unitPrice?: number }

/**
 * Record a counter sale: decrements stock for every line, stores the sale and
 * raises a matching Pharmacy bill. Rejects the whole sale if any line exceeds
 * available stock, so stock can never go negative.
 */
export async function createSale(input: unknown, actor: Session) {
  const data = validate(saleSchema, input);
  const lines = ((input as { items?: SaleLine[] })?.items ?? []).filter(
    (l) => l?.medicineName?.trim() && Number(l.quantity) > 0,
  );
  if (lines.length === 0) {
    throw new BadRequestError("Add at least one medicine to the sale");
  }

  // Resolve every line and check availability before mutating anything.
  const resolved: { stock: PharmacyItemRow; qty: number; unitPrice: number }[] = [];
  for (const l of lines) {
    const byId = l.pharmacyItemId ? await pharmacyRepo.getRow(l.pharmacyItemId) : null;
    const stock =
      (byId && byId.hospital_id === actor.hospitalId ? byId : null) ??
      (await pharmacyRepo.findRow([
        { column: "name", op: "eq", value: l.medicineName },
        { column: "hospital_id", op: "eq", value: actor.hospitalId },
      ]));
    if (!stock) {
      throw new BadRequestError(`"${l.medicineName}" is not in pharmacy inventory`);
    }
    const qty = Number(l.quantity);
    if (stock.stock < qty) {
      throw new ConflictError(
        `Only ${stock.stock} unit(s) of ${stock.name} in stock (needed ${qty})`,
      );
    }
    resolved.push({ stock, qty, unitPrice: Number(l.unitPrice ?? 0) });
  }

  let patientName = data.patientName || "Walk-in";
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }

  const subtotal = resolved.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  const discount = Number(data.discount ?? 0);
  const total = Math.max(0, subtotal - discount);

  const { rows: existing } = await pharmacySalesRepo.listRows(
    scopeToHospital({ unpaged: true }, actor),
  );
  const saleNumber = nextCode(existing.map((r) => r.sale_number), "SALE-", 4);
  const { rows: bills } = await billsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const billNumber = await nextNumber("invoice", actor, bills.map((b) => b.bill_number), { prefix: "INV-", pad: 8 });

  // Sale, line items, stock levels and the bill must land together — a partial
  // write here would decrement stock for a sale that was never recorded.
  const saleId = await transactional("pharmacy.sale", async (uow) => {
    const sale = await uow.insert<PharmacySaleRow>(TABLES.pharmacySales, {
      hospital_id: actor.hospitalId,
      sale_number: saleNumber,
      patient_id: data.patientId ?? null,
      patient_name: patientName,
      prescription_id: null,
      rx_number: data.rxNumber,
      item_count: resolved.length,
      subtotal,
      discount,
      total,
      payment_mode: data.paymentMode,
      sale_date: displayDate(),
      bill_id: null,
    });

    for (const r of resolved) {
      await uow.insert(TABLES.pharmacySaleItems, {
        sale_id: sale.id,
        pharmacy_item_id: r.stock.id,
        medicine_name: r.stock.name,
        quantity: r.qty,
        unit_price: r.unitPrice,
        line_total: r.qty * r.unitPrice,
      });
      const newStock = r.stock.stock - r.qty;
      await uow.update(TABLES.pharmacyItems, r.stock.id, {
        stock: newStock,
        status: computePharmacyStatus(newStock, r.stock.min_stock, r.stock.expiry_date),
      });
    }

    // Raise the corresponding bill so pharmacy revenue shows up in Billing.
    const bill = await uow.insert<BillRow>(TABLES.bills, {
      hospital_id: actor.hospitalId,
      bill_number: billNumber,
      patient_id: data.patientId ?? null,
      patient_name: patientName,
      type: "Pharmacy",
      bill_date: displayDate(),
      amount: subtotal,
      discount,
      gst: 0,
      total,
      status: "Paid",
    });
    await uow.update(TABLES.pharmacySales, sale.id, { bill_id: bill.id });
    return sale.id;
  });

  await audit(actor, "create", "pharmacy-sale", saleId, { saleNumber, total });
  const finalRow = await pharmacySalesRepo.getRow(saleId);
  return toPharmacySaleDTO(finalRow as PharmacySaleRow, await saleItems(saleId));
}

export async function getSale(id: number, actor: Session) {
  const row = await pharmacySalesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Sale");
  return toPharmacySaleDTO(row, await saleItems(id));
}

const saleEditSchema = {
  rxNumber: { type: "string", required: false, max: 40 },
  paymentMode: { type: "enum", required: false, values: PAYMENT_MODES },
  discount: { type: "number", required: false, min: 0 },
} as const;

/**
 * Edits a recorded sale's billing details (Rx reference, payment mode,
 * discount). Line items and stock are intentionally left alone here — they
 * already moved real inventory when the sale was created, so changing
 * quantities would need a separate stock-reconciliation step.
 */
export async function updateSale(id: number, input: unknown, actor: Session) {
  const existing = await pharmacySalesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Sale");

  const data = validatePartial(saleEditSchema, input);
  const patch: Record<string, unknown> = {};
  if ("rxNumber" in data) patch.rx_number = data.rxNumber;
  if ("paymentMode" in data) patch.payment_mode = data.paymentMode;
  if ("discount" in data) {
    const discount = Number(data.discount) || 0;
    patch.discount = discount;
    patch.total = Math.max(0, Number(existing.subtotal) - discount);
  }

  const row = await pharmacySalesRepo.update(id, patch);
  if (!row) throw new NotFoundError("Sale");

  // Keep the linked bill's figures in sync so Billing doesn't drift from the sale.
  if (existing.bill_id && "discount" in patch) {
    await billsRepo.update(existing.bill_id, { discount: patch.discount, total: patch.total });
  }

  await audit(actor, "update", "pharmacy-sale", id, patch);
  return toPharmacySaleDTO(row as PharmacySaleRow, await saleItems(id));
}

export async function deleteSale(id: number, actor: Session) {
  const existing = await pharmacySalesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Sale");
  const items = await saleItems(id);
  for (const i of items) await pharmacySaleItemsRepo.remove(i.id);
  await pharmacySalesRepo.remove(id);
  await audit(actor, "delete", "pharmacy-sale", id);
}
