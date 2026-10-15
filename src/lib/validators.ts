/**
 * Client-side form validators. Mirrors the rules enforced server-side in
 * `server/src/lib/field-rules` so invalid input is caught inline before the
 * API round-trip rejects it — kept as a separate, client-safe copy since
 * pages under `src/app` shouldn't pull in server code.
 */

/** Digits only, ignoring spaces, dashes, brackets and a +91 / 0 prefix. */
export function normalizeMobile(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** Indian mobile numbers are exactly 10 digits and start 6-9. */
export function validateMobile(value: string): string | null {
  if (!value.trim()) return null;
  const digits = normalizeMobile(value);
  if (digits.length !== 10) return "Enter a valid 10-digit mobile number";
  if (!/^[6-9]/.test(digits)) return "Mobile number must start with 6, 7, 8 or 9";
  return null;
}

/** A date of birth must be a real date, not in the future, and within a plausible lifespan. */
export function validateDob(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "Enter a valid date";

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d.getTime() > today.getTime()) return "Date of birth cannot be in the future";

  const maxAge = new Date();
  maxAge.setFullYear(maxAge.getFullYear() - 120);
  if (d.getTime() < maxAge.getTime()) return "Date of birth is too far in the past";

  return null;
}

/** Digits only, ignoring spaces and dashes. */
export function normalizeAadhaar(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Aadhaar numbers are exactly 12 digits and never start with 0 or 1. Optional — blank passes. */
export function validateAadhaar(value: string): string | null {
  if (!value.trim()) return null;
  const digits = normalizeAadhaar(value);
  if (digits.length !== 12) return "Aadhaar number must be exactly 12 digits";
  if (!/^[2-9]/.test(digits)) return "Aadhaar number cannot start with 0 or 1";
  return null;
}

/** Today as an ISO "yyyy-mm-dd" string, for a date input's `max` attribute. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Identity documents ────────────────────────────────────────────────────────

export const IDENTITY_TYPES = ["Aadhaar", "PAN", "Passport", "Voter ID", "Driving licence", "Other"] as const;
export type IdentityType = (typeof IDENTITY_TYPES)[number];

const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff checksum, as used by Aadhaar (the same check the server runs). */
function verhoeffValid(digits: string): boolean {
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = V_D[c][V_P[i % 8][Number(rev[i])]];
  return c === 0;
}

/** Error text for an identity number, or null when it is acceptable. Blank passes (it is optional). */
export function validateIdentityNumber(type: IdentityType, value: string): string | null {
  if (!value.trim()) return null;
  if (type === "Aadhaar") {
    const n = normalizeAadhaar(value);
    if (n.length !== 12) return "Aadhaar number must be exactly 12 digits";
    if (!/^[2-9]/.test(n)) return "Aadhaar number cannot start with 0 or 1";
    if (!verhoeffValid(n)) return "That Aadhaar number isn't valid — check the digits";
    return null;
  }
  const n = value.replace(/[\s-]/g, "").toUpperCase();
  switch (type) {
    case "PAN": return /^[A-Z]{5}\d{4}[A-Z]$/.test(n) ? null : "PAN must look like ABCDE1234F";
    case "Passport": return /^[A-Z]\d{7}$/.test(n) ? null : "Passport number is a letter followed by 7 digits";
    case "Voter ID": return /^[A-Z]{3}\d{7}$/.test(n) ? null : "Voter ID is 3 letters followed by 7 digits";
    default: return /^[A-Z0-9/]{6,20}$/.test(n) ? null : "Enter the document number (6–20 letters or digits)";
  }
}
