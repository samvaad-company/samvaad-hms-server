/**
 * Setup: the hospital's masters (service catalogue, rate plans, payers, registration lists, facility), hospital identity
 * and branches. Shared by the server (validation, defaults) and the browser (pickers, previews).
 *
 * Almost everything is stored as one generic record per master entry — `kind` says which master, `data` holds the fields
 * that kind needs — so a new list is a registry entry, not a new table.
 */

export const SETUP_KINDS = [
  "service_group", "service", "rate_plan", "package", "sponsor", "contract", "dual_sponsor_rule",
  "payer_class", "payment_mode", "bank_account", "edc_terminal", "edc_settlement", "payout_rule",
  "patient_category", "visit_purpose", "arrival_status", "income_group", "referral_source",
  "specialty", "org_unit", "id_format", "clinical_form", "protocol",
  "ward_class", "consulting_room", "facility_area", "collection_center", "lab_collection_center", "drug_rack",
  "branch",
] as const;
export type SetupKind = (typeof SETUP_KINDS)[number];

export interface SetupRecordDTO {
  id: number;
  kind: SetupKind;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Singleton configuration blobs (one per hospital): the hospital's identity and the Settings sections. */
export const CONFIG_KEYS = ["hospital", "billing", "notifications", "security", "plan", "referral"] as const;
export type ConfigKey = (typeof CONFIG_KEYS)[number];

// ── Service catalogue ────────────────────────────────────────────────────────

export const BILLING_CATEGORIES = ["Consultation", "Procedure", "Diagnostic", "Laboratory", "IPD charge", "Package", "Other"] as const;
export const SERVICE_UNITS = ["per session", "per day", "per test", "per visit", "per unit", "per hour"] as const;

export const PACKAGE_TYPES = ["Health check", "Multi-visit", "Surgical"] as const;
export const SPONSOR_TYPES = ["Insurer", "TPA", "Corporate / Group", "Government scheme"] as const;
export const RATE_SCOPES = ["general", "package", "tpa"] as const;
export type RateScope = (typeof RATE_SCOPES)[number];

export const PAYMENT_GROUPS = ["Cash", "Cheque", "Dd", "Ecs", "Card", "Upi", "Wallet", "Netbanking"] as const;
export const ACCOUNT_TYPES = ["Current", "Savings", "Overdraft"] as const;

export const PAYOUT_ROLES = ["Consulting", "Surgeon", "Outhouse", "Referred"] as const;
export const REFERRAL_TYPES = ["Referring doctor", "Corporate / organization", "Health camp", "Walk-in / direct", "Online"] as const;

export const ORG_UNIT_TYPES = ["Billing", "Clinical", "Support", "Reporting", "Other"] as const;
export const FACILITY_AREA_TYPES = ["Reception", "Ward", "ICU", "Operation Theatre", "Laboratory", "Radiology", "Pharmacy", "Emergency", "Other"] as const;
export const SERVICE_SCOPES = ["All services", "IPD", "A single service"] as const;

/** The ID formats whose number the HMS issues; the rest can be edited but nothing is numbered by them yet. */
export const LIVE_ID_FORMATS = ["uhid", "invoice", "admission", "ot", "lab_order", "radiology_order", "purchase_order", "mrd_file", "blood_donor", "cssd_cycle", "credit_note"] as const;
export const ID_RESETS = ["Never", "Every FY", "Every year", "Every month"] as const;
export const ID_SCOPES = ["Org-wide", "Per branch"] as const;

export const COPAY_ENDS = ["Primary first", "Proportional split"] as const;

export const COLOUR_CHOICES = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b", "#14b8a6", "#ec4899", "#64748b", "#ef4444"] as const;

export const FORM_FIELD_TYPES = ["Short text", "Long text", "Number", "Date", "Yes / No", "Choice", "Multiple choice", "Section heading"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface ClinicalFormField { id: string; label: string; type: FormFieldType; required: boolean; options: string[] }

// ── ID formats ───────────────────────────────────────────────────────────────

export interface IdFormatOptions {
  prefix?: string;
  /** The number to show; the preview uses 123. */
  seq?: number;
  gender?: "M" | "F" | "O";
  luhn?: boolean;
  /** Financial-year start month, 1–12 (April = 4). */
  fyStartMonth?: number;
  now?: Date;
}

/** Luhn check digit for a string of digits. */
export function luhnDigit(digits: string): string {
  let sum = 0;
  for (let i = digits.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = Number(digits[i]);
    if (Number.isNaN(d)) continue;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Render a mask. Tokens: {PREFIX} {FY} (start year) {FY2} (start year, 2 digits) {FYE} (end year) {FYP2} (26-27)
 * {YYYY} {YY} {MM} {SEQ:n} (zero-padded counter) {GENDER} {CHECK} (Luhn digit over the digits so far).
 */
export function formatIdPreview(mask: string, o: IdFormatOptions = {}): string {
  const now = o.now ?? new Date();
  const month = now.getMonth() + 1;
  const start = o.fyStartMonth ?? 4;
  const fy = month >= start ? now.getFullYear() : now.getFullYear() - 1;
  const fyEnd = start === 1 ? fy : fy + 1;
  const two = (n: number) => String(n % 100).padStart(2, "0");
  let out = mask
    .replace(/\{PREFIX\}/g, o.prefix ?? "")
    .replace(/\{FYP2\}/g, `${two(fy)}-${two(fyEnd)}`)
    .replace(/\{FYE\}/g, String(fyEnd))
    .replace(/\{FY2\}/g, two(fy))
    .replace(/\{FY\}/g, String(fy))
    .replace(/\{YYYY\}/g, String(now.getFullYear()))
    .replace(/\{YY\}/g, two(now.getFullYear()))
    .replace(/\{MM\}/g, String(month).padStart(2, "0"))
    .replace(/\{GENDER\}/g, o.gender ?? "M")
    .replace(/\{SEQ:(\d{1,2})\}/g, (_, n: string) => String(o.seq ?? 123).padStart(Number(n), "0"))
    .replace(/\{SEQ\}/g, String(o.seq ?? 123));
  if (/\{CHECK\}/.test(out) || o.luhn) {
    const digits = out.replace(/\{CHECK\}/g, "").replace(/\D/g, "");
    const check = luhnDigit(digits);
    out = /\{CHECK\}/.test(out) ? out.replace(/\{CHECK\}/g, check) : `${out}${check}`;
  }
  return out;
}

/** Problems with a mask, or null when it is usable. A live series needs a counter, or numbers would repeat. */
export function maskProblem(mask: string): string | null {
  const m = mask.trim();
  if (!m) return "The mask can't be empty";
  if (m.length > 60) return "The mask is too long (60 characters at most)";
  if (!/\{SEQ(:\d{1,2})?\}/.test(m)) return "The mask needs a {SEQ:n} counter, or every number would be the same";
  const unknown = (m.match(/\{[^}]*\}/g) ?? []).filter((t) => !/^\{(PREFIX|FY|FY2|FYE|FYP2|YYYY|YY|MM|GENDER|CHECK|SEQ|SEQ:\d{1,2})\}$/.test(t));
  if (unknown.length) return `Unknown token ${unknown[0]}`;
  return null;
}

/** ₹1,234.00 */
export const inr = (n: number | string | null | undefined): string =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
