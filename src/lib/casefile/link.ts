/**
 * What the rest of the app already knows about the patient, turned into rows for the case-file forms. These rows are read-only in the
 * form (they are edited where they come from) and appear before the rows staff add by hand.
 */
import type { CaseFileLinkedDTO } from "@/types/casefile";

export type Row = Record<string, string>;
export interface LinkedRow extends Row { _src: string }

const INJECTION = /\b(iv|im|sc|s\.c|i\.v|i\.m|inj|injection|infusion|intravenous|intramuscular|subcutaneous|drip)\b/i;
const isInjection = (route: string, name: string) => INJECTION.test(route) || /^\s*(inj|inf|iv)\b/i.test(name);
const initials = (name: string) => name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).join("").slice(0, 3);

const dmy = (iso: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);

const slotCell = (state: "" | "due" | "given" | "held", by: string): string => (state === "given" ? `✓${by ? ` ${initials(by)}` : ""}` : state === "held" ? "Held" : state === "due" ? "○" : "");

/** Rows for a table that takes its rows from elsewhere. `unit` is the day, for forms kept per day. */
export function linkedRows(name: string | undefined, l: CaseFileLinkedDTO | null | undefined, unit?: string): LinkedRow[] {
  if (!name || !l) return [];
  switch (name) {
    case "dailyNotes":
      return l.dailyNotes.map((n) => ({ date: dmy(n.date), time: n.time, mo: n.by, other: n.text, _src: "Nursing daily note" }));
    case "doctorRounds":
      return l.doctorNotes.map((n) => ({ date: dmy(n.date), note: `${n.by ? `${n.by}: ` : ""}${n.text}`, _src: "Doctor round" }));
    case "vitals":
      return l.vitals.map((v) => ({
        date: dmy(v.date), time: v.time, temp: v.tempF == null ? "" : `${v.tempF}°F`, pulse: v.pulse == null ? "" : String(v.pulse), rr: v.rr == null ? "" : String(v.rr), bp: v.bp,
        spo2: v.spo2 == null ? "" : `${v.spo2}%`, remark: v.note, sign: v.by, _src: "Nurse station vitals",
      }));
    case "ivLines":
      return l.ivLines.filter((x) => !unit || x.date === unit).map((x) => ({ time: x.time, intakeIv: `${x.fluid} ${x.volumeMl} ml @ ${x.rateMlHr}/hr`, others: x.status === "Running" ? "" : x.status, _src: "IV line" }));
    case "medsInjection":
    case "medsOral": {
      if (!unit) return [];
      const wantInjection = name === "medsInjection";
      const out: LinkedRow[] = [];
      for (const m of l.medicines) {
        if (isInjection(m.route, m.name) !== wantInjection) continue;
        if ((m.start && unit < m.start) || (m.end && unit > m.end)) continue;
        const cells = m.days[unit] ?? ["", "", "", ""], by = m.givenBy[unit] ?? ["", "", "", ""];
        out.push({ medication: m.name, dose: [m.dosage, m.frequency].filter(Boolean).join(" · "), route: m.route, s1: slotCell(cells[0], by[0]), s2: slotCell(cells[1], by[1]), s3: slotCell(cells[2], by[2]), s4: slotCell(cells[3], by[3]), _src: "Medicine order" });
      }
      if (!wantInjection) {
        for (const rx of l.prescriptions.filter((p) => p.date === unit)) {
          for (const it of rx.items) out.push({ medication: it.name, dose: [it.dosage, it.frequency, it.duration].filter(Boolean).join(" · "), route: "", s1: "", s2: "", s3: "", s4: "", _src: `Prescription ${rx.rx}` });
        }
      }
      return out;
    }
    default:
      return [];
  }
}

/** For the handover grid: what the nurse station wrote for each shift on a day, by the grid's row and column. */
export function linkedGrid(name: string | undefined, l: CaseFileLinkedDTO | null | undefined, unit?: string): Record<string, Record<string, string>> {
  if (name !== "handoverShifts" || !l || !unit) return {};
  const col: Record<string, string> = { Night: "night", Morning: "morning", Evening: "evening" };
  const out: Record<string, Record<string, string>> = { illness: {} };
  for (const h of l.handovers) {
    if (h.date !== unit || !col[h.shift]) continue;
    const c = col[h.shift];
    out.illness[c] = [out.illness[c], `${h.note}${h.author ? ` (${h.author})` : ""}`].filter(Boolean).join("\n");
  }
  return out;
}

/** Every day that something from elsewhere is recorded for, so the per-day forms show those days. */
export function linkedDays(formKey: string, l: CaseFileLinkedDTO | null | undefined): string[] {
  if (!l) return [];
  const days = new Set<string>();
  if (formKey === "treatment_sheet") {
    for (const m of l.medicines) for (const d of Object.keys(m.days)) days.add(d);
    for (const p of l.prescriptions) days.add(p.date);
  } else if (formKey === "io_chart") for (const x of l.ivLines) days.add(x.date);
  else if (formKey === "nursing_handover") for (const h of l.handovers) days.add(h.date);
  return [...days].sort();
}
