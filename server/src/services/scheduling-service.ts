/**
 * Doctor scheduling: how many patients a doctor sees per hour, which of their
 * hours are for video consultations and which for in-person visits, and whether
 * a given time can still be booked.
 *
 * The rules, in one place so every way of booking (reception, the patient app,
 * the patient booking link, a reschedule) behaves identically:
 *
 *  - A doctor sees N patients per hour (N divides 60). The hospital's working
 *    hours are cut into slots of 60/N minutes, one patient per slot — so an hour
 *    can never hold more than N bookings. Appointments at odd times (walk-ins,
 *    older data) count towards the same hour, and an hour with N is "full".
 *  - A doctor who takes video consultations reserves weekly windows for them.
 *    Inside a window only video consultations can be booked; everywhere else in
 *    the working day only in-person visits can. The wrong kind is not offered as
 *    a time at all, and is refused if someone insists.
 *  - Switching video off (the doctor's own switch, or the hospital's) hands the
 *    windows back to in-person.
 */
import { appointmentsRepo, doctorsRepo, hospitalsRepo, teleconsultBookingsRepo } from "@/repositories";
import { type AppointmentRow, type DoctorRow, type HospitalRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { DEFAULT_PATIENTS_PER_HOUR, PATIENTS_PER_HOUR_OPTIONS, patientsPerHourOf } from "@/lib/scheduling-rules";
import { DAY_NAMES, dayNameOf, hhmm, localDate, localMinutes, parseClock, to12h, zonedInstant } from "@/lib/clock";

export type SlotMode = "in_person" | "video";

export { PATIENTS_PER_HOUR_OPTIONS, DEFAULT_PATIENTS_PER_HOUR, patientsPerHourOf };
/** A started-but-unpaid video booking holds its slot for this long. */
export const HOLD_MINUTES = 15;

export interface VideoWindow {
  day: string;
  /** "HH:mm", 24-hour. */
  start: string;
  end: string;
}

type Range = [number, number];

// ── A doctor's settings ──────────────────────────────────────────────────────

export const slotMinutesOf = (d: Pick<DoctorRow, "patients_per_hour">): number => 60 / patientsPerHourOf(d);

/** The doctor takes video consultations right now: their own switch AND the hospital's. */
export function videoOn(d: Pick<DoctorRow, "video_enabled">, hospital: Pick<HospitalRow, "teleconsult_enabled">): boolean {
  return !!d.video_enabled && !!hospital.teleconsult_enabled;
}

export function videoWindowsOf(d: Pick<DoctorRow, "video_hours">): VideoWindow[] {
  return Array.isArray(d.video_hours) ? d.video_hours : [];
}

/** Check and tidy the weekly video hours a doctor submits. */
export function parseVideoHours(input: unknown): VideoWindow[] {
  if (input == null) return [];
  if (!Array.isArray(input)) throw new BadRequestError("Video hours must be a list of days and times");
  if (input.length > 40) throw new BadRequestError("Too many video-hour entries");
  const out: VideoWindow[] = [];
  for (const raw of input as Partial<VideoWindow>[]) {
    const day = String(raw?.day ?? "");
    if (!DAY_NAMES.includes(day)) throw new BadRequestError(`"${day}" isn't a day of the week`);
    const start = parseClock(String(raw?.start ?? ""));
    const end = parseClock(String(raw?.end ?? ""));
    if (start == null || end == null) throw new BadRequestError(`${day}: enter the start and end time`);
    if (end <= start) throw new BadRequestError(`${day}: the end time must be after the start time`);
    if (end - start < 15) throw new BadRequestError(`${day}: a video window must be at least 15 minutes long`);
    out.push({ day, start: hhmm(start), end: hhmm(end) });
  }
  for (const day of DAY_NAMES) {
    const mine = out.filter((w) => w.day === day).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < mine.length; i++) {
      if (mine[i].start < mine[i - 1].end) throw new BadRequestError(`${day}: video windows overlap (${mine[i - 1].start}–${mine[i - 1].end} and ${mine[i].start}–${mine[i].end})`);
    }
  }
  return out.sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day) || a.start.localeCompare(b.start));
}

// ── Hours → slots ────────────────────────────────────────────────────────────

function parseRange(text: string | undefined): Range | null {
  if (!text) return null;
  const parts = text.split(/[-–—]/).map((p) => p.trim());
  if (parts.length !== 2) return null;
  const a = parseClock(parts[0]);
  const b = parseClock(parts[1]);
  return a == null || b == null || b <= a ? null : [a, b];
}

interface WorkingDay { day?: string; open?: boolean; morning?: string; evening?: string }

