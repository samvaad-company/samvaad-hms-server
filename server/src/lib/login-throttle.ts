/**
 * Slows password guessing: too many wrong passwords for one email address (or from one address) locks sign-in for that key
 * until the current 15-minute window ends. Unknown emails are counted the same way, so the lock doesn't reveal which accounts
 * exist, and a good sign-in clears the email's count.
 *
 * The counts live in the database when the driver keeps shared counters (MongoDB, with the windows expiring on their own), so
 * every API process sees the same lock; otherwise they are kept in this process's memory, which is right for one server only.
 */
import { getDb } from "@/db";
import { RateLimitedError } from "@/lib/errors";

const WINDOW_MS = 15 * 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 50;

// ── Per-process fallback ──
const local = new Map<string, { n: number; expires: number }>();
const localHit = (key: string, now: number): number => {
  const bucket = Math.floor(now / WINDOW_MS);
  const id = `${key}|${bucket}`;
  const h = local.get(id) ?? { n: 0, expires: (bucket + 1) * WINDOW_MS };
  h.n++;
  local.set(id, h);
  if (local.size > 10_000) for (const [k, v] of local) if (v.expires <= now) local.delete(k);
  return h.n;
};
const localPeek = (key: string, now: number): number => local.get(`${key}|${Math.floor(now / WINDOW_MS)}`)?.n ?? 0;

const emailKey = (email: string) => `login:e:${email}`;
const ipKey = (ip: string) => `login:i:${ip}`;

/** Throws (429) while the email or the address is locked out. */
export async function assertNotLocked(email: string, ip: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  const peek = (key: string) => (db.peekHits ? db.peekHits(key, WINDOW_MS) : Promise.resolve(localPeek(key, now)));
  const [byEmail, byIp] = await Promise.all([peek(emailKey(email)), peek(ipKey(ip))]);
  if (byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP) {
    const seconds = Math.max(1, Math.ceil((WINDOW_MS - (now % WINDOW_MS)) / 1000));
    const minutes = Math.ceil(seconds / 60);
    throw new RateLimitedError(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { retryAfterSeconds: seconds });
  }
}

export async function recordFailure(email: string, ip: string, now = Date.now()): Promise<void> {
  const db = await getDb();
  const hit = (key: string) => (db.countHit ? db.countHit(key, WINDOW_MS) : Promise.resolve(localHit(key, now)));
  await Promise.all([hit(emailKey(email)), hit(ipKey(ip))]);
}

export async function recordSuccess(email: string): Promise<void> {
  const db = await getDb();
  if (db.clearHits) await db.clearHits(emailKey(email));
  else for (const k of local.keys()) if (k.startsWith(`${emailKey(email)}|`)) local.delete(k);
}

/** The caller's address as the reverse proxy reports it (the API sits behind one in production). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "local").trim() || "local";
}
