/**
 * IPD service — inpatient admissions wired to bed occupancy. Admitting a
 * patient occupies a bed; discharging frees it.
 */
import { queueForCoding } from "@/services/mrd-coding-service";
import {
  ipdRepo,
  bedsRepo,
  patientsRepo,
  doctorsRepo,
  wardsRepo,
  bedTransfersRepo,
  staffRepo,
} from "@/repositories";
import { toIpdDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import { type IpdAdmissionRow } from "@/db/tables";
import { ConflictError, BadRequestError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { validateNotPast } from "@/lib/field-rules";
import { displayDate, isoDate } from "@/services/helpers";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { nextNumber } from "@/services/id-service";

export const ADMISSION_TYPES = ["Emergency", "Planned", "Day care", "Maternity", "Transfer in"] as const;
export const DEPOSIT_MODES = ["Cash", "UPI", "Card"] as const;

const admitSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  patientCode: { type: "string", required: false, max: 40, default: "" },
  bedId: { type: "number", required: false },
  ward: { type: "string", required: false, max: 80, default: "" },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  // The reason for admission is "optional, can be filled in later" on the admit form.
  diagnosis: { type: "string", required: false, max: 240, default: "" },
  admissionDate: { type: "string", required: false, max: 40, custom: validateNotPast("admission date") },
  creditLimit: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Admitted", "ICU", "Discharged"], default: "Admitted" },
  admissionType: { type: "enum", required: false, values: ADMISSION_TYPES, default: "Planned" },
  isMlc: { type: "boolean", required: false, default: false },
  familyName: { type: "string", required: false, max: 120, default: "" },
  familyRelation: { type: "string", required: false, max: 60, default: "" },
  familyPhone: { type: "string", required: false, max: 30, default: "" },
  depositAmount: { type: "number", required: false, min: 0, default: 0 },
  depositMode: { type: "enum", required: false, values: DEPOSIT_MODES },
  primaryNurseId: { type: "number", required: false, min: 1 },
  expectedStayDays: { type: "number", required: false, min: 0, max: 365 },
  diet: { type: "string", required: false, max: 300, default: "" },
} as const;

export const IPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "patient_code", "ward", "bed", "doctor", "diagnosis"],
  filterable: ["status", "ward"],
  sortable: ["admission_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/** The patient's sex isn't copied onto the admission, so it is joined in for display. */
async function withGender<T extends { patientRefId: number | null; gender: string }>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r.patientRefId).filter((v): v is number => v != null))];
  const patients = await Promise.all(ids.map((id) => patientsRepo.getRow(id)));
  const gender = new Map(patients.filter((p) => p != null).map((p) => [p.id, p.gender]));
  return rows.map((r) => ({ ...r, gender: r.patientRefId != null ? (gender.get(r.patientRefId) ?? "") : "" }));
}

export async function listIpd(options: QueryOptions, actor: Session) {
  const res = await ipdRepo.list(scopeToHospital(scopeToOwnDoctor(options, actor, "doctor_id"), actor));
  return { ...res, rows: await withGender(res.rows) };
}

export async function getIpd(id: number, actor: Session) {
  const row = await ipdRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Admission");
  return (await withGender([toIpdDTO(row)]))[0];
}

/** Primary nurse must be one of this hospital's staff. */
async function resolveNurse(nurseId: number | undefined, actor: Session): Promise<{ id: number | null; name: string }> {
  if (!nurseId) return { id: null, name: "" };
  const nurse = await staffRepo.getRow(nurseId);
  assertOwnedByHospital(nurse, actor, "Nurse");
  return { id: nurse.id, name: nurse.name };
}

/** ADM/2026/00003 by default — the "Admission no." format in Setup decides. */
async function nextAdmissionNo(actor: Session): Promise<string> {
  const prefix = `ADM/${localDate().slice(0, 4)}/`;
  const { rows } = await ipdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  return nextNumber("admission", actor, rows.map((r) => r.admission_no ?? ""), { prefix, pad: 5 });
}

