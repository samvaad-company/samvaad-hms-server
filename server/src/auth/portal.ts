/**
 * Authentication for the patient portal's server-to-server calls.
 *
 * The portal has its own patient login; it proves itself to the HMS with a
 * shared secret (PORTAL_API_KEY) held only on its server, then tells us which
 * patient it is acting for. The key is compared in constant time, and the
 * routes behind it never hand out more than that one patient's own data.
 */
import { timingSafeEqual } from "node:crypto";
import { type ApiRequest } from "@/http/web";
import { AppError, UnauthorizedError } from "@/lib/errors";

export function requirePortalKey(req: ApiRequest): void {
  const expected = process.env.PORTAL_API_KEY;
  if (!expected) {
    throw new AppError(503, "INTERNAL", "The patient portal integration isn't configured (PORTAL_API_KEY is not set)");
  }
  const given = Buffer.from(req.headers.get("x-portal-key") ?? "", "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length || !timingSafeEqual(given, want)) throw new UnauthorizedError();
}

/** Read the patient id the portal says it is acting for (query string or JSON body field). */
export function portalPatientId(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new AppError(400, "BAD_REQUEST", "patientId is required");
  return n;
}
