/**
 * Client-side form validators. Mirrors the rules enforced server-side in
 * `@/server/lib/field-rules` so invalid input is caught inline before the
 * API round-trip rejects it — kept as a separate, client-safe copy since
 * pages under `src/app` shouldn't pull in `@/server/*`.
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
