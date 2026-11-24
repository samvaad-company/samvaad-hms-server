/**
 * How a medicine is taken, written the way patients read it. The pattern "1-0-1" is the morning, afternoon and night dose
 * (1 = take it, 0 = skip it), so 1-0-1 means morning and night. A fourth number is the evening (snacks) dose: 1-1-1-1.
 *
 * The directions (when to take it, with or without meals, for how long) can be written in English, Hindi or Gujarati. Only the
 * directions are translated; medicine names and anything the doctor typed stay as they are.
 */

export type Lang = "English" | "Hindi" | "Gujarati";
export const LANGS: Lang[] = ["English", "Hindi", "Gujarati"];

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

// ── The words, per language ──────────────────────────────────────────────────

interface Words {
  slots3: string[]; slots4: string[]; when3: string[]; when4: string[];
  times: Record<number, string>; more: (n: number) => string;
  rel: { before: (slot: string) => string; after: (slot: string) => string; with: (slot: string) => string };
  empty: string; sos: string; ongoing: string; and: string; end: string;
  take: (dose: string) => string;
  forDuration: (d: string) => string;
  units: Record<string, string>;
  timing: Record<string, string>;
  doseUnits: Record<string, string>;
}

const WORDS: Record<Lang, Words> = {
  English: {
    slots3: ["breakfast", "lunch", "dinner"], slots4: ["breakfast", "lunch", "snacks", "dinner"],
    when3: ["in the morning", "in the afternoon", "at night"], when4: ["in the morning", "in the afternoon", "in the evening", "at night"],
    times: { 1: "Once a day", 2: "Twice a day", 3: "3 times a day", 4: "4 times a day" }, more: (n) => `${n} times a day`,
    rel: { before: (s) => `before ${s}`, after: (s) => `after ${s}`, with: (s) => `with ${s}` },
    empty: "on an empty stomach", sos: "only when needed", ongoing: "continue until advised", and: "and", end: ".",
    take: (d) => `Take ${d}`, forDuration: (d) => `for ${d}`,
    units: { hour: "hours", day: "days", week: "weeks", month: "months", year: "years" },
    timing: { "Before Meal": "Before Meal", "After Meal": "After Meal", "With Meal": "With Meal", "Empty Stomach": "Empty Stomach" },
    doseUnits: {},
  },
  Hindi: {
    slots3: ["नाश्ते", "दोपहर के खाने", "रात के खाने"], slots4: ["नाश्ते", "दोपहर के खाने", "शाम के नाश्ते", "रात के खाने"],
    when3: ["सुबह", "दोपहर में", "रात को"], when4: ["सुबह", "दोपहर में", "शाम को", "रात को"],
    times: { 1: "दिन में एक बार", 2: "दिन में दो बार", 3: "दिन में 3 बार", 4: "दिन में 4 बार" }, more: (n) => `दिन में ${n} बार`,
    rel: { before: (s) => `${s} से पहले`, after: (s) => `${s} के बाद`, with: (s) => `${s} के साथ` },
    empty: "खाली पेट", sos: "केवल जरूरत पड़ने पर", ongoing: "डॉक्टर के कहने तक जारी रखें", and: "और", end: "।",
    take: (d) => `${d} लें`, forDuration: (d) => `${d} तक`,
    units: { hour: "घंटे", day: "दिन", week: "सप्ताह", month: "महीने", year: "साल" },
    timing: { "Before Meal": "खाने से पहले", "After Meal": "खाने के बाद", "With Meal": "खाने के साथ", "Empty Stomach": "खाली पेट" },
    doseUnits: { tablet: "गोली", tablets: "गोली", capsule: "कैप्सूल", capsules: "कैप्सूल", tablespoonful: "बड़ा चम्मच", teaspoonful: "चम्मच", spoon: "चम्मच", drops: "बूँद", drop: "बूँद", puff: "पफ", puffs: "पफ", ml: "मि.ली." },
  },
  Gujarati: {
    slots3: ["નાસ્તા", "બપોરના ભોજન", "રાત્રિના ભોજન"], slots4: ["નાસ્તા", "બપોરના ભોજન", "સાંજના નાસ્તા", "રાત્રિના ભોજન"],
    when3: ["સવારે", "બપોરે", "રાત્રે"], when4: ["સવારે", "બપોરે", "સાંજે", "રાત્રે"],
    times: { 1: "દિવસમાં એક વાર", 2: "દિવસમાં બે વાર", 3: "દિવસમાં 3 વાર", 4: "દિવસમાં 4 વાર" }, more: (n) => `દિવસમાં ${n} વાર`,
    rel: { before: (s) => `${s} પહેલાં`, after: (s) => `${s} પછી`, with: (s) => `${s} સાથે` },
    empty: "ખાલી પેટે", sos: "જરૂર પડે ત્યારે જ", ongoing: "ડૉક્ટર કહે ત્યાં સુધી ચાલુ રાખો", and: "અને", end: ".",
    take: (d) => `${d} લો`, forDuration: (d) => `${d} માટે`,
    units: { hour: "કલાક", day: "દિવસ", week: "અઠવાડિયા", month: "મહિના", year: "વર્ષ" },
    timing: { "Before Meal": "જમ્યા પહેલાં", "After Meal": "જમ્યા પછી", "With Meal": "જમતી વખતે", "Empty Stomach": "ખાલી પેટે" },
    doseUnits: { tablet: "ગોળી", tablets: "ગોળી", capsule: "કેપ્સ્યુલ", capsules: "કેપ્સ્યુલ", tablespoonful: "મોટો ચમચો", teaspoonful: "ચમચી", spoon: "ચમચી", drops: "ટીપાં", drop: "ટીપું", puff: "પફ", puffs: "પફ", ml: "મિ.લી." },
  },
};

