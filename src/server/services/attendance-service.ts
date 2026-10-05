/**
 * Staff attendance — punch in and punch out.
 *
 * The Attendance tab previously showed illustrative rows with no way to record
 * anything. One row per staff member per day: punching in creates it, punching
 * out closes it and stores the minutes worked.
 */
import { staffAttendanceRepo, staffRepo, usersRepo, hospitalsRepo } from "@/server/repositories";
import { toStaffAttendanceDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type StaffAttendanceRow } from "@/server/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/server/lib/errors";
import { signPayload, verifyPayload } from "@/server/auth/session";
import { isoDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/server/services/hospital-scope";

export const ATTENDANCE_LIST_CONFIG = {
  searchColumns: ["staff_name"],
  filterable: ["staff_id", "work_date", "status"],
  sortable: ["work_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listAttendance(options: QueryOptions, actor: Session) {
  return staffAttendanceRepo.list(scopeToHospital(options, actor));
}

/**
 * Attendance days and clock times are the hospital's local ones. Serverless
 * hosts run in UTC, where "today" would roll over at 5:30 AM IST and punches
 * would be stamped hours off — so format explicitly in the hospital timezone.
 */
const HOSPITAL_TZ = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";

function localDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: HOSPITAL_TZ });
}

function localTime(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-US", {
    timeZone: HOSPITAL_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** The staff member's record for a given day, if any. */
async function todaysRecord(
  staffId: number,
  workDate: string = localDate(),
): Promise<StaffAttendanceRow | null> {
  const { rows } = await staffAttendanceRepo.listRows({
    filters: [
      { column: "staff_id", op: "eq", value: staffId },
      { column: "work_date", op: "eq", value: workDate },
    ],
    unpaged: true,
  });
  return rows[0] ?? null;
}

/** Minutes between two "h:mm AM" times on the same day. */
function minutesBetween(from: string, to: string): number {
  const parse = (t: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t.trim());
    if (!m) return null;
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + Number(m[2]);
  };
  const a = parse(from);
  const b = parse(to);
  if (a == null || b == null) return 0;
  return Math.max(0, b - a);
}

/** Minutes worked, from exact instants when we have them, else the display times. */
function workedMinutes(rec: StaffAttendanceRow, outAt: Date, outDisplay: string): number {
  if (rec.punch_in_at) {
    const ms = outAt.getTime() - new Date(rec.punch_in_at).getTime();
    if (Number.isFinite(ms)) return Math.max(0, Math.round(ms / 60000));
  }
  return minutesBetween(rec.punch_in, outDisplay);
}

export async function punchIn(staffId: number, actor: Session) {
  const staff = await staffRepo.getRow(staffId);
  assertOwnedByHospital(staff, actor, "Staff member");

  const existing = await todaysRecord(staffId);
  if (existing && !existing.punch_out) {
    throw new ConflictError(`${staff.name} is already punched in at ${existing.punch_in}`);
  }
  if (existing && existing.punch_out) {
    throw new ConflictError(`${staff.name} has already completed a shift today`);
  }

  const row = await staffAttendanceRepo.create({
    hospital_id: actor.hospitalId,
    staff_id: staffId,
    staff_name: staff.name,
    work_date: localDate(),
    punch_in: localTime(),
    punch_out: "",
    minutes: 0,
    status: "Present",
    note: "",
    method: "manual",
    punch_in_at: new Date().toISOString(),
  });
  await audit(actor, "punch-in", "attendance", row.id, { staffId });
  return toStaffAttendanceDTO(row as StaffAttendanceRow);
}

export async function punchOut(staffId: number, actor: Session) {
  const staff = await staffRepo.getRow(staffId);
  assertOwnedByHospital(staff, actor, "Staff member");

  const existing = await todaysRecord(staffId);
  if (!existing) throw new ConflictError(`${staff.name} has not punched in today`);
  if (existing.punch_out) {
    throw new ConflictError(`${staff.name} already punched out at ${existing.punch_out}`);
  }

  const now = new Date();
  const out = localTime(now);
  const row = await staffAttendanceRepo.update(existing.id, {
    punch_out: out,
    punch_out_at: now.toISOString(),
    minutes: workedMinutes(existing, now, out),
  });
  await audit(actor, "punch-out", "attendance", existing.id, { staffId });
  return toStaffAttendanceDTO(row as StaffAttendanceRow);
}

