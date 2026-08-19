/**
 * Patients service — registration, updates, and patient-centric reads.
 */
import {
  patientsRepo,
  prescriptionsRepo,
  labRepo,
  doctorsRepo,
  appointmentsRepo,
  opdRepo,
  billsRepo,
  radiologyRepo,
  ipdRepo,
  otRepo,
  bedsRepo,
  bloodIssuesRepo,
  tpaClaimsRepo,
  pharmacySalesRepo,
  scribeNotesRepo,
} from "@/server/repositories";
import { toPatientDTO } from "@/server/repositories/mappers";
import { type QueryOptions, type Row } from "@/server/db/adapter";
import { type PatientRow } from "@/server/db/tables";
import { type Repository } from "@/server/repositories/base";
import { validate, validatePartial } from "@/server/lib/validation";
import {
  ageFromDob,
  displayDate,
  displayTime,
  nextCode,
} from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { toPrescriptionDTO } from "@/server/repositories/mappers";
import { mobileRule, dobRule, optionalMobileRule } from "@/server/lib/field-rules";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";
import { enrichLab } from "@/server/services/lab-service";
import { enrichRadiology } from "@/server/services/radiology-service";

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
  return patientsRepo.list(scopeToHospital(options, actor));
}

export async function getPatient(id: number, actor: Session) {
  const row = await patientsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Patient");
  return toPatientDTO(row);
}

export async function getPatientDetail(id: number, actor: Session) {
  const patient = await getPatient(id, actor);
  const [rxRows, labRows, radiologyRows] = await Promise.all([
    prescriptionsRepo.listRows({
      filters: [{ column: "patient_id", op: "eq", value: id }],
      unpaged: true,
    }),
    labRepo.listRows({
      filters: [{ column: "patient_id", op: "eq", value: id }],
      unpaged: true,
    }),
    radiologyRepo.listRows({
      filters: [{ column: "patient_id", op: "eq", value: id }],
      unpaged: true,
    }),
  ]);
  const [labTests, radiologyTests] = await Promise.all([
    enrichLab(labRows.rows),
    enrichRadiology(radiologyRows.rows),
  ]);
  return {
    ...patient,
    prescriptions: rxRows.rows.map((r) => toPrescriptionDTO(r)),
    labTests,
    radiologyTests,
  };
}

async function resolveDoctor(doctorId: number | undefined, actor: Session): Promise<string> {
  if (!doctorId) return "";
  const doc = await doctorsRepo.getRow(doctorId);
  if (!doc || doc.hospital_id !== actor.hospitalId) return "";
  return doc.name;
}

/**
 * Tables that denormalize `patient_name` alongside `patient_id`. Renaming a
 * patient must cascade into every one of them, or modules keep showing the
 * name as it was on the day the record was created.
 */
const PATIENT_NAME_CASCADE_REPOS: Repository<Row, unknown>[] = [
  appointmentsRepo,
  opdRepo,
  prescriptionsRepo,
  labRepo,
  billsRepo,
  radiologyRepo,
  ipdRepo,
  otRepo,
  bedsRepo,
  bloodIssuesRepo,
  tpaClaimsRepo,
  pharmacySalesRepo,
  scribeNotesRepo,
];

async function cascadePatientName(patientId: number, name: string): Promise<void> {
  await Promise.all(
    PATIENT_NAME_CASCADE_REPOS.map(async (repo) => {
      const { rows } = await repo.listRows({
        filters: [{ column: "patient_id", op: "eq", value: patientId }],
        unpaged: true,
      });
      await Promise.all(rows.map((row) => repo.update(row.id, { patient_name: name })));
    }),
  );
}

export async function createPatient(input: unknown, actor: Session) {
  const data = validate(createSchema, input);

  const existing = await patientsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const code = nextCode(
    existing.rows.map((r) => r.patient_code),
    "HMS-",
    4,
  );

  const age = data.age ?? (data.dob ? ageFromDob(String(data.dob)) : 0);
  const doctorName = await resolveDoctor(data.doctorId, actor);

  const row = await patientsRepo.create({
    hospital_id: actor.hospitalId,
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
  assertOwnedByHospital(existing, actor, "Patient");
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
    patch.doctor = await resolveDoctor(data.doctorId as number | undefined, actor);
  }

  const row = await patientsRepo.update(id, patch);
  if (typeof patch.name === "string" && patch.name !== existing.name) {
    await cascadePatientName(id, patch.name);
  }
  await audit(actor, "update", "patient", id, patch);
  return toPatientDTO(row as PatientRow);
}

export async function deletePatient(id: number, actor: Session) {
  const existing = await patientsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Patient");
  await patientsRepo.remove(id);
  await audit(actor, "delete", "patient", id);
}
