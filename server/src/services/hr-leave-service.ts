/**
 * HR leave. A staff member applies (or HR applies for them) for a leave type over a run of calendar days; HR approves or
 * rejects. Paid types have a yearly allowance — what has been approved plus what is still waiting counts against it, so
 * two requests can't both claim the last days. A person can't have two overlapping requests. Approved leave:
 *   – shows as "On Leave" on the attendance board and in the staff directory for those days,
 *   – blocks a roster shift on those days, and
 *   – is what payroll deducts when the leave type is unpaid.
 */
import { hrLeaveTypesRepo, hrLeaveRequestsRepo, hrRosterRepo, staffRepo } from "@/repositories";
import { type HrLeaveRequestRow, type HrLeaveTypeRow, type StaffRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { addDays } from "@/services/mrd-files-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { DEFAULT_LEAVE_TYPES } from "@shared/types/hr";
import type { HrLeaveBalanceDTO, HrLeaveCalendarDTO, HrLeaveRequestDTO, HrLeaveTypeDTO, HrStaffBalanceDTO } from "@shared/types/api";

const daysBetween = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};
/** Days both ranges share, first and last included (0 when apart). */
export function overlapDays(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const from = aFrom > bFrom ? aFrom : bFrom;
  const to = aTo < bTo ? aTo : bTo;
  return from > to ? 0 : daysBetween(from, to) + 1;
}

const toTypeDto = (r: HrLeaveTypeRow): HrLeaveTypeDTO => ({ id: r.id, name: r.name, code: r.code, daysPerYear: Number(r.days_per_year), paid: r.paid !== false, active: r.active !== false });
const toRequestDto = (r: HrLeaveRequestRow): HrLeaveRequestDTO => ({
  id: r.id, staffId: r.staff_id, staffName: r.staff_name, department: r.department ?? "", leaveTypeId: r.leave_type_id, typeName: r.type_name, typeCode: r.type_code,
  paid: r.paid !== false, fromDate: r.from_date, toDate: r.to_date, days: Number(r.days), reason: r.reason ?? "", status: r.status as HrLeaveRequestDTO["status"],
  appliedBy: r.applied_by ?? "", appliedAt: r.applied_at, decidedBy: r.decided_by ?? null, decidedAt: r.decided_at ?? null, decisionNote: r.decision_note ?? "",
});

// ── Leave types ──────────────────────────────────────────────────────────────

/** A hospital with no leave types starts with the usual four; they are ordinary rows afterwards. */
export function ensureLeaveTypes(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`hr-leave-types:${hospitalId}`, async () => {
    const existing = await hrLeaveTypesRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    for (const t of DEFAULT_LEAVE_TYPES) await hrLeaveTypesRepo.create({ hospital_id: hospitalId, name: t.name, code: t.code, days_per_year: t.daysPerYear, paid: t.paid, active: true });
  });
}

export async function listLeaveTypes(actor: Session): Promise<HrLeaveTypeDTO[]> {
  await ensureLeaveTypes(actor);
  const { rows } = await hrLeaveTypesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return (rows as HrLeaveTypeRow[]).map(toTypeDto);
}

const typeSchema = {
  name: { type: "string", required: true, min: 2, max: 60 },
  code: { type: "string", required: true, min: 1, max: 6, pattern: /^[A-Za-z0-9]+$/ },
  daysPerYear: { type: "number", required: false, min: 0, max: 366, default: 0 },
  paid: { type: "boolean", required: false, default: true },
  active: { type: "boolean", required: false, default: true },
} as const;

async function assertTypeFree(name: string, code: string, actor: Session, exceptId?: number) {
  const { rows } = await hrLeaveTypesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const clash = rows.find((r) => r.id !== exceptId && (r.name.trim().toLowerCase() === name.trim().toLowerCase() || r.code.toUpperCase() === code.toUpperCase()));
  if (clash) throw new ConflictError(`A leave type "${clash.name}" (${clash.code}) already exists`);
}

export async function createLeaveType(input: unknown, actor: Session) {
  const data = validate(typeSchema, input);
  await ensureLeaveTypes(actor);
  await assertTypeFree(data.name, data.code, actor);
  if (data.paid && data.daysPerYear === 0) throw new ValidationError([{ field: "daysPerYear", message: "a paid leave type needs a yearly allowance (or make it unpaid for no limit)" }]);
  const row = await hrLeaveTypesRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, code: data.code.toUpperCase(), days_per_year: data.daysPerYear, paid: data.paid, active: data.active });
  await audit(actor, "create", "hr-leave-type", row.id);
  return toTypeDto(row as HrLeaveTypeRow);
}