export async function deleteAttendance(id: number, actor: Session) {
  const existing = await staffAttendanceRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Attendance record");
  await staffAttendanceRepo.remove(id);
  await audit(actor, "delete", "attendance", id);
}

// ── QR + geofenced self-service punching ─────────────────────────────────────

const QR_PURPOSE = "attendance-qr";
const QR_PREFIX = "samvaad-att:";
/** How long a QR stays valid. The reception screen refreshes well inside this. */
const QR_TTL_SECONDS = 60;
const QR_REFRESH_SECONDS = 25;
const DEFAULT_RADIUS_M = 150;
/** A phone reporting a worse fix than this can't prove it's inside the geofence. */
const MAX_ACCURACY_M = 200;
/** A second scan this soon after punching in is a double-tap, not a punch-out. */
const MIN_SHIFT_SECONDS = 120;

/** Great-circle distance in metres between two lat/lng points. */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** Mint the rotating code the reception screen renders as a QR. */
export async function issueAttendanceQr(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const { token, expiresAt } = await signPayload(QR_PURPOSE, { h: hospitalId }, QR_TTL_SECONDS);
  return {
    code: `${QR_PREFIX}${token}`,
    expiresAt,
    refreshInSeconds: QR_REFRESH_SECONDS,
  };
}

/**
 * The staff record behind a login. Uses the explicit users.staff_id link; if
 * there isn't one yet, falls back to matching by email within the hospital
 * (then by a unique name) and saves the link so it's a one-time backfill.
 */
async function resolveStaff(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const user = await usersRepo.getRow(actor.userId);
  if (!user) throw new NotFoundError("User");

  if (user.staff_id) {
    const linked = await staffRepo.getRow(user.staff_id);
    if (linked && linked.hospital_id === hospitalId) return linked;
  }

  const byEmail = await staffRepo.findRow([
    { column: "hospital_id", op: "eq", value: hospitalId },
    { column: "email", op: "ilike", value: user.email },
  ]);
  if (byEmail) {
    await usersRepo.update(user.id, { staff_id: byEmail.id });
    return byEmail;
  }

  // Logins and staff records often carry different email domains. A name that
  // matches exactly one staff member is a safe link; two people sharing a
  // name is ambiguous, so that case is left for an admin to link by hand.
  const { rows: sameName } = await staffRepo.listRows({
    filters: [{ column: "hospital_id", op: "eq", value: hospitalId }],
    unpaged: true,
  });
  const matches = sameName.filter((s) => s.name.trim().toLowerCase() === user.name.trim().toLowerCase());
  if (matches.length === 1) {
    await usersRepo.update(user.id, { staff_id: matches[0].id });
    return matches[0];
  }
  return null;
}

function parseNumber(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new BadRequestError(`${field} is missing or out of range`);
  }
  return n;
}

