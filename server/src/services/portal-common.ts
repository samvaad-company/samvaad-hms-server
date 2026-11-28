/**
 * Helpers shared by the patient portal's routes (/api/portal/*).
 *
 * The portal's server proves itself with a shared key and says which patient it acts for. The key lets it act for ANY patient, so every
 * route loads the record it is asked for and checks that it is this patient's (and this hospital's); anything else is a 404, never a 403,
 * so record ids cannot be probed. Only purpose-built DTOs leave the HMS: never raw rows.
 */
import { patientsRepo } from "@/repositories";
import { type PatientRow } from "@/db/tables";
import { NotFoundError } from "@/lib/errors";

/** Record routes must never be cached by a shared proxy or kept by the browser. */
export const NO_STORE: ResponseInit = { headers: { "Cache-Control": "private, no-store" } };

export async function portalPatient(patientId: number): Promise<PatientRow> {
  const patient = await patientsRepo.getRow(patientId);
  if (!patient) throw new NotFoundError("Patient");
  return patient;
}

/** The row must belong to this patient and this patient's hospital, or it is "not found". */
export function assertPatientRecord<T extends { patient_id?: number | null; hospital_id?: number | null }>(
  row: T | null | undefined, patient: Pick<PatientRow, "id" | "hospital_id">, what: string,
): T {
  if (!row || row.patient_id !== patient.id || (row.hospital_id != null && row.hospital_id !== patient.hospital_id)) throw new NotFoundError(what);
  return row;
}

export function pageParams(q: URLSearchParams, defaultSize = 20): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.get("page"))) || 1);
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(q.get("pageSize"))) || defaultSize));
  return { page, pageSize };
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

/** A date or time stamp as the portal shows it: "YYYY-MM-DD". */
export const dayOf = (iso: string | null | undefined): string => String(iso ?? "").slice(0, 10);

/** A date moved by a number of days (calendar arithmetic, no time zone involved). */
export const addDaysTo = (date: string, n: number): string => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10);
