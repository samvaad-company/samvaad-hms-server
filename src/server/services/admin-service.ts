/**
 * Admin service — hospital settings, departments, system users, role
 * permissions, and the medicine catalog.
 */
import {
  settingsRepo,
  departmentsRepo,
  usersRepo,
  medicinesRepo,
} from "@/server/repositories";
import {
  toDepartmentDTO,
  toAdminUserDTO,
  toMedicineDTO,
} from "@/server/repositories/mappers";
import { hashPassword } from "@/server/auth/password";
import { ROLE_PERMISSIONS, RESOURCES } from "@/server/auth/rbac";
import { NotFoundError, ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type QueryOptions } from "@/server/db/adapter";

// ── Hospital settings ────────────────────────────────────────────────────────

export async function getSettings() {
  const row = await settingsRepo.getRow(1);
  if (!row) throw new NotFoundError("Hospital settings");
  return {
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    website: row.website,
    gstNumber: row.gst_number,
    panNumber: row.pan_number,
    regNumber: row.reg_number,
    workingHours: row.working_hours,
  };
}

const settingsSchema = {
  name: { type: "string", required: false, max: 160 },
  address: { type: "string", required: false, max: 240 },
  city: { type: "string", required: false, max: 80 },
  state: { type: "string", required: false, max: 80 },
  pincode: { type: "string", required: false, max: 12 },
  phone: { type: "string", required: false, max: 30 },
  mobile: { type: "string", required: false, max: 30 },
  email: { type: "string", required: false, max: 160 },
  website: { type: "string", required: false, max: 160 },
  gstNumber: { type: "string", required: false, max: 40 },
  panNumber: { type: "string", required: false, max: 20 },
  regNumber: { type: "string", required: false, max: 40 },
} as const;

export async function updateSettings(input: unknown, actor: Session) {
  const data = validatePartial(settingsSchema, input);
  const map: Record<string, string> = {
    name: "name",
    address: "address",
    city: "city",
    state: "state",
    pincode: "pincode",
    phone: "phone",
    mobile: "mobile",
    email: "email",
    website: "website",
    gstNumber: "gst_number",
    panNumber: "pan_number",
    regNumber: "reg_number",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in data) patch[col] = (data as Record<string, unknown>)[key];
  }
  if ((input as { workingHours?: unknown }).workingHours) {
    patch.working_hours = (input as { workingHours: unknown }).workingHours;
  }
  await settingsRepo.update(1, patch);
  await audit(actor, "update", "settings", 1, patch);
  return getSettings();
}

// ── Departments ──────────────────────────────────────────────────────────────

const deptSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  head: { type: "string", required: false, max: 120, default: "" },
  ext: { type: "string", required: false, max: 12, default: "" },
} as const;

export async function listDepartments() {
  const { rows } = await departmentsRepo.listRows({ unpaged: true });
  return rows.map(toDepartmentDTO);
}

export async function createDepartment(input: unknown, actor: Session) {
  const data = validate(deptSchema, input);
  const row = await departmentsRepo.create({
    name: data.name,
    head: data.head,
    extension: data.ext,
  });
  await audit(actor, "create", "department", row.id);
  return toDepartmentDTO(row);
}

export async function updateDepartment(id: number, input: unknown, actor: Session) {
  const existing = await departmentsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Department");
  const data = validatePartial(deptSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("head" in data) patch.head = data.head;
  if ("ext" in data) patch.extension = data.ext;
  const row = await departmentsRepo.update(id, patch);
  await audit(actor, "update", "department", id, patch);
  return toDepartmentDTO(row!);
}

export async function deleteDepartment(id: number, actor: Session) {
  const ok = await departmentsRepo.remove(id);
  if (!ok) throw new NotFoundError("Department");
  await audit(actor, "delete", "department", id);
}

// ── System users ─────────────────────────────────────────────────────────────

async function deptNameFor(id: number | null): Promise<string | null> {
  if (!id) return null;
  const d = await departmentsRepo.getRow(id);
  return d?.name ?? null;
}

export async function listUsers() {
  const { rows } = await usersRepo.listRows({ unpaged: true });
  const result = [];
  for (const u of rows) {
    result.push(toAdminUserDTO(u, await deptNameFor(u.department_id)));
  }
  return result;
}

const userCreateSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  email: { type: "string", required: true, min: 5, max: 160, pattern: /.+@.+\..+/ },
  password: { type: "string", required: true, min: 6, max: 100 },
  role: { type: "string", required: true, max: 60 },
  departmentId: { type: "number", required: false },
  status: { type: "enum", required: false, values: ["Active", "Inactive"], default: "Active" },
} as const;

export async function createUser(input: unknown, actor: Session) {
  const data = validate(userCreateSchema, input);
  const existing = await usersRepo.findRow([
    { column: "email", op: "eq", value: data.email.toLowerCase() },
  ]);
  if (existing) throw new ConflictError("A user with that email already exists");

  const row = await usersRepo.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password_hash: await hashPassword(data.password),
    role: data.role,
    department_id: data.departmentId ?? null,
    status: data.status,
    last_login_at: null,
  });
  await audit(actor, "create", "user", row.id, { role: data.role });
  return toAdminUserDTO(row, await deptNameFor(row.department_id));
}

const userUpdateSchema = {
  name: { type: "string", required: false, min: 2, max: 120 },
  role: { type: "string", required: false, max: 60 },
  departmentId: { type: "number", required: false },
  status: { type: "enum", required: false, values: ["Active", "Inactive"] },
  password: { type: "string", required: false, min: 6, max: 100 },
} as const;

export async function updateUser(id: number, input: unknown, actor: Session) {
  const existing = await usersRepo.getRow(id);
  if (!existing) throw new NotFoundError("User");
  const data = validatePartial(userUpdateSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("role" in data) patch.role = data.role;
  if ("status" in data) patch.status = data.status;
  if ("departmentId" in data) patch.department_id = data.departmentId ?? null;
  if ("password" in data && data.password) {
    patch.password_hash = await hashPassword(String(data.password));
  }
  const row = await usersRepo.update(id, patch);
  await audit(actor, "update", "user", id, { role: patch.role, status: patch.status });
  return toAdminUserDTO(row!, await deptNameFor(row!.department_id));
}

export async function deleteUser(id: number, actor: Session) {
  if (id === actor.userId) {
    throw new ConflictError("You cannot delete your own account");
  }
  const ok = await usersRepo.remove(id);
  if (!ok) throw new NotFoundError("User");
  await audit(actor, "delete", "user", id);
}

/** The full RBAC matrix, for the admin permissions view. */
export function rolePermissionMatrix() {
  return {
    resources: RESOURCES,
    roles: Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
      role,
      permissions: perms,
    })),
  };
}

// ── Medicine catalog ─────────────────────────────────────────────────────────

export const MEDICINE_LIST_CONFIG = {
  searchColumns: ["name", "generic", "category"],
  filterable: ["category"],
  sortable: ["name", "category"],
  defaultSort: [{ column: "name" as const, direction: "asc" as const }],
};

export async function listMedicines(options: QueryOptions) {
  const { rows, total } = await medicinesRepo.listRows(options);
  return { rows: rows.map(toMedicineDTO), total };
}
