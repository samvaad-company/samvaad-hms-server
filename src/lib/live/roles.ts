/**
 * Who is sent live appointment events and shown their notifications: the hospital's admin, the front desk, and doctors
 * (a doctor only for their own appointments — the server filters by doctor id). Framework-free so the API (which decides who
 * may open the stream) and the app (which decides whether to open it) use the same list.
 */
const LIVE_APPOINTMENT_ROLES = new Set(["Super Admin", "Receptionist", "Doctor"]);

export function receivesLiveAppointments(role: string | undefined | null): boolean {
  return Boolean(role && LIVE_APPOINTMENT_ROLES.has(role));
}
