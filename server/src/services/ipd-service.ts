/**
 * IPD service — inpatient admissions wired to bed occupancy. Admitting a
 * patient occupies a bed; discharging frees it.
 */
import {
  ipdRepo,
  bedsRepo,
  patientsRepo,
  doctorsRepo,
  wardsRepo,
  bedTransfersRepo,
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
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const admitSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  patientCode: { type: "string", required: false, max: 40, default: "" },
  bedId: { type: "number", required: false },
  ward: { type: "string", required: false, max: 80, default: "" },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  diagnosis: { type: "string", required: true, min: 2, max: 240 },
  admissionDate: { type: "string", required: false, max: 40, custom: validateNotPast("admission date") },
  creditLimit: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Admitted", "ICU", "Discharged"], default: "Admitted" },
} as const;

export const IPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "patient_code", "ward", "bed", "doctor", "diagnosis"],
  filterable: ["status", "ward"],
  sortable: ["admission_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listIpd(options: QueryOptions, actor: Session) {
  return ipdRepo.list(
    scopeToHospital(scopeToOwnDoctor(options, actor, "doctor_id"), actor),
  );
}

export async function getIpd(id: number, actor: Session) {
  const row = await ipdRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Admission");
  return toIpdDTO(row);
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
    });
  });
  await audit(actor, "admit", "ipd", row.id, { bedId, ward });
  return toIpdDTO(row as IpdAdmissionRow);
}

export async function updateIpd(id: number, input: unknown, actor: Session) {
  const existing = await ipdRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Admission");
  const data = validatePartial(admitSchema, input);
  const patch: Record<string, unknown> = {};
  if ("diagnosis" in data) patch.diagnosis = data.diagnosis;
  if ("creditLimit" in data) patch.credit_limit = data.creditLimit;
  if ("status" in data) patch.status = data.status;
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