/** The hospital's open ranges on a date. No hours on file → a plain 9–5 day, so there is still something to book. */
function hospitalRanges(hospital: Pick<HospitalRow, "working_hours">, date: string): Range[] {
  const wh = hospital.working_hours;
  if (!Array.isArray(wh) || wh.length === 0) return [[9 * 60, 17 * 60]];
  const day = (wh as WorkingDay[]).find((w) => w.day === dayNameOf(date));
  if (!day || !day.open) return [];
  return [parseRange(day.morning), parseRange(day.evening)].filter((r): r is Range => r !== null);
}

function videoRanges(d: Pick<DoctorRow, "video_hours">, date: string): Range[] {
  const day = dayNameOf(date);
  return videoWindowsOf(d)
    .filter((w) => w.day === day)
    .map((w) => [parseClock(w.start), parseClock(w.end)] as [number | null, number | null])
    .filter((r): r is Range => r[0] !== null && r[1] !== null && r[1] > r[0]);
}

function subtract(ranges: Range[], cuts: Range[]): Range[] {
  let out = ranges;
  for (const [cs, ce] of cuts) {
    out = out.flatMap(([a, b]): Range[] => {
      if (ce <= a || cs >= b) return [[a, b]];
      const parts: Range[] = [];
      if (cs > a) parts.push([a, cs]);
      if (ce < b) parts.push([ce, b]);
      return parts;
    });
  }
  return out;
}

/** Slot start times (minutes) a doctor offers on a date for one kind of visit. */
export function gridFor(doctor: DoctorRow, hospital: HospitalRow, date: string, mode: SlotMode): number[] {
  const len = slotMinutesOf(doctor);
  const video = videoOn(doctor, hospital);
  const ranges =
    mode === "video"
      ? video ? videoRanges(doctor, date) : []
      : video ? subtract(hospitalRanges(hospital, date), videoRanges(doctor, date)) : hospitalRanges(hospital, date);
  const starts: number[] = [];
  for (const [a, b] of ranges) for (let m = a; m + len <= b; m += len) starts.push(m);
  return [...new Set(starts)].sort((x, y) => x - y);
}

// ── What's already booked ────────────────────────────────────────────────────

interface Exclusions {
  /** The appointment being moved: it doesn't compete with itself. */
  excludeAppointmentId?: number;
  /** The video booking being confirmed: its own payment hold doesn't count against it. */
  excludeBookingId?: number;
}

/** Start times (minutes) of everything that takes a doctor's time on a date: appointments of every kind, plus live payment holds. */
async function occupancy(hospitalId: number, doctorId: number, date: string, ex: Exclusions): Promise<number[]> {
  const { rows } = await appointmentsRepo.listRows({
    filters: [
      { column: "doctor_id", op: "eq", value: doctorId },
      { column: "appointment_date", op: "eq", value: date },
    ],
    unpaged: true,
  });
  const out: number[] = [];
  for (const a of rows) {
    if (a.status === "Cancelled" || a.id === ex.excludeAppointmentId) continue;
    // A video appointment that this very booking already created isn't a clash with itself.
    if (ex.excludeBookingId != null && a.booking_id === ex.excludeBookingId) continue;
    const m = parseClock(a.appointment_time);
    if (m != null) out.push(m);
  }
  const cutoff = Date.now() - HOLD_MINUTES * 60_000;
  const { rows: holds } = await teleconsultBookingsRepo.listRows({
    filters: [
      { column: "hospital_id", op: "eq", value: hospitalId },
      { column: "doctor_id", op: "eq", value: doctorId },
      { column: "appointment_date", op: "eq", value: date },
      { column: "status", op: "eq", value: "pending_payment" },
    ],
    unpaged: true,
  });
  for (const h of holds) {
    if (h.id === ex.excludeBookingId || new Date(h.created_at).getTime() <= cutoff) continue;
    const m = parseClock(h.appointment_time);
    if (m != null) out.push(m);
  }
  return out;
}

const hourOf = (m: number) => Math.floor(m / 60);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The message everyone who tries to book a full hour sees — staff, patients, the app, the booking link. */
export function fullMessage(doctorName: string, perHour: number): string {
  return `This hour is full — ${doctorName} sees ${perHour === 1 ? "1 patient" : `up to ${perHour} patients`} per hour and all ${plural(perHour, "place")} in it are booked. Please choose another time.`;
}

export const takenMessage = "That time was just booked — please pick another slot.";

// ── Loading ──────────────────────────────────────────────────────────────────

