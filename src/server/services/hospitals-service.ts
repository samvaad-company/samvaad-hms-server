/**
 * Hospitals service — onboarding new hospital tenants. Platform-admin only:
 * a hospital's own "Super Admin" manages their one hospital via
 * admin-service's settings/users, but only a platform operator can create a
 * new tenant or see the full list of hospitals on the platform.
 */
import {
  hospitalsRepo,
  usersRepo,
  patientsRepo,
  appointmentsRepo,
  doctorsRepo,
  staffRepo,
  billsRepo,
  radiologyCentersRepo,
  labCentersRepo,
} from "@/server/repositories";
import { hashPassword } from "@/server/auth/password";
import { ForbiddenError, ConflictError, NotFoundError } from "@/server/lib/errors";
import { validate } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { type HospitalRow } from "@/server/db/tables";

function requirePlatformAdmin(actor: Session): void {
  if (actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a platform admin can manage hospitals");
  }
}

/** Statuses a hospital tenant can be in. "Paused" blocks staff logins without discarding data. */
export const HOSPITAL_STATUSES = ["Active", "Paused", "Removed"] as const;

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

export async function getHospital(id: number, actor: Session) {
  requirePlatformAdmin(actor);
  const row = await hospitalsRepo.getRow(id);
  if (!row) throw new NotFoundError("Hospital");
  return toHospitalDTO(row);
}

/**
 * Usage snapshot for one hospital tenant — patients, appointments, staffing,
 * and revenue, all scoped to that hospital_id. Platform admins bypass
 * per-hospital scoping elsewhere, so these counts are computed directly
 * rather than reusing the scoped list services.
 */
export async function getHospitalAnalytics(id: number, actor: Session) {
  requirePlatformAdmin(actor);
  const hospital = await hospitalsRepo.getRow(id);
  if (!hospital) throw new NotFoundError("Hospital");

  const byHospital = { filters: [{ column: "hospital_id" as const, op: "eq" as const, value: id }], unpaged: true };
  const [patients, appointments, doctors, staff, bills] = await Promise.all([
    patientsRepo.listRows(byHospital),
    appointmentsRepo.listRows(byHospital),
    doctorsRepo.listRows(byHospital),
    staffRepo.listRows(byHospital),
    billsRepo.listRows(byHospital),
  ]);

  const revenue = bills.rows
    .filter((b) => b.status === "Paid" || b.status === "Partial")
    .reduce((sum, b) => sum + Number(b.total), 0);
  const outstanding = bills.rows
    .filter((b) => b.status === "Pending" || b.status === "Partial")
    .reduce((sum, b) => sum + Number(b.total), 0);

  return {
    hospital: toHospitalDTO(hospital),
    totalPatients: patients.rows.length,
    totalAppointments: appointments.rows.length,
    activeDoctors: doctors.rows.filter((d) => d.status !== "On Leave").length,
    totalDoctors: doctors.rows.length,
    totalStaff: staff.rows.length,
    totalBills: bills.rows.length,
    revenue: Math.round(revenue),
    outstanding: Math.round(outstanding),
  };
}

async function setHospitalStatus(id: number, status: (typeof HOSPITAL_STATUSES)[number], actor: Session) {
  requirePlatformAdmin(actor);
  const existing = await hospitalsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Hospital");
  const row = await hospitalsRepo.update(id, { status });
  await audit(actor, "update", "hospital", id, { status });
  return toHospitalDTO(row as HospitalRow);
}

/** Suspend a hospital tenant: its staff can no longer log in, but no data is touched. */
export function pauseHospital(id: number, actor: Session) {
  return setHospitalStatus(id, "Paused", actor);
}

/** Restore a paused hospital tenant to normal operation. */
export function activateHospital(id: number, actor: Session) {
  return setHospitalStatus(id, "Active", actor);
}

/**
 * Soft-remove a hospital tenant. Staff lose access immediately; all
 * historical records stay in the database (reversible via activateHospital).
 */
export function removeHospital(id: number, actor: Session) {
  return setHospitalStatus(id, "Removed", actor);
}

/** Cross-hospital summary for the platform admin's own overview screen. */
export async function getPlatformOverview(actor: Session) {
  requirePlatformAdmin(actor);
  const [hospitals, patients, appointments, bills, radiologyCenters, labCenters] = await Promise.all([
    hospitalsRepo.listRows({ unpaged: true }),
    patientsRepo.listRows({ unpaged: true }),
    appointmentsRepo.listRows({ unpaged: true }),
    billsRepo.listRows({ unpaged: true }),
    radiologyCentersRepo.listRows({ unpaged: true }),
    labCentersRepo.listRows({ unpaged: true }),
  ]);

  const revenue = bills.rows
    .filter((b) => b.status === "Paid" || b.status === "Partial")
    .reduce((sum, b) => sum + Number(b.total), 0);

  return {
    totalHospitals: hospitals.rows.length,
    activeHospitals: hospitals.rows.filter((h) => h.status === "Active").length,
    pausedHospitals: hospitals.rows.filter((h) => h.status === "Paused").length,
    removedHospitals: hospitals.rows.filter((h) => h.status === "Removed").length,
    totalPatients: patients.rows.length,
    totalAppointments: appointments.rows.length,
    totalRevenue: Math.round(revenue),
    radiologyCenters: radiologyCenters.rows.length,
    labCenters: labCenters.rows.length,
    hospitals: hospitals.rows.map(toHospitalDTO),
  };
}
