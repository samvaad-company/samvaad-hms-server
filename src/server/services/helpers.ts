/**
 * Shared business-logic helpers used across services.
 */
import { type PharmacyStatus } from "@/types";

/** Derive pharmacy stock status from quantities and expiry. */
export function computePharmacyStatus(
  stock: number,
  minStock: number,
  expiryDate: string,
): PharmacyStatus {
  if (isExpired(expiryDate)) return "Expired";
  if (stock <= 0) return "Out of Stock";
  if (stock < minStock) return "Low Stock";
  return "In Stock";
}

/** Best-effort parse of "Mon YYYY" / ISO expiry strings; expired if in past. */
export function isExpired(expiryDate: string): boolean {
  if (!expiryDate) return false;
  const parsed = new Date(`1 ${expiryDate}`);
  const date = Number.isNaN(parsed.getTime())
    ? new Date(expiryDate)
    : parsed;
  if (Number.isNaN(date.getTime())) return false;
  // Treat as end-of-month expiry.
  return date.getTime() < Date.now();
}

const GST_RATE = 0.09; // 9% default (matches seed: ₹500 → ₹45)

/** Compute GST + grand total for a bill line. */
export function computeBillTotals(
  amount: number,
  discount: number,
  type: string,
): { gst: number; total: number } {
  const taxable = Math.max(0, amount - discount);
  // Lab bills in the sample data are GST-exempt.
  const rate = type === "Lab" ? 0 : GST_RATE;
  const gst = Math.round(taxable * rate * 100) / 100;
  const total = Math.round((taxable + gst) * 100) / 100;
  return { gst, total };
}

/**
 * Generate the next sequential code from existing values that share a prefix,
 * e.g. nextCode(["HMS-0001","HMS-0009"], "HMS-", 4) → "HMS-0010".
 */
export function nextCode(
  existing: string[],
  prefix: string,
  padTo: number,
): string {
  let max = 0;
  for (const code of existing) {
    if (!code?.startsWith(prefix)) continue;
    const n = parseInt(code.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(padTo, "0")}`;
}

/** Today's display date, e.g. "8 Nov 2025". */
export function displayDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Current display time, e.g. "11:30 AM". */
export function displayTime(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Compute age in years from a date-of-birth string. */
export function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const diff = Date.now() - birth.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}