export async function updateLeaveType(id: number, input: unknown, actor: Session) {
  const existing = await hrLeaveTypesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Leave type");
  const data = validatePartial(typeSchema, input);
  const patch: Record<string, unknown> = {};
  for (const k of ["daysPerYear", "paid", "active"] as const) if (k in data) patch[k === "daysPerYear" ? "days_per_year" : k] = data[k];
  const name = ("name" in data ? data.name : existing!.name) as string;
  const code = ("code" in data ? data.code : existing!.code) as string;
  if ("name" in data || "code" in data) { await assertTypeFree(name, code, actor, id); patch.name = name; patch.code = code.toUpperCase(); }
  const row = await hrLeaveTypesRepo.update(id, patch);
  await audit(actor, "update", "hr-leave-type", id, patch);
  return toTypeDto(row as HrLeaveTypeRow);
}

// ── Requests ─────────────────────────────────────────────────────────────────

const REQUEST_RANK: Record<string, number> = { Pending: 0, Approved: 1, Rejected: 2, Cancelled: 2 };

export async function listLeaveRequests(actor: Session, filter: { status?: string; staffId?: number; month?: string } = {}): Promise<HrLeaveRequestDTO[]> {
  const filters = [] as { column: string; op: "eq"; value: unknown }[];
  if (filter.status) filters.push({ column: "status", op: "eq", value: filter.status });
  const { rows } = await hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters, sort: [{ column: "id", direction: "desc" }] }, actor));
  let list = rows as HrLeaveRequestRow[];
  if (filter.staffId) list = list.filter((r) => r.staff_id === filter.staffId);
  if (filter.month && /^\d{4}-\d{2}$/.test(filter.month)) {
    const [y, m] = filter.month.split("-").map(Number);
    const last = `${filter.month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    list = list.filter((r) => overlapDays(r.from_date, r.to_date, `${filter.month}-01`, last) > 0);
  }
  return list.sort((a, b) => (REQUEST_RANK[a.status] - REQUEST_RANK[b.status]) || (a.from_date < b.from_date ? 1 : -1)).map(toRequestDto);
}

async function ownedRequest(id: number, actor: Session): Promise<HrLeaveRequestRow> {
  const row = await hrLeaveRequestsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Leave request");
  return row as HrLeaveRequestRow;
}

/** What a person has used (approved) and has waiting (pending) of one leave type in a calendar year. */
async function usage(staffId: number, typeId: number, year: string, actor: Session, exceptId?: number): Promise<{ used: number; pending: number }> {
  const { rows } = await hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: staffId }] }, actor));
  let used = 0, pending = 0;
  for (const r of rows as HrLeaveRequestRow[]) {
    if (r.id === exceptId || r.leave_type_id !== typeId || !r.from_date.startsWith(year)) continue;
    if (r.status === "Approved") used += Number(r.days);
    else if (r.status === "Pending") pending += Number(r.days);
  }
  return { used, pending };
}

const requestSchema = {
  staffId: { type: "number", required: true, min: 1 },
  leaveTypeId: { type: "number", required: true, min: 1 },
  fromDate: { type: "date", required: true },
  toDate: { type: "date", required: true },
  reason: { type: "string", required: false, max: 300, default: "" },
} as const;

/** Apply for leave. The days must fit the yearly allowance and not overlap another request of this person. */
export async function requestLeave(input: unknown, actor: Session): Promise<HrLeaveRequestDTO> {
  const data = validate(requestSchema, input);
  const staff = await staffRepo.getRow(data.staffId);
  assertOwnedByHospital(staff, actor, "Staff member");
  if (staff!.status === "Inactive") throw new ConflictError(`${staff!.name} is inactive`);
  const type = await hrLeaveTypesRepo.getRow(data.leaveTypeId);
  assertOwnedByHospital(type, actor, "Leave type");
  if (type!.active === false) throw new ConflictError(`${type!.name} is switched off`);
  const today = localDate();
  if (data.toDate < data.fromDate) throw new ValidationError([{ field: "toDate", message: "can't be before the first day" }]);
  if (data.fromDate < addDays(today, -60)) throw new ValidationError([{ field: "fromDate", message: "leave can't be applied for more than 60 days back" }]);
  if (data.fromDate > addDays(today, 366)) throw new ValidationError([{ field: "fromDate", message: "is too far ahead" }]);
  if (data.fromDate.slice(0, 4) !== data.toDate.slice(0, 4)) throw new ValidationError([{ field: "toDate", message: "a request can't run across two years — split it at 31 December" }]);
  const days = daysBetween(data.fromDate, data.toDate) + 1;
  const hospitalId = requireHospitalId(actor);

  const row = await withKeyLocks([`hr-leave:${data.staffId}`], async () => {
    const { rows } = await hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: data.staffId }] }, actor));
    const clash = (rows as HrLeaveRequestRow[]).find((r) => (r.status === "Pending" || r.status === "Approved") && overlapDays(r.from_date, r.to_date, data.fromDate, data.toDate) > 0);
    if (clash) throw new ConflictError(`${staff!.name} already has ${clash.status.toLowerCase()} leave from ${clash.from_date} to ${clash.to_date}`);
    const allowance = Number(type!.days_per_year);
    if (allowance > 0) {
      const { used, pending } = await usage(data.staffId, type!.id, data.fromDate.slice(0, 4), actor);
      const left = allowance - used - pending;
      if (days > left) throw new ConflictError(`${staff!.name} has ${Math.max(0, left)} ${type!.name.toLowerCase()} ${left === 1 ? "day" : "days"} left this year (${used} taken, ${pending} waiting) — this request is ${days}`);
    }
    return hrLeaveRequestsRepo.create({
      hospital_id: hospitalId, staff_id: staff!.id, staff_name: staff!.name, department: staff!.department ?? "", leave_type_id: type!.id, type_name: type!.name, type_code: type!.code,
      paid: type!.paid !== false, from_date: data.fromDate, to_date: data.toDate, days, reason: data.reason, status: "Pending", applied_by: actor.name, applied_at: new Date().toISOString(),
      decided_by: null, decided_at: null, decision_note: "",
    });
  });
  await audit(actor, "apply", "hr-leave", row.id, { staffId: data.staffId, days });
  return toRequestDto(row as HrLeaveRequestRow);
}

/** Approve or reject a pending request. Approving re-checks the allowance and overlaps, in case things changed since it was applied for. */
export async function decideLeave(id: number, input: unknown, actor: Session): Promise<HrLeaveRequestDTO> {
  const first = await ownedRequest(id, actor);
  const data = validate({ decision: { type: "enum", required: true, values: ["Approved", "Rejected"] }, note: { type: "string", required: false, max: 300, default: "" } } as const, input);
  if (data.decision === "Rejected" && data.note.trim().length < 3) throw new ValidationError([{ field: "note", message: "give the reason for rejecting" }]);
  const row = await withKeyLocks([`hr-leave:${first.staff_id}`], async () => {
    const r = await ownedRequest(id, actor);
    if (r.status !== "Pending") throw new ConflictError(`This request is already ${r.status.toLowerCase()}`);
    if (data.decision === "Approved") {
      const type = await hrLeaveTypesRepo.getRow(r.leave_type_id);
      const allowance = Number(type?.days_per_year ?? 0);
      if (allowance > 0) {
        const { used } = await usage(r.staff_id, r.leave_type_id, r.from_date.slice(0, 4), actor, id);
        if (used + Number(r.days) > allowance) throw new ConflictError(`Approving this would take ${r.staff_name} over the ${allowance}-day ${r.type_name.toLowerCase()} allowance (${used} already approved)`);
      }
    }
    const decided = await hrLeaveRequestsRepo.update(id, { status: data.decision, decided_by: actor.name, decided_at: new Date().toISOString(), decision_note: data.note.trim() });
    if (data.decision === "Approved") {
      // Someone on leave isn't on duty: take them off any shifts already rostered for those days.
      const { rows } = await hrRosterRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: r.staff_id }, { column: "work_date", op: "gte", value: r.from_date }, { column: "work_date", op: "lte", value: r.to_date }] }, actor));
      for (const e of rows) await hrRosterRepo.remove(e.id);
    }
    return decided;
  });
  await audit(actor, data.decision === "Approved" ? "approve" : "reject", "hr-leave", id);
  return toRequestDto(row as HrLeaveRequestRow);
}

/** Withdraw a pending request, or an approved one that hasn't started. */
export async function cancelLeave(id: number, actor: Session): Promise<HrLeaveRequestDTO> {
  const first = await ownedRequest(id, actor);
  const row = await withKeyLocks([`hr-leave:${first.staff_id}`], async () => {
    const r = await ownedRequest(id, actor);
    if (r.status === "Pending" || (r.status === "Approved" && r.from_date > localDate())) return hrLeaveRequestsRepo.update(id, { status: "Cancelled", decided_by: r.decided_by ?? actor.name, decided_at: r.decided_at ?? new Date().toISOString() });
    throw new ConflictError(r.status === "Approved" ? "This leave has already started — it can't be cancelled" : `A ${r.status.toLowerCase()} request can't be cancelled`);
  });
  await audit(actor, "cancel", "hr-leave", id);
  return toRequestDto(row as HrLeaveRequestRow);
}

