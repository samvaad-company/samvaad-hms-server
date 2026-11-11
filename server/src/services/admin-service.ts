/**
 * Admin service — hospital settings, departments, system users, role
 * permissions, and the medicine catalog.
 */
import {
  hospitalsRepo,
  departmentsRepo,
  usersRepo,
  staffRepo,
  doctorsRepo,
  medicinesRepo,
  setupRecordsRepo,
} from "@/repositories";
import {
  toDepartmentDTO,
  toAdminUserDTO,
  toMedicineDTO,
} from "@/repositories/mappers";
import { hashPassword } from "@/auth/password";
import { DEFAULT_THEME, THEME_KEYS } from "@shared/lib/theme";
import { ROLE_PERMISSIONS, RESOURCES } from "@/auth/rbac";
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { type MedicineRow } from "@/db/tables";
import { type QueryOptions } from "@/db/adapter";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";

// ── Hospital settings ────────────────────────────────────────────────────────

export async function getSettings(actor: Session) {
  const row = await hospitalsRepo.getRow(requireHospitalId(actor));
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
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    geofenceRadiusM: row.geofence_radius_m ?? 150,
    teleconsultEnabled: !!row.teleconsult_enabled,
    teleconsultPrice: row.teleconsult_price ?? null,
    teleconsultMeetAccess: row.teleconsult_meet_access ?? "OPEN",
    themeColor: (row.theme_color ?? DEFAULT_THEME) as string,
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
  latitude: { type: "number", required: false, min: -90, max: 90 },
  longitude: { type: "number", required: false, min: -180, max: 180 },
  geofenceRadiusM: { type: "number", required: false, min: 20, max: 5000 },
  teleconsultEnabled: { type: "boolean", required: false },
  teleconsultPrice: { type: "number", required: false, min: 0, max: 100000 },
  teleconsultMeetAccess: { type: "enum", required: false, values: ["OPEN", "TRUSTED", "RESTRICTED"] },
  themeColor: { type: "enum", required: false, values: THEME_KEYS },
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
    latitude: "latitude",
    longitude: "longitude",
    geofenceRadiusM: "geofence_radius_m",
    teleconsultEnabled: "teleconsult_enabled",
    teleconsultPrice: "teleconsult_price",
    teleconsultMeetAccess: "teleconsult_meet_access",
    themeColor: "theme_color",
  };
  const patch: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in data) patch[col] = (data as Record<string, unknown>)[key];
  }
  if ((input as { workingHours?: unknown }).workingHours) {
    patch.working_hours = (input as { workingHours: unknown }).workingHours;
  }
  const hospitalId = requireHospitalId(actor);

  // The video-consultation fee is a financial setting: only the hospital's top admin decides it.
  // The settings form posts every field back, so only an actual change counts.
  const current = await hospitalsRepo.getRow(hospitalId);
  const priceChanged = "teleconsultPrice" in data && data.teleconsultPrice !== (current?.teleconsult_price ?? undefined);
  const enabledChanged = "teleconsultEnabled" in data && data.teleconsultEnabled !== !!current?.teleconsult_enabled;
  const accessChanged = "teleconsultMeetAccess" in data && data.teleconsultMeetAccess !== (current?.teleconsult_meet_access ?? "OPEN");
  if ((priceChanged || enabledChanged || accessChanged) && actor.role !== "Super Admin" && actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a Super Admin can change the video-consultation fee, who can join the call, or switch it on or off");
  }
  if (!priceChanged) delete patch.teleconsult_price;
  if (!enabledChanged) delete patch.teleconsult_enabled;
  if (!accessChanged) delete patch.teleconsult_meet_access;
  if (data.teleconsultEnabled === true) {
    const price = "teleconsultPrice" in data ? data.teleconsultPrice : current?.teleconsult_price;
    if (price == null) throw new ConflictError("Set the consultation fee before switching video consultations on");
  }
  await hospitalsRepo.update(hospitalId, patch);
  await audit(actor, "update", "settings", hospitalId, patch);
  return getSettings(actor);
}

// ── Departments ──────────────────────────────────────────────────────────────

const deptSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  head: { type: "string", required: false, max: 120, default: "" },
  ext: { type: "string", required: false, max: 12, default: "" },
  code: { type: "string", required: false, max: 12, pattern: /^[A-Za-z0-9._-]*$/ },
  specialty: { type: "string", required: false, max: 80, default: "" },
  clinical: { type: "boolean", required: false },
  active: { type: "boolean", required: false },
} as const;

export async function listDepartments(actor: Session) {
  const { rows } = await departmentsRepo.listRows(
    scopeToHospital({ unpaged: true }, actor),
  );
  return rows.map(toDepartmentDTO);
}

