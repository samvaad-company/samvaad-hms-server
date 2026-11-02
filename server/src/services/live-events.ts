/**
 * Live events for the dashboards. A new appointment — booked by staff, by the patient app, walked in, or created when a
 * video consultation is paid for — is published here once it is safely saved; every dashboard open in that hospital (a doctor's
 * dashboard: only their own) receives it over the SSE stream and puts it in its Redux store.
 */
import { publish } from "@/lib/event-bus";
import { appointmentsRepo } from "@/repositories";
import { toAppointmentDTO } from "@/repositories/mappers";
import { type AppointmentRow } from "@/db/tables";

/**
 * An appointment that appeared in the database without passing through this process. A booking that lost a race for the last
 * place is saved and then removed again within moments, so the row is looked up once things have settled before it is announced.
 */
export function publishAppointmentCreatedFromFeed(row: AppointmentRow, settleMs = 800): void {
  setTimeout(() => {
    void appointmentsRepo.getRow(row.id).then((still) => { if (still) publishAppointmentCreated(still as AppointmentRow); }).catch(() => undefined);
  }, settleMs).unref?.();
}

export function publishAppointmentCreated(row: AppointmentRow): void {
  if (row.hospital_id == null) return;
  publish({ type: "appointment.created", hospitalId: row.hospital_id, doctorId: row.doctor_id ?? null, data: toAppointmentDTO(row) }, `appointment.created:${row.hospital_id}:${row.id}`);
}
