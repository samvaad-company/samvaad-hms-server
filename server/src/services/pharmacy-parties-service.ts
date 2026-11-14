/**
 * Manufacturers and suppliers: the two Setup → Masters lists the pharmacy picks from. A medicine, a purchase bill and the supplier
 * credit history all name a manufacturer and/or a supplier, by name (so they read well) and by master id (so they follow the master).
 * Renaming one in Masters updates all of those; one that is in use can't be deleted.
 */
import { pharmacyRepo, purchaseOrdersRepo, purchaseOrderItemsRepo, setupRecordsRepo, supplierCreditsRepo } from "@/repositories";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";

export type PartyKind = "manufacturer" | "supplier";
export const isPartyKind = (k: string): k is PartyKind => k === "manufacturer" || k === "supplier";

export interface Party { id: number; name: string }

/** The master record a name (or id) points at, if there is one. */
export async function findParty(kind: PartyKind, ref: { id?: unknown; name?: unknown }, actor: Session): Promise<Party | null> {
  const { rows } = await setupRecordsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "kind", op: "eq", value: kind }] }, actor));
  const id = ref.id === undefined || ref.id === null || ref.id === "" ? null : Number(ref.id);
  const name = typeof ref.name === "string" ? ref.name.trim().toLowerCase() : "";
  const hit = rows.find((r) => (id !== null && r.id === id) || (name !== "" && String(r.name).trim().toLowerCase() === name));
  return hit ? { id: hit.id, name: hit.name } : null;
}

const same = (a: unknown, b: unknown) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

interface Usage { items: number; billLines: number; bills: number; credits: number }

async function usage(kind: PartyKind, id: number, name: string, actor: Session): Promise<{ u: Usage; itemIds: number[]; lineIds: number[]; billIds: number[]; creditIds: number[] }> {
  const idCol = kind === "manufacturer" ? "manufacturer_id" : "supplier_id";
  const { rows: items } = await pharmacyRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const itemIds = items.filter((i) => (i as unknown as Record<string, unknown>)[idCol] === id || same((i as unknown as Record<string, unknown>)[kind], name)).map((i) => i.id);

  const { rows: pos } = await purchaseOrdersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const poIds = new Set(pos.map((p) => p.id));
  let lineIds: number[] = [];
  let billIds: number[] = [];
  if (kind === "manufacturer") {
    const { rows: lines } = await purchaseOrderItemsRepo.listRows({ unpaged: true });
    lineIds = lines.filter((l) => poIds.has(l.purchase_order_id) && (l.manufacturer_id === id || same(l.manufacturer, name))).map((l) => l.id);
  } else {
    billIds = pos.filter((p) => p.supplier_id === id || same(p.supplier, name)).map((p) => p.id);
  }
  const { rows: credits } = await supplierCreditsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const creditIds = credits.filter((c) => (kind === "manufacturer" ? c.manufacturer_id === id || same(c.manufacturer, name) : c.supplier_id === id || same(c.supplier, name))).map((c) => c.id);
  return { u: { items: itemIds.length, billLines: lineIds.length, bills: billIds.length, credits: creditIds.length }, itemIds, lineIds, billIds, creditIds };
}

/** What still points at this manufacturer / supplier, as a sentence for the "can't delete" message; "" when nothing does. */
export async function partyInUse(kind: PartyKind, id: number, name: string, actor: Session): Promise<string> {
  const { u } = await usage(kind, id, name, actor);
  const parts: string[] = [];
  if (u.items) parts.push(`${u.items} medicine${u.items === 1 ? "" : "s"} in the inventory`);
  if (u.billLines) parts.push(`${u.billLines} purchase bill line${u.billLines === 1 ? "" : "s"}`);
  if (u.bills) parts.push(`${u.bills} purchase bill${u.bills === 1 ? "" : "s"}`);
  if (u.credits) parts.push(`${u.credits} supplier credit entr${u.credits === 1 ? "y" : "ies"}`);
  return parts.join(", ");
}

/** A master was renamed: everything that carries its name follows. */
export async function renameParty(kind: PartyKind, id: number, oldName: string, newName: string, actor: Session): Promise<void> {
  if (oldName === newName) return;
  const { itemIds, lineIds, billIds, creditIds } = await usage(kind, id, oldName, actor);
  for (const itemId of itemIds) await pharmacyRepo.update(itemId, kind === "manufacturer" ? { manufacturer: newName, manufacturer_id: id } : { supplier: newName, supplier_id: id } as never);
  for (const lineId of lineIds) await purchaseOrderItemsRepo.update(lineId, { manufacturer: newName, manufacturer_id: id } as never);
  for (const poId of billIds) await purchaseOrdersRepo.update(poId, { supplier: newName, supplier_id: id } as never);
  for (const cid of creditIds) await supplierCreditsRepo.update(cid, (kind === "manufacturer" ? { manufacturer: newName, manufacturer_id: id } : { supplier: newName, supplier_id: id }) as never);
}

/** The medicines in the inventory made by this manufacturer (for Setup → Masters → Manufacturers). */
export async function manufacturerMedicines(id: number, actor: Session) {
  const m = await findParty("manufacturer", { id }, actor);
  if (!m) return [];
  const { rows } = await pharmacyRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor));
  return rows.filter((i) => i.manufacturer_id === id || same(i.manufacturer, m.name)).map((i) => ({ id: i.id, name: i.name, category: i.category, stock: i.stock, supplier: i.supplier }));
}

/** Move a medicine to another manufacturer (or none): the "change it from the master panel" action. */
export async function setItemManufacturer(itemId: number, manufacturerId: number | null, actor: Session) {
  const item = await pharmacyRepo.getRow(itemId);
  if (!item || item.hospital_id !== actor.hospitalId) return null;
  if (manufacturerId === null) return pharmacyRepo.update(itemId, { manufacturer: "", manufacturer_id: null } as never);
  const m = await findParty("manufacturer", { id: manufacturerId }, actor);
  if (!m) return undefined;
  return pharmacyRepo.update(itemId, { manufacturer: m.name, manufacturer_id: m.id } as never);
}
