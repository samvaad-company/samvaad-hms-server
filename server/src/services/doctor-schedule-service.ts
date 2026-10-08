/**
 * A doctor's own scheduling settings: patients per hour, whether they take video
 * consultations, and which hours are for video. Set by the doctor themselves or
 * by an administrator; the hospital's video switch (Admin → Settings) must be on
 * before a doctor can turn video on.
 */
import { appointmentsRepo, doctorsRepo, hospitalsRepo } from "@/repositories";
import { type DoctorRow } from "@/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { audit } from "@/services/audit";
import { can } from "@/auth/rbac";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital } from "@/services/hospital-scope";
import { localDate, parseClock } from "@/lib/clock";
import {
  gridFor,
  parseVideoHours,
  patientsPerHourOf,
  PATIENTS_PER_HOUR_OPTIONS,
  slotMinutesOf,
  videoOn,
  videoWindowsOf,
} from "@/services/scheduling-service";

function assertMayManage(doctor: DoctorRow | null, actor: Session): asserts doctor is DoctorRow {
  assertOwnedByHospital(doctor, actor, "Doctor");
  const own = actor.role === "Doctor" && actor.doctorId === doctor.id;
  if (!own && !can(actor.role, "doctors", "write")) throw new ForbiddenError("Only the doctor or an administrator can change this schedule");
}

async function describe(doctor: DoctorRow) {
  const hospital = await hospitalsRepo.getRow(doctor.hospital_id);
  if (!hospital) throw new NotFoundError("Hospital");
  return {
    doctorId: doctor.id,
    doctorName: doctor.name,
    patientsPerHour: patientsPerHourOf(doctor),
    slotMinutes: slotMinutesOf(doctor),
    patientsPerHourOptions: [...PATIENTS_PER_HOUR_OPTIONS],
    videoEnabled: !!doctor.video_enabled,
    videoHours: videoWindowsOf(doctor),
    /** The hospital's switch: when false the doctor can't take video, whatever their own setting says. */
    hospitalVideoEnabled: !!hospital.teleconsult_enabled,
    /** Video is actually on for this doctor (their switch AND the hospital's). */
    videoActive: videoOn(doctor, hospital),
  };
}

export async function getDoctorSchedule(id: number, actor: Session) {
  const doctor = await doctorsRepo.getRow(id);
  assertOwnedByHospital(doctor, actor, "Doctor");
  return { ...(await describe(doctor)), warnings: [] as string[] };
}

/** Upcoming appointments that don't fit the doctor's current hours — kept, but worth telling them about. */
async function misfits(doctor: DoctorRow): Promise<{ video: number; inPerson: number }> {
  const hospital = await hospitalsRepo.getRow(doctor.hospital_id);
  if (!hospital) return { video: 0, inPerson: 0 };
  const today = localDate();
  const { rows } = await appointmentsRepo.listRows({
    filters: [
      { column: "doctor_id", op: "eq", value: doctor.id },
      { column: "appointment_date", op: "gte", value: today },
    ],
    unpaged: true,
  });
  const out = { video: 0, inPerson: 0 };
  const grids = new Map<string, number[]>();
  const gridOf = (date: string, mode: "video" | "in_person") => {
    const key = `${date}|${mode}`;
    if (!grids.has(key)) grids.set(key, gridFor(doctor, hospital, date, mode));
    return grids.get(key)!;
  };
  for (const a of rows) {
    if ((a.status !== "Upcoming" && a.status !== "Today") || a.type === "Walk-in") continue;
    const m = parseClock(a.appointment_time);
    if (m == null) continue;
    const mode = a.type === "Tele-consult" ? "video" : "in_person";
    if (!gridOf(a.appointment_date, mode).includes(m)) out[mode === "video" ? "video" : "inPerson"]++;
  }
  return out;
}

export async function updateDoctorSchedule(id: number, input: unknown, actor: Session) {
  const doctor = await doctorsRepo.getRow(id);
  assertMayManage(doctor, actor);
  const hospital = await hospitalsRepo.getRow(doctor.hospital_id);
  if (!hospital) throw new NotFoundError("Hospital");
  const body = (input ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("patientsPerHour" in body) {
    const n = Number(body.patientsPerHour);
    if (!(PATIENTS_PER_HOUR_OPTIONS as readonly number[]).includes(n)) {
      throw new BadRequestError(`Patients per hour must be one of ${PATIENTS_PER_HOUR_OPTIONS.join(", ")} (so every patient gets a whole number of minutes)`);
    }
    patch.patients_per_hour = n;
  }
  if ("videoHours" in body) {
    const windows = parseVideoHours(body.videoHours);
    if (windows.length > 0 && !hospital.teleconsult_enabled) {
      throw new ConflictError("Video consultations are switched off for this hospital — ask an administrator to turn them on first");
    }
    patch.video_hours = windows;
  }
  if ("videoEnabled" in body) {
    const on = body.videoEnabled === true;
    if (on && !hospital.teleconsult_enabled) {
      throw new ConflictError("Video consultations are switched off for this hospital — ask an administrator to turn them on first");
    }
    patch.video_enabled = on;
  }

  const updated = (await doctorsRepo.update(id, patch))!;
  await audit(actor, "update-schedule", "doctor", id, patch);

  const warnings: string[] = [];
  const bad = await misfits(updated);
  if (bad.video) warnings.push(`${bad.video} upcoming video consultation${bad.video === 1 ? " falls" : "s fall"} outside your video hours — they're kept; reschedule or cancel them if needed.`);
  if (bad.inPerson) warnings.push(`${bad.inPerson} upcoming in-person appointment${bad.inPerson === 1 ? " falls" : "s fall"} outside your in-person hours — they're kept; reschedule them if needed.`);
  if (updated.video_enabled && videoWindowsOf(updated).length === 0) warnings.push("Video is on but you haven't set any video hours yet, so nobody can book a video consultation.");
  return { ...(await describe(updated)), warnings };
}
