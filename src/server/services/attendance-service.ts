/**
 * Staff attendance — punch in and punch out.
 *
 * The Attendance tab previously showed illustrative rows with no way to record
 * anything. One row per staff member per day: punching in creates it, punching
 * out closes it and stores the minutes worked.
 */
import { staffAttendanceRepo, staffRepo } from "@/server/repositories";
import { toStaffAttendanceDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type StaffAttendanceRow } from "@/server/db/tables";
import { ConflictError } from "@/server/lib/errors";
import { isoDate, displayTime } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

export const ATTENDANCE_LIST_CONFIG = {
  searchColumns: ["staff_name"],
  filterable: ["staff_id", "work_date", "status"],
  sortable: ["work_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listAttendance(options: QueryOptions, actor: Session) {
  return staffAttendanceRepo.list(scopeToHospital(options, actor));
}

/** Today's open (punched-in, not yet out) record for a staff member. */
async function todaysRecord(staffId: number): Promise<StaffAttendanceRow | null> {
  const { rows } = await staffAttendanceRepo.listRows({
    filters: [
      { column: "staff_id", op: "eq", value: staffId },
      { column: "work_date", op: "eq", value: isoDate(new Date()) },
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
    work_date: isoDate(new Date()),
    punch_in: displayTime(),
    punch_out: "",
    minutes: 0,
    status: "Present",
    note: "",
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

  const out = displayTime();
  const row = await staffAttendanceRepo.update(existing.id, {
    punch_out: out,
    minutes: minutesBetween(existing.punch_in, out),
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
