/**
 * Sequence numbers (patient codes, invoice numbers, tokens…) that never repeat, even with several API processes.
 *
 * With a driver that keeps sequences in the database (MongoDB, the in-memory store) every value comes from one atomic
 * update there. The first time a series is used after this process starts, the existing records are scanned once for their
 * highest number and the stored counter is lifted to it if it is behind — never lowered — so counters created by older
 * versions, imports and seeds are caught up. Without such a driver (Supabase today) the counter is kept in this process, which
 * is right for one server only.
 */
import { getDb } from "@/db";
import { singleFlight } from "@/lib/key-lock";

const seeded = new Set<string>();
const local = new Map<string, number>();

export interface Allocation {
  /** The sequence value handed out. */
  value: number;
  /** Give the value back if nothing else has been handed out since (so a save that failed leaves no gap). */
  release: () => Promise<void>;
}

/** `scan` returns the highest value already in use by existing records (0 if none); it is called at most once per series per process. */
export async function allocateSequence(key: string, scan: () => Promise<number>): Promise<Allocation> {
  const db = await getDb();
  if (db.nextSequence) {
    const floor = seeded.has(key) ? 0 : await singleFlight(`seed:${key}`, scan);
    const value = await db.nextSequence(key, floor);
    seeded.add(key);
    return { value, release: async () => { await db.releaseSequence?.(key, value); } };
  }
  const base = local.get(key) ?? (await singleFlight(`seed:${key}`, scan));
  // Synchronous from here: two requests in this process can't be handed the same value.
  const value = Math.max(local.get(key) ?? 0, base) + 1;
  local.set(key, value);
  return { value, release: async () => { if (local.get(key) === value) local.set(key, value - 1); } };
}

/** Forget what this process knows (tests that start from fresh data). */
export function resetSequenceMemory(): void {
  seeded.clear();
  local.clear();
}
