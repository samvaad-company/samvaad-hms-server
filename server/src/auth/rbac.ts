/**
 * Role-Based Access Control.
 *
 * Every protected resource maps to an access level per role, from least to most:
 *   "none"  — no access
 *   "read"  — may list/view
 *   "add"   — read, and may create new records
 *   "edit"  — add, and may change existing records
 *   "write" — edit, and may delete (full access)
 * A hospital's Super Admin can change any role's level per resource (see role-access-service.ts); the table below is what every
 * hospital starts with.
 */

export type Resource =
  | "patients"
  | "appointments"
  | "doctors"
  | "opd"
  | "prescriptions"
  | "pharmacy"
  | "lab"
  | "ipd"
  | "ot"
  | "beds"
  | "billing"
  | "staff"
  | "reports"
  | "admin"
  | "radiology"
  | "bloodbank"
  | "ambulance"
  | "records"
  | "tpa"
  | "finance"
  | "inventory"
  | "tasks"
  | "scribe"
  | "documents"
  | "chat"
  | "attendance"
  | "teleconsult"
  | "enquiries"
  | "followups"
  | "nursing"
  | "mrd"
  | "consents"
  | "cssd"
  | "hr"
  | "payroll"
  | "awareness"
  | "casefile";

export type Access = "none" | "read" | "add" | "edit" | "write";
/** `write` is any change at all (used where the check doesn't know which kind); the others are what a request actually does. */
export type Action = "read" | "add" | "edit" | "delete" | "write";

export const ACCESS_LEVELS: Access[] = ["none", "read", "add", "edit", "write"];
const LEVEL_RANK: Record<Access, number> = { none: 0, read: 1, add: 2, edit: 3, write: 4 };
const ACTION_RANK: Record<Action, number> = { read: 1, add: 2, write: 2, edit: 3, delete: 4 };

export const RESOURCES: Resource[] = [
  "patients",
  "appointments",
  "doctors",
  "opd",
  "prescriptions",
  "pharmacy",
  "lab",
  "ipd",
  "ot",
  "beds",
  "billing",
  "staff",
  "reports",
  "admin",
  "radiology",
  "bloodbank",
  "ambulance",
  "records",
  "tpa",
  "finance",
  "inventory",
  "tasks",
  "scribe",
  "documents",
  "chat",
  "attendance",
  "teleconsult",
  "enquiries",
  "followups",
  "nursing",
  "mrd",
  "consents",
  "cssd",
  "hr",
  "payroll",
  "awareness",
  "casefile",
];

const ALL_WRITE: Record<Resource, Access> = RESOURCES.reduce(
  (acc, r) => ({ ...acc, [r]: "write" }),
  {} as Record<Resource, Access>,
);

const ALL_READ: Record<Resource, Access> = RESOURCES.reduce(
  (acc, r) => ({ ...acc, [r]: "read" }),
  {} as Record<Resource, Access>,
);

function withOverrides(
  base: Record<Resource, Access>,
  overrides: Partial<Record<Resource, Access>>,
): Record<Resource, Access> {
  return { ...base, ...overrides };
}

const NONE: Record<Resource, Access> = RESOURCES.reduce(
  (acc, r) => ({ ...acc, [r]: "none" }),
  {} as Record<Resource, Access>,
);

/**
 * Permission matrix per role. Roles map to the role strings used in the
 * `users` table. Unknown roles fall back to read-only on clinical data.
 */
