/**
 * HR shifts and roster. A shift is a named block of hours (Morning, Evening, Night…). The roster gives each active staff
 * member at most one shift per date; a date with no shift is a day off. A person on approved leave can't be given a shift
 * that day. The duty list turns one date of the roster into who is on, by shift and department.
 */
import { hrShiftsRepo, hrRosterRepo, staffRepo } from "@/repositories";
import { type HrRosterRow, type HrShiftRow, type StaffRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { addDays } from "@/services/mrd-files-service";
import { approvedLeaveDays } from "@/services/hr-leave-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { DEFAULT_SHIFTS } from "@shared/types/hr";
import type { HrDutyListDTO, HrRosterDTO, HrShiftDTO } from "@shared/types/api";

const toShiftDto = (r: HrShiftRow): HrShiftDTO => ({ id: r.id, name: r.name, code: r.code, start: r.start, end: r.end, active: r.active !== false });
const MAX_RANGE_DAYS = 62;

// ── Shifts ───────────────────────────────────────────────────────────────────

export function ensureShifts(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`hr-shifts:${hospitalId}`, async () => {
    const existing = await hrShiftsRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    for (const s of DEFAULT_SHIFTS) await hrShiftsRepo.create({ hospital_id: hospitalId, ...s, active: true });
  });
}

export async function listShifts(actor: Session): Promise<HrShiftDTO[]> {
  await ensureShifts(actor);
  const { rows } = await hrShiftsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return (rows as HrShiftRow[]).map(toShiftDto);
}

const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const shiftSchema = {
  name: { type: "string", required: true, min: 2, max: 40 },
  code: { type: "string", required: true, min: 1, max: 3, pattern: /^[A-Za-z0-9]+$/ },
  start: { type: "string", required: true, pattern: time },
  end: { type: "string", required: true, pattern: time },
  active: { type: "boolean", required: false, default: true },
} as const;

async function assertShiftFree(name: string, code: string, actor: Session, exceptId?: number) {
  const { rows } = await hrShiftsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const clash = rows.find((r) => r.id !== exceptId && (r.name.trim().toLowerCase() === name.trim().toLowerCase() || r.code.toUpperCase() === code.toUpperCase()));
  if (clash) throw new ConflictError(`A shift "${clash.name}" (${clash.code}) already exists`);
}

export async function createShift(input: unknown, actor: Session) {
  const data = validate(shiftSchema, input);
  if (data.start === data.end) throw new ValidationError([{ field: "end", message: "a shift can't start and end at the same time" }]);
  await ensureShifts(actor);
  await assertShiftFree(data.name, data.code, actor);
  const row = await hrShiftsRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, code: data.code.toUpperCase(), start: data.start, end: data.end, active: data.active });
  await audit(actor, "create", "hr-shift", row.id);
  return toShiftDto(row as HrShiftRow);
}

export async function updateShift(id: number, input: unknown, actor: Session) {
  const existing = await hrShiftsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Shift");
  const data = validatePartial(shiftSchema, input);
  const patch: Record<string, unknown> = {};
  for (const k of ["start", "end", "active"] as const) if (k in data) patch[k] = data[k];
  if ((patch.start ?? existing!.start) === (patch.end ?? existing!.end)) throw new ValidationError([{ field: "end", message: "a shift can't start and end at the same time" }]);
  const name = ("name" in data ? data.name : existing!.name) as string;
  const code = ("code" in data ? data.code : existing!.code) as string;
  if ("name" in data || "code" in data) { await assertShiftFree(name, code, actor, id); patch.name = name; patch.code = code.toUpperCase(); }
  const row = await hrShiftsRepo.update(id, patch);
  await audit(actor, "update", "hr-shift", id, patch);
  return toShiftDto(row as HrShiftRow);
}

// ── Roster ───────────────────────────────────────────────────────────────────

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
const span = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;

/** The roster between two dates (62 days at most), with the days people are on leave. */
export async function getRoster(from: string | null, to: string | null, actor: Session): Promise<HrRosterDTO> {
  const f = isDate(from) ? from : localDate();
  const t = isDate(to) ? to : addDays(f, 6);
  if (t < f) throw new ValidationError([{ field: "to", message: "can't be before the start" }]);
  if (span(f, t) > MAX_RANGE_DAYS) throw new ValidationError([{ field: "to", message: `ask for ${MAX_RANGE_DAYS} days or fewer at a time` }]);
  const [{ rows }, leave] = await Promise.all([
    hrRosterRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "work_date", op: "gte", value: f }, { column: "work_date", op: "lte", value: t }] }, actor)),
    approvedLeaveDays(f, t, actor),
  ]);
  return {
    from: f, to: t,
    entries: (rows as HrRosterRow[]).map((r) => ({ staffId: r.staff_id, date: r.work_date, shiftId: r.shift_id })),
    leaveDays: leave.map((l) => ({ staffId: l.staffId, date: l.date, code: l.code })),
  };
}

async function activeStaffRow(id: number, actor: Session): Promise<StaffRow> {
  const s = await staffRepo.getRow(id);
  assertOwnedByHospital(s, actor, "Staff member");
  if (s!.status === "Inactive") throw new ConflictError(`${s!.name} is inactive`);
  return s as StaffRow;
}

