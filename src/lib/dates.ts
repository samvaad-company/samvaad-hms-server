/**
 * Client-side date helpers for filtering display-formatted dates.
 * Row dates are stored as strings like "8 Nov 2025"; expiries like "Mar 2027".
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
