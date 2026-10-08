/**
 * Booking and rescheduling appointments against a doctor's schedule — for staff
 * in the HMS, doctors, and patients through the patient app.
 *
 * Every path ends in the same checks (see scheduling-service): the time must be
 * one of the doctor's slots for that kind of visit (in-person or video), and the
 * doctor's per-hour quota must not be used up. Whoever books or moves an
 * appointment into a full hour sees the same message.
 */
import { appointmentsRepo, opdRepo, patientsRepo, teleconsultBookingsRepo } from "@/repositories";
import { toAppointmentDTO } from "@/repositories/mappers";
import { type AppointmentRow, type DoctorRow, type HospitalRow } from "@/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { audit } from "@/services/audit";
import { can } from "@/auth/rbac";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital } from "@/services/hospital-scope";
import { parseClock, to12h } from "@/lib/clock";
import { moveMeetEvent } from "@/services/google-meet";
import { TELECONSULT_TYPE } from "@/services/teleconsult-service";
import {
  appointmentStart,
  assertSlot,
  DEFAULT_SLOT_MINUTES,
  loadDoctor,
  lostRace,
  patientRescheduleInfo,
  slotMinutesOf,
  withDoctorDayLock,
  type SlotMode,
} from "@/services/scheduling-service";


const modeOf = (a: Pick<AppointmentRow, "type">): SlotMode => (a.type === TELECONSULT_TYPE ? "video" : "in_person");