export async function scanAttendance(input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const body = (input ?? {}) as Record<string, unknown>;

  const raw = typeof body.code === "string" ? body.code.trim() : "";
  if (!raw.startsWith(QR_PREFIX)) {
    throw new BadRequestError("That isn't a Samvaad attendance QR code");
  }
  const payload = await verifyPayload<{ h: number }>(QR_PURPOSE, raw.slice(QR_PREFIX.length));
  if (!payload) {
    throw new BadRequestError("This QR code has expired — scan the live one on the reception screen");
  }
  if (payload.h !== hospitalId) {
    throw new ForbiddenError("This QR code belongs to a different hospital");
  }

  const lat = parseNumber(body.lat, "Latitude", -90, 90);
  const lng = parseNumber(body.lng, "Longitude", -180, 180);
  const accuracy = parseNumber(body.accuracy, "Accuracy", 0, 1_000_000);
  // Optional explicit intent from the attendance app. Without it the scan toggles in/out.
  const intent = body.action === "in" || body.action === "out" ? body.action : null;

  const hospital = await hospitalsRepo.getRow(hospitalId);
  if (!hospital) throw new NotFoundError("Hospital");
  if (hospital.latitude == null || hospital.longitude == null) {
    throw new BadRequestError("The hospital's location isn't set up yet — ask an admin to set it in Admin → Settings");
  }
  const radius = hospital.geofence_radius_m ?? DEFAULT_RADIUS_M;

  const distance = Math.round(
    distanceMetres(lat, lng, Number(hospital.latitude), Number(hospital.longitude)),
  );

  const staff = await resolveStaff(actor);
  if (!staff) {
    throw new BadRequestError("Your login isn't linked to a staff record — ask an admin to link it");
  }

  if (accuracy > MAX_ACCURACY_M) {
    await audit(actor, "attendance-denied", "attendance", staff.id, { reason: "accuracy", accuracy, distance });
    throw new BadRequestError(
      `Your location is too imprecise (±${Math.round(accuracy)} m). Move near a window or turn on precise location and try again`,
    );
  }
  if (distance > radius) {
    await audit(actor, "attendance-denied", "attendance", staff.id, { reason: "distance", distance, radius });
    throw new ForbiddenError(
      `You're ${distance} m from the hospital — you need to be within ${radius} m to mark attendance`,
    );
  }

  const now = new Date();
  const workDate = localDate(now);
  const display = localTime(now);
  const existing = await todaysRecord(staff.id, workDate);

  if (!existing && intent === "out") {
    throw new ConflictError("You haven't punched in today, so there's nothing to punch out of");
  }

  if (!existing) {
    const row = await staffAttendanceRepo.create({
      hospital_id: hospitalId,
      staff_id: staff.id,
      staff_name: staff.name,
      work_date: workDate,
      punch_in: display,
      punch_out: "",
      minutes: 0,
      status: "Present",
      note: "",
      method: "qr",
      punch_in_at: now.toISOString(),
      in_lat: lat,
      in_lng: lng,
      in_distance_m: distance,
    });
    await audit(actor, "punch-in", "attendance", row.id, { staffId: staff.id, method: "qr", distance });
    return { action: "in" as const, at: display, distanceM: distance, staffName: staff.name, record: toStaffAttendanceDTO(row as StaffAttendanceRow) };
  }

  if (existing.punch_out) {
    throw new ConflictError(`Your shift for today is already complete (out at ${existing.punch_out})`);
  }

  const sinceIn = existing.punch_in_at ? (now.getTime() - new Date(existing.punch_in_at).getTime()) / 1000 : Infinity;
  if (intent === "in") {
    // Re-scanning right after punching in is harmless; later it's a mistake worth explaining.
    if (sinceIn < MIN_SHIFT_SECONDS) {
      return { action: "in" as const, at: existing.punch_in, distanceM: distance, staffName: staff.name, duplicate: true, record: toStaffAttendanceDTO(existing) };
    }
    throw new ConflictError(`You're already punched in (since ${existing.punch_in}) — use Punch out when you leave`);
  }
  // The double-tap guard only applies to an unspecified scan; an explicit punch-out is deliberate.
  if (intent === null && sinceIn < MIN_SHIFT_SECONDS) {
    return { action: "in" as const, at: existing.punch_in, distanceM: distance, staffName: staff.name, duplicate: true, record: toStaffAttendanceDTO(existing) };
  }

  const row = await staffAttendanceRepo.update(existing.id, {
    punch_out: display,
    punch_out_at: now.toISOString(),
    minutes: workedMinutes(existing, now, display),
    out_lat: lat,
    out_lng: lng,
    out_distance_m: distance,
  });
  await audit(actor, "punch-out", "attendance", existing.id, { staffId: staff.id, method: "qr", distance });
  return { action: "out" as const, at: display, distanceM: distance, staffName: staff.name, record: toStaffAttendanceDTO(row as StaffAttendanceRow) };
}

