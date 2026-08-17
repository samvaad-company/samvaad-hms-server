/**
 * Radiology centers service — the second tenant type. A center isn't owned
 * by any hospital, so its accounts carry `radiology_center_id` instead of
 * `hospital_id` (see 0017_radiology_centers.sql). Creating a center is a
 * platform-admin operation, same as onboarding a hospital; a center's own
 * account can only read/edit its own record.
 */
import { radiologyCentersRepo, usersRepo } from "@/server/repositories";
import { hashPassword } from "@/server/auth/password";
import { ForbiddenError, ConflictError, NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type RadiologyCenterRow } from "@/server/db/tables";

function requirePlatformAdmin(actor: Session): void {
  if (actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a platform admin can manage radiology centers");
  }
}

/** Require the actor to be a radiology center account and return its center id. */
function requireOwnCenterId(actor: Session): number {
  if (actor.radiologyCenterId == null) {
    throw new ForbiddenError("Only a radiology center account can do this");
  }
  return actor.radiologyCenterId;
}

function toCenterDTO(row: RadiologyCenterRow) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    phone: row.phone,
    contactEmail: row.contact_email,
  };
}

export async function listCenters(actor: Session) {
  requirePlatformAdmin(actor);
  const { rows } = await radiologyCentersRepo.listRows({ unpaged: true });
  return rows.map(toCenterDTO);
}

const createSchema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  city: { type: "string", required: false, max: 80, default: "" },
  state: { type: "string", required: false, max: 80, default: "" },
  phone: { type: "string", required: false, max: 30, default: "" },
  contactEmail: { type: "string", required: false, max: 160, default: "" },
  adminName: { type: "string", required: true, min: 2, max: 120 },
  adminEmail: { type: "string", required: true, min: 5, max: 160, pattern: /.+@.+\..+/ },
  adminPassword: { type: "string", required: true, min: 6, max: 100 },
} as const;

/** Onboard a new radiology center and its first login in one step. */
export async function createCenter(input: unknown, actor: Session) {
  requirePlatformAdmin(actor);
  const data = validate(createSchema, input);

  const existingUser = await usersRepo.findRow([
    { column: "email", op: "eq", value: data.adminEmail.toLowerCase() },
  ]);
  if (existingUser) throw new ConflictError("A user with that email already exists");

  const { rows: existing } = await radiologyCentersRepo.listRows({ unpaged: true });
  const seq = existing.length + 1;
  const code = `RADC-${String(seq).padStart(4, "0")}`;

  const center = await radiologyCentersRepo.create({
    code,
    status: "Active",
    name: data.name,
    address: "",
    city: data.city,
    state: data.state,
    phone: data.phone,
    contact_email: data.contactEmail,
  });

  const admin = await usersRepo.create({
    hospital_id: null,
    radiology_center_id: center.id,
    name: data.adminName,
    email: data.adminEmail.toLowerCase(),
    password_hash: await hashPassword(data.adminPassword),
    role: "Radiology Partner",
    department_id: null,
    status: "Active",
    last_login_at: null,
  });

  await audit(actor, "create", "radiology-center", center.id, { code, adminUserId: admin.id });
  return toCenterDTO(center as RadiologyCenterRow);
}

export async function getOwnCenter(actor: Session) {
  const id = requireOwnCenterId(actor);
  const row = await radiologyCentersRepo.getRow(id);
  if (!row) throw new NotFoundError("Radiology center");
  return toCenterDTO(row);
}

const updateSchema = {
  name: { type: "string", required: false, min: 2, max: 160 },
  address: { type: "string", required: false, max: 240 },
  city: { type: "string", required: false, max: 80 },
  state: { type: "string", required: false, max: 80 },
  phone: { type: "string", required: false, max: 30 },
  contactEmail: { type: "string", required: false, max: 160 },
} as const;

export async function updateOwnCenter(input: unknown, actor: Session) {
  const id = requireOwnCenterId(actor);
  const data = validatePartial(updateSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("address" in data) patch.address = data.address;
  if ("city" in data) patch.city = data.city;
  if ("state" in data) patch.state = data.state;
  if ("phone" in data) patch.phone = data.phone;
  if ("contactEmail" in data) patch.contact_email = data.contactEmail;

  const row = await radiologyCentersRepo.update(id, patch);
  if (!row) throw new NotFoundError("Radiology center");
  await audit(actor, "update", "radiology-center", id, patch);
  return toCenterDTO(row as RadiologyCenterRow);
}
