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
} from "@/server/repositories";
import {
  toPurchaseOrderDTO,
  toPharmacySaleDTO,
} from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import {
  type PurchaseOrderRow,
  type PurchaseOrderItemRow,
  type PharmacySaleRow,
  type PharmacySaleItemRow,
} from "@/server/db/tables";
import { NotFoundError, BadRequestError, ConflictError } from "@/server/lib/errors";
import { validate } from "@/server/lib/validation";
import { displayDate, nextCode } from "@/server/services/helpers";
import { computePharmacyStatus } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

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

export async function listPurchaseOrders(options: QueryOptions) {
  const { rows, total } = await purchaseOrdersRepo.listRows(options);
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

export async function getPurchaseOrder(id: number) {
  const row = await purchaseOrdersRepo.getRow(id);
  if (!row) throw new NotFoundError("Purchase order");
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

  const { rows: existing } = await purchaseOrdersRepo.listRows({ unpaged: true });
  const poNumber = nextCode(existing.map((r) => r.po_number), "PO-", 4);

  const total = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitCost ?? 0),
    0,
  );

  const row = await purchaseOrdersRepo.create({
    po_number: poNumber,
    supplier: data.supplier,
    order_date: displayDate(),
    expected_date: data.expectedDate,
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
  if (!row) throw new NotFoundError("Purchase order");
  if (row.status === "Received") {
    throw new ConflictError("This purchase order has already been received");
  }
  if (row.status === "Cancelled") {
    throw new ConflictError("A cancelled purchase order cannot be received");
  }

  const items = await poItems(id);
  const applied: { name: string; added: number; to: number }[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    const stock =
      (item.pharmacy_item_id
        ? await pharmacyRepo.getRow(item.pharmacy_item_id)
        : null) ??
      (await pharmacyRepo.findRow([
        { column: "name", op: "eq", value: item.medicine_name },
      ]));

    if (!stock) {
      unmatched.push(item.medicine_name);
      continue;
    }
    const newStock = stock.stock + item.quantity;
    await pharmacyRepo.update(stock.id, {
      stock: newStock,
      status: computePharmacyStatus(newStock, stock.min_stock, stock.expiry_date),
    });
    applied.push({ name: stock.name, added: item.quantity, to: newStock });
  }

  const updated = await purchaseOrdersRepo.update(id, { status: "Received" });
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
  const row = await purchaseOrdersRepo.update(id, { status });
  if (!row) throw new NotFoundError("Purchase order");
  await audit(actor, "update", "purchase-order", id, { status });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

export async function deletePurchaseOrder(id: number, actor: Session) {
  const items = await poItems(id);
  for (const i of items) await purchaseOrderItemsRepo.remove(i.id);
  const ok = await purchaseOrdersRepo.remove(id);
  if (!ok) throw new NotFoundError("Purchase order");
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

export async function listSales(options: QueryOptions) {
  const { rows, total } = await pharmacySalesRepo.listRows(options);
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
  const resolved = [];
  for (const l of lines) {
    const stock =
      (l.pharmacyItemId ? await pharmacyRepo.getRow(l.pharmacyItemId) : null) ??
      (await pharmacyRepo.findRow([
        { column: "name", op: "eq", value: l.medicineName },
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

  const { rows: existing } = await pharmacySalesRepo.listRows({ unpaged: true });
  const saleNumber = nextCode(existing.map((r) => r.sale_number), "SALE-", 4);

  const sale = await pharmacySalesRepo.create({
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
    await pharmacySaleItemsRepo.create({
      sale_id: sale.id,
      pharmacy_item_id: r.stock.id,
      medicine_name: r.stock.name,
      quantity: r.qty,
      unit_price: r.unitPrice,
      line_total: r.qty * r.unitPrice,
    });
    const newStock = r.stock.stock - r.qty;
    await pharmacyRepo.update(r.stock.id, {
      stock: newStock,
      status: computePharmacyStatus(newStock, r.stock.min_stock, r.stock.expiry_date),
    });
  }

  // Raise the corresponding bill so pharmacy revenue shows up in Billing.
  const { rows: bills } = await billsRepo.listRows({ unpaged: true });
  const bill = await billsRepo.create({
    bill_number: nextCode(bills.map((b) => b.bill_number), "INV-", 8),
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
  await pharmacySalesRepo.update(sale.id, { bill_id: bill.id });

  await audit(actor, "create", "pharmacy-sale", sale.id, { saleNumber, total });
  const finalRow = await pharmacySalesRepo.getRow(sale.id);
  return toPharmacySaleDTO(finalRow as PharmacySaleRow, await saleItems(sale.id));
}

export async function deleteSale(id: number, actor: Session) {
  const items = await saleItems(id);
  for (const i of items) await pharmacySaleItemsRepo.remove(i.id);
  const ok = await pharmacySalesRepo.remove(id);
  if (!ok) throw new NotFoundError("Sale");
  await audit(actor, "delete", "pharmacy-sale", id);
}
