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
} from "@/server/repositories";
import { toIpdDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type IpdAdmissionRow } from "@/server/db/tables";
import { NotFoundError, ConflictError, BadRequestError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

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
  status: { type: "enum", required: false, values: ["Admitted", "ICU", "Discharged"], default: "Admitted" },
} as const;

export const IPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "patient_code", "ward", "bed", "doctor", "diagnosis"],
  filterable: ["status", "ward"],
  sortable: ["admission_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listIpd(options: QueryOptions) {
  return ipdRepo.list(options);
}

export async function getIpd(id: number) {
  const r = await ipdRepo.get(id);
  if (!r) throw new NotFoundError("Admission");
  return r;
}

export async function admitPatient(input: unknown, actor: Session) {
  const data = validate(admitSchema, input);

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  let patientCode = data.patientCode ?? "";
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
      patientCode = p.patient_code;
    }
  }

  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    if (d) doctorName = d.name;
  }

  // Resolve and occupy the bed.
  let ward = data.ward ?? "";
  let bedLabel = "";
  let bedId = data.bedId ?? null;
  if (bedId) {
    const bed = await bedsRepo.getRow(bedId);
    if (!bed) throw new NotFoundError("Bed");
    if (bed.status === "Occupied") {
      throw new ConflictError(`Bed ${bed.bed_number} is already occupied`);
    }
    ward = bed.ward;
    bedLabel = bed.bed_number;
    await bedsRepo.update(bed.id, {
      status: "Occupied",
      patient_id: data.patientId ?? null,
      patient_name: patientName,
      patient_code: patientCode,
    });
  }

  const wardRow = ward
    ? await wardsRepo.findRow([{ column: "name", op: "eq", value: ward }])
    : null;

  const row = await ipdRepo.create({
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    patient_code: patientCode,
    admission_date: displayDate(),
    ward_id: wardRow?.id ?? null,
    ward,
    bed_id: bedId,
    bed: bedLabel,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    diagnosis: data.diagnosis,
    status: data.status,
  });
  await audit(actor, "admit", "ipd", row.id, { bedId, ward });
  return toIpdDTO(row as IpdAdmissionRow);
}

export async function updateIpd(id: number, input: unknown, actor: Session) {
  const existing = await ipdRepo.getRow(id);
  if (!existing) throw new NotFoundError("Admission");
  const data = validatePartial(admitSchema, input);
  const patch: Record<string, unknown> = {};
  if ("diagnosis" in data) patch.diagnosis = data.diagnosis;
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
  if (!admission) throw new NotFoundError("Admission");
  if (admission.status === "Discharged") {
    throw new ConflictError("Patient is already discharged");
  }
  if (admission.bed_id) {
    await bedsRepo.update(admission.bed_id, {
      status: "Available",
      patient_id: null,
      patient_name: null,
      patient_code: null,
    });
  }
  const row = await ipdRepo.update(id, { status: "Discharged" });
  await audit(actor, "discharge", "ipd", id, { bedId: admission.bed_id });
  return toIpdDTO(row as IpdAdmissionRow);
}

/** Move a patient to a different bed, updating both beds' occupancy. */
export async function transferBed(id: number, newBedId: number, actor: Session) {
  const admission = await ipdRepo.getRow(id);
  if (!admission) throw new NotFoundError("Admission");
  const target = await bedsRepo.getRow(newBedId);
  if (!target) throw new NotFoundError("Target bed");
  if (target.status === "Occupied") {
    throw new ConflictError(`Bed ${target.bed_number} is already occupied`);
  }
  if (admission.bed_id === newBedId) {
    throw new BadRequestError("Patient is already in that bed");
  }

  if (admission.bed_id) {
    await bedsRepo.update(admission.bed_id, {
      status: "Available",
      patient_id: null,
      patient_name: null,
      patient_code: null,
    });
  }
  await bedsRepo.update(newBedId, {
    status: "Occupied",
    patient_id: admission.patient_id,
    patient_name: admission.patient_name,
    patient_code: admission.patient_code,
  });
  const row = await ipdRepo.update(id, {
    bed_id: newBedId,
    bed: target.bed_number,
    ward: target.ward,
    ward_id: target.ward_id,
  });
  await audit(actor, "transfer", "ipd", id, { from: admission.bed_id, to: newBedId });
  return toIpdDTO(row as IpdAdmissionRow);
}

export async function deleteIpd(id: number, actor: Session) {
  const admission = await ipdRepo.getRow(id);
  if (!admission) throw new NotFoundError("Admission");
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
