/**
 * When each inpatient medicine is due. A medication order only carries a free-text frequency ("BD",
 * "Three times a day"), so this reads the common forms and places the doses at the ward's usual drug-round
 * times. A frequency it cannot read (as-needed / "SOS", every-N-hours, anything unusual) has no fixed doses
 * and so never raises a missed-dose alert — it is up to the nurse, not the clock.
 */
import { zonedInstant, localDate, TZ } from "@/lib/clock";
import { type IpdMedicationRow, type IpdDoseLogRow } from "@/db/tables";
import { type DoseSlotDTO, type DoseState } from "@shared/types/api";

/** A dose is "due" from this long before its time until this long after; later than that it is missed. */
export const DOSE_WINDOW_MIN = 60;

const h = (hour: number, minute = 0) => hour * 60 + minute;

/** Drug-round times as minutes after midnight, by how many doses a day. */
const ROUNDS: Record<number, number[]> = {
  1: [h(9)],
  2: [h(9), h(21)],
  3: [h(6), h(14), h(22)],
  4: [h(6), h(12), h(18), h(22)],
};

/** Minutes-after-midnight of each dose in a day for a free-text frequency; [] when there is no fixed schedule. */
export function slotTimes(frequency: string): number[] {
  const f = (frequency ?? "").toLowerCase().trim();
  if (!f) return [];
  if (/\b(sos|prn|as needed|as required|if required|when required|when needed|stat|once only|single dose|immediately)\b/.test(f)) return [];
  // "1-0-1" style: one entry per morning / noon / night.
  const dashed = /^(\d)\s*-\s*(\d)\s*-\s*(\d)(?:\s*-\s*(\d))?$/.exec(f);
  if (dashed) {
    const [, a, b, c, d] = dashed;
    const at = [a, b, c, d].map((x, i) => (Number(x ?? 0) > 0 ? [h(9), h(14), h(21), h(23)][i] : -1)).filter((m) => m >= 0);
    return at;
  }
  if (/\b(nocte|hs|bedtime|at night|night)\b/.test(f) && !/\b(twice|bd|bid|thrice|tds|tid)\b/.test(f)) return [h(21)];
  if (/\b(qid|q\.?i\.?d|four times|4 times|6 hourly|6-hourly|q6h?)\b/.test(f)) return ROUNDS[4];
  if (/\b(tds|tid|t\.?i\.?d|thrice|three times|3 times|8 hourly|8-hourly|q8h?)\b/.test(f)) return ROUNDS[3];
  if (/\b(bd|bid|b\.?i\.?d|twice|two times|2 times|12 hourly|12-hourly|q12h?)\b/.test(f)) return ROUNDS[2];
  if (/\b(od|o\.?d|once|1 time|one time|daily|every day|morning|qd)\b/.test(f)) return ROUNDS[1];
  return [];
}

/** Every calendar date from `from` to `to`, inclusive, as yyyy-mm-dd. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const end = Date.UTC(ty, tm - 1, td);
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end; t += 86_400_000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return out;
}

export function stateOf(scheduledAt: Date, now: Date, log: IpdDoseLogRow | undefined): DoseState {
  if (log) return log.status === "Held" ? "held" : "given";
  const diffMin = (scheduledAt.getTime() - now.getTime()) / 60_000;
  if (diffMin > DOSE_WINDOW_MIN) return "upcoming";
  if (diffMin >= -DOSE_WINDOW_MIN) return "due";
  return "missed";
}

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/**
 * Every dose of the given medicines that falls between two dates (hospital-local, inclusive), with its state.
 * An order never owes a dose from before it was written, so a medicine started mid-day starts at its next round.
 */
export function doseSlots(
  meds: IpdMedicationRow[],
  logs: IpdDoseLogRow[],
  from: string,
  to: string,
  now: Date = new Date(),
): DoseSlotDTO[] {
  const days = datesBetween(from, to);
  const out: DoseSlotDTO[] = [];
  for (const med of meds) {
    if (med.status !== "Active") continue;
    const times = slotTimes(med.frequency);
    if (times.length === 0) continue;
    const ordered = new Date(med.created_at).getTime();
    const medLogs = logs.filter((l) => l.medication_id === med.id);
    for (const day of days) {
      if (med.start_date && day < med.start_date) continue;
      if (med.end_date && day > med.end_date) continue;
      for (const minutes of times) {
        const at = zonedInstant(day, minutes);
        // Ordered after this round was due → not owed. (A dose already recorded is always kept.)
        const log = medLogs.find((l) => sameInstant(l.scheduled_at, at.toISOString()));
        if (!log && at.getTime() < ordered) continue;
        out.push({
          key: `${med.id}|${at.toISOString()}`,
          admissionId: med.admission_id,
          medicationId: med.id,
          medicineName: med.medicine_name,
          dosage: med.dosage,
          route: med.route,
          scheduledAt: at.toISOString(),
          state: stateOf(at, now, log),
          givenAt: log?.given_at ?? null,
          givenBy: log?.given_by ?? null,
          note: log?.note ?? "",
        });
      }
    }
  }
  return out.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.medicineName.localeCompare(b.medicineName));
}

export type Shift = "Morning" | "Evening" | "Night";

/** The ward shift a moment falls in, and the date that shift started (a night shift after midnight belongs to the day before). */
export function shiftOf(now: Date = new Date()): { shift: Shift; date: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  if (hour >= 6 && hour < 14) return { shift: "Morning", date: localDate(now) };
  if (hour >= 14 && hour < 22) return { shift: "Evening", date: localDate(now) };
  const date = hour >= 22 ? localDate(now) : localDate(new Date(now.getTime() - 86_400_000));
  return { shift: "Night", date };
}