export async function loadDoctor(doctorId: number): Promise<{ doctor: DoctorRow; hospital: HospitalRow }> {
  const doctor = await doctorsRepo.getRow(doctorId);
  if (!doctor) throw new NotFoundError("Doctor");
  const hospital = await hospitalsRepo.getRow(doctor.hospital_id);
  if (!hospital) throw new NotFoundError("Hospital");
  return { doctor, hospital };
}

// ── Public: the bookable times ───────────────────────────────────────────────

export interface SlotView {
  /** "HH:mm". */
  value: string;
  /** "10:30 AM". */
  label: string;
  /** open: can be booked. booked: this exact time is taken. full: the hour's quota is used up. */
  status: "open" | "booked" | "full";
}

export interface HourView {
  label: string;
  booked: number;
  capacity: number;
  full: boolean;
}

export async function slotsFor(opts: { doctorId: number; date: string; mode: SlotMode } & Exclusions) {
  const { doctor, hospital } = await loadDoctor(opts.doctorId);
  const perHour = patientsPerHourOf(doctor);
  const len = slotMinutesOf(doctor);
  const base = {
    mode: opts.mode,
    doctorName: doctor.name,
    patientsPerHour: perHour,
    slotMinutes: len,
    slots: [] as SlotView[],
    hours: [] as HourView[],
    note: `${doctor.name} sees ${perHour === 1 ? "1 patient" : `up to ${perHour} patients`} per hour — one every ${len} minutes. A time shows as Booked once it's taken and Full once the hour's places are used up.`,
  };
  const closed = (closedReason: string) => ({ ...base, isOpen: false, closedReason });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) return closed("Pick a valid date.");
  const today = localDate();
  if (opts.date < today) return closed("That date has already passed.");
  if (doctor.status === "On Leave") return closed(`${doctor.name} is on leave.`);
  if (opts.mode === "video" && !videoOn(doctor, hospital)) return closed(`${doctor.name} isn't taking video consultations.`);

  const grid = gridFor(doctor, hospital, opts.date, opts.mode);
  if (grid.length === 0) {
    const day = dayNameOf(opts.date);
    return closed(opts.mode === "video" ? `${doctor.name} has no video consultation hours on ${day}.` : `${doctor.name} has no in-person hours on ${day}.`);
  }

  const occ = await occupancy(doctor.hospital_id, doctor.id, opts.date, opts);
  const nowMin = opts.date === today ? localMinutes() : -1;
  const slots: SlotView[] = grid
    .filter((m) => m > nowMin)
    .map((m) => {
      const taken = occ.some((o) => o >= m && o < m + len);
      const hourCount = occ.filter((o) => hourOf(o) === hourOf(m)).length;
      return { value: hhmm(m), label: to12h(m), status: taken ? "booked" : hourCount >= perHour ? "full" : "open" };
    });

  const hours = new Map<number, HourView>();
  for (const s of slots) {
    const h = hourOf(parseClock(s.value)!);
    if (!hours.has(h)) {
      const booked = occ.filter((o) => hourOf(o) === h).length;
      hours.set(h, { label: `${to12h(h * 60)} – ${to12h((h + 1) * 60)}`, booked, capacity: perHour, full: booked >= perHour });
    }
  }
  const open = slots.filter((s) => s.status === "open").length;
  return {
    ...base,
    isOpen: true,
    closedReason: slots.length === 0 ? "No more times today." : open === 0 ? `Every time is booked — ${fullMessage(doctor.name, perHour).replace(/^This hour is full — /, "")}` : null,
    slots,
    hours: [...hours.values()],
  };
}

// ── Public: can this time be booked? ─────────────────────────────────────────

/**
 * Throw a message a person can act on if `minutes` on `date` can't be booked
 * for this kind of visit. `occupancyOnly` skips the hours/mode rules and only
 * checks that nobody has taken the place — used when confirming a booking that
 * was already paid for, which must stand even if the doctor changed their hours
 * in the meantime.
 */
