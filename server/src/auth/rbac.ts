/**
 * Role-Based Access Control.
 *
 * Every protected resource maps to an access level per role:
 *   "none"  — no access
 *   "read"  — may list/view
 *   "write" — may create/update/delete (implies read)
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
  | "payroll";

export type Access = "none" | "read" | "write";
export type Action = "read" | "write";

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
   * AI Chat and the Task Board are deliberately restricted to Super Admin
   * only — see the "none" overrides below and on every non-ALL_WRITE role.
   */
  "Platform Admin": withOverrides(ALL_WRITE, { chat: "none", tasks: "none" }),
  "Super Admin": ALL_WRITE,
  "IT Admin": withOverrides(NONE, { admin: "write", staff: "read" }),
  Doctor: withOverrides(ALL_READ, {
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
    hr: "read",
    cssd: "write",
    consents: "write",
    documents: "write",
    nursing: "write",
    followups: "read",
    patients: "read",
    appointments: "read",
    opd: "read",
    lab: "read",
    radiology: "read",
    ipd: "read",
    beds: "write",
    doctors: "read",
    bloodbank: "read",
    inventory: "write",
    staff: "read",
  }),
  Receptionist: withOverrides(NONE, {
    consents: "write",
    documents: "write",
    followups: "write",
    enquiries: "write",
    patients: "read",
    appointments: "read",
    doctors: "read",
    opd: "read",
    beds: "read",
    inventory: "write",
    ambulance: "read",
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
    followups: "write",
    enquiries: "write",
    patients: "read",
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
  Driver: withOverrides(NONE, { ambulance: "read" }),
  /** External imaging centre: sees only the radiology worklist and uploads reports. */
  "Radiology Partner": withOverrides(NONE, { radiology: "write" }),
  /** External diagnostic lab: sees only the lab worklist and uploads reports. */
  "Lab Partner": withOverrides(NONE, { lab: "write" }),
};

function levelSatisfies(level: Access, action: Action): boolean {
  if (level === "write") return true;
  if (level === "read") return action === "read";
  return false;
}

export function permissionsFor(role: string): Record<Resource, Access> {
  return ROLE_PERMISSIONS[role] ?? ALL_READ;
}

export function can(role: string, resource: Resource, action: Action): boolean {
  return levelSatisfies(permissionsFor(role)[resource] ?? "none", action);
}

/** Resources a role may at least read — used to build the nav. */
export function readableResources(role: string): Resource[] {
  const perms = permissionsFor(role);
  return RESOURCES.filter((r) => perms[r] !== "none");
}
