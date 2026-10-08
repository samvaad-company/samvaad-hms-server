/** Pure scheduling constants shared by the row mappers and the scheduling service (no database access). */

/** Values of "patients per hour" that give whole-minute slots. */
export const PATIENTS_PER_HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60] as const;
export const DEFAULT_PATIENTS_PER_HOUR = 2;

export function patientsPerHourOf(d: { patients_per_hour?: number | null }): number {
  const n = Number(d.patients_per_hour);
  return (PATIENTS_PER_HOUR_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PATIENTS_PER_HOUR;
}