const list = (xs: string[], and: string) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${and} ${xs[xs.length - 1]}`);

/** "Before Meal" / "After Meal" … in the patient's language. */
export const timingLabel = (t: string | null | undefined, lang: Lang = "English") => (t ? WORDS[lang].timing[t] ?? t : "");

/** "5 days" / "1 month" → "5 Days" (English) or "5 दिन" / "5 દિવસ"; anything else stays as written. */
export function durationLabel(d: string | null | undefined, lang: Lang = "English"): string {
  const raw = (d ?? "").trim();
  if (lang === "English") return raw.replace(/\b\w/g, (c) => c.toUpperCase());
  return translateDuration(raw, lang) || raw;
}

function translateDuration(raw: string, lang: Lang): string {
  const m = /^(\d+(?:\.\d+)?)\s*(hour|day|week|month|year)s?$/i.exec(raw);
  return m ? `${m[1]} ${WORDS[lang].units[m[2].toLowerCase()]}` : "";
}

/** The dose as typed ("1 tablet"), with the unit word translated when it is one we know; the number is kept. */
function doseIn(dose: string, lang: Lang): string {
  if (lang === "English") return dose;
  const m = /^(\d+(?:\.\d+)?(?:\s*[-/]\s*\d+)?)\s+([A-Za-z.]+)\s*$/.exec(dose);
  const unit = m ? WORDS[lang].doseUnits[m[2].toLowerCase()] : undefined;
  return m && unit ? `${m[1]} ${unit}` : dose;
}

export interface RemarkInput { dosage?: string | null; frequency?: string | null; timing?: string | null; duration?: string | null; instructions?: string | null }

/**
 * "Take 1 tablet - Twice a day, after breakfast and after dinner, for 5 days." — made from the pattern, the meal timing and the duration,
 * in the chosen language. Anything the doctor wrote as a special instruction is a separate line under it, as typed.
 */
export function remarksOf(it: RemarkInput, lang: Lang = "English"): { line: string; special: string } {
  const W = WORDS[lang];
  const special = (it.instructions ?? "").trim();
  const pattern = toPattern(it.frequency);
  const dose = doseIn((it.dosage ?? "").trim() || "1", lang);
  const days = (it.duration ?? "").trim();
  const dur = !days ? "" : /ongoing|continue/i.test(days) ? W.ongoing : W.forDuration(lang === "English" ? days.toLowerCase() : translateDuration(days, lang) || days);
  const join = (...parts: string[]) => parts.filter(Boolean).join(", ");
  const end = (s: string) => `${s}${W.end}`;
  if (pattern === "SOS") return { line: end(`${W.take(dose)} - ${join(W.sos, dur)}`), special };
  if (!isPattern(pattern)) return { line: pattern ? end(`${W.take(dose)} - ${join(pattern, dur)}`) : "", special };

  const counts = pattern.split("-").map(Number);
  const slots = counts.length === 4 ? W.slots4 : W.slots3;
  const when = counts.length === 4 ? W.when4 : W.when3;
  const on = counts.map((n, i) => ({ n, i })).filter((x) => x.n > 0);
  if (on.length === 0) return { line: "", special };
  const meal = (it.timing ?? "").trim();
  const rel = meal === "Before Meal" ? W.rel.before : meal === "After Meal" ? W.rel.after : meal === "With Meal" ? W.rel.with : null;
  const whenText = meal === "Empty Stomach" ? W.empty : rel ? list(on.map((x) => rel(slots[x.i])), W.and) : list(on.map((x) => when[x.i]), W.and);
  const same = on.every((x) => x.n === on[0].n);
  const times = on.length === 1 ? "" : W.times[on.length] ?? W.more(on.length);
  if (same) {
    const amount = on[0].n === 1 ? dose : `${on[0].n} × ${dose}`;
    return { line: end(`${W.take(amount)} - ${join(times, whenText, dur)}`), special };
  }
  const parts = on.map((x) => `${x.n} × ${dose} ${rel ? rel(slots[x.i]) : when[x.i]}`);
  return { line: end(`${W.take(list(parts, W.and))}${dur ? `, ${dur}` : ""}`), special };
}
