/**
 * Patient portal: the patient's appointments (list and cancel), the in-person doctor list and the multi-day availability strip.
 * Booking, one appointment, rescheduling and the day's slots already exist in appointment-scheduling-service and scheduling-service.
 */
import { appointmentsRepo, doctorsRepo, hospitalsRepo, opdRepo } from "@/repositories";
import { type AppointmentRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { hhmm, localDate, parseClock } from "@/lib/clock";
import { patientAppointmentView } from "@/services/appointment-scheduling-service";
import { cancelConsultAppointment, TELECONSULT_TYPE, videoDoctorsForPatient } from "@/services/teleconsult-service";
import { gridFor, patientsPerHourOf, slotMinutesOf, slotsFor, PATIENT_CUTOFF_MINUTES, appointmentStart, type SlotMode } from "@/services/scheduling-service";
import { addDaysTo, assertPatientRecord, portalPatient, slicePage } from "@/services/portal-common";

const UPCOMING = new Set(["Upcoming", "Today"]);

const when = (a: AppointmentRow) => `${a.appointment_date} ${String(parseClock(a.appointment_time) ?? 0).padStart(4, "0")}`;

/** The patient's appointments, in person and video. Upcoming: soonest first. Past: newest first. */
export async function listPatientAppointments(patientId: number, scope: string, page: number, pageSize: number) {
  const patient = await portalPatient(patientId);
  const { rows } = await appointmentsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }] } as never);
  const mine = (rows as AppointmentRow[]).filter((a) => a.hospital_id === patient.hospital_id);
  const want = scope === "past" ? "past" : scope === "upcoming" ? "upcoming" : "all";
  const upcoming = mine.filter((a) => UPCOMING.has(a.status)).sort((a, b) => when(a).localeCompare(when(b)));
  const past = mine.filter((a) => !UPCOMING.has(a.status)).sort((a, b) => when(b).localeCompare(when(a)));
  const ordered = want === "upcoming" ? upcoming : want === "past" ? past : [...upcoming, ...past];
  const hospital = await hospitalsRepo.getRow(patient.hospital_id);
  const place = { name: hospital?.name ?? "", address: [hospital?.address, hospital?.city].filter(Boolean).join(", "), phone: hospital?.phone ?? "" };
  return slicePage(ordered, page, pageSize).map((a) => ({
    ...patientAppointmentView(a),
    consultAmount: a.consult_amount ?? null,
    paymentStatus: a.payment_status ?? null,
    hospital: place,
  }));
}

/** The patient cancels their own appointment: only upcoming ones, and not once it is about to start. */
export async function cancelForPatient(id: number, patientId: number, input: unknown) {
  const patient = await portalPatient(patientId);
  const appt = assertPatientRecord(await appointmentsRepo.getRow(id), patient, "Appointment");
  if (!UPCOMING.has(appt.status)) throw new ConflictError("Only an upcoming appointment can be cancelled.");
  const start = appointmentStart(appt);
  if (start && start.getTime() - Date.now() < PATIENT_CUTOFF_MINUTES * 60_000) {
    throw new ConflictError("This appointment starts soon — please call the hospital to cancel it.");
  }
  if (await opdRepo.findRow([{ column: "appointment_id", op: "eq", value: appt.id }])) {
    throw new ConflictError("You have already checked in for this appointment, so it can't be cancelled here.");
  }
  const reason = String((input as { reason?: unknown } | null)?.reason ?? "").trim().slice(0, 200);
  if (appt.type === TELECONSULT_TYPE) {
    // A paid video consultation is refunded by the same rule staff use; if the refund fails nothing is cancelled.
    await cancelConsultAppointment(appt, true, null);
  } else {
    await appointmentsRepo.update(appt.id, { status: "Cancelled" });
    await audit(null, "cancel", "appointment", appt.id, { via: "patient-portal", reason });
  }
  return patientAppointmentView((await appointmentsRepo.getRow(appt.id))!);
}