function parseWhen(date: unknown, time: unknown): { date: string; minutes: number } {
  const d = String(date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestError("Pick a date");
  const minutes = parseClock(String(time ?? ""));
  if (minutes == null) throw new BadRequestError("Pick a time");
  return { date: d, minutes };
}

// ── Booking an in-person appointment ─────────────────────────────────────────

export interface InPersonBooking {
  hospitalId: number;
  patientId: number | null;
  patientName: string;
  patientAge: number;
  doctor: DoctorRow;
  hospital: HospitalRow;
  date: string;
  minutes: number;
  reason: string;
  status?: string;
}

/** Validate against the doctor's schedule and create the appointment, so two people can't take the last place. */
export async function bookInPerson(b: InPersonBooking): Promise<AppointmentRow> {
  return withDoctorDayLock(b.doctor.id, b.date, async () => {
    await assertSlot({ doctor: b.doctor, hospital: b.hospital, date: b.date, minutes: b.minutes, mode: "in_person" });
    const row = (await appointmentsRepo.create({
      hospital_id: b.hospitalId,
      patient_id: b.patientId,
      patient_name: b.patientName,
      patient_age: b.patientAge,
      doctor_id: b.doctor.id,
      doctor: b.doctor.name,
      appointment_date: b.date,
      appointment_time: to12h(b.minutes),
      type: "Booked",
      reason: b.reason,
      status: b.status ?? "Upcoming",
      slot_minutes: slotMinutesOf(b.doctor),
    })) as AppointmentRow;
    // Another server may have taken the same place in the same instant: the earlier appointment keeps it.
    const lost = await lostRace({ doctor: b.doctor, date: b.date, minutes: b.minutes, appointmentId: row.id });
    if (lost) {
      await appointmentsRepo.remove(row.id);
      throw lost;
    }
    return row;
  });
}

/** Patient app: book an in-person appointment. The patient may belong to a different hospital from the doctor (as the app always allowed). */
export async function createPortalAppointment(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const patientId = Number(body.patientId);
  const doctorId = Number(body.doctorId);
  const reason = String(body.reason ?? "").trim();
  if (!Number.isInteger(patientId) || patientId < 1) throw new BadRequestError("patientId is required");
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new BadRequestError("Choose a doctor");
  if (reason.length < 2 || reason.length > 240) throw new BadRequestError("Please add a reason for the visit");
  const { date, minutes } = parseWhen(body.date, body.time);

  const patient = await patientsRepo.getRow(patientId);
  if (!patient) throw new NotFoundError("Patient");
  const { doctor, hospital } = await loadDoctor(doctorId);
  const row = await bookInPerson({
    hospitalId: doctor.hospital_id, patientId: patient.id, patientName: patient.name, patientAge: patient.age,
    doctor, hospital, date, minutes, reason,
  });
  await audit(null, "create", "appointment", row.id, { via: "patient-app" });
  return patientAppointmentView(row);
}

// ── Rescheduling ─────────────────────────────────────────────────────────────

/** The appointment as the patient app shows it. */
export function patientAppointmentView(a: AppointmentRow) {
  const start = appointmentStart(a);
  const len = a.slot_minutes ?? DEFAULT_SLOT_MINUTES;
  const r = patientRescheduleInfo(a);
  return {
    appointmentId: a.id,
    type: a.type,
    mode: modeOf(a),
    status: a.status,
    doctorId: a.doctor_id,
    doctorName: a.doctor,
    date: a.appointment_date,
    time: a.appointment_time,
    startsAt: start?.toISOString() ?? null,
    endsAt: start ? new Date(start.getTime() + len * 60_000).toISOString() : null,
    reason: a.reason,
    rescheduleCount: a.reschedule_count ?? 0,
    canReschedule: r.canReschedule,
    rescheduleBlockedReason: r.reason,
    videoUrl: a.type === TELECONSULT_TYPE && a.status !== "Cancelled" ? a.video_url ?? null : null,
    updatedAt: a.updated_at,
  };
}

interface MoveOptions {
  /** Patients are held to the cutoff and the move limit; staff and doctors aren't. */
  byPatient: boolean;
  actor?: Session;
}

async function move(appt: AppointmentRow, input: unknown, opts: MoveOptions): Promise<AppointmentRow> {
  const body = (input ?? {}) as Record<string, unknown>;
  const { date, minutes } = parseWhen(body.date, body.time);

  if (appt.status !== "Upcoming" && appt.status !== "Today") throw new ConflictError("Only upcoming appointments can be rescheduled");
  if (appt.doctor_id == null) throw new BadRequestError("This appointment has no doctor assigned, so it can't be moved to a slot");
  if (await opdRepo.findRow([{ column: "appointment_id", op: "eq", value: appt.id }])) {
    throw new ConflictError("This patient has already checked in, so the appointment can't be moved");
  }
  if (opts.byPatient) {
    const r = patientRescheduleInfo(appt);
    if (!r.canReschedule) throw new ConflictError(r.reason ?? "This appointment can't be rescheduled");
  }
  if (date === appt.appointment_date && minutes === parseClock(appt.appointment_time)) {
    throw new BadRequestError("That's the time it's already booked for — please choose a different one");
  }

  const { doctor, hospital } = await loadDoctor(appt.doctor_id);
  const mode = modeOf(appt);
  return withDoctorDayLock(doctor.id, date, async () => {
    await assertSlot({
      doctor, hospital, date, minutes, mode,
      excludeAppointmentId: appt.id, excludeBookingId: appt.booking_id ?? undefined,
    });
    const before = `${appt.appointment_date} ${appt.appointment_time}`;
    const row = (await appointmentsRepo.update(appt.id, {
      appointment_date: date,
      appointment_time: to12h(minutes),
      status: "Upcoming",
      slot_minutes: slotMinutesOf(doctor),
      reschedule_count: (appt.reschedule_count ?? 0) + 1,
      rescheduled_from: before,
    }))!;
    const lost = await lostRace({ doctor, date, minutes, appointmentId: row.id });
    if (lost) {
      // Put it back exactly as it was.
      await appointmentsRepo.update(appt.id, {
        appointment_date: appt.appointment_date, appointment_time: appt.appointment_time, status: appt.status,
        slot_minutes: appt.slot_minutes ?? null, reschedule_count: appt.reschedule_count ?? 0, rescheduled_from: appt.rescheduled_from ?? null,
      });
      throw lost;
    }
    return mode === "video" ? syncVideoReschedule(row) : row;
  });
}

/** A moved video consultation: keep its booking in step and move the calendar entry (the Meet link stays valid). */
async function syncVideoReschedule(row: AppointmentRow): Promise<AppointmentRow> {
  if (row.booking_id) {
    await teleconsultBookingsRepo.update(row.booking_id, { appointment_date: row.appointment_date, appointment_time: row.appointment_time });
  }
  if (row.video_provider !== "google_meet") return row;
  const start = appointmentStart(row);
  if (!start) return row;
  try {
    await moveMeetEvent(row.hospital_id, row.meet_event_id || `samvaadtc${row.id}`, start, new Date(start.getTime() + (row.slot_minutes ?? DEFAULT_SLOT_MINUTES) * 60_000));
    return (await appointmentsRepo.update(row.id, { meet_warning: null }))!;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("teleconsult.reschedule.calendar_failed", { appointmentId: row.id, message });
    return (await appointmentsRepo.update(row.id, { meet_warning: `The appointment moved, but the calendar invite wasn't updated (${message}). The video link is unchanged.` }))!;
  }
}

/** Staff or a doctor moves an appointment. */
export async function rescheduleAppointment(id: number, input: unknown, actor: Session) {
  const appt = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(appt, actor, "Appointment");
  const isOwnDoctor = actor.role === "Doctor" && actor.doctorId != null && actor.doctorId === appt.doctor_id;
  const allowed =
    can(actor.role, "appointments", "write") || isOwnDoctor || (appt.type === TELECONSULT_TYPE && can(actor.role, "teleconsult", "write"));
  if (!allowed) throw new ForbiddenError("You can't reschedule this appointment");
  const row = await move(appt, input, { byPatient: false, actor });
  await audit(actor, "reschedule", "appointment", id, { from: row.rescheduled_from, to: `${row.appointment_date} ${row.appointment_time}` });
  return toAppointmentDTO(row);
}

/** A patient moves their own appointment (patient app). */
export async function rescheduleForPatient(id: number, patientId: number, input: unknown) {
  const appt = await appointmentsRepo.getRow(id);
  if (!appt || appt.patient_id !== patientId) throw new NotFoundError("Appointment");
  const row = await move(appt, input, { byPatient: true });
  await audit(null, "reschedule", "appointment", id, { by: "patient", from: row.rescheduled_from, to: `${row.appointment_date} ${row.appointment_time}` });
  return patientAppointmentView(row);
}

export async function getPatientAppointment(id: number, patientId: number) {
  const a = await appointmentsRepo.getRow(id);
  if (!a || a.patient_id !== patientId) throw new NotFoundError("Appointment");
  return patientAppointmentView(a);
}
