/**
 * Doctors' diagnosis lists, and the diagnoses recorded for patients.
 *
 * Each doctor keeps their own list of diagnoses (the ones they type or pick on a prescription) so they can find them again by typing
 * a few letters. Every diagnosis put on a prescription is also recorded against the patient and the doctor, so the patient's record
 * and the doctor's record both show it.
 */
import { doctorDiagnosesRepo, patientDiagnosesRepo, doctorsRepo, patientsRepo } from "@/repositories";
import { toDoctorDiagnosisDTO, toPatientDiagnosisDTO } from "@/repositories/mappers";
import { type DoctorDiagnosisRow, type PatientDiagnosisRow } from "@/db/tables";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const clean = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
const key = (s: string) => s.toLowerCase();

/** "Acute bronchitis (J20.9)" → the name and the ICD-10 code in the brackets. */
function splitCode(name: string): { name: string; code: string } {
  const m = /^(.*?)\s*\(([A-Z][0-9][0-9A-Z.]{0,6})\)\s*$/.exec(name);
  return m ? { name: m[1].trim() || name, code: m[2] } : { name, code: "" };
}

/** The doctor whose list this is: a doctor account's own, or (for staff writing on a doctor's behalf) the one asked for. */
async function resolveDoctor(actor: Session, requested?: number | null): Promise<number> {
  const id = actor.doctorId ?? requested ?? null;
  if (id == null) throw new BadRequestError("Choose the doctor first");
  if (actor.doctorId != null && requested != null && requested !== actor.doctorId) throw new ForbiddenError("You can only use your own diagnosis list");
  const doctor = await doctorsRepo.getRow(id);
  assertOwnedByHospital(doctor, actor, "Doctor");
  return id;
}

async function mine(doctorId: number, actor: Session): Promise<DoctorDiagnosisRow[]> {
  const { rows } = await doctorDiagnosesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "doctor_id", op: "eq", value: doctorId }] }, actor));
  return rows;
}

/** A doctor's diagnoses, the most used first; `q` keeps the ones that contain what was typed. */
export async function listDoctorDiagnoses(actor: Session, opts: { doctorId?: number | null; q?: string; limit?: number }) {
  if (actor.doctorId == null && opts.doctorId == null) return [];
  const doctorId = await resolveDoctor(actor, opts.doctorId);
  const q = key(clean(opts.q));
  const rows = (await mine(doctorId, actor))
    .filter((r) => !q || key(r.name).includes(q) || key(r.code ?? "").includes(q))
    .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0) || a.name.localeCompare(b.name))
    .slice(0, opts.limit ?? 50);
  return rows.map(toDoctorDiagnosisDTO);
}

/** Adds a diagnosis to the doctor's list (or returns the one already there with that name). */
async function upsert(doctorId: number, hospitalId: number, raw: string, existing: DoctorDiagnosisRow[], used: boolean): Promise<DoctorDiagnosisRow | null> {
  const { name, code } = splitCode(clean(raw));
  if (name.length < 2) return null;
  const found = existing.find((r) => key(r.name) === key(name));
  const now = new Date().toISOString();
  if (found) {
    if (!used) return found;
    const row = (await doctorDiagnosesRepo.update(found.id, { use_count: (found.use_count ?? 0) + 1, last_used_at: now, ...(code && !found.code ? { code } : {}) })) as DoctorDiagnosisRow;
    Object.assign(found, row);
    return found;
  }
  const row = (await doctorDiagnosesRepo.create({ hospital_id: hospitalId, doctor_id: doctorId, name, code, use_count: used ? 1 : 0, last_used_at: used ? now : null })) as DoctorDiagnosisRow;
  existing.push(row);
  return row;
}

export async function addDoctorDiagnosis(input: unknown, actor: Session) {
  const body = (input ?? {}) as { name?: unknown; doctorId?: unknown };
  const name = clean(body.name);
  if (name.length < 2) throw new BadRequestError("Type the diagnosis first");
  const doctorId = await resolveDoctor(actor, typeof body.doctorId === "number" ? body.doctorId : null);
  const hospitalId = requireHospitalId(actor);
  const existing = await mine(doctorId, actor);
  const before = existing.length;
  const row = await upsert(doctorId, hospitalId, name, existing, false);
  if (!row) throw new BadRequestError("Type the diagnosis first");
  if (existing.length > before) await audit(actor, "create", "doctor_diagnosis", row.id, { name: row.name });
  return toDoctorDiagnosisDTO(row);
}

export async function deleteDoctorDiagnosis(id: number, actor: Session) {
  const row = await doctorDiagnosesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Diagnosis");
  if (actor.doctorId != null && row.doctor_id !== actor.doctorId) throw new ForbiddenError("You can only remove diagnoses from your own list");
  await doctorDiagnosesRepo.remove(id);
  await audit(actor, "delete", "doctor_diagnosis", id, { name: row.name });
}

/**
 * Records the diagnoses on a prescription: each goes in the doctor's list (and counts as used) and, when the prescription is for a
 * registered patient, in the patient's record under that doctor.
 */
