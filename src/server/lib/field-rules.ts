/**
 * Reusable field validators shared across services.
 *
 * Keeping these in one place means a rule such as "an Indian mobile number is
 * exactly 10 digits" is enforced identically wherever a phone number is
 * accepted (patients, staff, donors, ambulance calls, …).
 */

/** Digits only, ignoring spaces, dashes, brackets and a +91 / 0 prefix. */
export function normalizeMobile(raw: string): string {
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/**
 * Indian mobile numbers are exactly 10 digits and start 6-9. Accepts common
 * written forms (+91 98765 43210, 098765-43210) by normalizing first.
 */
export function validateMobile(value: unknown): string | null {
  const digits = normalizeMobile(String(value ?? ""));
  if (digits.length !== 10) {
    return "mobile number must be exactly 10 digits";
  }
  if (!/^[6-9]/.test(digits)) {
    return "mobile number must start with 6, 7, 8 or 9";
  }
  return null;
}

/**
 * A date of birth must be a real date, not in the future, and within a
 * plausible human lifespan.
 */
export function validateDob(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null; // optional; presence is enforced by `required`
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "date of birth is not a valid date";

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d.getTime() > today.getTime()) {
    return "date of birth cannot be in the future";
  }
  const maxAge = new Date();
  maxAge.setFullYear(maxAge.getFullYear() - 120);
  if (d.getTime() < maxAge.getTime()) {
    return "date of birth is too far in the past";
  }
  return null;
}

/** Rejects a date earlier than today — for bookings and scheduling. */
export function validateNotPast(label: string) {
  return (value: unknown): string | null => {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return `${label} is not a valid date`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.getTime() < today.getTime()) return `${label} cannot be in the past`;
    return null;
  };
}

/** Ready-made rules for use inside a validation schema. */
export const mobileRule = {
  type: "string",
  required: true,
  max: 20,
  custom: validateMobile,
} as const;

export const optionalMobileRule = {
  type: "string",
  required: false,
  max: 20,
  custom: validateMobile,
} as const;

export const dobRule = {
  type: "string",
  required: false,
  max: 40,
  custom: validateDob,
} as const;
