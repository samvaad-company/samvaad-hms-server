/**
 * Doctors service — directory CRUD plus per-doctor workload reads.
 */
import {
  doctorsRepo,
  appointmentsRepo,
  opdRepo,
  departmentsRepo,
  usersRepo,
} from "@/repositories";
import { toDoctorDTO, toAppointmentDTO, toOpdDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type DoctorRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const schema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  specialty: { type: "string", required: false, max: 120, default: "" },
  departmentId: { type: "number", required: false },
  department: { type: "string", required: false, max: 120, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  experience: { type: "string", required: false, max: 40, default: "" },
  status: {
    type: "enum",
    required: false,
    values: ["Active", "On Leave", "In OPD"],
    default: "Active",
  },
} as const;

export const DOCTOR_LIST_CONFIG = {
  searchColumns: ["name", "specialty", "department", "phone"],
  filterable: ["status", "department"],
  sortable: ["name", "patients_today", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/**
 * "Patients today" is derived from the live OPD queue rather than stored, so
 * the number on the doctors list always agrees with the queue, the doctor
 * dashboard and the reports. A stored counter drifts the moment a visit is
 * checked in, deleted or reassigned.
 */
async function withLiveCounts<T extends { id: number; patientsToday: number }>(
  doctors: T[],
  actor: Session,
): Promise<T[]> {
  const { rows } = await opdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.doctor_id == null) continue;
    counts.set(r.doctor_id, (counts.get(r.doctor_id) ?? 0) + 1);
  }
  return doctors.map((d) => ({ ...d, patientsToday: counts.get(d.id) ?? 0 }));
}

export async function listDoctors(options: QueryOptions, actor: Session) {
  const { rows, total } = await doctorsRepo.list(scopeToHospital(options, actor));
  return { rows: await withLiveCounts(rows, actor), total };
}

export async function getDoctor(id: number, actor: Session) {
  const row = await doctorsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Doctor");
  const [withCount] = await withLiveCounts([toDoctorDTO(row)], actor);
  return withCount;
}

export async function getDoctorDashboard(id: number, actor: Session) {
  const doctor = await getDoctor(id, actor);
  const [appts, opd] = await Promise.all([
    appointmentsRepo.listRows({
      filters: [{ column: "doctor_id", op: "eq", value: id }],
      unpaged: true,
    }),
    opdRepo.listRows({
      filters: [{ column: "doctor_id", op: "eq", value: id }],
      unpaged: true,
    }),
  ]);
  return {
    doctor,
    appointments: appts.rows.map(toAppointmentDTO),
    queue: opd.rows.map(toOpdDTO),
  };
}

async function deptName(id?: number, fallback = ""): Promise<string> {
  if (!id) return fallback;
  const d = await departmentsRepo.getRow(id);
  return d?.name ?? fallback;
}

export async function createDoctor(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const department = await deptName(data.departmentId, data.department ?? "");
  const row = await doctorsRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    specialty: data.specialty,
    department_id: data.departmentId ?? null,
    department,
    phone: data.phone,
    experience: data.experience,
    patients_today: 0,
    status: data.status,
  });
  await audit(actor, "create", "doctor", row.id);
  return toDoctorDTO(row as DoctorRow);
}

/** Appointments and OPD visits carry the doctor's name; keep them in step when the name changes. */
async function propagateDoctorName(id: number, name: string): Promise<void> {
  for (const repo of [appointmentsRepo, opdRepo] as const) {
    const { rows } = await repo.listRows({ filters: [{ column: "doctor_id", op: "eq", value: id }], unpaged: true });
    for (const r of rows) if (r.doctor !== name) await repo.update(r.id, { doctor: name });
  }
  const login = await usersRepo.findRow([{ column: "doctor_id", op: "eq", value: id }]);
  if (login && login.name !== name) await usersRepo.update(login.id, { name });
}

/** Apply a validated partial edit to a doctor record, keeping the denormalised names consistent. */
async function applyDoctorEdit(existing: DoctorRow, input: unknown, allowed: readonly string[], actor: Session) {
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  // validatePartial skips blanks, so a cleared name would silently do nothing — say so instead.
  const rawName = (input as Record<string, unknown> | null)?.name;
  if (allowed.includes("name") && typeof rawName === "string" && !rawName.trim()) {
    throw new ValidationError([{ field: "name", message: "is required" }]);
  }
  if (allowed.includes("name") && data.name) patch.name = data.name;
  if (allowed.includes("specialty") && "specialty" in data) patch.specialty = data.specialty;
  if (allowed.includes("phone") && "phone" in data) patch.phone = data.phone;
  if (allowed.includes("experience") && "experience" in data) patch.experience = data.experience;
  if (allowed.includes("status") && "status" in data) patch.status = data.status;
  if (allowed.includes("department")) {
    if ("departmentId" in data) {
      patch.department_id = data.departmentId ?? null;
      patch.department = await deptName(data.departmentId as number | undefined, existing.department);
    } else if ("department" in data) {
      patch.department = data.department;
    }
  }
  const row = (await doctorsRepo.update(existing.id, patch)) as DoctorRow;
  if (typeof patch.name === "string" && patch.name !== existing.name) await propagateDoctorName(existing.id, patch.name);
  await audit(actor, "update", "doctor", existing.id, patch);
  return row;
}

const ADMIN_EDITABLE = ["name", "specialty", "department", "phone", "experience", "status"] as const;
/** What a doctor may change on their own record — not their department. */
export const SELF_EDITABLE = ["name", "specialty", "phone", "experience", "status"] as const;

export async function updateDoctor(id: number, input: unknown, actor: Session) {
  const existing = await doctorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Doctor");
  return toDoctorDTO(await applyDoctorEdit(existing, input, ADMIN_EDITABLE, actor));
}

/** A doctor edits their own record (called from the profile endpoint). */
export async function updateOwnDoctorRecord(doctorId: number, input: unknown, actor: Session) {
  const existing = await doctorsRepo.getRow(doctorId);
  assertOwnedByHospital(existing, actor, "Doctor");
  return toDoctorDTO(await applyDoctorEdit(existing, input, SELF_EDITABLE, actor));
}

export async function deleteDoctor(id: number, actor: Session) {
  const existing = await doctorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Doctor");
  await doctorsRepo.remove(id);
  await audit(actor, "delete", "doctor", id);
}
