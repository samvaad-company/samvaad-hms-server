/**
 * Supplier credit: stock sent back to a supplier earns the same amount as credit with that supplier and manufacturer, and the next
 * purchase bill for the same pair takes it off. Every movement is a row in the ledger (`supplier_credits`), so the history can be
 * read as it happened and the balance is simply the sum.
 */
import { pharmacyRepo, purchaseOrdersRepo, purchaseOrderItemsRepo, supplierCreditsRepo } from "@/repositories";
import { transactional, type UnitOfWork } from "@/db/unit-of-work";
import { TABLES, type PurchaseOrderItemRow, type SupplierCreditRow } from "@/db/tables";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { type QueryOptions } from "@/db/adapter";
import { validate } from "@/lib/validation";
import { computePharmacyStatus } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { findParty } from "@/services/pharmacy-parties-service";
import type { SupplierCreditBalanceDTO, SupplierCreditDTO } from "@shared/types/api";

const r2 = (n: number) => Math.round(n * 100) / 100;
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
const pairKey = (supplier: unknown, manufacturer: unknown) => `${norm(supplier)}|${norm(manufacturer)}`;

export const CREDIT_LIST_CONFIG = {
  searchColumns: ["supplier", "manufacturer", "medicine_name", "reference"],
  filterable: ["supplier", "manufacturer", "entry_type"],
  sortable: ["created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

const toDto = (r: SupplierCreditRow): SupplierCreditDTO => ({
  id: r.id, supplier: r.supplier, manufacturer: r.manufacturer ?? "", entryType: r.entry_type as SupplierCreditDTO["entryType"], amount: Number(r.amount),
  reference: r.reference ?? "", purchaseOrderId: r.purchase_order_id ?? null, medicineName: r.medicine_name ?? "", quantity: r.quantity ?? null,
  unitCost: r.unit_cost == null ? null : Number(r.unit_cost), reason: r.reason ?? "", createdBy: r.created_by ?? "", createdAt: r.created_at,
});

/** The lock that keeps two people from spending the same credit twice. */
export const creditLock = (hospitalId: number, supplier: string) => `supplier-credit:${hospitalId}:${norm(supplier)}`;

export async function listSupplierCredits(options: QueryOptions, actor: Session) {
  const { rows, total } = await supplierCreditsRepo.listRows(scopeToHospital(options, actor));
  return { rows: rows.map(toDto), total };
}

/** What each supplier / manufacturer pair is owed: credit earned and not yet used. Pairs with nothing left are left out. */
export async function creditBalances(actor: Session, only?: { supplier?: string }): Promise<SupplierCreditBalanceDTO[]> {
  const { rows } = await supplierCreditsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const map = new Map<string, SupplierCreditBalanceDTO>();
  for (const r of rows) {
    if (only?.supplier && norm(r.supplier) !== norm(only.supplier)) continue;
    const k = pairKey(r.supplier, r.manufacturer);
    const cur = map.get(k) ?? { supplier: r.supplier, manufacturer: r.manufacturer ?? "", balance: 0 };
    cur.balance = r2(cur.balance + Number(r.amount));
    map.set(k, cur);
  }
  return [...map.values()].filter((b) => Math.abs(b.balance) >= 0.005).sort((a, b) => a.supplier.localeCompare(b.supplier) || a.manufacturer.localeCompare(b.manufacturer));
}

export interface CreditLine { manufacturer: string; amount: number }

/**
 * How much credit a bill would use: for each manufacturer on the bill, the credit held with this supplier for that manufacturer,
 * up to what that manufacturer's lines come to. Credit never goes below zero and never exceeds the goods.
 */
export async function planCredit(supplier: string, lines: { manufacturer: string; quantity: number; unitCost: number }[], actor: Session): Promise<CreditLine[]> {
  const spend = new Map<string, { manufacturer: string; subtotal: number }>();
  for (const l of lines) {
    const k = norm(l.manufacturer);
    const cur = spend.get(k) ?? { manufacturer: l.manufacturer, subtotal: 0 };
    cur.subtotal = r2(cur.subtotal + l.quantity * l.unitCost);
    spend.set(k, cur);
  }
  const balances = await creditBalances(actor, { supplier });
  const out: CreditLine[] = [];
  for (const [k, s] of spend) {
    const held = balances.find((b) => norm(b.manufacturer) === k)?.balance ?? 0;
    const amount = r2(Math.min(Math.max(held, 0), s.subtotal));
    if (amount > 0) out.push({ manufacturer: s.manufacturer, amount });
  }
  return out;
}

/** Write the "Applied" rows of a bill that uses credit. */
export async function recordApplied(uow: UnitOfWork, poId: number, poNumber: string, supplier: string, supplierId: number | null, credit: CreditLine[], actor: Session): Promise<void> {
  for (const c of credit) {
    const m = c.manufacturer ? await findParty("manufacturer", { name: c.manufacturer }, actor) : null;
    await uow.insert<SupplierCreditRow>(TABLES.supplierCredits, {
      hospital_id: requireHospitalId(actor), supplier, supplier_id: supplierId, manufacturer: c.manufacturer, manufacturer_id: m?.id ?? null,
      entry_type: "Applied", amount: -c.amount, reference: poNumber, purchase_order_id: poId, created_by: actor.name,
    });
  }
}

/** Give back the credit a bill used (it was cancelled, deleted or edited). Safe to repeat: only what is still outstanding is returned. */
export async function releaseCredit(uow: UnitOfWork, poId: number, poNumber: string, actor: Session): Promise<number> {
  const { rows } = await supplierCreditsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "purchase_order_id", op: "eq", value: poId }] }, actor));
  const net = new Map<string, SupplierCreditRow>();
  const left = new Map<string, number>();
  for (const r of rows) {
    if (r.entry_type !== "Applied" && r.entry_type !== "Reversal") continue;
    const k = pairKey(r.supplier, r.manufacturer);
    net.set(k, r);
    left.set(k, r2((left.get(k) ?? 0) + Number(r.amount)));
  }
  let given = 0;
  for (const [k, remaining] of left) {
    if (remaining >= -0.005) continue; // nothing outstanding for this pair
    const r = net.get(k)!;
    await uow.insert<SupplierCreditRow>(TABLES.supplierCredits, {
      hospital_id: requireHospitalId(actor), supplier: r.supplier, supplier_id: r.supplier_id ?? null, manufacturer: r.manufacturer ?? "", manufacturer_id: r.manufacturer_id ?? null,
      entry_type: "Reversal", amount: r2(-remaining), reference: poNumber, purchase_order_id: poId, reason: "Bill changed or cancelled", created_by: actor.name,
    });
    given = r2(given - remaining);
  }
  return given;
}

