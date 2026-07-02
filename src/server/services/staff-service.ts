/**
 * Staff service — non-clinical personnel directory CRUD.
 */
import { staffRepo, departmentsRepo } from "@/server/repositories";
import { toStaffDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type StaffRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

const schema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  role: { type: "string", required: true, max: 80 },
  departmentId: { type: "number", required: false },
  department: { type: "string", required: false, max: 80, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  email: { type: "string", required: false, max: 160, default: "" },
  joinDate: { type: "string", required: false, max: 40 },
  status: { type: "enum", required: false, values: ["Active", "On Leave", "Inactive"], default: "Active" },
} as const;

export const STAFF_LIST_CONFIG = {
  searchColumns: ["name", "role", "department", "email", "phone"],
  filterable: ["status", "department", "role"],
  sortable: ["name", "join_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listStaff(options: QueryOptions) {
  return staffRepo.list(options);
}

export async function getStaff(id: number) {
  const s = await staffRepo.get(id);
  if (!s) throw new NotFoundError("Staff member");
  return s;
}

async function deptName(id?: number, fallback = ""): Promise<string> {
  if (!id) return fallback;
  const d = await departmentsRepo.getRow(id);
  return d?.name ?? fallback;
}

export async function createStaff(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const department = await deptName(data.departmentId, data.department ?? "");
  const row = await staffRepo.create({
    name: data.name,
    role: data.role,
    department_id: data.departmentId ?? null,
    department,
    phone: data.phone,
    email: data.email,
    join_date: data.joinDate ?? displayDate(),
    status: data.status,
  });
  await audit(actor, "create", "staff", row.id);
  return toStaffDTO(row as StaffRow);
}

export async function updateStaff(id: number, input: unknown, actor: Session) {
  const existing = await staffRepo.getRow(id);
  if (!existing) throw new NotFoundError("Staff member");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("role" in data) patch.role = data.role;
  if ("phone" in data) patch.phone = data.phone;
  if ("email" in data) patch.email = data.email;
  if ("joinDate" in data) patch.join_date = data.joinDate;
  if ("status" in data) patch.status = data.status;
  if ("departmentId" in data) {
    patch.department_id = data.departmentId ?? null;
    patch.department = await deptName(data.departmentId as number | undefined, existing.department);
  }
  const row = await staffRepo.update(id, patch);
  await audit(actor, "update", "staff", id, patch);
  return toStaffDTO(row as StaffRow);
}

export async function deleteStaff(id: number, actor: Session) {
  const ok = await staffRepo.remove(id);
  if (!ok) throw new NotFoundError("Staff member");
  await audit(actor, "delete", "staff", id);
}
