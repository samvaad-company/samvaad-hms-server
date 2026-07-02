/**
 * Pharmacy service — inventory CRUD with automatic stock-status derivation
 * and an explicit restock action.
 */
import { pharmacyRepo } from "@/server/repositories";
import { toPharmacyDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type PharmacyItemRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { computePharmacyStatus } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

const schema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  category: { type: "string", required: false, max: 80, default: "" },
  stock: { type: "number", required: true, min: 0 },
  minStock: { type: "number", required: false, min: 0, default: 0 },
  expiryDate: { type: "string", required: false, max: 40, default: "" },
  supplier: { type: "string", required: false, max: 160, default: "" },
} as const;

export const PHARMACY_LIST_CONFIG = {
  searchColumns: ["name", "category", "supplier"],
  filterable: ["status", "category"],
  sortable: ["name", "stock", "expiry_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listPharmacy(options: QueryOptions) {
  return pharmacyRepo.list(options);
}

export async function getPharmacyItem(id: number) {
  const item = await pharmacyRepo.get(id);
  if (!item) throw new NotFoundError("Pharmacy item");
  return item;
}

export async function createPharmacyItem(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const status = computePharmacyStatus(data.stock, data.minStock ?? 0, data.expiryDate ?? "");
  const row = await pharmacyRepo.create({
    name: data.name,
    category: data.category,
    stock: data.stock,
    min_stock: data.minStock,
    expiry_date: data.expiryDate,
    supplier: data.supplier,
    status,
  });
  await audit(actor, "create", "pharmacy", row.id);
  return toPharmacyDTO(row as PharmacyItemRow);
}

export async function updatePharmacyItem(id: number, input: unknown, actor: Session) {
  const existing = await pharmacyRepo.getRow(id);
  if (!existing) throw new NotFoundError("Pharmacy item");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("category" in data) patch.category = data.category;
  if ("stock" in data) patch.stock = data.stock;
  if ("minStock" in data) patch.min_stock = data.minStock;
  if ("expiryDate" in data) patch.expiry_date = data.expiryDate;
  if ("supplier" in data) patch.supplier = data.supplier;

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
  if (!existing) throw new NotFoundError("Pharmacy item");
  const newStock = Math.max(0, existing.stock + Math.round(quantity));
  const row = await pharmacyRepo.update(id, {
    stock: newStock,
    status: computePharmacyStatus(newStock, existing.min_stock, existing.expiry_date),
  });
  await audit(actor, "restock", "pharmacy", id, { quantity, newStock });
  return toPharmacyDTO(row as PharmacyItemRow);
}

export async function deletePharmacyItem(id: number, actor: Session) {
  const ok = await pharmacyRepo.remove(id);
  if (!ok) throw new NotFoundError("Pharmacy item");
  await audit(actor, "delete", "pharmacy", id);
}