export async function admitPatient(input: unknown, actor: Session) {
  const data = validate(admitSchema, input);

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  let patientCode = data.patientCode ?? "";
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    assertOwnedByHospital(p, actor, "Patient");
    patientName = p.name;
    patientAge = p.age;
    patientCode = p.patient_code;
  }

  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    assertOwnedByHospital(d, actor, "Doctor");
    doctorName = d.name;
  }

  const nurse = await resolveNurse(data.primaryNurseId, actor);
  const admissionNo = await nextAdmissionNo(actor);

  // Resolve and occupy the bed.
  let ward = data.ward ?? "";
  let bedToOccupy: number | null = null;
  let bedLabel = "";
  const bedId = data.bedId ?? null;
  if (bedId) {
    const bed = await bedsRepo.getRow(bedId);
    assertOwnedByHospital(bed, actor, "Bed");
    if (bed.status === "Occupied") {
      throw new ConflictError(`Bed ${bed.bed_number} is already occupied`);
    }
    ward = bed.ward;
    bedLabel = bed.bed_number;
    bedToOccupy = bed.id;
  }

  const wardRow = ward
    ? await wardsRepo.findRow([
        { column: "name", op: "eq", value: ward },
        { column: "hospital_id", op: "eq", value: actor.hospitalId },
      ])
    : null;

  // Occupying the bed and creating the admission must land together, or a bed
  // is marked occupied for an admission that does not exist.
  const row = await transactional("ipd.admit", async (uow) => {
    if (bedToOccupy) {
      await uow.update(TABLES.beds, bedToOccupy, {
        status: "Occupied",
        patient_id: data.patientId ?? null,
        patient_name: patientName,
        patient_code: patientCode,
      });
    }
    return uow.insert<IpdAdmissionRow>(TABLES.ipdAdmissions, {
      hospital_id: actor.hospitalId,
      patient_id: data.patientId ?? null,
      patient_name: patientName,
      patient_age: patientAge,
      patient_code: patientCode,
      admission_date: isoDate(data.admissionDate) || displayDate(),
      ward_id: wardRow?.id ?? null,
      ward,
      bed_id: bedId,
      bed: bedLabel,
      doctor_id: data.doctorId ?? null,
      doctor: doctorName,
      diagnosis: data.diagnosis,
      credit_limit: data.creditLimit ?? 0,
      status: data.status,
      admission_no: admissionNo,
      admission_type: data.admissionType,
      is_mlc: data.isMlc,
      family_name: data.familyName,
      family_relation: data.familyRelation,
      family_phone: data.familyPhone,
      deposit_amount: data.depositAmount ?? 0,
      deposit_mode: data.depositAmount ? (data.depositMode ?? "Cash") : "",
      primary_nurse_id: nurse.id,
      primary_nurse: nurse.name,
      expected_stay_days: data.expectedStayDays ?? null,
      diet: data.diet,
    });
  });
  await audit(actor, "admit", "ipd", row.id, { bedId, ward, admissionNo });
  return (await withGender([toIpdDTO(row as IpdAdmissionRow)]))[0];
}

export async function updateIpd(id: number, input: unknown, actor: Session) {
  const existing = await ipdRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Admission");
  const data = validatePartial(admitSchema, input);
  const patch: Record<string, unknown> = {};
  if ("diagnosis" in data) patch.diagnosis = data.diagnosis;
  if ("creditLimit" in data) patch.credit_limit = data.creditLimit;
  if ("status" in data) patch.status = data.status;
  if ("admissionType" in data) patch.admission_type = data.admissionType;
  if ("isMlc" in data) patch.is_mlc = data.isMlc;
  if ("familyName" in data) patch.family_name = data.familyName;
  if ("familyRelation" in data) patch.family_relation = data.familyRelation;
  if ("familyPhone" in data) patch.family_phone = data.familyPhone;
  if ("depositAmount" in data) patch.deposit_amount = data.depositAmount ?? 0;
  if ("depositMode" in data) patch.deposit_mode = data.depositMode ?? "";
  if ("expectedStayDays" in data) patch.expected_stay_days = data.expectedStayDays ?? null;
  if ("diet" in data) patch.diet = data.diet;
  // `null` means "no nurse": the validator drops nulls, so look at the raw input for that key.
  if ("primaryNurseId" in ((input ?? {}) as Record<string, unknown>)) {
    const nurse = await resolveNurse(data.primaryNurseId, actor);
    patch.primary_nurse_id = nurse.id;
    patch.primary_nurse = nurse.name;
  }
  if ("doctorId" in data) {
    patch.doctor_id = data.doctorId ?? null;
    const d = data.doctorId ? await doctorsRepo.getRow(data.doctorId) : null;
    patch.doctor = d?.name ?? existing.doctor;
  }
  const row = await ipdRepo.update(id, patch);
  await audit(actor, "update", "ipd", id, patch);
  return toIpdDTO(row as IpdAdmissionRow);
}

