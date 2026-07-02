/**
 * Doctors service — directory CRUD plus per-doctor workload reads.
 */
import {
  doctorsRepo,
  appointmentsRepo,
  opdRepo,
  departmentsRepo,
} from "@/server/repositories";
import { toDoctorDTO, toAppointmentDTO, toOpdDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type DoctorRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

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

export async function listDoctors(options: QueryOptions) {
  return doctorsRepo.list(options);
}

export async function getDoctor(id: number) {
  const doc = await doctorsRepo.get(id);
  if (!doc) throw new NotFoundError("Doctor");
  return doc;
}

export async function getDoctorDashboard(id: number) {
  const doctor = await getDoctor(id);
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

export async function updateDoctor(id: number, input: unknown, actor: Session) {
  const existing = await doctorsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Doctor");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("specialty" in data) patch.specialty = data.specialty;
  if ("phone" in data) patch.phone = data.phone;
  if ("experience" in data) patch.experience = data.experience;
  if ("status" in data) patch.status = data.status;
  if ("departmentId" in data) {
    patch.department_id = data.departmentId ?? null;
    patch.department = await deptName(data.departmentId as number | undefined, existing.department);
  }
  const row = await doctorsRepo.update(id, patch);
  await audit(actor, "update", "doctor", id, patch);
  return toDoctorDTO(row as DoctorRow);
}

export async function deleteDoctor(id: number, actor: Session) {
  const ok = await doctorsRepo.remove(id);
  if (!ok) throw new NotFoundError("Doctor");
  await audit(actor, "delete", "doctor", id);
}
