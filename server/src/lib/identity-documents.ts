/**
 * Identity documents captured at registration (Aadhaar, PAN, …).
 *
 * The full number is never stored: only the last four characters (so staff can recognise it)
 * and a keyed fingerprint (so the same document can't be registered twice). Aadhaar numbers are
 * checked with the Verhoeff checksum, not just their length.
 */
import { createHmac } from "node:crypto";
import { getConfig } from "@/config/env";
import { BadRequestError } from "@/lib/errors";

export const IDENTITY_TYPES = ["Aadhaar", "PAN", "Passport", "Voter ID", "Driving licence", "Other"] as const;
export type IdentityType = (typeof IDENTITY_TYPES)[number];

// Verhoeff tables (dihedral group D5).
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** True when the digit string (check digit included) passes the Verhoeff checksum. */
export function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

/** The check digit to append to `digits` so the whole number passes the checksum (used by tests and tools). */
export function verhoeffCheckDigit(digits: string): number {
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[(i + 1) % 8][Number(rev[i])]];
  return INV[c];
}

const normalize = (type: IdentityType, raw: string) =>
  type === "Aadhaar" ? raw.replace(/\D/g, "") : raw.replace(/[\s-]/g, "").toUpperCase();

/** An error message, or null when the number is acceptable for that document type. */
export function validateIdentityNumber(type: IdentityType, raw: string): string | null {
  const n = normalize(type, raw);
  switch (type) {
    case "Aadhaar":
      if (n.length !== 12) return "Aadhaar number must be exactly 12 digits";
      if (!/^[2-9]/.test(n)) return "Aadhaar number cannot start with 0 or 1";
      if (!verhoeffValid(n)) return "That Aadhaar number isn't valid — please check the digits";
      return null;
    case "PAN":
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(n) ? null : "PAN must look like ABCDE1234F";
    case "Passport":
      return /^[A-Z]\d{7}$/.test(n) ? null : "Passport number must be a letter followed by 7 digits";
    case "Voter ID":
      return /^[A-Z]{3}\d{7}$/.test(n) ? null : "Voter ID must be 3 letters followed by 7 digits";
    default:
      return /^[A-Z0-9/]{6,20}$/.test(n) ? null : "Enter the document number (6–20 letters or digits)";
  }
}

export interface StoredIdentityDocument {
  type: IdentityType;
  /** Last four characters of the number. */
  last4: string;
  /** Keyed hash of the whole number — identifies duplicates without revealing it. */
  fingerprint: string;
}

const fingerprintOf = (type: IdentityType, normalized: string) =>
  createHmac("sha256", process.env.ID_FINGERPRINT_SECRET || getConfig().sessionSecret).update(`${type}:${normalized}`).digest("hex");

/** Validate a submitted list and reduce each entry to what may be stored. Blank numbers are skipped. */
export function toStoredDocuments(input: unknown): StoredIdentityDocument[] {
  if (input == null || input === "") return [];
  if (!Array.isArray(input)) throw new BadRequestError("identityDocuments must be a list");
  const out: StoredIdentityDocument[] = [];
  for (const item of input) {
    const { type, number } = (item ?? {}) as { type?: string; number?: string };
    if (!number || !String(number).trim()) continue;
    if (!IDENTITY_TYPES.includes(type as IdentityType)) throw new BadRequestError(`Unknown document type "${type}"`);
    const t = type as IdentityType;
    const err = validateIdentityNumber(t, String(number));
    if (err) throw new BadRequestError(err);
    const n = normalize(t, String(number));
    const fingerprint = fingerprintOf(t, n);
    if (!out.some((d) => d.fingerprint === fingerprint)) out.push({ type: t, last4: n.slice(-4), fingerprint });
  }
  return out;
}