export const ROLE_PERMISSIONS: Record<string, Record<Resource, Access>> = {
  /**
   * Platform-level operator, not tied to any one hospital's data — used to
   * onboard hospitals and for cross-hospital support. Distinct from
   * "Super Admin", which is a hospital's own top admin and stays scoped to
   * that hospital like every other role (see hospital-scope.ts).
   */
  /**
   * The Task Board is Super Admin only (see the "none" overrides below). AI Chat is open to every hospital role, so
   * anyone can ask the assistant about the hospital's records; its use is capped by a monthly token allowance
   * (ai-quota-service.ts), and the platform admin, who has no hospital data of their own, does not get it.
   */
  "Platform Admin": withOverrides(ALL_WRITE, { tasks: "none" }),
  "Super Admin": ALL_WRITE,
  "IT Admin": withOverrides(NONE, { admin: "write", staff: "read" }),
  Doctor: withOverrides(ALL_READ, {
    casefile: "write",
    awareness: "write",
    payroll: "none",
    cssd: "write",
    consents: "write",
    documents: "write",
    followups: "write",
    nursing: "write",
    attendance: "none",
    teleconsult: "write",
    opd: "write",
    prescriptions: "write",
    patients: "write",
    lab: "write",
    radiology: "write",
    ipd: "write",
    scribe: "write",
    chat: "none",
    tasks: "none",
    admin: "none",
    staff: "none",
    ambulance: "none",
    inventory: "none",
    billing: "none",
    reports: "none",
  }),
  "Head Nurse": withOverrides(NONE, {
    casefile: "write",
    hr: "read",
    cssd: "write",
    consents: "write",
    documents: "write",
    nursing: "write",
    followups: "read",
    patients: "read",
    appointments: "read",
    opd: "write",
    lab: "read",
    radiology: "read",
    ipd: "write",
    beds: "write",
    doctors: "read",
    bloodbank: "read",
    inventory: "write",
    staff: "read",
  }),
  Receptionist: withOverrides(NONE, {
    casefile: "edit",
    awareness: "write",
    consents: "write",
    documents: "write",
    followups: "write",
    enquiries: "write",
    patients: "write",
    appointments: "write",
    doctors: "read",
    opd: "write",
    beds: "read",
    inventory: "write",
    ambulance: "write",
    tpa: "read",
    bloodbank: "read",
    attendance: "write",
    teleconsult: "read",
  }),
  /**
   * Books and follows up paid video consultations on patients' behalf. Sees
   * patients, doctors and appointments but no clinical or financial records.
   */
  "Tele Caller": withOverrides(NONE, {
    awareness: "write",
    followups: "write",
    enquiries: "write",
    patients: "write",
    appointments: "read",
    doctors: "read",
    teleconsult: "write",
  }),
  "Billing Exec": withOverrides(NONE, {
    patients: "read",
    appointments: "read",
    billing: "write",
    reports: "read",
    tpa: "write",
    finance: "write",
  }),
  Pharmacist: withOverrides(NONE, {
    pharmacy: "write",
    prescriptions: "read",
  }),
  "Lab Technician": withOverrides(NONE, {
    bloodbank: "write",
    lab: "write",
    radiology: "write",
    patients: "read",
  }),
  /** Medical records department: patient files, retention, consent signatures, coding and the statutory registers. */
  "MRD Officer": withOverrides(NONE, {
    casefile: "read",
    mrd: "write",
    consents: "write",
    documents: "write",
    patients: "read",
    ipd: "read",
    doctors: "read",
  }),
  /** Human resources: the staff directory, leave, shifts and roster, and payroll. */
  "HR Manager": withOverrides(NONE, { hr: "write", payroll: "write", staff: "write", documents: "write", doctors: "read", patients: "none" }),
  /** Central sterile services: packs, sterilizes and issues instrument sets. */
  "CSSD Technician": withOverrides(NONE, { cssd: "write", patients: "read", ot: "read" }),
  Driver: withOverrides(NONE, { ambulance: "write" }),
  /** External imaging centre: sees only the radiology worklist and uploads reports. */
  "Radiology Partner": withOverrides(NONE, { radiology: "write" }),
  /** External diagnostic lab: sees only the lab worklist and uploads reports. */
  "Lab Partner": withOverrides(NONE, { lab: "write" }),
};

// Every role may use the AI assistant, whatever its other permissions. (A platform admin has no hospital of its own, so
// the assistant has no hospital records to look up for them.)
for (const perms of Object.values(ROLE_PERMISSIONS)) perms.chat = "write";

function levelSatisfies(level: Access, action: Action): boolean {
  return LEVEL_RANK[level] >= ACTION_RANK[action];
}

/** What each hospital's Super Admin has changed, by hospital and role. Kept in memory and reloaded from the database (role-access-service.ts). */
export type RoleOverrides = Record<string, Partial<Record<Resource, Access>>>;
const overridesByHospital = new Map<number, RoleOverrides>();
export function setRoleOverrides(hospitalId: number, overrides: RoleOverrides): void {
  if (Object.keys(overrides).length === 0) overridesByHospital.delete(hospitalId);
  else overridesByHospital.set(hospitalId, overrides);
}
export function roleOverridesFor(hospitalId: number | null | undefined): RoleOverrides {
  return hospitalId == null ? {} : overridesByHospital.get(hospitalId) ?? {};
}

/** The built-in levels for a role, before any hospital changes. */
export function defaultPermissionsFor(role: string): Record<Resource, Access> {
  // A role with no entry above is read-only on everything, but still gets the AI assistant like every other role.
  return ROLE_PERMISSIONS[role] ?? { ...ALL_READ, chat: "write" };
}

/** A role's levels in one hospital: the built-ins with that hospital's changes on top. */
export function permissionsFor(role: string, hospitalId?: number | null): Record<Resource, Access> {
  const base = defaultPermissionsFor(role);
  const changes = roleOverridesFor(hospitalId)[role];
  return changes ? { ...base, ...changes } : base;
}

export function can(role: string, resource: Resource, action: Action, hospitalId?: number | null): boolean {
  return levelSatisfies(permissionsFor(role, hospitalId)[resource] ?? "none", action);
}

/** Resources a role may at least read: used to build the nav. */
export function readableResources(role: string, hospitalId?: number | null): Resource[] {
  const perms = permissionsFor(role, hospitalId);
  return RESOURCES.filter((r) => perms[r] !== "none");
}