export async function createDepartment(input: unknown, actor: Session) {
  const data = validate(deptSchema, input);
  const row = await departmentsRepo.create({
    hospital_id: requireHospitalId(actor),
    name: data.name,
    head: data.head,
    extension: data.ext,
    code: data.code ? data.code.toUpperCase() : null,
    specialty: data.specialty || null,
    clinical: data.clinical ?? true,
    active: data.active ?? true,
  });
  await audit(actor, "create", "department", row.id);
  return toDepartmentDTO(row);
}

export async function updateDepartment(id: number, input: unknown, actor: Session) {
  const existing = await departmentsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Department");
  const data = validatePartial(deptSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("head" in data) patch.head = data.head;
  if ("ext" in data) patch.extension = data.ext;
  if ("code" in data) patch.code = data.code ? data.code.toUpperCase() : null;
  if ("specialty" in data) patch.specialty = data.specialty || null;
  if ("clinical" in data) patch.clinical = data.clinical;
  if ("active" in data) patch.active = data.active;
  const row = await departmentsRepo.update(id, patch);
  await audit(actor, "update", "department", id, patch);
  return toDepartmentDTO(row!);
}

export async function deleteDepartment(id: number, actor: Session) {
  const existing = await departmentsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Department");
  await departmentsRepo.remove(id);
  await audit(actor, "delete", "department", id);
}

// ── System users ─────────────────────────────────────────────────────────────

async function deptNameFor(id: number | null): Promise<string | null> {
  if (!id) return null;
  const d = await departmentsRepo.getRow(id);
  return d?.name ?? null;
}

export async function listUsers(actor: Session) {
  const { rows } = await usersRepo.listRows(
    scopeToHospital({ unpaged: true }, actor),
  );
  const visible =
    actor.role === "Platform Admin" ? rows : rows.filter((u) => u.role !== "Platform Admin");
  const result = [];
  for (const u of visible) {
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
  staffId: { type: "number", required: false },
  doctorId: { type: "number", required: false },
  status: { type: "enum", required: false, values: ["Active", "Inactive"], default: "Active" },
} as const;

/**
 * "Platform Admin" bypasses hospital scoping entirely (see hospital-scope.ts)
 * — only an existing platform admin may grant it, or any hospital admin
 * could mint themselves cross-hospital access through the ordinary user form.
 */
function assertMayGrantRole(role: string, actor: Session): void {
  if (role === "Platform Admin" && actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a platform admin can grant the Platform Admin role");
  }
}

/** A staff link must point at a staff member of the actor's own hospital. */
async function resolveStaffLink(staffId: number | undefined, actor: Session): Promise<number | null> {
  if (!staffId) return null;
  const staff = await staffRepo.getRow(staffId);
  assertOwnedByHospital(staff, actor, "Staff member");
  return staff.id;
}

/**
 * A "Doctor" login points at one doctor record of the actor's hospital (that is what gives them My Schedule and
 * their own appointments). Only one login per doctor; other roles can't carry the link. 0/absent clears it.
 */
async function resolveDoctorLink(doctorId: number | undefined, role: string, actor: Session, selfUserId?: number): Promise<number | null> {
  if (!doctorId) return null;
  if (role !== "Doctor") throw new BadRequestError("Only a user with the Doctor role can be linked to a doctor record");
  const doctor = await doctorsRepo.getRow(doctorId);
  assertOwnedByHospital(doctor, actor, "Doctor");
  const taken = await usersRepo.findRow([{ column: "doctor_id", op: "eq", value: doctorId }]);
  if (taken && taken.id !== selfUserId) throw new ConflictError(`${doctor.name} already has a login (${taken.email})`);
  return doctor.id;
}

export async function createUser(input: unknown, actor: Session) {
  const data = validate(userCreateSchema, input);
  assertMayGrantRole(data.role, actor);
  const existing = await usersRepo.findRow([
    { column: "email", op: "eq", value: data.email.toLowerCase() },
  ]);
  if (existing) throw new ConflictError("A user with that email already exists");

  const row = await usersRepo.create({
    hospital_id: requireHospitalId(actor),
    radiology_center_id: null,
    lab_center_id: null,
    name: data.name,
    email: data.email.toLowerCase(),
    password_hash: await hashPassword(data.password),
    role: data.role,
    department_id: data.departmentId ?? null,
    staff_id: await resolveStaffLink(data.staffId, actor),
    doctor_id: await resolveDoctorLink(data.doctorId, data.role, actor),
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
  staffId: { type: "number", required: false },
  doctorId: { type: "number", required: false },
  status: { type: "enum", required: false, values: ["Active", "Inactive"] },
  password: { type: "string", required: false, min: 6, max: 100 },
} as const;

export async function updateUser(id: number, input: unknown, actor: Session) {
  const existing = await usersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "User");
  if (existing.role === "Platform Admin" && actor.role !== "Platform Admin") {
    throw new NotFoundError("User");
  }
  const data = validatePartial(userUpdateSchema, input);
  if ("role" in data && data.role) assertMayGrantRole(data.role, actor);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("role" in data) patch.role = data.role;
  if ("status" in data) patch.status = data.status;
  if ("departmentId" in data) patch.department_id = data.departmentId ?? null;
  if ("staffId" in data) patch.staff_id = await resolveStaffLink(data.staffId, actor);
  const newRole = ("role" in data && data.role ? data.role : existing.role) as string;
  if ("doctorId" in data) patch.doctor_id = await resolveDoctorLink(data.doctorId, newRole, actor, id);
  else if (newRole !== "Doctor" && existing.doctor_id != null) patch.doctor_id = null; // moved away from Doctor: drop the link
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
  const existing = await usersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "User");
  if (existing.role === "Platform Admin" && actor.role !== "Platform Admin") {
    throw new NotFoundError("User");
  }
  await usersRepo.remove(id);
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

/**
 * The imported drug directory is stored once, for every hospital (hospital_id 0); a hospital's own medicines carry its id. The price a
 * hospital sets in Setup → Masters → Medicines on a shared medicine is kept as a small record of its own (kind "medicine_price"),
 * so hospitals never see each other's prices.
 */
const SHARED = 0;
const PRICE_KIND = "medicine_price";

async function priceOverrides(actor: Session): Promise<Map<number, { rowId: number; price: number }>> {
  const { rows } = await setupRecordsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "kind", op: "eq", value: PRICE_KIND }] }, actor));
  return new Map((rows as { id: number; data: Record<string, unknown> }[]).map((r) => [Number(r.data?.medicineId), { rowId: r.id, price: Number(r.data?.price) }]));
}

