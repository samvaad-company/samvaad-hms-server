/**
 * Patients service — registration, updates, and patient-centric reads.
 */
import {
  patientsRepo,
  prescriptionsRepo,
  labRepo,
  doctorsRepo,
} from "@/server/repositories";
import { toPatientDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type PatientRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import {
  ageFromDob,
  displayDate,
  displayTime,
  nextCode,
} from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToOwnDoctor } from "@/server/services/doctor-scope";
import { toPrescriptionDTO, toLabDTO } from "@/server/repositories/mappers";
import { mobileRule, dobRule, optionalMobileRule } from "@/server/lib/field-rules";

const createSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  phone: mobileRule,
  dob: dobRule,
  age: { type: "number", required: false, min: 0, max: 200 },
  gender: { type: "enum", required: true, values: ["Male", "Female", "Other"] },
  email: { type: "string", required: false, max: 160 },
  bloodGroup: {
    type: "enum",
    required: false,
    values: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  reason: { type: "string", required: false, max: 240, default: "General consultation" },
  doctorId: { type: "number", required: false },
  allergies: { type: "string", required: false, max: 500 },
  chronic: { type: "string", required: false, max: 500 },
  abhaId: { type: "string", required: false, max: 40 },
  address: { type: "string", required: false, max: 240 },
  city: { type: "string", required: false, max: 80 },
  state: { type: "string", required: false, max: 80 },
  pincode: { type: "string", required: false, max: 12 },
  emergencyName: { type: "string", required: false, max: 120 },
  emergencyRelation: { type: "string", required: false, max: 40 },
  emergencyPhone: optionalMobileRule,
  insurer: { type: "string", required: false, max: 120 },
  policyNumber: { type: "string", required: false, max: 80 },
  corporate: { type: "string", required: false, max: 120 },
  status: {
    type: "enum",
    required: false,
    values: ["Completed", "Today", "Upcoming", "Cancelled"],
    default: "Today",
  },
} as const;

export const PATIENT_LIST_CONFIG = {
  searchColumns: ["name", "patient_code", "doctor", "reason", "phone"],
  filterable: ["status", "gender", "doctor"],
  sortable: ["name", "age", "visit_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listPatients(options: QueryOptions, actor: Session) {
  return patientsRepo.list(scopeToOwnDoctor(options, actor, "doctor_id"));
}

export async function getPatient(id: number) {
  const patient = await patientsRepo.get(id);
  if (!patient) throw new NotFoundError("Patient");
  return patient;
}

export async function getPatientDetail(id: number) {
  const patient = await getPatient(id);
  const [rxRows, labRows] = await Promise.all([
    prescriptionsRepo.listRows({
      filters: [{ column: "patient_id", op: "eq", value: id }],
      unpaged: true,
    }),
    labRepo.listRows({
      filters: [{ column: "patient_id", op: "eq", value: id }],
      unpaged: true,
    }),
  ]);
  return {
    ...patient,
    prescriptions: rxRows.rows.map((r) => toPrescriptionDTO(r)),
    labTests: labRows.rows.map(toLabDTO),
  };
}

async function resolveDoctor(doctorId?: number): Promise<string> {
  if (!doctorId) return "";
  const doc = await doctorsRepo.getRow(doctorId);
  return doc?.name ?? "";
}

export async function createPatient(input: unknown, actor: Session) {
  const data = validate(createSchema, input);

  const existing = await patientsRepo.listRows({ unpaged: true });
  const code = nextCode(
    existing.rows.map((r) => r.patient_code),
    "HMS-",
    4,
  );

  const age = data.age ?? (data.dob ? ageFromDob(String(data.dob)) : 0);
  const doctorName = await resolveDoctor(data.doctorId);

  const row = await patientsRepo.create({
    patient_code: code,
    name: data.name,
    age,
    gender: data.gender,
    phone: data.phone,
    email: data.email ?? null,
    blood_group: data.bloodGroup ?? null,
    dob: data.dob ?? null,
    reason: data.reason,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    status: data.status,
    visit_date: displayDate(),
    visit_time: displayTime(),
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    pincode: data.pincode ?? null,
    allergies: data.allergies ?? null,
    chronic_conditions: data.chronic ?? null,
    abha_id: data.abhaId ?? null,
    emergency_name: data.emergencyName ?? null,
    emergency_relation: data.emergencyRelation ?? null,
    emergency_phone: data.emergencyPhone ?? null,
    insurer: data.insurer ?? null,
    policy_number: data.policyNumber ?? null,
    corporate: data.corporate ?? null,
  });

  await audit(actor, "create", "patient", row.id, { code });
  return toPatientDTO(row as PatientRow);
}

export async function updatePatient(id: number, input: unknown, actor: Session) {
  const existing = await patientsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Patient");
  const data = validatePartial(createSchema, input);

  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    name: "name",
    phone: "phone",
    email: "email",
    gender: "gender",
    bloodGroup: "blood_group",
    reason: "reason",
    status: "status",
    dob: "dob",
    allergies: "allergies",
    chronic: "chronic_conditions",
    abhaId: "abha_id",
    address: "address",
    city: "city",
    state: "state",
    pincode: "pincode",
    emergencyName: "emergency_name",
    emergencyRelation: "emergency_relation",
    emergencyPhone: "emergency_phone",
    insurer: "insurer",
    policyNumber: "policy_number",
    corporate: "corporate",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in data) patch[col] = (data as Record<string, unknown>)[key];
  }
  if ("age" in data) patch.age = data.age;
  if ("dob" in data && data.dob) patch.age = ageFromDob(String(data.dob));
  if ("doctorId" in data) {
    patch.doctor_id = data.doctorId ?? null;
    patch.doctor = await resolveDoctor(data.doctorId as number | undefined);
  }

  const row = await patientsRepo.update(id, patch);
  await audit(actor, "update", "patient", id, patch);
  return toPatientDTO(row as PatientRow);
}

export async function deletePatient(id: number, actor: Session) {
  const ok = await patientsRepo.remove(id);
  if (!ok) throw new NotFoundError("Patient");
  await audit(actor, "delete", "patient", id);
}
