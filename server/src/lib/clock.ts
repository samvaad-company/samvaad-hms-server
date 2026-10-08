/**
 * Wall-clock helpers in the hospital's timezone. Appointment dates are
 * "YYYY-MM-DD", times are "h:mm AM/PM" (or 24-hour "HH:mm"), and "today" and
 * "now" mean the hospital's, not the server's (serverless hosts run in UTC).
 */
export const TZ = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function localDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function localMinutes(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** "4:30 PM" or "16:30" → minutes after midnight; null if neither. */
export function parseClock(t: string): number | null {
  if (typeof t !== "string") return null;
  const s = t.trim();
  const twelve = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s);
  if (twelve) {
    let h = Number(twelve[1]) % 12;
    if (twelve[3].toUpperCase() === "PM") h += 12;
    return h * 60 + Number(twelve[2]);
  }
  const twentyFour = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  return twentyFour ? Number(twentyFour[1]) * 60 + Number(twentyFour[2]) : null;
}

export function to12h(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** Minutes → "HH:mm". */
export function hhmm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The weekday name of a "YYYY-MM-DD" date (treated as a plain calendar date, never shifted by timezone). */
export function dayNameOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** The instant a wall-clock time on `date` happens in the hospital's timezone. */
export function zonedInstant(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0) + minutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess.getTime() - (asUtc - Math.floor(guess.getTime() / 1000) * 1000));
}