const parseMode = (v: unknown): SlotMode => (v === "video" ? "video" : "in_person");
const dayName = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/**
 * The doctors the patient can book: not on leave and with hours for that kind of visit. Each comes with the weekly hours the doctor offers
 * and the first open time in the next 14 days.
 */
export async function portalDoctors(patientId: number, rawMode: unknown) {
  const patient = await portalPatient(patientId);
  const mode = parseMode(rawMode);
  if (mode === "video") {
    // The video list already exists for the portal; add the same hours and next free time.
    const base = await videoDoctorsForPatient(patient.id);
    return Promise.all(base.map(async (d) => decorate(d.id, mode, d)));
  }
  const hospital = await hospitalsRepo.getRow(patient.hospital_id);
  if (!hospital) throw new NotFoundError("Hospital");
  const { rows } = await doctorsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospital.id }] } as never);
  const out = [];
  for (const d of rows.filter((x) => x.status !== "On Leave")) {
    const entry = await decorate(d.id, mode, { id: d.id, name: d.name, specialty: d.specialty, patientsPerHour: patientsPerHourOf(d), slotMinutes: slotMinutesOf(d) });
    if (entry.weeklyHours.length) out.push(entry);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

interface DoctorCard { id: number; name: string; specialty: string; patientsPerHour: number; slotMinutes: number }

async function decorate(doctorId: number, mode: SlotMode, card: DoctorCard) {
  const doctor = await doctorsRepo.getRow(doctorId);
  const hospital = doctor ? await hospitalsRepo.getRow(doctor.hospital_id) : null;
  const weekly: { day: string; start: string; end: string }[] = [];
  const seen = new Set<string>();
  if (doctor && hospital) {
    const today = localDate();
    for (let i = 0; i < 7; i++) {
      const date = addDaysTo(today, i);
      const grid = gridFor(doctor, hospital, date, mode);
      if (!grid.length) continue;
      const day = dayName(date);
      if (seen.has(day)) continue;
      seen.add(day);
      const len = slotMinutesOf(doctor);
      weekly.push({ day, start: hhmm(grid[0]), end: hhmm(grid[grid.length - 1] + len) });
    }
  }
  return { ...card, photoUrl: null as string | null, weeklyHours: weekly, nextAvailable: await nextOpen(doctorId, mode, 14) };
}

async function nextOpen(doctorId: number, mode: SlotMode, days: number): Promise<{ date: string; time: string } | null> {
  const today = localDate();
  for (let i = 0; i < days; i++) {
    const date = addDaysTo(today, i);
    const r = await slotsFor({ doctorId, date, mode });
    const first = r.slots.find((s) => s.status === "open");
    if (first) return { date, time: first.value };
  }
  return null;
}

/** For the date strip: for each of the next days, how many open times the doctor has. */
export async function portalAvailability(patientId: number, doctorId: number, rawMode: unknown, from: string, rawDays: unknown) {
  const patient = await portalPatient(patientId);
  const doctor = await doctorsRepo.getRow(doctorId);
  if (!doctor || doctor.hospital_id !== patient.hospital_id) throw new NotFoundError("Doctor");
  const mode = parseMode(rawMode);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : localDate();
  if (start < localDate()) throw new BadRequestError("Choose today or a later date.");
  const days = Math.min(31, Math.max(1, Math.floor(Number(rawDays)) || 14));
  const dates = Array.from({ length: days }, (_, i) => addDaysTo(start, i));
  const out: { date: string; open: number; total: number; closedReason: string | null }[] = [];
  for (let i = 0; i < dates.length; i += 7) {
    const batch = await Promise.all(dates.slice(i, i + 7).map(async (date) => {
      const r = await slotsFor({ doctorId, date, mode });
      return { date, open: r.slots.filter((s) => s.status === "open").length, total: r.slots.length, closedReason: r.isOpen ? (r.closedReason ?? null) : r.closedReason };
    }));
    out.push(...batch);
  }
  return { doctorId, mode, days: out };
}