function withPrice(row: MedicineRow, overrides: Map<number, { rowId: number; price: number }>) {
  const dto = toMedicineDTO(row);
  const own = overrides.get(row.id)?.price ?? row.price ?? null;
  return { ...dto, masterPrice: own, price: own ?? row.mrp ?? null };
}

/** The price charged for each medicine name (master price if set, else MRP) — used to price stock items. */
export async function medicinePricesByName(names: string[], actor: Session): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (names.length === 0) return out;
  const [{ rows }, overrides] = await Promise.all([
    medicinesRepo.listRows({ unpaged: true, filters: [{ column: "name", op: "in", value: names }, ...(actor.hospitalId == null ? [] : [{ column: "hospital_id", op: "in" as const, value: [actor.hospitalId, SHARED] }])] }),
    priceOverrides(actor),
  ]);
  for (const r of rows) { const p = withPrice(r, overrides).price; if (p != null) out.set(r.name.toLowerCase(), p); }
  return out;
}

/** Sets the master price of a medicine (`{ price: number }`), or clears it (`{ price: null }`) so the printed MRP applies again. */
export async function setMedicinePrice(id: number, input: unknown, actor: Session) {
  const row = await medicinesRepo.getRow(id);
  if (!row || (row.hospital_id !== SHARED && row.hospital_id !== actor.hospitalId)) throw new NotFoundError("Medicine");
  const raw = (typeof input === "object" && input !== null ? (input as { price?: unknown }).price : undefined);
  if (raw === undefined) throw new ValidationError([{ field: "price", message: "give a price, or null to use the MRP" }]);
  const price = raw === null || raw === "" ? null : Math.round(Number(raw) * 100) / 100;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10_000_000)) throw new ValidationError([{ field: "price", message: "price must be a number from 0" }]);
  if (row.hospital_id === actor.hospitalId) {
    await medicinesRepo.update(id, { price });
  } else {
    const hospitalId = requireHospitalId(actor);
    const have = (await priceOverrides(actor)).get(id);
    if (price === null) { if (have) await setupRecordsRepo.remove(have.rowId); }
    else if (have) await setupRecordsRepo.update(have.rowId, { data: { medicineId: id, price } } as never);
    else await setupRecordsRepo.create({ hospital_id: hospitalId, kind: PRICE_KIND, code: String(id), name: row.name, active: true, sort_order: 0, data: { medicineId: id, price } } as never);
  }
  await audit(actor, "update", "medicine", id, { price });
  const fresh = (await medicinesRepo.getRow(id)) as MedicineRow;
  return withPrice(fresh, await priceOverrides(actor));
}

export async function listMedicines(options: QueryOptions, actor: Session) {
  const scoped = actor.hospitalId == null ? options : { ...options, filters: [...(options.filters ?? []), { column: "hospital_id", op: "in" as const, value: [actor.hospitalId, SHARED] }] };
  const [{ rows, total }, overrides] = await Promise.all([medicinesRepo.listRows(scoped), priceOverrides(actor)]);
  return { rows: rows.map((r) => withPrice(r as MedicineRow, overrides)), total };
}