/** What the attendance app shows on open: who am I, am I in, recent days. */
export async function myAttendance(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const staff = await resolveStaff(actor);
  const hospital = await hospitalsRepo.getRow(hospitalId);
  const base = {
    hospitalName: hospital?.name ?? "",
    geofenceConfigured: hospital?.latitude != null && hospital?.longitude != null,
    radiusM: hospital?.geofence_radius_m ?? DEFAULT_RADIUS_M,
  };
  if (!staff) return { ...base, linked: false as const, staffName: actor.name, today: null, recent: [] };

  const [today, recent] = await Promise.all([
    todaysRecord(staff.id),
    staffAttendanceRepo.listRows({
      filters: [{ column: "staff_id", op: "eq", value: staff.id }],
      sort: [{ column: "work_date", direction: "desc" }],
      page: 1,
      pageSize: 14,
    }),
  ]);
  return {
    ...base,
    linked: true as const,
    staffName: staff.name,
    today: today ? toStaffAttendanceDTO(today) : null,
    recent: recent.rows.map(toStaffAttendanceDTO),
  };
}

// ── Admin views: today's snapshot and the monthly register ───────────────────

export type DayStatus = "Present" | "No punch-out" | "In progress" | "Absent" | "Not in yet" | "On Leave";

interface DayCell {
  status: DayStatus;
  punchIn: string;
  punchOut: string;
  minutes: number;
  method: string;
  inDistanceM: number | null;
  outDistanceM: number | null;
}

function cellFor(rec: StaffAttendanceRow | undefined, date: string, today: string, staffOnLeave: boolean): DayCell | null {
  if (rec) {
    const open = !rec.punch_out;
    return {
      status: !open ? "Present" : date === today ? "In progress" : "No punch-out",
      punchIn: rec.punch_in,
      punchOut: rec.punch_out,
      minutes: rec.minutes,
      method: rec.method ?? "manual",
      inDistanceM: rec.in_distance_m ?? null,
      outDistanceM: rec.out_distance_m ?? null,
    };
  }
  if (date > today) return null;
  const status: DayStatus = date === today ? (staffOnLeave ? "On Leave" : "Not in yet") : "Absent";
  return { status, punchIn: "", punchOut: "", minutes: 0, method: "", inDistanceM: null, outDistanceM: null };
}

/** Today's headline numbers plus the latest check-ins, for the admin home card. */
export async function attendanceToday(actor: Session) {
  const today = localDate();
  const [staffRes, attRes] = await Promise.all([
    staffRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    staffAttendanceRepo.listRows(
      scopeToHospital({ filters: [{ column: "work_date", op: "eq", value: today }], unpaged: true }, actor),
    ),
  ]);
  const active = staffRes.rows.filter((s) => s.status !== "Inactive");
  const byStaff = new Map(attRes.rows.map((r) => [r.staff_id, r]));
  const present = active.filter((s) => byStaff.has(s.id)).length;
  const onLeave = active.filter((s) => !byStaff.has(s.id) && s.status === "On Leave").length;
  const recent = [...attRes.rows]
    .sort((a, b) => b.id - a.id)
    .slice(0, 6)
    .map((r) => ({
      staffId: r.staff_id,
      staffName: r.staff_name,
      punchIn: r.punch_in,
      punchOut: r.punch_out,
      method: r.method ?? "manual",
    }));
  return {
    date: today,
    totalStaff: active.length,
    present,
    checkedOut: attRes.rows.filter((r) => r.punch_out).length,
    onLeave,
    notIn: Math.max(0, active.length - present - onLeave),
    viaQr: attRes.rows.filter((r) => r.method === "qr").length,
    recent,
  };
}

