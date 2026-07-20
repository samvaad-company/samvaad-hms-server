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
  | "scribe";

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
  "IT Admin": withOverrides(NONE, { admin: "write", reports: "read", tasks: "write" }),
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
  }),
  "Head Nurse": withOverrides(NONE, {
    patients: "write",
    appointments: "write",
    opd: "write",
    pharmacy: "read",
    lab: "read",
    ipd: "write",
    beds: "write",
    doctors: "read",
    bloodbank: "read",
    inventory: "read",
    tasks: "write",
  }),
  Receptionist: withOverrides(NONE, {
    patients: "write",
    appointments: "write",
    doctors: "read",
    opd: "write",
    beds: "read",
    tasks: "read",
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