export async function assertSlot(opts: {
  doctor: DoctorRow;
  hospital: HospitalRow;
  date: string;
  minutes: number;
  mode: SlotMode;
  occupancyOnly?: boolean;
} & Exclusions): Promise<void> {
  const { doctor, hospital, date, minutes, mode } = opts;
  const perHour = patientsPerHourOf(doctor);
  const len = slotMinutesOf(doctor);

  if (!opts.occupancyOnly) {
    const today = localDate();
    if (date < today || (date === today && minutes <= localMinutes())) throw new BadRequestError("Please pick a time in the future");
    if (doctor.status === "On Leave") throw new BadRequestError(`${doctor.name} is on leave — please choose another doctor or date.`);
    if (mode === "video" && !videoOn(doctor, hospital)) throw new BadRequestError(`${doctor.name} isn't taking video consultations.`);
    if (!gridFor(doctor, hospital, date, mode).includes(minutes)) {
      const other: SlotMode = mode === "video" ? "in_person" : "video";
      throw new BadRequestError(
        gridFor(doctor, hospital, date, other).includes(minutes)
          ? mode === "in_person"
            ? `${doctor.name} takes video consultations only at that time — please pick another time for an in-person visit.`
            : `${doctor.name} sees in-person patients at that time — video consultations are only available in the doctor's video hours.`
          : `That time isn't one of ${doctor.name}'s ${mode === "video" ? "video" : "in-person"} slots — please pick one from the list.`,
      );
    }
  }

  const occ = await occupancy(doctor.hospital_id, doctor.id, date, opts);
  if (occ.filter((o) => hourOf(o) === hourOf(minutes)).length >= perHour) throw new ConflictError(fullMessage(doctor.name, perHour));
  if (occ.some((o) => o >= minutes && o < minutes + len)) throw new ConflictError(takenMessage);
}

// ── Racing bookings ──────────────────────────────────────────────────────────

const slotTails = new Map<string, Promise<void>>();

/** Run `fn` with nobody else in this process booking the same doctor and day (so two people can't both take the last place). */
export async function withDoctorDayLock<T>(doctorId: number, date: string, fn: () => Promise<T>): Promise<T> {
  const key = `${doctorId}|${date}`;
  const prev = slotTails.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const mine = new Promise<void>((resolve) => { release = resolve; });
  const tail = prev.then(() => mine);
  slotTails.set(key, tail);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (slotTails.get(key) === tail) slotTails.delete(key);
  }
}

/**
 * After inserting an appointment, make sure it didn't lose a race with another
 * server booking the same place at the same moment. The earliest appointment
 * (lowest id) keeps the place; a later one must be removed by its creator.
 * Returns what the late one should tell its user, or null if all is well.
 */
export async function lostRace(opts: { doctor: DoctorRow; date: string; minutes: number; appointmentId: number }): Promise<Error | null> {
  const perHour = patientsPerHourOf(opts.doctor);
  const len = slotMinutesOf(opts.doctor);
  const { rows } = await appointmentsRepo.listRows({
    filters: [
      { column: "doctor_id", op: "eq", value: opts.doctor.id },
      { column: "appointment_date", op: "eq", value: opts.date },
    ],
    unpaged: true,
  });
  const live = rows
    .filter((a) => a.status !== "Cancelled")
    .map((a) => ({ id: a.id, m: parseClock(a.appointment_time) }))
    .filter((a): a is { id: number; m: number } => a.m != null)
    .sort((a, b) => a.id - b.id);
  const sameSlot = live.filter((a) => a.m >= opts.minutes && a.m < opts.minutes + len);
  if (sameSlot[0] && sameSlot[0].id !== opts.appointmentId) return new ConflictError(takenMessage);
  const sameHour = live.filter((a) => hourOf(a.m) === hourOf(opts.minutes));
  if (sameHour.findIndex((a) => a.id === opts.appointmentId) >= perHour) return new ConflictError(fullMessage(opts.doctor.name, perHour));
  return null;
}

// ── Rescheduling rules ───────────────────────────────────────────────────────

/** Slot length when an appointment doesn't record one (older rows). */
export const DEFAULT_SLOT_MINUTES = 30;
/** A patient can't move an appointment that starts sooner than this (they should call the hospital), nor move one more than this many times. */
export const PATIENT_CUTOFF_MINUTES = 60;
export const PATIENT_MAX_RESCHEDULES = 3;

export function appointmentStart(a: Pick<AppointmentRow, "appointment_date" | "appointment_time">): Date | null {
  const m = parseClock(a.appointment_time);
  return m == null ? null : zonedInstant(a.appointment_date, m);
}

/** What a patient may do with an appointment right now, and why not. */
export function patientRescheduleInfo(a: AppointmentRow): { canReschedule: boolean; reason: string | null } {
  if (a.status !== "Upcoming" && a.status !== "Today") return { canReschedule: false, reason: "Only upcoming appointments can be rescheduled." };
  if ((a.reschedule_count ?? 0) >= PATIENT_MAX_RESCHEDULES) {
    return { canReschedule: false, reason: `This appointment has already been moved ${PATIENT_MAX_RESCHEDULES} times — please call the hospital to change it again.` };
  }
  const start = appointmentStart(a);
  if (start && start.getTime() - Date.now() < PATIENT_CUTOFF_MINUTES * 60_000) {
    return { canReschedule: false, reason: "This appointment starts soon — please call the hospital to change it." };
  }
  return { canReschedule: true, reason: null };
}