/** One row per staff member for a month: a status per day plus totals. */
export async function attendanceSummary(monthInput: string | null, actor: Session) {
  const today = localDate();
  const month = monthInput && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInput) ? monthInput : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const first = `${month}-01`;
  const last = `${month}-${String(daysInMonth).padStart(2, "0")}`;

  const [staffRes, attRes] = await Promise.all([
    staffRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    staffAttendanceRepo.listRows(
      scopeToHospital(
        {
          filters: [
            { column: "work_date", op: "gte", value: first },
            { column: "work_date", op: "lte", value: last },
          ],
          unpaged: true,
        },
        actor,
      ),
    ),
  ]);

  const recsByStaff = new Map<number, Map<string, StaffAttendanceRow>>();
  for (const r of attRes.rows) {
    if (!recsByStaff.has(r.staff_id)) recsByStaff.set(r.staff_id, new Map());
    recsByStaff.get(r.staff_id)!.set(r.work_date, r);
  }

  const staff = staffRes.rows
    .filter((s) => s.status !== "Inactive")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const recs = recsByStaff.get(s.id) ?? new Map<string, StaffAttendanceRow>();
      const joined = s.join_date ? isoDate(s.join_date) : "";
      const days: Record<string, DayCell> = {};
      let presentDays = 0;
      let absentDays = 0;
      let totalMinutes = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${month}-${String(d).padStart(2, "0")}`;
        // Days before someone joined aren't absences.
        if (joined && date < joined) continue;
        const cell = cellFor(recs.get(date), date, today, s.status === "On Leave");
        if (!cell) continue;
        days[String(d)] = cell;
        if (cell.status === "Absent") absentDays++;
        else if (cell.status !== "Not in yet" && cell.status !== "On Leave") presentDays++;
        totalMinutes += cell.minutes;
      }
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        department: s.department,
        joinDate: s.join_date,
        staffStatus: s.status,
        presentDays,
        absentDays,
        totalMinutes,
        days,
      };
    });

  return { month, today, daysInMonth, staff };
}

// ── Punch history: every individual punch-in and punch-out ───────────────────

/** Minutes since midnight for a display time like "2:10 PM"; 0 when unparseable. */
function displayMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*([AP]M)?$/i.exec(t.trim());
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

const MAX_HISTORY_DAYS = 92;

/**
 * Each attendance row holds one punch-in and (once closed) one punch-out; this
 * flattens them into a chronological log of punch events, newest first.
 * `from`/`to` are YYYY-MM-DD (default: the last 30 days), capped at ~3 months.
 */
export async function attendanceHistory(
  params: { from?: string | null; to?: string | null; staffId?: number | null },
  actor: Session,
) {
  const today = localDate();
  const valid = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const to = valid(params.to) ?? today;
  const defaultFrom = new Date(`${to}T00:00:00Z`);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const earliest = new Date(`${to}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - (MAX_HISTORY_DAYS - 1));
  let from = valid(params.from) ?? defaultFrom.toISOString().slice(0, 10);
  const floor = earliest.toISOString().slice(0, 10);
  if (from < floor) from = floor;

  const filters: { column: string; op: "eq" | "gte" | "lte"; value: string | number }[] = [
    { column: "work_date", op: "gte", value: from },
    { column: "work_date", op: "lte", value: to },
  ];
  if (params.staffId) filters.push({ column: "staff_id", op: "eq", value: params.staffId });

  const { rows } = await staffAttendanceRepo.listRows(scopeToHospital({ filters, unpaged: true }, actor));

  interface PunchEvent {
    id: string;
    staffId: number;
    staffName: string;
    date: string;
    type: "in" | "out";
    time: string;
    method: string;
    distanceM: number | null;
    sortKey: number;
  }
  const events: PunchEvent[] = [];
  for (const r of rows) {
    const day = new Date(`${r.work_date}T00:00:00Z`).getTime();
    const method = r.method ?? "manual";
    const key = (iso: string | null | undefined, display: string) =>
      iso ? new Date(iso).getTime() : day + displayMinutes(display) * 60_000;
    if (r.punch_in) {
      events.push({
        id: `${r.id}-in`, staffId: r.staff_id, staffName: r.staff_name, date: r.work_date, type: "in",
        time: r.punch_in, method, distanceM: r.in_distance_m ?? null, sortKey: key(r.punch_in_at, r.punch_in),
      });
    }
    if (r.punch_out) {
      events.push({
        id: `${r.id}-out`, staffId: r.staff_id, staffName: r.staff_name, date: r.work_date, type: "out",
        time: r.punch_out, method, distanceM: r.out_distance_m ?? null, sortKey: key(r.punch_out_at, r.punch_out),
      });
    }
  }
  // Newest first; when a punch-in and punch-out share a minute, the out is the later event.
  events.sort((a, b) => b.sortKey - a.sortKey || (a.type === b.type ? 0 : a.type === "out" ? -1 : 1));
  return { from, to, events: events.map((e) => ({ id: e.id, staffId: e.staffId, staffName: e.staffName, date: e.date, type: e.type, time: e.time, method: e.method, distanceM: e.distanceM })) };
}
