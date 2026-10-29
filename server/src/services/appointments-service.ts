/**
 * Appointments service — booking, rescheduling, and status transitions.
 * Links to patients and doctors by id, keeping denormalized display fields
 * in sync.
 */
import {
  appointmentsRepo,
  patientsRepo,
  doctorsRepo,
  opdRepo,
} from "@/repositories";
import { toAppointmentDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import { type AppointmentRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { parseClock, to12h } from "@/lib/clock";
import { bookInPerson } from "@/services/appointment-scheduling-service";
import { assertSlot, loadDoctor, slotMinutesOf, withDoctorDayLock } from "@/services/scheduling-service";
import { validate, validatePartial } from "@/lib/validation";
import { validateNotPast } from "@/lib/field-rules";
import { audit } from "@/services/audit";
import { checkInOpd } from "@/services/opd-service";
import { isoDate } from "@/services/helpers";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { canonicalMaster } from "@/services/setup-service";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  date: { type: "string", required: true, max: 40, custom: validateNotPast("appointment date") },
  time: { type: "string", required: true, max: 20 },
  type: { type: "enum", required: false, values: ["Walk-in", "Booked"], default: "Booked" },
  reason: { type: "string", required: false, max: 240, default: "" },
  visitPurpose: { type: "string", required: false, max: 80 },
  status: {
    type: "enum",
    required: false,
    values: ["Completed", "Today", "Upcoming", "Cancelled"],
    default: "Upcoming",
  },
} as const;

export const APPOINTMENT_LIST_CONFIG = {
  searchColumns: ["patient_name", "doctor", "reason"],
  filterable: ["status", "type", "doctor", "patient_id", "doctor_id", "appointment_date"],
  sortable: ["appointment_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listAppointments(options: QueryOptions, actor: Session) {
  return appointmentsRepo.list(
    scopeToHospital(scopeToOwnDoctor(options, actor, "doctor_id"), actor),
  );
}

export async function getAppointment(id: number, actor: Session) {
  const row = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Appointment");
  return toAppointmentDTO(row);
}

export async function createAppointment(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  const visitPurpose = await canonicalMaster("visit_purpose", data.visitPurpose, actor, "visitPurpose");

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }

  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    if (d) doctorName = d.name;
  }

  // A booked (not walk-in) appointment with a doctor must fit that doctor's schedule: one of their in-person
  // slots, with the hour's places not used up. Everyone booking sees the same "this hour is full" message.
  if (data.type === "Booked" && data.doctorId) {
    const { doctor, hospital } = await loadDoctor(data.doctorId);
    if (actor.role !== "Platform Admin" && doctor.hospital_id !== actor.hospitalId) throw new NotFoundError("Doctor");
    const minutes = parseClock(data.time);
    if (minutes == null) throw new BadRequestError("Pick a time from the available slots");
    const created = await bookInPerson({
      hospitalId: doctor.hospital_id, patientId: data.patientId ?? null, patientName, patientAge,
      doctor, hospital, date: isoDate(data.date), minutes, reason: data.reason ?? "", status: data.status,
    });
    await audit(actor, "create", "appointment", created.id);
    if (visitPurpose) return toAppointmentDTO((await appointmentsRepo.update(created.id, { visit_purpose: visitPurpose })) as AppointmentRow);
    return toAppointmentDTO(created);
  }

  const row = await appointmentsRepo.create({
    hospital_id: actor.hospitalId,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    appointment_date: isoDate(data.date),
    appointment_time: data.time,
    type: data.type,
    reason: data.reason,
    visit_purpose: visitPurpose || null,
    status: data.status,
  });
  await audit(actor, "create", "appointment", row.id);
  return toAppointmentDTO(row as AppointmentRow);
}

