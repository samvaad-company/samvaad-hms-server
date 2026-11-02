/**
 * Slows password guessing: too many wrong passwords for one email address (or from one address) locks sign-in for
 * that key for a while. Counted in this process's memory, which is enough for a single API server; a clustered
 * deployment would keep the counters in the shared store instead. A successful sign-in clears the email's count.
 * Unknown emails are counted the same way, so the lock doesn't reveal which accounts exist.
 */
import { RateLimitedError } from "@/lib/errors";

interface Bucket { fails: number; first: number; lockedUntil: number }

const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_PER_EMAIL = 5;
const MAX_PER_IP = 50;
const buckets = new Map<string, Bucket>();

function live(key: string, now: number): Bucket | undefined {
  const b = buckets.get(key);
  if (b && b.lockedUntil <= now && now - b.first > WINDOW_MS) { buckets.delete(key); return undefined; }
  return b;
}

/** Throws (429) while the email or the address is locked out. */
export function assertNotLocked(email: string, ip: string, now = Date.now()): void {
  for (const key of [`e:${email}`, `i:${ip}`]) {
    const b = live(key, now);
    if (b && b.lockedUntil > now) {
      const minutes = Math.ceil((b.lockedUntil - now) / 60_000);
      throw new RateLimitedError(`Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, { retryAfterSeconds: Math.ceil((b.lockedUntil - now) / 1000) });
    }
  }
}

export function recordFailure(email: string, ip: string, now = Date.now()): void {
  for (const [key, max] of [[`e:${email}`, MAX_PER_EMAIL], [`i:${ip}`, MAX_PER_IP]] as const) {
    const b = live(key, now) ?? { fails: 0, first: now, lockedUntil: 0 };
    b.fails++;
    if (b.fails >= max) b.lockedUntil = now + LOCK_MS;
    buckets.set(key, b);
  }
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.lockedUntil <= now && now - b.first > WINDOW_MS) buckets.delete(k);
}

export function recordSuccess(email: string): void {
  buckets.delete(`e:${email}`);
}

/** The caller's address as the reverse proxy reports it (the API sits behind one in production). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") ?? "local").trim() || "local";
}
