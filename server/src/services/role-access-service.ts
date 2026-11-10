/**
 * Roles & access: what each role may do in each part of the hospital, set by the hospital's Super Admin.
 *
 * Every role starts with the built-in levels in auth/rbac.ts. A Super Admin can change any role's level per resource to one of
 *   none (hidden), read (view only), add (view and create), edit (view, create and change), write (everything, including delete).
 * Only the changes are stored (one record per hospital), so a role the hospital never touched keeps following the built-ins, and
 * "reset" simply removes a role's changes. A hospital's changes never touch another hospital.
 *
 * The levels are enforced on the server for every request (auth/server.ts → requirePermission); the app only uses them to decide
 * what to show.
 */
import { setupRecordsRepo } from "@/repositories";
import type { SetupRecordRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { ForbiddenError, ValidationError, type FieldError } from "@/lib/errors";
import { ACCESS_LEVELS, RESOURCES, ROLE_PERMISSIONS, defaultPermissionsFor, permissionsFor, setRoleOverrides, type Access, type Resource, type RoleOverrides } from "@/auth/rbac";
import { requireHospitalId } from "@/services/hospital-scope";
import { audit } from "@/services/audit";
import type { RoleAccessDTO } from "@shared/types/role-access";

const KIND = "config:role_access";
/** How long a loaded copy is trusted before it is read again, so a change made on another server instance reaches this one. */
const TTL_MS = 15_000;
const loadedAt = new Map<number, number>();

/** Roles that can't be changed: the hospital's own top admin always has everything, and the partner roles belong to outside centres. */
const LOCKED = ["Platform Admin", "Super Admin", "Radiology Partner", "Lab Partner"];

export const editableRoles = (): string[] => Object.keys(ROLE_PERMISSIONS).filter((r) => !LOCKED.includes(r));

async function recordFor(hospitalId: number): Promise<SetupRecordRow | undefined> {
  const { rows } = await setupRecordsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "kind", op: "eq", value: KIND }] } as never);
  return (rows as SetupRecordRow[])[0];
}

/** Keeps only valid roles, resources and levels, and only what differs from the built-ins. */
function clean(raw: unknown): RoleOverrides {
  const out: RoleOverrides = {};
  const roles = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  for (const role of editableRoles()) {
    const given = roles[role];
    if (typeof given !== "object" || given === null) continue;
    const base = defaultPermissionsFor(role);
    const changes: Partial<Record<Resource, Access>> = {};
    for (const res of RESOURCES) {
      const level = (given as Record<string, unknown>)[res];
      if (typeof level === "string" && (ACCESS_LEVELS as string[]).includes(level) && level !== base[res]) changes[res] = level as Access;
    }
    if (Object.keys(changes).length) out[role] = changes;
  }
  return out;
}

/** Makes sure this hospital's changes are loaded (called on every signed-in request; cheap when recent). */
export async function ensureRoleAccess(hospitalId: number): Promise<void> {
  const at = loadedAt.get(hospitalId);
  if (at !== undefined && Date.now() - at < TTL_MS) return;
  loadedAt.set(hospitalId, Date.now());
  try {
    const row = await recordFor(hospitalId);
    setRoleOverrides(hospitalId, clean((row?.data as { roles?: unknown } | undefined)?.roles));
  } catch {
    loadedAt.delete(hospitalId); // try again on the next request; until then the last good copy (or the built-ins) applies
  }
}

export async function getRoleAccess(actor: Session): Promise<RoleAccessDTO> {
  const hid = requireHospitalId(actor);
  await ensureRoleAccess(hid);
  const roles = Object.keys(ROLE_PERMISSIONS).filter((r) => r !== "Platform Admin" && !["Radiology Partner", "Lab Partner"].includes(r));
  return {
    resources: RESOURCES,
    levels: ACCESS_LEVELS,
    roles: roles.map((role) => {
      const defaults = defaultPermissionsFor(role), current = permissionsFor(role, hid);
      return { role, locked: LOCKED.includes(role), defaults, current, changed: RESOURCES.filter((r) => current[r] !== defaults[r]).length };
    }),
  };
}

/**
 * `{ role, levels: { patients: "read", billing: "edit", … } }` sets that role's levels (anything left out goes back to the built-in),
 * or `{ role, reset: true }` puts the role back to the built-ins. Only the hospital's Super Admin may do this.
 */
export async function saveRoleAccess(input: unknown, actor: Session): Promise<RoleAccessDTO> {
  const hid = requireHospitalId(actor);
  if (actor.role !== "Super Admin") throw new ForbiddenError("Only the hospital's admin can change what each role can do.");
  const body = (typeof input === "object" && input !== null ? input : {}) as { role?: unknown; levels?: unknown; reset?: unknown };
  const role = typeof body.role === "string" ? body.role : "";
  const errors: FieldError[] = [];
  if (!editableRoles().includes(role)) throw new ValidationError([{ field: "role", message: LOCKED.includes(role) ? "this role's access can't be changed" : "choose one of the hospital's roles" }]);

  await ensureRoleAccess(hid);
  const all = { ...roleOverridesCopy(hid) };
  if (body.reset === true) delete all[role];
  else {
    const levels = typeof body.levels === "object" && body.levels !== null ? (body.levels as Record<string, unknown>) : null;
    if (!levels) throw new ValidationError([{ field: "levels", message: "send the level for each part of the app" }]);
    for (const [res, level] of Object.entries(levels)) {
      if (!(RESOURCES as string[]).includes(res)) errors.push({ field: res, message: "that isn't a part of the app" });
      else if (typeof level !== "string" || !(ACCESS_LEVELS as string[]).includes(level)) errors.push({ field: res, message: "choose none, read, add, edit or full" });
    }
    if (errors.length) throw new ValidationError(errors);
    const next = clean({ [role]: levels });
    if (next[role]) all[role] = next[role]; else delete all[role];
  }

  const row = await recordFor(hid);
  const data = { roles: all };
  if (row) await setupRecordsRepo.update(row.id, { data: data as never } as never);
  else await setupRecordsRepo.create({ hospital_id: hid, kind: KIND, code: "", name: "role access", active: true, sort_order: 0, data } as never);
  setRoleOverrides(hid, all);
  loadedAt.set(hid, Date.now());
  await audit(actor, body.reset === true ? "role_access.reset" : "role_access.update", "role", role, { changed: Object.keys(all[role] ?? {}).length });
  return getRoleAccess(actor);
}

function roleOverridesCopy(hid: number): RoleOverrides {
  // permissionsFor() already merges; rebuild just the differences from the built-ins so the stored copy stays minimal.
  const out: RoleOverrides = {};
  for (const role of editableRoles()) {
    const base = defaultPermissionsFor(role), cur = permissionsFor(role, hid);
    const diff: Partial<Record<Resource, Access>> = {};
    for (const r of RESOURCES) if (cur[r] !== base[r]) diff[r] = cur[r];
    if (Object.keys(diff).length) out[role] = diff;
  }
  return out;
}
