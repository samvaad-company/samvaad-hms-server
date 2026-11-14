/**
 * Pharmacy service — inventory CRUD with automatic stock-status derivation
 * and an explicit restock action.
 */
import { pharmacyRepo } from "@/repositories";
import { findParty } from "@/services/pharmacy-parties-service";
import { medicinePricesByName } from "@/services/admin-service";
import { toPharmacyDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type PharmacyItemRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { computePharmacyStatus } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const schema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  category: { type: "string", required: false, max: 80, default: "" },
  stock: { type: "number", required: true, min: 0 },
  minStock: { type: "number", required: false, min: 0, default: 0 },
  expiryDate: { type: "string", required: false, max: 40, default: "" },
  supplier: { type: "string", required: false, max: 160, default: "" },
  manufacturer: { type: "string", required: false, max: 160, default: "" },
  hsn: { type: "string", required: false, max: 8, pattern: /^\d{4,8}$/ },
  isH1: { type: "boolean", required: false },
} as const;

/** The Masters records a manufacturer / supplier name on an item points at (so renaming them there follows). */
async function partyFields(data: { supplier?: string; manufacturer?: string }, actor: Session): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (data.supplier !== undefined) { const s = data.supplier ? await findParty("supplier", { name: data.supplier }, actor) : null; out.supplier = s?.name ?? data.supplier; out.supplier_id = s?.id ?? null; }
  if (data.manufacturer !== undefined) { const m = data.manufacturer ? await findParty("manufacturer", { name: data.manufacturer }, actor) : null; out.manufacturer = m?.name ?? data.manufacturer; out.manufacturer_id = m?.id ?? null; }
  return out;
}

export const PHARMACY_LIST_CONFIG = {
  searchColumns: ["name", "category", "supplier", "manufacturer"],
  filterable: ["status", "category", "is_h1"],
  sortable: ["name", "stock", "expiry_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/**
 * The price shown for a stock item: the price set in Setup → Masters → Medicines when there is one, else the price remembered
 * from dispensing, else the printed MRP of the medicine of the same name.
 */
export async function listPharmacy(options: QueryOptions, actor: Session) {
  const res = await pharmacyRepo.list(scopeToHospital(options, actor));
  const names = [...new Set(res.rows.map((r) => r.name))];
  if (names.length === 0 || names.length > 500) return res;
  const prices = await medicinePricesByName(names, actor);
  return { ...res, rows: res.rows.map((r) => ({ ...r, unitPrice: Number(prices.get(r.name.toLowerCase()) ?? r.unitPrice ?? 0) || 0 })) };
}

export async function getPharmacyItem(id: number, actor: Session) {
  const row = await pharmacyRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Pharmacy item");
  return toPharmacyDTO(row);
}

export async function createPharmacyItem(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const status = computePharmacyStatus(data.stock, data.minStock ?? 0, data.expiryDate ?? "");
  const row = await pharmacyRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    category: data.category,
    stock: data.stock,
    min_stock: data.minStock,
    expiry_date: data.expiryDate,
    status,
    hsn: data.hsn ?? "",
    is_h1: data.isH1 === true,
    ...(await partyFields(data, actor)),
  });
  await audit(actor, "create", "pharmacy", row.id);
  return toPharmacyDTO(row as PharmacyItemRow);
}

export async function updatePharmacyItem(id: number, input: unknown, actor: Session) {
  const existing = await pharmacyRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Pharmacy item");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("category" in data) patch.category = data.category;
  if ("stock" in data) patch.stock = data.stock;
  if ("minStock" in data) patch.min_stock = data.minStock;
  if ("expiryDate" in data) patch.expiry_date = data.expiryDate;
  if ("hsn" in data) patch.hsn = data.hsn ?? "";
  if (typeof input === "object" && input !== null && "hsn" in input && ((input as { hsn?: unknown }).hsn === "" || (input as { hsn?: unknown }).hsn === null)) patch.hsn = ""; // clearing the HSN
  if ("isH1" in data) patch.is_h1 = data.isH1 === true;
  Object.assign(patch, await partyFields(data, actor));

  const stock = (patch.stock as number) ?? existing.stock;
  const minStock = (patch.min_stock as number) ?? existing.min_stock;
  const expiry = (patch.expiry_date as string) ?? existing.expiry_date;
  patch.status = computePharmacyStatus(stock, minStock, expiry);

  const row = await pharmacyRepo.update(id, patch);
  await audit(actor, "update", "pharmacy", id, patch);
  return toPharmacyDTO(row as PharmacyItemRow);
}

/** Add quantity to an item's stock and recompute its status. */
export async function restockItem(id: number, quantity: number, actor: Session) {
  const existing = await pharmacyRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Pharmacy item");
  const newStock = Math.max(0, existing.stock + Math.round(quantity));
  const row = await pharmacyRepo.update(id, {
    stock: newStock,
    status: computePharmacyStatus(newStock, existing.min_stock, existing.expiry_date),
  });
  await audit(actor, "restock", "pharmacy", id, { quantity, newStock });
  return toPharmacyDTO(row as PharmacyItemRow);
}

export async function deletePharmacyItem(id: number, actor: Session) {
  const existing = await pharmacyRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Pharmacy item");
  await pharmacyRepo.remove(id);
  await audit(actor, "delete", "pharmacy", id);
}
