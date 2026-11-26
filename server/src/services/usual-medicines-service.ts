/**
 * A doctor's usual medicines for each disease, learned from their own prescriptions (no AI, only what they wrote before).
 *
 * Every time a doctor issues a prescription, each medicine on it is recorded against each of its diagnoses in a table that belongs to that
 * doctor: the dose, pattern, timing and duration used last, and how many prescriptions have used it. When the next patient with the same
 * disease comes, the prescription form offers those medicines and one tap fills the row. The first time a doctor asks, their earlier
 * prescriptions are read once to fill the table.
 */
import { doctorDiseaseMedicinesRepo, doctorsRepo, prescriptionsRepo, prescriptionItemsRepo } from "@/repositories";
import { toUsualMedicineDTO } from "@/repositories/mappers";
import { type DoctorDiseaseMedicineRow, type PrescriptionItemRow, type PrescriptionRow } from "@/db/tables";
import { BadRequestError, ForbiddenError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const clean = (s: unknown, max = 160) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** "Acute bronchitis (J20.9)" and "acute  bronchitis" are the same disease: lower case, no ICD code, no punctuation. */
export function diseaseKey(raw: unknown): string {
  const s = clean(raw).replace(/\s*\(\s*[A-Z][0-9][0-9A-Z.]{0,6}\s*\)\s*$/, "");
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
const medicineKey = (raw: unknown) => clean(raw, 120).toLowerCase().replace(/\s+/g, " ");

/** The same disease, or one written a little longer ("type 2 diabetes" and "type 2 diabetes mellitus"). */
function sameDisease(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && (long.startsWith(`${short} `) || long.endsWith(` ${short}`) || long.includes(` ${short} `));
}

async function resolveDoctor(actor: Session, requested?: number | null): Promise<number> {
  const id = actor.doctorId ?? requested ?? null;
  if (id == null) throw new BadRequestError("Choose the doctor first");
  if (actor.doctorId != null && requested != null && requested !== actor.doctorId) throw new ForbiddenError("You can only see your own usual medicines");
  assertOwnedByHospital(await doctorsRepo.getRow(id), actor, "Doctor");
  return id;
}

async function rowsOf(doctorId: number, actor: Session): Promise<DoctorDiseaseMedicineRow[]> {
  const { rows } = await doctorDiseaseMedicinesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "doctor_id", op: "eq", value: doctorId }] } as never, actor));
  return rows as DoctorDiseaseMedicineRow[];
}

export interface UsedMedicine { medicineId: number | null; medicineName: string; dosage: string; frequency: string; timing: string; duration: string; instructions: string }

/** Writes one prescription's medicines against each of its diseases in the doctor's table. `when` is the day it was issued. */
async function apply(rows: DoctorDiseaseMedicineRow[], hospitalId: number, doctorId: number, diagnoses: string[], items: UsedMedicine[], when: string): Promise<void> {
  const seen = new Set<string>();
  for (const raw of diagnoses.slice(0, 6)) {
    const name = clean(raw).replace(/\s*\(\s*[A-Z][0-9][0-9A-Z.]{0,6}\s*\)\s*$/, "");
    const dk = diseaseKey(raw);
    if (dk.length < 2 || seen.has(dk)) continue;
    seen.add(dk);
    for (const it of items) {
      const mk = medicineKey(it.medicineName);
      if (!mk) continue;
      const found = rows.find((r) => r.diagnosis_key === dk && r.medicine_key === mk);
      const settings = { medicine_id: it.medicineId ?? null, dosage: clean(it.dosage, 60), frequency: clean(it.frequency, 40), timing: clean(it.timing, 40), duration: clean(it.duration, 40), instructions: clean(it.instructions, 200) };
      if (found) {
        // The latest use wins for the dose; an older prescription read later must not overwrite a newer one.
        const newer = when >= (found.last_used_at ?? "");
        const row = (await doctorDiseaseMedicinesRepo.update(found.id, { use_count: (found.use_count ?? 0) + 1, ...(newer ? { ...settings, last_used_at: when } : {}) })) as DoctorDiseaseMedicineRow;
        Object.assign(found, row);
      } else {
        const row = (await doctorDiseaseMedicinesRepo.create({
          hospital_id: hospitalId, doctor_id: doctorId, diagnosis: name, diagnosis_key: dk, medicine_name: clean(it.medicineName, 120), medicine_key: mk, ...settings, use_count: 1, last_used_at: when,
        } as never)) as DoctorDiseaseMedicineRow;
        rows.push(row);
      }
    }
  }
}

