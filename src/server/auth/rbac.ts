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
  | "documents";

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
  "Super Admin": ALL_WRITE,
  "IT Admin": withOverrides(NONE, { admin: "write", tasks: "write", staff: "read" }),
  Doctor: withOverrides(ALL_READ, {
    opd: "write",
    prescriptions: "write",
    patients: "write",
    lab: "write",
    ipd: "write",
    scribe: "write",
    tasks: "read",
    admin: "none",
    staff: "none",
    ambulance: "none",
    inventory: "none",
    billing: "none",
    reports: "none",
  }),
  "Head Nurse": withOverrides(NONE, {
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
    tasks: "write",
    staff: "read",
  }),
  Receptionist: withOverrides(NONE, {
    patients: "read",
    appointments: "read",
    doctors: "read",
    opd: "read",
    beds: "read",
    inventory: "write",
    ambulance: "read",
    tpa: "read",
    bloodbank: "read",
  }),
  "Billing Exec": withOverrides(NONE, {
    patients: "read",
    appointments: "read",
    billing: "write",
    reports: "read",
    tpa: "write",
    finance: "write",
    tasks: "read",
  }),
  Pharmacist: withOverrides(NONE, {
    pharmacy: "write",
    prescriptions: "read",
    tasks: "read",
  }),
  "Lab Technician": withOverrides(NONE, {
    lab: "write",
    radiology: "write",
    patients: "read",
    tasks: "read",
  }),
  Driver: withOverrides(NONE, { ambulance: "read", tasks: "read" }),
  /** External imaging centre: sees only the radiology worklist and uploads reports. */
  "Radiology Partner": withOverrides(NONE, { radiology: "write" }),
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