export async function updateAppointment(id: number, input: unknown, actor: Session) {
  const existing = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Appointment");
  const data = validatePartial(createSchema, input);
  const patch: Record<string, unknown> = {};
  if ("patientName" in data) patch.patient_name = data.patientName;
  if ("patientAge" in data) patch.patient_age = data.patientAge;
  if ("date" in data) patch.appointment_date = isoDate(data.date);
  if ("time" in data) patch.appointment_time = data.time;
  if ("type" in data) patch.type = data.type;
  if ("reason" in data) patch.reason = data.reason;
  if ("visitPurpose" in data) patch.visit_purpose = (await canonicalMaster("visit_purpose", data.visitPurpose, actor, "visitPurpose", existing.visit_purpose)) || null;
  if ("status" in data) patch.status = data.status;
  if ("doctorId" in data) {
    patch.doctor_id = data.doctorId ?? null;
    const d = data.doctorId ? await doctorsRepo.getRow(data.doctorId) : null;
    patch.doctor = d?.name ?? existing.doctor;
  }
  // Moving a booked appointment (new time, day or doctor) goes through the same schedule checks as booking one.
  const movedTo = {
    date: "appointment_date" in patch ? String(patch.appointment_date) : existing.appointment_date,
    time: "appointment_time" in patch ? String(patch.appointment_time) : existing.appointment_time,
    doctorId: "doctor_id" in patch ? (patch.doctor_id as number | null) : existing.doctor_id,
  };
  const moved = movedTo.date !== existing.appointment_date || parseClock(movedTo.time) !== parseClock(existing.appointment_time) || movedTo.doctorId !== existing.doctor_id;
  const finalType = ("type" in patch ? String(patch.type) : existing.type);
  if (moved && movedTo.doctorId && finalType !== "Walk-in") {
    const minutes = parseClock(movedTo.time);
    if (minutes == null) throw new BadRequestError("Pick a time from the available slots");
    const { doctor, hospital } = await loadDoctor(movedTo.doctorId);
    if (actor.role !== "Platform Admin" && doctor.hospital_id !== actor.hospitalId) throw new NotFoundError("Doctor");
    return withDoctorDayLock(doctor.id, movedTo.date, async () => {
      await assertSlot({
        doctor, hospital, date: movedTo.date, minutes, mode: existing.type === "Tele-consult" ? "video" : "in_person",
        excludeAppointmentId: existing.id, excludeBookingId: existing.booking_id ?? undefined,
      });
      patch.appointment_time = to12h(minutes);
      patch.slot_minutes = slotMinutesOf(doctor);
      const row = await appointmentsRepo.update(id, patch);
      await audit(actor, "update", "appointment", id, patch);
      return toAppointmentDTO(row as AppointmentRow);
    });
  }

  const row = await appointmentsRepo.update(id, patch);
  await audit(actor, "update", "appointment", id, patch);
  return toAppointmentDTO(row as AppointmentRow);
}

export async function deleteAppointment(id: number, actor: Session) {
  const existing = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Appointment");
  await appointmentsRepo.remove(id);
  await audit(actor, "delete", "appointment", id);
}

/**
 * Check a booked appointment into the OPD queue.
 *
 * Appointments and OPD visits were previously unconnected, so a booking never
 * appeared in OPD and the front desk had to re-enter the patient by hand. This
 * issues a token carrying the appointment's patient, doctor and reason, and
 * marks the appointment as Today so both views agree.
 */
export async function checkInAppointment(id: number, actor: Session) {
  const appt = await appointmentsRepo.getRow(id);
  assertOwnedByHospital(appt, actor, "Appointment");
  if (appt.status === "Cancelled") {
    throw new ConflictError("A cancelled appointment cannot be checked in");
  }

  // Don't issue a second token for the same appointment.
  const existing = await opdRepo.findRow([
    { column: "appointment_id", op: "eq", value: id },
  ]);
  if (existing) {
    throw new ConflictError(
      `${appt.patient_name} is already in the OPD queue as ${existing.token_number}`,
    );
  }

  // The token and the appointment's new status commit together, so an
  // appointment can never show as checked in without a queue entry.
  const visit = await transactional("appointment.checkIn", async (uow) => {
    const created = await checkInOpd(
      {
        appointmentId: id,
        patientId: appt.patient_id ?? undefined,
        patientName: appt.patient_name,
        patientAge: appt.patient_age,
        doctorId: appt.doctor_id ?? undefined,
        doctor: appt.doctor,
        reason: appt.reason,
      },
      actor,
      uow,
    );
    await uow.update(TABLES.appointments, id, { status: "Today" });
    return created;
  });
  await audit(actor, "checkin", "appointment", id, { token: visit.tokenNumber });
  return visit;
}
