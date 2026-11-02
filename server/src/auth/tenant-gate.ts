/**
 * Whether a hospital's tenant is still open. Sessions are signed tokens that stay valid until they expire, so a hospital
 * a platform admin pauses or removes would otherwise keep working for everyone already signed in. The answer is kept for a
 * few seconds (one read per hospital, not one per request) and dropped right away when the status is changed in this process.
 */
const TTL_MS = 10_000;
const cache = new Map<number, { open: boolean; at: number }>();

export async function hospitalIsOpen(hospitalId: number, now = Date.now()): Promise<boolean> {
  const hit = cache.get(hospitalId);
  if (hit && now - hit.at < TTL_MS) return hit.open;
  const { hospitalsRepo } = await import("@/repositories");
  const row = await hospitalsRepo.getRow(hospitalId).catch(() => null);
  const open = !row || row.status === "Active";
  cache.set(hospitalId, { open, at: now });
  return open;
}

export function forgetHospitalStatus(hospitalId: number): void {
  cache.delete(hospitalId);
}
