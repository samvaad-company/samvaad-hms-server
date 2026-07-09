/**
 * Inventory service — general (non-pharmacy) hospital supplies. Issuing stock
 * to a department decrements the item's quantity and re-derives its status.
 */
import {
  inventoryItemsRepo,
  inventoryIssuesRepo,
} from "@/server/repositories";
import {
  toInventoryItemDTO,
  toInventoryIssueDTO,
} from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import {
  type InventoryItemRow,
  type InventoryIssueRow,
} from "@/server/db/tables";
import { NotFoundError, ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type InventoryStatus } from "@/types";

export const ITEM_CATEGORIES = [
  "Linen", "Consumables", "Medical Equipment", "PPE", "Surgical Supplies",
  "Furniture", "Stationery", "Uniforms",
] as const;

function deriveStatus(stock: number, minStock: number): InventoryStatus {
  if (stock <= 0) return "Out of Stock";
  if (stock < minStock) return "Low Stock";
  return "In Stock";
}

// ── Items ───────────────────────────────────────────────────────────────────

const itemSchema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  category: { type: "enum", required: true, values: ITEM_CATEGORIES },
  unit: { type: "string", required: false, max: 40, default: "pcs" },
  stock: { type: "number", required: true, min: 0 },
  minStock: { type: "number", required: false, min: 0, default: 10 },
  supplier: { type: "string", required: false, max: 160, default: "" },
} as const;

export const ITEMS_LIST_CONFIG = {
  searchColumns: ["name", "category", "supplier"],
  filterable: ["status", "category"],
  sortable: ["name", "stock", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listItems(options: QueryOptions) {
  return inventoryItemsRepo.list(options);
}

export async function getItem(id: number) {
  const i = await inventoryItemsRepo.get(id);
  if (!i) throw new NotFoundError("Inventory item");
  return i;
}

export async function createItem(input: unknown, actor: Session) {
  const data = validate(itemSchema, input);
  const row = await inventoryItemsRepo.create({
    name: data.name,
    category: data.category,
    unit: data.unit,
    stock: data.stock,
    min_stock: data.minStock,
    supplier: data.supplier,
    status: deriveStatus(data.stock, data.minStock ?? 10),
  });
  await audit(actor, "create", "inventory-item", row.id);
  return toInventoryItemDTO(row as InventoryItemRow);
}

export async function updateItem(id: number, input: unknown, actor: Session) {
  const existing = await inventoryItemsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Inventory item");
  const data = validatePartial(itemSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("category" in data) patch.category = data.category;
  if ("unit" in data) patch.unit = data.unit;
  if ("stock" in data) patch.stock = data.stock;
  if ("minStock" in data) patch.min_stock = data.minStock;
  if ("supplier" in data) patch.supplier = data.supplier;
  const stock = (patch.stock as number) ?? existing.stock;
  const minStock = (patch.min_stock as number) ?? existing.min_stock;
  patch.status = deriveStatus(Number(stock), Number(minStock));
  const row = await inventoryItemsRepo.update(id, patch);
  await audit(actor, "update", "inventory-item", id, patch);
  return toInventoryItemDTO(row as InventoryItemRow);
}

export async function deleteItem(id: number, actor: Session) {
  const ok = await inventoryItemsRepo.remove(id);
  if (!ok) throw new NotFoundError("Inventory item");
  await audit(actor, "delete", "inventory-item", id);
}

/** Top up an item's stock. */
export async function restockItem(id: number, input: unknown, actor: Session) {
  const existing = await inventoryItemsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Inventory item");
  const data = validate(
    { quantity: { type: "number", required: true, min: 1 } } as const,
    input,
  );
  const stock = existing.stock + data.quantity;
  const row = await inventoryItemsRepo.update(id, {
    stock,
    status: deriveStatus(stock, existing.min_stock),
  });
  await audit(actor, "restock", "inventory-item", id, { quantity: data.quantity });
  return toInventoryItemDTO(row as InventoryItemRow);
}

// ── Issues ──────────────────────────────────────────────────────────────────

const issueSchema = {
  itemId: { type: "number", required: true },
  department: { type: "string", required: true, min: 2, max: 120 },
  quantity: { type: "number", required: true, min: 1 },
  issuedTo: { type: "string", required: false, max: 120, default: "" },
  note: { type: "string", required: false, max: 240, default: "" },
} as const;

export const INVENTORY_ISSUES_LIST_CONFIG = {
  searchColumns: ["item_name", "department", "issued_to"],
  filterable: ["department"],
  sortable: ["issue_date", "item_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listIssues(options: QueryOptions) {
  return inventoryIssuesRepo.list(options);
}

export async function createIssue(input: unknown, actor: Session) {
  const data = validate(issueSchema, input);
  const item = await inventoryItemsRepo.getRow(data.itemId);
  if (!item) throw new NotFoundError("Inventory item");
  if (item.stock < data.quantity) {
    throw new ConflictError(
      `Only ${item.stock} ${item.unit} of ${item.name} in stock`,
    );
  }
  const stock = item.stock - data.quantity;
  await inventoryItemsRepo.update(item.id, {
    stock,
    status: deriveStatus(stock, item.min_stock),
  });
  const row = await inventoryIssuesRepo.create({
    item_id: item.id,
    item_name: item.name,
    department: data.department,
    quantity: data.quantity,
    issued_to: data.issuedTo,
    issue_date: displayDate(),
    note: data.note,
  });
  await audit(actor, "issue", "inventory-issue", row.id, {
    itemId: item.id,
    quantity: data.quantity,
  });
  return toInventoryIssueDTO(row as InventoryIssueRow);
}

export async function deleteIssue(id: number, actor: Session) {
  const ok = await inventoryIssuesRepo.remove(id);
  if (!ok) throw new NotFoundError("Inventory issue");
  await audit(actor, "delete", "inventory-issue", id);
}
