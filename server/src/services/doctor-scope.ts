/**
 * Row-level scoping for the Doctor role. A logged-in doctor should only ever
 * see records tied to their own doctorId — every other role (nurses,
 * receptionists, pharmacists, admins, …) keeps seeing the full list as
 * before. Applied inside the service layer so it can't be bypassed by query
 * params from the client.
 */
import { type Filter, type QueryOptions } from "@/db/adapter";
import { type Session } from "@/auth/session";
import { patientsRepo } from "@/repositories";

/** Restrict a list query to rows whose `column` equals the doctor's own id. */
export function scopeToOwnDoctor(
  options: QueryOptions,
  actor: Session,
  column: string,
): QueryOptions {
  if (actor.role !== "Doctor" || actor.doctorId == null) return options;
  const filters: Filter[] = [
    ...(options.filters ?? []),
    { column, op: "eq", value: actor.doctorId },
  ];
  return { ...options, filters };
}

/**
 * Restrict a list query to rows whose `patient_id` belongs to a patient
 * currently assigned to the doctor — for resources (lab, radiology) that
 * carry no doctor_id of their own.
 */
export async function scopeToOwnPatients(
  options: QueryOptions,
  actor: Session,
): Promise<QueryOptions> {
  if (actor.role !== "Doctor" || actor.doctorId == null) return options;
  const { rows } = await patientsRepo.listRows({
    filters: [{ column: "doctor_id", op: "eq", value: actor.doctorId }],
    unpaged: true,
  });
  const filters: Filter[] = [
    ...(options.filters ?? []),
    { column: "patient_id", op: "in", value: rows.map((p) => p.id) },
  ];
  return { ...options, filters };
}