export async function recordPrescriptionDiagnoses(args: {
  actor: Session; patientId: number | null; doctorId: number | null; doctorName: string; prescriptionId: number; rxNumber: string;
  primary: string[]; secondary: string[];
}): Promise<void> {
  const { actor, patientId, doctorId, doctorName, prescriptionId, rxNumber } = args;
  const hospitalId = requireHospitalId(actor);
  const lists: { kind: "Primary" | "Secondary"; names: string[] }[] = [{ kind: "Primary", names: args.primary }, { kind: "Secondary", names: args.secondary }];
  const library = doctorId != null ? await mine(doctorId, actor) : [];
  const seen = new Set<string>();
  const patient = patientId != null ? await patientsRepo.getRow(patientId) : null;
  const linkPatient = patientId != null && !!patient && patient.hospital_id === hospitalId;
  for (const { kind, names } of lists) {
    for (const raw of names) {
      const { name } = splitCode(clean(raw));
      if (name.length < 2 || seen.has(`${kind}:${key(name)}`)) continue;
      seen.add(`${kind}:${key(name)}`);
      const entry = doctorId != null ? await upsert(doctorId, hospitalId, raw, library, true) : null;
      if (linkPatient) {
        // One saved with the Save button before the prescription: it is attached to the prescription, not repeated.
        const earlier = (await patientRowsOf(patientId!, actor)).find((r) => r.prescription_id == null && r.doctor_id === doctorId && r.kind === kind && key(r.name) === key(name));
        if (earlier) {
          await patientDiagnosesRepo.update(earlier.id, { prescription_id: prescriptionId, rx_number: rxNumber, diagnosis_id: entry?.id ?? earlier.diagnosis_id });
          continue;
        }
        await patientDiagnosesRepo.create({
          hospital_id: hospitalId, patient_id: patientId!, doctor_id: doctorId, doctor: doctorName, diagnosis_id: entry?.id ?? null, name, kind,
          prescription_id: prescriptionId, rx_number: rxNumber, recorded_on: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }
}

async function patientRowsOf(patientId: number, actor: Session): Promise<PatientDiagnosisRow[]> {
  const { rows } = await patientDiagnosesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] }, actor));
  return rows as PatientDiagnosisRow[];
}

/**
 * The Save button: keeps what the doctor wrote in their own list and in the patient's record straight away (before the prescription is
 * saved). Writing the same diagnosis again for the same patient on the same day does not repeat it.
 */
export async function savePatientDiagnoses(patientId: number, input: unknown, actor: Session) {
  const body = (input ?? {}) as { names?: unknown; kind?: unknown; doctorId?: unknown };
  const names = (Array.isArray(body.names) ? body.names : []).map((n) => clean(n)).filter((n) => splitCode(n).name.length >= 2);
  if (!names.length) throw new BadRequestError("Type the diagnosis first");
  const kind = body.kind === "Secondary" ? "Secondary" : "Primary";
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const doctorId = await resolveDoctor(actor, typeof body.doctorId === "number" ? body.doctorId : null);
  const doctor = await doctorsRepo.getRow(doctorId);
  const hospitalId = requireHospitalId(actor);
  const library = await mine(doctorId, actor);
  const rows = await patientRowsOf(patientId, actor);
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  for (const raw of names) {
    const { name } = splitCode(raw);
    if (seen.has(key(name))) continue;
    seen.add(key(name));
    const entry = await upsert(doctorId, hospitalId, raw, library, false);
    if (rows.some((r) => r.doctor_id === doctorId && r.kind === kind && key(r.name) === key(name) && (r.prescription_id == null || r.recorded_on === today))) continue;
    const row = (await patientDiagnosesRepo.create({
      hospital_id: hospitalId, patient_id: patientId, doctor_id: doctorId, doctor: String((doctor as { name?: string } | null)?.name ?? ""), diagnosis_id: entry?.id ?? null, name, kind,
      prescription_id: null, rx_number: "", recorded_on: today,
    })) as PatientDiagnosisRow;
    rows.push(row);
  }
  await audit(actor, "create", "patient_diagnosis", patientId, { kind, count: seen.size });
  return (await patientRowsOf(patientId, actor)).map(toPatientDiagnosisDTO);
}

/** Every diagnosis recorded for a patient, newest first. */
export async function listPatientDiagnoses(patientId: number, actor: Session) {
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const { rows } = await patientDiagnosesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] }, actor));
  return (rows as PatientDiagnosisRow[]).sort((a, b) => `${b.recorded_on}${String(b.id).padStart(9, "0")}`.localeCompare(`${a.recorded_on}${String(a.id).padStart(9, "0")}`)).map(toPatientDiagnosisDTO);
}

/** A doctor's diagnosis list with how often each was used, for the doctor's record. */
export async function listDoctorRecord(doctorId: number, actor: Session) {
  const doctor = await doctorsRepo.getRow(doctorId);
  assertOwnedByHospital(doctor, actor, "Doctor");
  if (!doctor) throw new NotFoundError("Doctor");
  return (await mine(doctorId, actor)).sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0) || a.name.localeCompare(b.name)).map(toDoctorDiagnosisDTO);
}
