/**
 * Appointments service — booking, rescheduling, and status transitions.
 * Links to patients and doctors by id, keeping denormalized display fields
 * in sync.
 */
import {
  appointmentsRepo,
  patientsRepo,
  doctorsRepo,
} from "@/server/repositories";
import { toAppointmentDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type AppointmentRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
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
  filterable: ["status", "type", "doctor"],
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
    appointment_date: data.date,
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
  if ("date" in data) patch.appointment_date = data.date;
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
