/**
 * A prescription written for a patient who is in hospital is a medicine order for the ward. Each of its medicines becomes an order on the
 * patient's admission, so the nurse station shows the patient, the drug chart lists the medicines, and the doses can be given and charted.
 * Each medicine is copied once (a note on the order says which prescription it came from), so syncing again never doubles it.
 */
import { ipdRepo, ipdMedicationsRepo, prescriptionItemsRepo, prescriptionsRepo } from "@/repositories";
import { type IpdAdmissionRow, type PrescriptionItemRow, type PrescriptionRow } from "@/db/tables";
import { localDate } from "@/lib/clock";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";

/** Only prescriptions this recent are brought to the ward by the catch-up, so an old prescription never floods the chart with missed doses. */
const CATCH_UP_DAYS = 7;

const addDays = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);

/** How a medicine is given, read from its name and instructions. */
export function routeOf(name: string, instructions: string | null): string {
  const t = `${name} ${instructions ?? ""}`.toLowerCase();
  if (/\b(iv|i\.v|drip|infusion|saline|ringer)\b/.test(t)) return "IV";
  if (/\b(im|i\.m)\b/.test(t)) return "IM";
  if (/\b(sc|s\.c|subcut)/.test(t)) return "SC";
  if (/\binj/.test(t)) return "IV";
  if (/\b(cream|ointment|gel|lotion|topical|eye drop|ear drop)\b/.test(t)) return "Topical";
  if (/\b(inhaler|nebul|rotacap|respule)\b/.test(t)) return "Inhaled";
  return "Oral";
}

/** "5 days" / "2 weeks" / "1 month" as a number of days; null when it isn't a plain duration. */
export function durationDays(text: string): number | null {
  const m = /(\d+)\s*(day|week|month)/i.exec(text ?? "");
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase().startsWith("week") ? n * 7 : m[2].toLowerCase().startsWith("month") ? n * 30 : n;
}

const marker = (rxNumber: string, itemId: number) => `From prescription ${rxNumber} [rx-item:${itemId}]`;

async function activeAdmission(patientId: number, hospitalId: number): Promise<IpdAdmissionRow | null> {
  const { rows } = await ipdRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }, { column: "status", op: "neq", value: "Discharged" }, { column: "hospital_id", op: "eq", value: hospitalId }], sort: [{ column: "id", direction: "desc" }] });
  return rows[0] ?? null;
}

/** Copies a prescription's medicines onto the patient's current admission, if they have one. Returns how many orders were added. */
export async function mirrorPrescriptionToWard(rx: PrescriptionRow, items: PrescriptionItemRow[], admission?: IpdAdmissionRow | null): Promise<number> {
  if (!rx.patient_id) return 0;
  const adm = admission === undefined ? await activeAdmission(rx.patient_id, rx.hospital_id) : admission;
  if (!adm) return 0;
  const { rows: existing } = await ipdMedicationsRepo.listRows({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: adm.id }] });
  const have = new Set(existing.map((m) => m.notes));
  const today = localDate();
  let added = 0;
  for (const it of items) {
    const note = marker(rx.rx_number, it.id);
    if (have.has(note) || !it.medicine_name?.trim()) continue;
    const days = durationDays(it.duration);
    await ipdMedicationsRepo.create({
      admission_id: adm.id,
      medicine_name: it.medicine_name.trim(),
      dosage: it.dosage ?? "",
      frequency: it.frequency ?? "",
      route: routeOf(it.medicine_name, it.instructions),
      start_date: today,
      end_date: days ? addDays(today, days) : "",
      status: "Active",
      last_given_at: "",
      notes: note,
    });
    added += 1;
  }
  return added;
}

const lastRun = new Map<number, number>();

/**
 * Catch-up for the nurse station: recent prescriptions for patients who are in hospital that haven't reached the ward yet (written before
 * this was in place, or for a patient admitted after the prescription). Quick to repeat, so it is skipped if it ran in the last half minute.
 */
export async function syncWardPrescriptions(admissions: IpdAdmissionRow[], actor: Session): Promise<void> {
  const hid = actor.hospitalId;
  if (hid == null || admissions.length === 0) return;
  const now = Date.now();
  if (now - (lastRun.get(hid) ?? 0) < 30_000) return;
  lastRun.set(hid, now);
  const since = new Date(now - CATCH_UP_DAYS * 86_400_000).toISOString();
  const byPatient = new Map(admissions.filter((a) => a.patient_id != null).map((a) => [a.patient_id as number, a]));
  if (byPatient.size === 0) return;
  const { rows } = await prescriptionsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "in", value: [...byPatient.keys()] }, { column: "created_at", op: "gte", value: since }] }, actor));
  for (const rx of rows) {
    const adm = byPatient.get(rx.patient_id as number);
    if (!adm || (rx.created_at ?? "") < (adm.created_at ?? "")) continue; // written before this stay began
    const { rows: items } = await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq", value: rx.id }] });
    await mirrorPrescriptionToWard(rx, items, adm);
  }
}