/** Give a person a shift on a date, change it, or (shiftId null) clear it to a day off. */
export async function setRoster(input: unknown, actor: Session): Promise<{ staffId: number; date: string; shiftId: number | null }> {
  const body = (input ?? {}) as Record<string, unknown>;
  const { staffId } = validate({ staffId: { type: "number", required: true, min: 1 } } as const, body);
  if (!isDate(body.date)) throw new ValidationError([{ field: "date", message: "must be a date" }]);
  const date = body.date;
  const today = localDate();
  if (date < addDays(today, -7)) throw new ValidationError([{ field: "date", message: "the roster can't be changed for dates more than a week back" }]);
  if (date > addDays(today, 366)) throw new ValidationError([{ field: "date", message: "is too far ahead" }]);
  const shiftId = body.shiftId == null || body.shiftId === "" ? null : Number(body.shiftId);
  const staff = await activeStaffRow(staffId, actor);
  if (shiftId != null) {
    const shift = await hrShiftsRepo.getRow(shiftId);
    assertOwnedByHospital(shift, actor, "Shift");
    if (shift!.active === false) throw new ConflictError(`The ${shift!.name} shift is switched off`);
    const onLeave = (await approvedLeaveDays(date, date, actor)).find((l) => l.staffId === staffId);
    if (onLeave) throw new ConflictError(`${staff.name} is on approved leave (${onLeave.code}) on ${date}`);
  }
  await withKeyLocks([`hr-roster:${staffId}:${date}`], async () => {
    const { rows } = await hrRosterRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: staffId }, { column: "work_date", op: "eq", value: date }] }, actor));
    const [current, ...extra] = rows as HrRosterRow[];
    for (const e of extra) await hrRosterRepo.remove(e.id);
    if (shiftId == null) { if (current) await hrRosterRepo.remove(current.id); return; }
    if (current) await hrRosterRepo.update(current.id, { shift_id: shiftId });
    else await hrRosterRepo.create({ hospital_id: requireHospitalId(actor), staff_id: staffId, work_date: date, shift_id: shiftId });
  });
  await audit(actor, "roster", "hr-roster", staffId, { date, shiftId });
  return { staffId, date, shiftId };
}

/** Copy a week's roster to another week (7 days each, from the given Monday-or-any start). Existing shifts and leave days are left alone. */
export async function copyRosterWeek(input: unknown, actor: Session): Promise<{ copied: number; skippedExisting: number; skippedLeave: number }> {
  const body = (input ?? {}) as Record<string, unknown>;
  if (!isDate(body.fromStart) || !isDate(body.toStart)) throw new ValidationError([{ field: "fromStart", message: "give the first day of each week" }]);
  const fromStart = body.fromStart, toStart = body.toStart;
  if (fromStart === toStart) throw new ValidationError([{ field: "toStart", message: "is the same week" }]);
  const offset = span(fromStart, toStart) - 1;
  if (toStart < addDays(localDate(), -7)) throw new ValidationError([{ field: "toStart", message: "can't copy into a week more than a week back" }]);
  const [source, target, leave, staff] = await Promise.all([
    getRoster(fromStart, addDays(fromStart, 6), actor),
    getRoster(toStart, addDays(toStart, 6), actor),
    approvedLeaveDays(toStart, addDays(toStart, 6), actor),
    staffRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const active = new Set((staff.rows as StaffRow[]).filter((s) => s.status !== "Inactive").map((s) => s.id));
  const have = new Set(target.entries.map((e) => `${e.staffId}|${e.date}`));
  const off = new Set(leave.map((l) => `${l.staffId}|${l.date}`));
  const out = { copied: 0, skippedExisting: 0, skippedLeave: 0 };
  for (const e of source.entries) {
    if (!active.has(e.staffId)) continue;
    const date = addDays(e.date, offset);
    const key = `${e.staffId}|${date}`;
    if (have.has(key)) { out.skippedExisting++; continue; }
    if (off.has(key)) { out.skippedLeave++; continue; }
    await withKeyLocks([`hr-roster:${e.staffId}:${date}`], async () => { await hrRosterRepo.create({ hospital_id: requireHospitalId(actor), staff_id: e.staffId, work_date: date, shift_id: e.shiftId }); });
    out.copied++;
  }
  await audit(actor, "roster-copy", "hr-roster", 0, { fromStart, toStart, ...out });
  return out;
}

/** Who is on duty on a date: by shift, then department; who is on leave; how many have no shift. */
export async function dutyList(date: string | null, actor: Session): Promise<HrDutyListDTO> {
  const d = isDate(date) ? date : localDate();
  const [shifts, roster, staffRes] = await Promise.all([listShifts(actor), getRoster(d, d, actor), staffRepo.listRows(scopeToHospital({ unpaged: true }, actor))]);
  const staff = new Map((staffRes.rows as StaffRow[]).filter((s) => s.status !== "Inactive").map((s) => [s.id, s]));
  const rostered = new Set<number>();
  const out: HrDutyListDTO["shifts"] = shifts.filter((s) => s.active || roster.entries.some((e) => e.shiftId === s.id)).map((shift) => {
    const people = roster.entries.filter((e) => e.shiftId === shift.id && staff.has(e.staffId)).map((e) => staff.get(e.staffId)!);
    for (const p of people) rostered.add(p.id);
    const byDept = new Map<string, { id: number; name: string; role: string }[]>();
    for (const p of people) byDept.set(p.department || "No department", [...(byDept.get(p.department || "No department") ?? []), { id: p.id, name: p.name, role: p.role }]);
    return { shift, count: people.length, departments: [...byDept.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([department, list]) => ({ department, staff: list.sort((a, b) => a.name.localeCompare(b.name)) })) };
  });
  const onLeave = roster.leaveDays.filter((l) => staff.has(l.staffId)).map((l) => ({ id: l.staffId, name: staff.get(l.staffId)!.name, role: staff.get(l.staffId)!.role, department: staff.get(l.staffId)!.department ?? "", code: l.code }));
  const away = new Set(onLeave.map((l) => l.id));
  return { date: d, shifts: out, onLeave, unrostered: [...staff.keys()].filter((id) => !rostered.has(id) && !away.has(id)).length };
}
