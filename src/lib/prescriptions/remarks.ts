/**
 * How a medicine is taken, written the way patients read it. The pattern "1-0-1" is the morning, afternoon and night dose
 * (1 = take it, 0 = skip it), so 1-0-1 means morning and night. A fourth number is the evening (snacks) dose: 1-1-1-1.
 */

export type Timing = "" | "Before Meal" | "After Meal" | "With Meal" | "Empty Stomach";
export const TIMINGS: Timing[] = ["", "Before Meal", "After Meal", "With Meal", "Empty Stomach"];

/** Quick choices for the pattern box. */
export const PATTERN_PRESETS: { value: string; label: string }[] = [
  { value: "1-0-0", label: "1-0-0 · morning" },
  { value: "0-1-0", label: "0-1-0 · afternoon" },
  { value: "0-0-1", label: "0-0-1 · night" },
  { value: "1-0-1", label: "1-0-1 · morning & night" },
  { value: "1-1-0", label: "1-1-0 · morning & afternoon" },
  { value: "0-1-1", label: "0-1-1 · afternoon & night" },
  { value: "1-1-1", label: "1-1-1 · morning, afternoon & night" },
  { value: "1-1-1-1", label: "1-1-1-1 · four times a day" },
];

/** Older prescriptions and the medicine list use OD / BD / TDS; this turns them into the pattern. */
export function toPattern(freq: string | null | undefined): string {
  const f = (freq ?? "").trim();
  if (/^\d(\.\d)?(-\d(\.\d)?){2,3}$/.test(f)) return f;
  const l = f.toLowerCase();
  if (!l) return "";
  if (/\b(sos|prn|as needed|as required|when needed)\b/.test(l)) return "SOS";
  if (/\b(nocte|hs|bedtime|at night|night)\b/.test(l) && !/\b(twice|bd|tds)\b/.test(l)) return "0-0-1";
  if (/\b(qid|four times|4 times)\b/.test(l)) return "1-1-1-1";
  if (/\b(tds|tid|thrice|three times|3 times)\b/.test(l)) return "1-1-1";
  if (/\b(bd|bid|twice|two times|2 times)\b/.test(l)) return "1-0-1";
  if (/\b(od|once|daily|morning|qd)\b/.test(l)) return "1-0-0";
  return f;
}

export const isPattern = (p: string) => /^\d(\.\d)?(-\d(\.\d)?){2,3}$/.test(p.trim());

const SLOT3 = ["breakfast", "lunch", "dinner"];
const SLOT4 = ["breakfast", "lunch", "snacks", "dinner"];
const TIME3 = ["in the morning", "in the afternoon", "at night"];
const TIME4 = ["in the morning", "in the afternoon", "in the evening", "at night"];

const TIMES: Record<number, string> = { 1: "Once a day", 2: "Twice a day", 3: "3 times a day", 4: "4 times a day" };

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** "5 days" / "1 month" → "5 Days" for the table; "Ongoing" stays. */
export const durationLabel = (d: string | null | undefined) => (d ?? "").trim().replace(/\b\w/g, (c) => c.toUpperCase());

export interface RemarkInput { dosage?: string | null; frequency?: string | null; timing?: string | null; duration?: string | null; instructions?: string | null }

/**
 * "Take 1 tablet - Twice a day, after breakfast and after dinner, for 5 days." — made from the pattern, the meal timing and the duration.
 * Anything the doctor wrote as a special instruction is a separate line under it.
 */
export function remarksOf(it: RemarkInput): { line: string; special: string } {
  const special = (it.instructions ?? "").trim();
  const pattern = toPattern(it.frequency);
  const dose = (it.dosage ?? "").trim() || "1";
  const days = (it.duration ?? "").trim();
  const forDays = days ? (/ongoing|continue/i.test(days) ? ", continue until advised" : `, for ${days.toLowerCase()}`) : "";
  if (pattern === "SOS") return { line: `Take ${dose} - only when needed${forDays}.`, special };
  if (!isPattern(pattern)) return { line: pattern ? `Take ${dose} - ${pattern}${forDays}.` : "", special };

  const counts = pattern.split("-").map(Number);
  const slots = counts.length === 4 ? SLOT4 : SLOT3;
  const when = counts.length === 4 ? TIME4 : TIME3;
  const on = counts.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
  if (on.length === 0) return { line: "", special };
  const meal = (it.timing ?? "").trim();
  const word = meal === "Before Meal" ? "before" : meal === "After Meal" ? "after" : meal === "With Meal" ? "with" : "";
  const whenText = meal === "Empty Stomach" ? "on an empty stomach" : word ? list(on.map((x) => `${word} ${slots[x.i]}`)) : list(on.map((x) => when[x.i]));
  const same = on.every((x) => x.n === on[0].n);
  // The same amount each time reads "Take 1 tablet - Twice a day, …"; different amounts are spelled out.
  const amount = same ? (on[0].n === 1 ? dose : `${on[0].n} × ${dose}`) : "";
  const times = on.length === 1 ? "" : `${TIMES[on.length] ?? `${on.length} times a day`}, `;
  if (same) return { line: `Take ${amount} - ${times}${whenText}${forDays}.`, special };
  const parts = on.map((x) => `${x.n} × ${dose} ${word ? `${word} ${slots[x.i]}` : when[x.i]}`);
  return { line: `Take ${list(parts)}${forDays}.`, special };
}
