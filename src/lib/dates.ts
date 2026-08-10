/**
 * Date helpers.
 *
 * Dates are STORED as ISO "yyyy-mm-dd" so they sort chronologically and compare
 * exactly, and FORMATTED for display ("8 Nov 2025") only at render time.
 * Legacy display-string values are still parsed so old rows keep working.
 */

export type DateRangeId = "all" | "today" | "7d" | "30d" | "90d";

export const DATE_RANGES: { id: DateRangeId; label: string }[] = [
  { id: "all",   label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d",    label: "Last 7 days" },
  { id: "30d",   label: "Last 30 days" },
  { id: "90d",   label: "Last 90 days" },
];

/** Parse "8 Nov 2025" / ISO-ish strings; null when unparseable. */
export function parseDisplayDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse "Mar 2027" (month-year) as the END of that month; null on failure. */
export function parseMonthYear(value: string | null | undefined): Date | null {
  if (!value) return null;
  const start = new Date(`1 ${value}`);
  if (Number.isNaN(start.getTime())) return parseDisplayDate(value);
  // End of month = day 0 of the next month.
  return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
}

/**
 * True when `dateStr` falls inside the selected range (ending today).
 * Unparseable dates are kept so bad data never silently disappears.
 */
export function inDateRange(dateStr: string, range: DateRangeId): boolean {
  if (range === "all") return true;
  const d = parseDisplayDate(dateStr);
  if (!d) return true;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  if (range === "today") return d >= startOfToday && d <= endOfToday;

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const start = new Date(startOfToday);
  start.setDate(start.getDate() - days);
  return d >= start && d <= endOfToday;
}


const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * Normalize any supported input to ISO "yyyy-mm-dd".
 * Accepts ISO, "8 Nov 2025", and Date. Returns "" when unparseable.
 */
export function toIsoDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : localIso(value);
  }
  const raw = String(value).trim();
  const already = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (already) return already[1];
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : localIso(d);
}

/** yyyy-mm-dd in local time (avoids the UTC day-shift of toISOString). */
function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO (or legacy) date → "8 Nov 2025" for display. Empty input renders "—". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (iso) {
    const [, y, m, d] = iso;
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  }
  return String(value); // already display-formatted or free text
}

/** True when `value` is strictly before today (local). */
export function isPastDate(value: string | null | undefined): boolean {
  const iso = toIsoDate(value ?? "");
  if (!iso) return false;
  return iso < localIso(new Date());
}

/** Today as ISO — handy as a `min` for date inputs. */
export function todayIso(): string {
  return localIso(new Date());
}
