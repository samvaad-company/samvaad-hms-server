/**
 * Staff service — non-clinical personnel directory CRUD.
 */
import { staffRepo, departmentsRepo } from "@/repositories";
import { toStaffDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type StaffRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { displayDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { approvedLeaveDays } from "@/services/hr-leave-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const schema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  role: { type: "string", required: true, max: 80 },
  departmentId: { type: "number", required: false },
  department: { type: "string", required: false, max: 80, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  email: { type: "string", required: false, max: 160, default: "" },
  joinDate: { type: "string", required: false, max: 40 },
  status: { type: "enum", required: false, values: ["Active", "On Leave", "Inactive"], default: "Active" },
  employeeNo: { type: "string", required: false, max: 30 },
  gender: { type: "string", required: false, max: 20, default: "" },
  address: { type: "string", required: false, max: 300, default: "" },
  qualification: { type: "string", required: false, max: 200, default: "" },
  licenceNo: { type: "string", required: false, max: 60, default: "" },
  emergencyName: { type: "string", required: false, max: 120, default: "" },
  emergencyPhone: { type: "string", required: false, max: 20, default: "" },
} as const;

/** Dates are optional and clearable (null or ""), so they're read from the raw body rather than the scalar schema. */
function optionalDate(body: Record<string, unknown>, field: "dob" | "licenceExpiry"): string | null | undefined {
  if (!(field in body)) return undefined;
  const v = body[field];
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) {
    throw new ValidationError([{ field, message: `${field} must be a date like 2026-10-28` }]);
  }
  return v;
}

/** Profile columns shared by create and update (only the ones present). */
function profilePatch(data: Record<string, unknown>, body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if ("gender" in data) patch.gender = data.gender;
  if ("address" in data) patch.address = data.address;
  if ("qualification" in data) patch.qualification = data.qualification;
  if ("licenceNo" in data) patch.licence_no = data.licenceNo;
  if ("emergencyName" in data) patch.emergency_name = data.emergencyName;
  if ("emergencyPhone" in data) patch.emergency_phone = data.emergencyPhone;
  const dob = optionalDate(body, "dob");
  if (dob !== undefined) patch.dob = dob;
  const exp = optionalDate(body, "licenceExpiry");
  if (exp !== undefined) patch.licence_expiry = exp;
  return patch;
}

async function assertEmployeeNoFree(no: string, actor: Session, exceptId?: number) {
  const { rows } = await staffRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "employee_no", op: "eq", value: no }] }, actor));
  if (rows.some((r) => r.id !== exceptId)) throw new ConflictError(`Employee ID ${no} is already used by someone else`);
}

/** Anyone with approved leave today shows as On Leave in the directory, without anyone editing their status. */
async function overlayLeave<T extends { id: number; status: string }>(rows: T[], actor: Session): Promise<T[]> {
  if (rows.length === 0) return rows;
  const today = localDate();
  const onLeave = new Set((await approvedLeaveDays(today, today, actor)).map((l) => l.staffId));
  if (onLeave.size === 0) return rows;
  return rows.map((r) => (r.status === "Active" && onLeave.has(r.id) ? { ...r, status: "On Leave" } : r));
}

export const STAFF_LIST_CONFIG = {
  searchColumns: ["name", "role", "department", "email", "phone"],
  filterable: ["status", "department", "role"],
  sortable: ["name", "join_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listStaff(options: QueryOptions, actor: Session) {
  const res = await staffRepo.list(scopeToHospital(options, actor));
  return { ...res, rows: await overlayLeave(res.rows, actor) };
}

export async function getStaff(id: number, actor: Session) {
  const row = await staffRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Staff member");
  return (await overlayLeave([toStaffDTO(row)], actor))[0];
}

async function deptName(id?: number, fallback = ""): Promise<string> {
  if (!id) return fallback;
  const d = await departmentsRepo.getRow(id);
  return d?.name ?? fallback;
}

export async function createStaff(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const body = (input ?? {}) as Record<string, unknown>;
  const department = await deptName(data.departmentId, data.department ?? "");
  if (data.employeeNo) await assertEmployeeNoFree(data.employeeNo, actor);
  const row = await staffRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    role: data.role,
    department_id: data.departmentId ?? null,
    department,
    phone: data.phone,
    email: data.email,
    join_date: data.joinDate ?? displayDate(),
    status: data.status,
    employee_no: data.employeeNo ?? null,
    ...profilePatch(data, body),
  });
  await audit(actor, "create", "staff", row.id);
  return toStaffDTO(row as StaffRow);
}

export async function updateStaff(id: number, input: unknown, actor: Session) {
  const existing = await staffRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Staff member");
  const data = validatePartial(schema, input);
  const body = (input ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = profilePatch(data, body);
  if ("employeeNo" in data && data.employeeNo !== existing.employee_no) {
    await assertEmployeeNoFree(data.employeeNo as string, actor, id);
    patch.employee_no = data.employeeNo;
  }
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
  const existing = await staffRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Staff member");
  await staffRepo.remove(id);
  await audit(actor, "delete", "staff", id);
}