// ── Balances and the calendar ────────────────────────────────────────────────

const activeStaff = async (actor: Session) =>
  ((await staffRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor))).rows as StaffRow[]).filter((s) => s.status !== "Inactive");

/** Each active person's allowance, used, waiting and remaining for every active leave type, in a calendar year. */
export async function leaveBalances(year: string | null, actor: Session): Promise<HrStaffBalanceDTO[]> {
  const y = year && /^\d{4}$/.test(year) ? year : localDate().slice(0, 4);
  const [types, staff, { rows }] = await Promise.all([
    listLeaveTypes(actor), activeStaff(actor),
    hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const live = (rows as HrLeaveRequestRow[]).filter((r) => r.from_date.startsWith(y) && (r.status === "Approved" || r.status === "Pending"));
  return staff.map((s) => ({
    staffId: s.id, name: s.name, role: s.role, department: s.department ?? "",
    balances: types.filter((t) => t.active).map((t): HrLeaveBalanceDTO => {
      const mine = live.filter((r) => r.staff_id === s.id && r.leave_type_id === t.id);
      const used = mine.filter((r) => r.status === "Approved").reduce((n, r) => n + Number(r.days), 0);
      const pending = mine.filter((r) => r.status === "Pending").reduce((n, r) => n + Number(r.days), 0);
      return { typeId: t.id, code: t.code, name: t.name, paid: t.paid, allocated: t.daysPerYear, used, pending, remaining: t.daysPerYear > 0 ? Math.max(0, t.daysPerYear - used - pending) : null };
    }),
  }));
}

/** Who is off on which day of a month: approved leave and leave still waiting. */
export async function leaveCalendar(month: string | null, actor: Session): Promise<HrLeaveCalendarDTO> {
  const m = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : localDate().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const first = `${m}-01`, last = `${m}-${String(daysInMonth).padStart(2, "0")}`;
  const [staff, { rows }] = await Promise.all([activeStaff(actor), hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true }, actor))]);
  const live = (rows as HrLeaveRequestRow[]).filter((r) => (r.status === "Approved" || r.status === "Pending") && overlapDays(r.from_date, r.to_date, first, last) > 0);
  return {
    month: m, daysInMonth,
    staff: staff.map((s) => {
      const days: HrLeaveCalendarDTO["staff"][number]["days"] = {};
      for (const r of live.filter((x) => x.staff_id === s.id)) {
        for (let d = 1; d <= daysInMonth; d++) {
          const date = `${m}-${String(d).padStart(2, "0")}`;
          if (date >= r.from_date && date <= r.to_date) days[String(d)] = { status: r.status as "Approved" | "Pending", code: r.type_code, paid: r.paid !== false };
        }
      }
      return { staffId: s.id, name: s.name, role: s.role, department: s.department ?? "", days };
    }),
  };
}

/** Approved leave days per person between two dates (used by attendance, the roster and payroll). */
export async function approvedLeaveDays(from: string, to: string, actor: Session): Promise<{ staffId: number; date: string; code: string; paid: boolean }[]> {
  const { rows } = await hrLeaveRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Approved" }] }, actor));
  const out: { staffId: number; date: string; code: string; paid: boolean }[] = [];
  for (const r of rows as HrLeaveRequestRow[]) {
    const start = r.from_date > from ? r.from_date : from;
    const end = r.to_date < to ? r.to_date : to;
    for (let d = start; d <= end; d = addDays(d, 1)) out.push({ staffId: r.staff_id, date: d, code: r.type_code, paid: r.paid !== false });
  }
  return out;
}

export async function pendingLeaveCount(actor: Session): Promise<number> {
  const { total } = await hrLeaveRequestsRepo.listRows(scopeToHospital({ pageSize: 1, filters: [{ column: "status", op: "eq", value: "Pending" }] }, actor));
  return total;
}
