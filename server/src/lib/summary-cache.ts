/**
 * Remembers an expensive summary (the dashboard, analytics) for a hospital so it isn't rebuilt from every table on each open.
 * An entry is reused only while nothing has been written in that hospital (every recorded change calls `touchHospital`, from
 * `audit()`) and for at most `MAX_AGE_MS`; people opening the screen at the same moment share one computation.
 */
import { singleFlight } from "@/lib/key-lock";

const MAX_AGE_MS = 30_000;
const versions = new Map<number, number>();
const entries = new Map<string, { version: number; at: number; value: unknown }>();

/** Something changed in this hospital: summaries built before now are out of date. */
export function touchHospital(hospitalId: number | null | undefined): void {
  const id = hospitalId ?? 0;
  versions.set(id, (versions.get(id) ?? 0) + 1);
}

export async function cachedSummary<T>(hospitalId: number, key: string, build: () => Promise<T>): Promise<T> {
  const full = `${hospitalId}|${key}`;
  const version = versions.get(hospitalId) ?? 0;
  const hit = entries.get(full);
  if (hit && hit.version === version && Date.now() - hit.at < MAX_AGE_MS) return hit.value as T;
  const value = await singleFlight(`${full}|v${version}`, build);
  entries.set(full, { version, at: Date.now(), value });
  if (entries.size > 500) for (const [k, e] of entries) if (Date.now() - e.at >= MAX_AGE_MS) entries.delete(k);
  return value;
}