/** Discharge an admission, freeing its bed. */
export async function dischargePatient(id: number, actor: Session) {
  const admission = await ipdRepo.getRow(id);
  assertOwnedByHospital(admission, actor, "Admission");
  if (admission.status === "Discharged") {
    throw new ConflictError("Patient is already discharged");
  }
  const row = await transactional("ipd.discharge", async (uow) => {
    if (admission.bed_id) {
      await uow.update(TABLES.beds, admission.bed_id, {
        status: "Available",
        patient_id: null,
        patient_name: null,
        patient_code: null,
      });
    }
    return uow.update<IpdAdmissionRow>(TABLES.ipdAdmissions, id, { status: "Discharged" });
  });
  await audit(actor, "discharge", "ipd", id, { bedId: admission.bed_id });
  // The chart now waits in the MRD coding queue.
  await queueForCoding(row as IpdAdmissionRow);
  return toIpdDTO(row as IpdAdmissionRow);
}

/** Move a patient to a different bed, updating both beds' occupancy. */
export async function transferBed(id: number, newBedId: number, actor: Session) {
  const admission = await ipdRepo.getRow(id);
  assertOwnedByHospital(admission, actor, "Admission");
  const target = await bedsRepo.getRow(newBedId);
  assertOwnedByHospital(target, actor, "Target bed");
  if (target.status === "Occupied") {
    throw new ConflictError(`Bed ${target.bed_number} is already occupied`);
  }
  if (admission.bed_id === newBedId) {
    throw new BadRequestError("Patient is already in that bed");
  }

  // Freeing the old bed, occupying the new one and moving the admission are a
  // single move — a partial failure would leave the patient in two beds.
  const row = await transactional("ipd.transfer", async (uow) => {
    if (admission.bed_id) {
      await uow.update(TABLES.beds, admission.bed_id, {
        status: "Available",
        patient_id: null,
        patient_name: null,
        patient_code: null,
      });
    }
    await uow.update(TABLES.beds, newBedId, {
      status: "Occupied",
      patient_id: admission.patient_id,
      patient_name: admission.patient_name,
      patient_code: admission.patient_code,
    });
    return uow.update<IpdAdmissionRow>(TABLES.ipdAdmissions, id, {
      bed_id: newBedId,
      bed: target.bed_number,
      ward: target.ward,
      ward_id: target.ward_id,
    });
  });
  await bedTransfersRepo.create({
    hospital_id: actor.hospitalId,
    patient_name: admission.patient_name,
    from_label: admission.bed ? `${admission.ward} · ${admission.bed}` : admission.ward || "—",
    to_label: `${target.ward} · ${target.bed_number}`,
    transfer_date: displayDate(),
    reason: "IPD transfer",
    status: "Completed",
  });
  await audit(actor, "transfer", "ipd", id, { from: admission.bed_id, to: newBedId });
  return toIpdDTO(row as IpdAdmissionRow);
}

export async function deleteIpd(id: number, actor: Session) {
  const admission = await ipdRepo.getRow(id);
  assertOwnedByHospital(admission, actor, "Admission");
  if (admission.bed_id && admission.status !== "Discharged") {
    await bedsRepo.update(admission.bed_id, {
      status: "Available",
      patient_id: null,
      patient_name: null,
      patient_code: null,
    });
  }
  await ipdRepo.remove(id);
  await audit(actor, "delete", "ipd", id);
}
