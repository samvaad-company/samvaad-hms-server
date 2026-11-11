/**
 * A patient's vaccination history. Nothing is filled in for the person: every entry is typed in, and its date is either a real date
 * (not in the future) or marked "exact date not known", optionally with roughly when.
 */
import { patientsRepo, patientVaccinationsRepo } from "@/repositories";
import { type PatientVaccinationRow } from "@/db/tables";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital } from "@/services/hospital-scope";
import { isRealCalendarDate } from "@/lib/field-rules";
import type { PatientVaccinationDTO } from "@shared/types/api";

const toDto = (r: PatientVaccinationRow): PatientVaccinationDTO => ({
  id: r.id, patientId: r.patient_id, vaccine: r.vaccine, dose: r.dose ?? "", givenOn: r.given_on ?? null, dateUnknown: !!r.date_unknown,
  approxWhen: r.approx_when ?? "", nextDue: r.next_due ?? null, note: r.note ?? "", recordedBy: r.recorded_by ?? "",
});

async function patient(id: number, actor: Session) {
  const p = await patientsRepo.getRow(id);
  if (!p) throw new NotFoundError("Patient");
  assertOwnedByHospital(p, actor, "Patient");
  return p;
}

const schema = {
  vaccine: { type: "string", required: true, min: 2, max: 80 },
  dose: { type: "string", required: false, max: 40, default: "" },
  givenOn: { type: "string", required: false, max: 10 },
  dateUnknown: { type: "boolean", required: false, default: false },
  approxWhen: { type: "string", required: false, max: 40, default: "" },
  nextDue: { type: "string", required: false, max: 10 },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The date rules: a real date that is not in the future, or "not known" — never neither. */
function dates(data: { givenOn?: string; dateUnknown?: boolean; approxWhen?: string; nextDue?: string }) {
  const today = localDate();
  const given = (data.givenOn ?? "").trim();
  if (!given && data.dateUnknown !== true) throw new BadRequestError("Enter the date of the vaccination, or tick “I don't know the exact date”");
  if (given) {
    if (!ISO.test(given) || !isRealCalendarDate(given)) throw new BadRequestError("The vaccination date isn't a valid date");
    if (given > today) throw new BadRequestError("The vaccination date can't be in the future");
  }
  const next = (data.nextDue ?? "").trim();
  if (next && (!ISO.test(next) || !isRealCalendarDate(next))) throw new BadRequestError("The next-due date isn't a valid date");
  return { given_on: given || null, date_unknown: !given, approx_when: given ? "" : (data.approxWhen ?? "").trim(), next_due: next || null };
}

export async function listVaccinations(patientId: number, actor: Session): Promise<PatientVaccinationDTO[]> {
  await patient(patientId, actor);
  const { rows } = await patientVaccinationsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }], sort: [{ column: "id", direction: "desc" }] });
  // Dated ones newest first, then the ones with no exact date.
  return rows.map(toDto).sort((a, b) => (b.givenOn ?? "").localeCompare(a.givenOn ?? "") || b.id - a.id);
}

export async function addVaccination(patientId: number, input: unknown, actor: Session): Promise<PatientVaccinationDTO> {
  const p = await patient(patientId, actor);
  const data = validate(schema, input);
  const row = await patientVaccinationsRepo.create({ hospital_id: p.hospital_id, patient_id: p.id, vaccine: data.vaccine.trim(), dose: (data.dose ?? "").trim(), ...dates(data), note: data.note ?? "", recorded_by: actor.name });
  await audit(actor, "vaccination.add", "patient", p.id, { vaccine: data.vaccine });
  return toDto(row as PatientVaccinationRow);
}

export async function deleteVaccination(patientId: number, id: number, actor: Session) {
  await patient(patientId, actor);
  const row = await patientVaccinationsRepo.getRow(id);
  if (!row || row.patient_id !== patientId) throw new NotFoundError("Vaccination");
  await patientVaccinationsRepo.remove(id);
  await audit(actor, "vaccination.delete", "patient", patientId, { vaccine: row.vaccine });
}