const returnSchema = {
  pharmacyItemId: { type: "number", required: true, min: 1 },
  quantity: { type: "number", required: true, min: 1 },
  unitCost: { type: "number", required: false, min: 0 },
  supplier: { type: "string", required: false, max: 160 },
  manufacturer: { type: "string", required: false, max: 160 },
  reason: { type: "string", required: false, max: 300, default: "" },
} as const;

/** The price paid per unit the last time this medicine was bought, if it ever was. */
async function lastCost(itemId: number, name: string, actor: Session): Promise<number | null> {
  const { rows: pos } = await purchaseOrdersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const mine = new Set(pos.filter((p) => p.status !== "Cancelled").map((p) => p.id));
  const { rows } = await purchaseOrderItemsRepo.listRows({ unpaged: true });
  const hits = (rows as PurchaseOrderItemRow[]).filter((l) => mine.has(l.purchase_order_id) && Number(l.unit_cost) > 0 && (l.pharmacy_item_id === itemId || norm(l.medicine_name) === norm(name)));
  hits.sort((a, b) => b.id - a.id);
  return hits[0] ? Number(hits[0].unit_cost) : null;
}

/**
 * Stock goes back to the supplier: it leaves the shelf and the same amount becomes credit with that supplier and manufacturer,
 * to be taken off their next purchase bill.
 */
export async function returnToSupplier(input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const data = validate(returnSchema, input);
  if (!Number.isInteger(data.quantity)) throw new ValidationError([{ field: "quantity", message: "quantity must be a whole number" }]);
  const item = await pharmacyRepo.getRow(data.pharmacyItemId);
  assertOwnedByHospital(item, actor, "Pharmacy item");

  const supplierName = (data.supplier ?? item.supplier ?? "").trim();
  if (!supplierName) throw new ValidationError([{ field: "supplier", message: "say which supplier the stock goes back to" }]);
  const supplier = await findParty("supplier", { name: supplierName }, actor);
  const manufacturerName = (data.manufacturer ?? item.manufacturer ?? "").trim();
  const manufacturer = manufacturerName ? await findParty("manufacturer", { name: manufacturerName }, actor) : null;
  const unitCost = data.unitCost ?? (await lastCost(item.id, item.name, actor));
  if (unitCost == null || unitCost <= 0) throw new ValidationError([{ field: "unitCost", message: "enter what each unit cost, so the credit can be worked out" }]);
  const amount = r2(data.quantity * unitCost);

  const result = await withKeyLocks([`pharmacy-stock:${hospitalId}:${item.id}`, creditLock(hospitalId, supplier?.name ?? supplierName), `supplier-credit-ref:${hospitalId}`], async () => {
    const fresh = await pharmacyRepo.getRow(item.id);
    if (!fresh) throw new NotFoundError("Pharmacy item");
    if (data.quantity > fresh.stock) throw new ConflictError(`Only ${fresh.stock} ${fresh.stock === 1 ? "unit" : "units"} of ${fresh.name} in stock (asked to return ${data.quantity})`);
    const { rows: existing } = await supplierCreditsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "entry_type", op: "eq", value: "Return" }] }, actor));
    const used = existing.map((r) => Number(/^RET-(\d+)$/.exec(r.reference ?? "")?.[1] ?? 0));
    const reference = `RET-${String(Math.max(0, ...used) + 1).padStart(4, "0")}`;
    const newStock = fresh.stock - data.quantity;
    const row = await transactional("pharmacy.returnToSupplier", async (uow) => {
      await uow.update(TABLES.pharmacyItems, fresh.id, { stock: newStock, status: computePharmacyStatus(newStock, fresh.min_stock, fresh.expiry_date) });
      return uow.insert<SupplierCreditRow>(TABLES.supplierCredits, {
        hospital_id: hospitalId, supplier: supplier?.name ?? supplierName, supplier_id: supplier?.id ?? null, manufacturer: manufacturer?.name ?? manufacturerName, manufacturer_id: manufacturer?.id ?? null,
        entry_type: "Return", amount, reference, pharmacy_item_id: fresh.id, medicine_name: fresh.name, quantity: data.quantity, unit_cost: unitCost, reason: data.reason ?? "", created_by: actor.name,
      });
    });
    return { row, newStock };
  });
  await audit(actor, "return", "supplier-credit", result.row.id, { medicine: item.name, quantity: data.quantity, amount, supplier: result.row.supplier });
  const balance = (await creditBalances(actor, { supplier: result.row.supplier })).find((b) => norm(b.manufacturer) === norm(result.row.manufacturer))?.balance ?? 0;
  return { entry: toDto(result.row), stockLeft: result.newStock, balance };
}
