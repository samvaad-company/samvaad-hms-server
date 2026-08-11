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
} from "@/server/repositories";
import { toAppointmentDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { transactional } from "@/server/db/unit-of-work";
import { TABLES } from "@/server/db/tables";
import { type AppointmentRow } from "@/server/db/tables";
import { NotFoundError, ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { checkInOpd } from "@/server/services/opd-service";
import { isoDate } from "@/server/services/helpers";
import { type Session } from "@/server/auth/session";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  date: { type: "string", required: true, max: 40 },
  time: { type: "string", required: true, max: 20 },
  type: { type: "enum", required: false, values: ["Walk-in", "Booked"], default: "Booked" },
  reason: { type: "string", required: false, max: 240, default: "" },
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

export async function listAppointments(options: QueryOptions) {
  return appointmentsRepo.list(options);
}

export async function getAppointment(id: number) {
  const a = await appointmentsRepo.get(id);
  if (!a) throw new NotFoundError("Appointment");
  return a;
}

export async function createAppointment(input: unknown, actor: Session) {
  const data = validate(createSchema, input);

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

  const row = await appointmentsRepo.create({
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    appointment_date: isoDate(data.date),
    appointment_time: data.time,
    type: data.type,
    reason: data.reason,
    status: data.status,
  });
  await audit(actor, "create", "appointment", row.id);
  return toAppointmentDTO(row as AppointmentRow);
}

export async function updateAppointment(id: number, input: unknown, actor: Session) {
  const existing = await appointmentsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Appointment");
  const data = validatePartial(createSchema, input);
  const patch: Record<string, unknown> = {};
  if ("patientName" in data) patch.patient_name = data.patientName;
  if ("patientAge" in data) patch.patient_age = data.patientAge;
  if ("date" in data) patch.appointment_date = isoDate(data.date);
  if ("time" in data) patch.appointment_time = data.time;
  if ("type" in data) patch.type = data.type;
  if ("reason" in data) patch.reason = data.reason;
  if ("status" in data) patch.status = data.status;
  if ("doctorId" in data) {
    patch.doctor_id = data.doctorId ?? null;
    const d = data.doctorId ? await doctorsRepo.getRow(data.doctorId) : null;
    patch.doctor = d?.name ?? existing.doctor;
  }
  const row = await appointmentsRepo.update(id, patch);
  await audit(actor, "update", "appointment", id, patch);
  return toAppointmentDTO(row as AppointmentRow);
}

export async function deleteAppointment(id: number, actor: Session) {
  const ok = await appointmentsRepo.remove(id);
  if (!ok) throw new NotFoundError("Appointment");
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
  if (!appt) throw new NotFoundError("Appointment");
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