/** Called when a prescription is issued. Never needs to stop the prescription: the caller ignores a failure here. */
export async function recordDiseaseMedicines(args: { actor: Session; doctorId: number | null; diagnoses: string[]; items: UsedMedicine[] }): Promise<void> {
  if (args.doctorId == null || !args.diagnoses.length || !args.items.length) return;
  const hospitalId = requireHospitalId(args.actor);
  const rows = await rowsOf(args.doctorId, args.actor);
  await apply(rows, hospitalId, args.doctorId, args.diagnoses, args.items, new Date().toISOString());
}

/** Fills a doctor's table from the prescriptions they issued before this existed (once, the first time it is asked for). */
async function backfill(doctorId: number, actor: Session): Promise<void> {
  const hospitalId = requireHospitalId(actor);
  const { rows: all } = await prescriptionsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "doctor_id", op: "eq", value: doctorId }] } as never, actor));
  const mineRx = (all as PrescriptionRow[]).sort((a, b) => a.id - b.id).slice(-400);
  const table: DoctorDiseaseMedicineRow[] = [];
  for (const rx of mineRx) {
    const { rows: its } = await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq", value: rx.id }] } as never);
    const items = (its as PrescriptionItemRow[]).map((i) => ({ medicineId: i.medicine_id, medicineName: i.medicine_name, dosage: i.dosage, frequency: i.frequency, timing: i.timing ?? "", duration: i.duration, instructions: i.instructions ?? "" }));
    if (!items.length) continue;
    await apply(table, hospitalId, doctorId, String(rx.diagnosis ?? "").split(";"), items, String(rx.created_at ?? new Date().toISOString()));
  }
}

/**
 * The doctor's usual medicines for each disease asked about, the ones used most first. A disease matches when it is the same as one the
 * doctor has prescribed for (or a longer or shorter form of it).
 */
export async function usualMedicines(actor: Session, opts: { doctorId?: number | null; diagnoses: string[]; limit?: number }) {
  if (actor.doctorId == null && opts.doctorId == null) return [];
  const doctorId = await resolveDoctor(actor, opts.doctorId);
  let rows = await rowsOf(doctorId, actor);
  if (!rows.length) { await backfill(doctorId, actor).catch(() => null); rows = await rowsOf(doctorId, actor); }
  const limit = Math.min(20, opts.limit ?? 8);
  const groups: { diagnosis: string; items: ReturnType<typeof toUsualMedicineDTO>[] }[] = [];
  const asked = new Set<string>();
  for (const raw of opts.diagnoses.slice(0, 12)) {
    const dk = diseaseKey(raw);
    if (dk.length < 2 || asked.has(dk)) continue;
    asked.add(dk);
    const hits = rows.filter((r) => sameDisease(r.diagnosis_key, dk));
    // One medicine can sit under two forms of the name; offer it once, with the most used count.
    const byMedicine = new Map<string, DoctorDiseaseMedicineRow>();
    for (const r of hits) { const cur = byMedicine.get(r.medicine_key); if (!cur || (r.use_count ?? 0) > (cur.use_count ?? 0)) byMedicine.set(r.medicine_key, r); }
    const items = [...byMedicine.values()].sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0) || String(b.last_used_at).localeCompare(String(a.last_used_at))).slice(0, limit).map(toUsualMedicineDTO);
    if (items.length) groups.push({ diagnosis: clean(raw).replace(/\s*\(\s*[A-Z][0-9][0-9A-Z.]{0,6}\s*\)\s*$/, ""), items });
  }
  return groups;
}
