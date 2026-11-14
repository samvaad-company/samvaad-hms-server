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
import { NotFoundError, BadRequestError, ConflictError, ValidationError, type FieldError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { validate, validatePartial } from "@/lib/validation";
import { displayDate, nextCode, isoDate } from "@/services/helpers";
import { computePharmacyStatus } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { findParty } from "@/services/pharmacy-parties-service";
import { creditLock, planCredit, recordApplied, releaseCredit } from "@/services/supplier-credit-service";
import { nextNumber } from "@/services/id-service";
import { allocateBatches, type BatchTake } from "@/services/pharmacy-batch-service";

export const PO_STATUSES = ["Pending", "Received", "Cancelled"] as const;
export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Cheque", "Insurance"] as const;

// ── Purchase orders ─────────────────────────────────────────────────────────

export const PO_LIST_CONFIG = {
  searchColumns: ["po_number", "supplier"],
  filterable: ["status", "supplier", "payment_type", "payment_status"],
  sortable: ["order_date", "po_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export const PAYMENT_TYPES = ["Cash", "Credit"] as const;

const poSchema = {
  supplier: { type: "string", required: true, min: 2, max: 160 },
  expectedDate: { type: "string", required: false, max: 40, default: "" },
  notes: { type: "string", required: false, max: 500, default: "" },
  paymentType: { type: "enum", required: false, values: PAYMENT_TYPES, default: "Cash" },
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

interface POLine { medicineName: string; quantity: number; unitCost?: number; pharmacyItemId?: number; manufacturer?: string; hsn?: string; isH1?: boolean }
interface CleanLine { medicineName: string; quantity: number; unitCost: number; pharmacyItemId: number | null; manufacturer: string; manufacturerId: number | null; hsn: string; isH1: boolean }

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The lines of a bill, checked and completed: whole quantities, a cost, an HSN code that looks like one (4–8 digits), and the
 * manufacturer — taken from the medicine in the inventory when the line doesn't name one, and linked to the Masters record.
 */
async function cleanLines(raw: unknown, actor: Session): Promise<CleanLine[]> {
  const list = (Array.isArray(raw) ? raw : []).filter((l: POLine) => l?.medicineName?.trim() && Number(l.quantity) > 0) as POLine[];
  if (list.length === 0) throw new BadRequestError("Add at least one medicine with a quantity");
  if (list.length > 200) throw new BadRequestError("A bill can have at most 200 lines");
  const errors: FieldError[] = [];
  const out: CleanLine[] = [];
  for (const [i, l] of list.entries()) {
    const quantity = Number(l.quantity), unitCost = Number(l.unitCost ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) { errors.push({ field: `items[${i}].quantity`, message: "quantity must be a whole number" }); continue; }
    if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 100_000_000) { errors.push({ field: `items[${i}].unitCost`, message: "cost must be a number from 0" }); continue; }
    const hsn = String(l.hsn ?? "").trim();
    if (hsn && !/^\d{4,8}$/.test(hsn)) { errors.push({ field: `items[${i}].hsn`, message: "HSN must be 4 to 8 digits" }); continue; }
    const item = l.pharmacyItemId ? await pharmacyRepo.getRow(Number(l.pharmacyItemId)) : null;
    const owned = item && item.hospital_id === actor.hospitalId ? item : null;
    const mName = String(l.manufacturer ?? "").trim() || (owned?.manufacturer ?? "");
    const m = mName ? await findParty("manufacturer", { name: mName }, actor) : null;
    out.push({
      medicineName: l.medicineName.trim().slice(0, 160), quantity, unitCost: r2(unitCost), pharmacyItemId: owned?.id ?? null,
      manufacturer: m?.name ?? mName, manufacturerId: m?.id ?? null, hsn: hsn || (owned?.hsn ?? ""), isH1: typeof l.isH1 === "boolean" ? l.isH1 : owned?.is_h1 === true,
    });
  }
  if (errors.length) throw new ValidationError(errors);
  return out;
}

const goods = (lines: CleanLine[]) => r2(lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0));

const lineRow = (poId: number, l: CleanLine) => ({
  purchase_order_id: poId, pharmacy_item_id: l.pharmacyItemId, medicine_name: l.medicineName, quantity: l.quantity, unit_cost: l.unitCost,
  manufacturer: l.manufacturer, manufacturer_id: l.manufacturerId, hsn: l.hsn, is_h1: l.isH1,
});

/** A cash bill is paid when it is made; a credit bill is paid later — unless supplier credit covers all of it. */
const paymentStatusFor = (type: string, net: number) => (type === "Credit" && net > 0.004 ? "Unpaid" : "Paid");

export async function createPurchaseOrder(input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const data = validate(poSchema, input);
  const body = (typeof input === "object" && input !== null ? input : {}) as { items?: unknown; useCredit?: unknown };
  const lines = await cleanLines(body.items, actor);
  const supplier = await findParty("supplier", { name: data.supplier }, actor);
  const supplierName = supplier?.name ?? data.supplier;

  const { rows: existing } = await purchaseOrdersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const poNumber = await nextNumber("purchase_order", actor, existing.map((r) => r.po_number), { prefix: "PO-", pad: 4 });
  const total = goods(lines);

  // Supplier credit from stock returned earlier is taken off, for the same supplier and manufacturer, unless the bill says not to.
  const row = await withKeyLocks([creditLock(hospitalId, supplierName)], async () => {
    const credit = body.useCredit === false ? [] : await planCredit(supplierName, lines, actor);
    const applied = r2(credit.reduce((n, c) => n + c.amount, 0));
    const net = r2(total - applied);
    return transactional("pharmacy.createPO", async (uow) => {
      const po = await uow.insert<PurchaseOrderRow>(TABLES.purchaseOrders, {
        hospital_id: hospitalId, po_number: poNumber, supplier: supplierName, supplier_id: supplier?.id ?? null, order_date: displayDate(), expected_date: isoDate(data.expectedDate),
        item_count: lines.length, total, status: "Pending", notes: data.notes, payment_type: data.paymentType, payment_status: paymentStatusFor(data.paymentType, net),
        credit_applied: applied, net_payable: net,
      });
      for (const l of lines) await uow.insert(TABLES.purchaseOrderItems, lineRow(po.id, l));
      await recordApplied(uow, po.id, poNumber, supplierName, supplier?.id ?? null, credit, actor);
      return po;
    });
  });

  await audit(actor, "create", "purchase-order", row.id, { poNumber, paymentType: data.paymentType, creditApplied: row.credit_applied });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(row.id));
}

/** Receiving a PO adds its quantities to pharmacy stock, and records each medicine's manufacturer, HSN and H1 flag on the inventory item. */
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
    const patch: Record<string, unknown> = {
      stock: newStock,
      status: computePharmacyStatus(newStock, stock.min_stock, stock.expiry_date),
    };
    if (item.manufacturer) { patch.manufacturer = item.manufacturer; patch.manufacturer_id = item.manufacturer_id ?? null; }
    if (item.hsn) patch.hsn = item.hsn;
    if (item.is_h1 != null) patch.is_h1 = item.is_h1 === true;
    if (!stock.supplier && row.supplier) { patch.supplier = row.supplier; patch.supplier_id = row.supplier_id ?? null; }
    await uow.update(TABLES.pharmacyItems, stock.id, patch);
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
  if (existing.status === "Received" && status !== "Received") throw new ConflictError("A received purchase order can't be changed back — its stock is already in");
  if (status === "Cancelled" && existing.status !== "Cancelled") {
    // A cancelled bill gives back the supplier credit it used.
    const row = await withKeyLocks([creditLock(requireHospitalId(actor), existing.supplier)], () => transactional("pharmacy.cancelPO", async (uow) => {
      await releaseCredit(uow, id, existing.po_number, actor);
      return uow.update<PurchaseOrderRow>(TABLES.purchaseOrders, id, { status, credit_applied: 0, net_payable: Number(existing.total), payment_status: existing.payment_type === "Credit" ? "Unpaid" : existing.payment_status });
    }));
    await audit(actor, "update", "purchase-order", id, { status });
    return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
  }
  const row = await purchaseOrdersRepo.update(id, { status });
  await audit(actor, "update", "purchase-order", id, { status });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

/** A credit bill has been paid to the supplier. */
export async function payPurchaseOrder(id: number, actor: Session) {
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  if (existing.status === "Cancelled") throw new ConflictError("A cancelled purchase order has nothing to pay");
  if (existing.payment_status === "Paid") throw new ConflictError("This bill is already paid");
  const row = await purchaseOrdersRepo.update(id, { payment_status: "Paid" });
  await audit(actor, "pay", "purchase-order", id, { amount: Number(existing.net_payable ?? existing.total) });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

const poEditSchema = {
  supplier: { type: "string", required: false, min: 2, max: 160 },
  expectedDate: { type: "string", required: false, max: 40 },
  paymentType: { type: "enum", required: false, values: PAYMENT_TYPES },
} as const;

/**
 * Full content edit (supplier, expected date, payment type, line items) — distinct from `updatePurchaseOrderStatus`. Once a PO has
 * been received, its items already moved stock, so editing is restricted to Pending orders only. The supplier credit the bill used
 * is given back and worked out again for what the bill now holds.
 */
export async function updatePurchaseOrder(id: number, input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  if (existing.status !== "Pending") {
    throw new ConflictError("Only a pending purchase order can be edited");
  }

  const data = validatePartial(poEditSchema, input);
  const body = (typeof input === "object" && input !== null ? input : {}) as { items?: unknown; useCredit?: unknown };
  const lines = body.items !== undefined ? await cleanLines(body.items, actor) : null;
  const newSupplier = "supplier" in data ? await findParty("supplier", { name: data.supplier }, actor) : null;
  const supplierName = "supplier" in data ? (newSupplier?.name ?? String(data.supplier)) : existing.supplier;
  const supplierId = "supplier" in data ? newSupplier?.id ?? null : existing.supplier_id ?? null;
  const paymentType = ("paymentType" in data ? data.paymentType : existing.payment_type) ?? "Cash";

  await withKeyLocks([creditLock(hospitalId, existing.supplier), creditLock(hospitalId, supplierName)], async () => {
    await transactional("pharmacy.editPO", async (uow) => {
      // Give back what the bill used, then work it out again from what it holds now.
      await releaseCredit(uow, id, existing.po_number, actor);
      const current = lines ?? (await poItems(id)).map((i): CleanLine => ({
        medicineName: i.medicine_name, quantity: i.quantity, unitCost: Number(i.unit_cost), pharmacyItemId: i.pharmacy_item_id, manufacturer: i.manufacturer ?? "", manufacturerId: i.manufacturer_id ?? null, hsn: i.hsn ?? "", isH1: i.is_h1 === true,
      }));
      const total = goods(current);
      const credit = body.useCredit === false ? [] : await planCredit(supplierName, current, actor);
      const applied = r2(credit.reduce((n, c) => n + c.amount, 0));
      const net = r2(total - applied);
      const patch: Record<string, unknown> = { total, item_count: current.length, credit_applied: applied, net_payable: net, payment_type: paymentType, payment_status: paymentStatusFor(paymentType, net), supplier: supplierName, supplier_id: supplierId };
      if ("expectedDate" in data) patch.expected_date = isoDate(data.expectedDate);
      await uow.update(TABLES.purchaseOrders, id, patch);
      if (lines) {
        for (const i of await poItems(id)) await uow.remove(TABLES.purchaseOrderItems, i.id);
        for (const l of lines) await uow.insert(TABLES.purchaseOrderItems, lineRow(id, l));
      }
      await recordApplied(uow, id, existing.po_number, supplierName, supplierId, credit, actor);
    });
  });

  const row = await purchaseOrdersRepo.getRow(id);
  await audit(actor, "update", "purchase-order", id, { supplier: supplierName, paymentType });
  return toPurchaseOrderDTO(row as PurchaseOrderRow, await poItems(id));
}

export async function deletePurchaseOrder(id: number, actor: Session) {
  const existing = await purchaseOrdersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Purchase order");
  await withKeyLocks([creditLock(requireHospitalId(actor), existing.supplier)], () => transactional("pharmacy.deletePO", async (uow) => {
    await releaseCredit(uow, id, existing.po_number, actor);
    for (const i of await poItems(id)) await uow.remove(TABLES.purchaseOrderItems, i.id);
    await uow.remove(TABLES.purchaseOrders, id);
  }));
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

interface SaleLine { pharmacyItemId?: number; medicineName: string; quantity: number; unitPrice?: number; isH1?: boolean; givenBy?: string; batchNo?: string }

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
  const usedBatches = new Map<number, number>();
  const resolved: { stock: PharmacyItemRow; qty: number; unitPrice: number; h1: boolean; givenBy: string; batchNo: string; takes: BatchTake[] }[] = [];
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
    // A medicine that is H1 in the inventory always goes in the register; the pharmacist can also tick one that isn't marked.
    const alloc = await allocateBatches(stock, qty, typeof l.batchNo === "string" ? l.batchNo : "", actor, usedBatches);
    resolved.push({ stock, qty, unitPrice: Number(l.unitPrice ?? 0), batchNo: alloc.label, takes: alloc.takes, h1: l.isH1 === true || stock.is_h1 === true, givenBy: typeof l.givenBy === "string" ? l.givenBy.trim().slice(0, 80) : "" });
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
        is_h1: r.h1,
        ...(r.h1 ? { given_by: r.givenBy || actor.name, given_by_id: actor.userId } : {}),
        ...(r.batchNo ? { batch_no: r.batchNo } : {}),
      });
      for (const t of r.takes) await uow.update(TABLES.pharmacyBatches, t.batchId, { quantity: t.left });
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
