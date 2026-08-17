/**
 * Hospitals service — onboarding new hospital tenants. Platform-admin only:
 * a hospital's own "Super Admin" manages their one hospital via
 * admin-service's settings/users, but only a platform operator can create a
 * new tenant or see the full list of hospitals on the platform.
 */
import { hospitalsRepo, usersRepo } from "@/server/repositories";
import { hashPassword } from "@/server/auth/password";
import { ForbiddenError, ConflictError } from "@/server/lib/errors";
import { validate } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type HospitalRow } from "@/server/db/tables";

function requirePlatformAdmin(actor: Session): void {
  if (actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a platform admin can manage hospitals");
  }
}

function toHospitalDTO(row: HospitalRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
  };
}

export async function listHospitals(actor: Session) {
  requirePlatformAdmin(actor);
  const { rows } = await hospitalsRepo.listRows({ unpaged: true });
  return rows.map(toHospitalDTO);
}

const createSchema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  city: { type: "string", required: false, max: 80, default: "" },
  state: { type: "string", required: false, max: 80, default: "" },
  phone: { type: "string", required: false, max: 30, default: "" },
  email: { type: "string", required: false, max: 160, default: "" },
  adminName: { type: "string", required: true, min: 2, max: 120 },
  adminEmail: { type: "string", required: true, min: 5, max: 160, pattern: /.+@.+\..+/ },
  adminPassword: { type: "string", required: true, min: 6, max: 100 },
} as const;

/** Onboard a new hospital and its first Super Admin login in one step. */
export async function createHospital(input: unknown, actor: Session) {
  requirePlatformAdmin(actor);
  const data = validate(createSchema, input);

  const existingUser = await usersRepo.findRow([
    { column: "email", op: "eq", value: data.adminEmail.toLowerCase() },
  ]);
  if (existingUser) throw new ConflictError("A user with that email already exists");

  const { rows: existing } = await hospitalsRepo.listRows({ unpaged: true });
  const seq = existing.length + 1;
  const code = `HOSP-${String(seq).padStart(4, "0")}`;

  const hospital = await hospitalsRepo.create({
    code,
    status: "Active",
    name: data.name,
    address: "",
    city: data.city,
    state: data.state,
    pincode: "",
    phone: data.phone,
    mobile: "",
    email: data.email,
    website: "",
    gst_number: "",
    pan_number: "",
    reg_number: "",
    working_hours: null,
  });

  const admin = await usersRepo.create({
    hospital_id: hospital.id,
    name: data.adminName,
    email: data.adminEmail.toLowerCase(),
    password_hash: await hashPassword(data.adminPassword),
    role: "Super Admin",
    department_id: null,
    status: "Active",
    last_login_at: null,
  });

  await audit(actor, "create", "hospital", hospital.id, { code, adminUserId: admin.id });
  return toHospitalDTO(hospital as HospitalRow);
}
