/**
 * Batches for the places that don't dispense: the Billing screen and counter sales. A medicine line takes the batch the cashier chose,
 * or by default the earliest-expiring batch that is still in date. A counter sale also takes its units from that batch (then the next
 * to expire), so the batches keep adding up to the item's stock.
 */
import { type PharmacyItemRow } from "@/db/tables";
import { ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { type Session } from "@/auth/session";
import { requireHospitalId } from "@/services/hospital-scope";
import { syncBatches, usable } from "@/services/dispense-service";
import type { PharmacyBatchDTO } from "@shared/types/api";

const lockKey = (actor: Session, itemId: number) => `pharmacy-stock:${requireHospitalId(actor)}:${itemId}`;

/** The batches of one item that still hold stock, earliest expiry first (an expired one is flagged and never picked by default). */
export async function itemBatches(item: PharmacyItemRow, actor: Session): Promise<PharmacyBatchDTO[]> {
  const today = localDate();
  const rows = await withKeyLocks([lockKey(actor, item.id)], () => syncBatches(item, actor));
  const live = rows.filter((b) => Number(b.quantity) > 0).sort((a, b) => (a.expiry_date || "9999").localeCompare(b.expiry_date || "9999") || a.id - b.id);
  return live.map((b) => ({ id: b.id, batchNo: b.batch_no, expiryDate: b.expiry_date ?? "", quantity: Number(b.quantity), expired: Boolean(b.expiry_date) && b.expiry_date < today }));
}

export interface BatchTake { batchId: number; take: number; left: number }

/**
 * Which batch(es) `qty` units come from: the wanted batch first (when given), then the earliest to expire. `used` carries what earlier
 * lines of the same sale already took. `label` is the batch number(s) to print; `takes` is what to subtract from each batch.
 */
export async function allocateBatches(item: PharmacyItemRow, qty: number, wanted: string, actor: Session, used: Map<number, number> = new Map()): Promise<{ label: string; takes: BatchTake[] }> {
  const today = localDate();
  const rows = await withKeyLocks([lockKey(actor, item.id)], () => syncBatches(item, actor));
  const pool = usable(rows, today).map((b) => ({ b, free: Number(b.quantity) - (used.get(b.id) ?? 0) })).filter((x) => x.free > 0);
  const want = wanted.trim();
  if (want) {
    const at = pool.findIndex((x) => x.b.batch_no === want);
    if (at < 0) throw new ValidationError([{ field: "batchNo", message: `batch ${want} of ${item.name} isn't in stock or is out of date` }]);
    pool.unshift(...pool.splice(at, 1));
  }
  const takes: BatchTake[] = [];
  let need = qty;
  for (const x of pool) {
    if (need <= 0) break;
    const take = Math.min(need, x.free);
    takes.push({ batchId: x.b.id, take, left: x.free - take });
    need -= take;
  }
  for (const t of takes) used.set(t.batchId, (used.get(t.batchId) ?? 0) + t.take);
  const names = takes.map((t) => pool.find((x) => x.b.id === t.batchId)!.b.batch_no);
  return { label: names.length ? names.join(", ") : (pool[0]?.b.batch_no ?? ""), takes };
}

/** For a bill line, which does not move stock: the chosen batch, or the earliest-expiring one in date. */
export async function pickBatchLabel(item: PharmacyItemRow, wanted: string, actor: Session): Promise<string> {
  return (await allocateBatches(item, 1, wanted, actor)).label;
}
