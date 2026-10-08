/**
 * Row-level scoping by hospital tenant. A hospital account belongs to
 * exactly one hospital (radiology center accounts belong to no hospital at
 * all — see radiology-center-scope.ts for their equivalent). "Platform
 * Admin" is the one exception (used for hospital onboarding and
 * cross-hospital support) and bypasses scoping. Note this is distinct from
 * "Super Admin", a hospital's own top admin, which stays scoped to its
 * hospital like every other role. Applied inside the service layer, same as
 * doctor-scope.ts, so it can't be bypassed by query params from the client.
 */
import { type Filter, type QueryOptions } from "@/db/adapter";
import { type Session } from "@/auth/session";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

function bypassesHospitalScope(actor: Session): boolean {
  return actor.role === "Platform Admin";
}

/** Require the actor to be a hospital account and return its hospital id. */
export function requireHospitalId(actor: Session): number {
  if (actor.hospitalId == null) {
    throw new ForbiddenError("Only a hospital account can do this");
  }
  return actor.hospitalId;
}

/** Restrict a list query to rows belonging to the actor's own hospital. */
export function scopeToHospital(options: QueryOptions, actor: Session): QueryOptions {
  if (bypassesHospitalScope(actor)) return options;
  const filters: Filter[] = [
    ...(options.filters ?? []),
    { column: "hospital_id", op: "eq", value: actor.hospitalId },
  ];
  return { ...options, filters };
}

/**
 * Verify a fetched row belongs to the actor's hospital before it's returned
 * or mutated. Throws NotFoundError — not Forbidden — so a record that
 * belongs to another hospital reads as absent instead of confirming it
 * exists.
 */
export function assertOwnedByHospital<T extends { hospital_id: number | null }>(
  row: T | null | undefined,
  actor: Session,
  what = "Record",
): asserts row is T {
  if (!row) throw new NotFoundError(what);
  if (bypassesHospitalScope(actor)) return;
  if (row.hospital_id !== actor.hospitalId) throw new NotFoundError(what);
}
