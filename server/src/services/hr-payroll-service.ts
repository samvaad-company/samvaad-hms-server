/**
 * HR payroll. Each staff member has a salary structure (basic, HRA, allowances, PF %, professional tax, other deduction).
 * A month's payroll run turns those into payslips:
 *
 *   paid days  = days in the month from the join date, less approved unpaid leave, less any extra loss-of-pay days HR enters
 *   earnings   = (basic + HRA + allowances) × paid days ÷ days in the month, each rounded to the rupee
 *   deductions = PF % of the earned basic, professional tax (flat, once gross reaches the threshold), other deduction
 *   net pay    = gross − deductions
 *
 * A run is a Draft — it can be regenerated (HR's loss-of-pay entries are kept) and payslips adjusted — until it is
 * Finalized, after which nothing changes. Days with no attendance punch and no leave are shown for information; HR
 * decides whether to dock them (the attendance register can't tell a weekly off from an absence).
 */
import { hrSalariesRepo, hrPayrollRunsRepo, hrPayslipsRepo, staffRepo } from "@/repositories";
import { transactional } from "@/db/unit-of-work";
import { TABLES, type HrPayrollRunRow, type HrPayslipRow, type HrSalaryRow, type StaffRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks } from "@/lib/key-lock";
import { isoDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { approvedLeaveDays } from "@/services/hr-leave-service";
import { attendanceSummary } from "@/services/attendance-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { DEFAULT_PF_PERCENT, DEFAULT_PROF_TAX, PROF_TAX_THRESHOLD } from "@shared/types/hr";
import type { HrPayrollRunDTO, HrPayrollRunDetailDTO, HrPayslipDTO, HrSalaryDTO } from "@shared/types/api";

const employeeNo = (s: Pick<StaffRow, "id" | "employee_no">) => s.employee_no || `EMP-${1000 + s.id}`;
const monthOk = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const daysIn = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(y, m, 0).getDate(); };

// ── The calculation ──────────────────────────────────────────────────────────

export interface SalaryTerms { basic: number; hra: number; allowances: number; pfPercent: number; profTax: number; otherDeduction: number }
export interface PayInputs { month: string; joinDate: string; unpaidLeaveDays: number; lopAdjust: number }
export interface PayFigures { monthDays: number; paidDays: number; basic: number; hra: number; allowances: number; gross: number; pf: number; profTax: number; otherDeduction: number; netPay: number }

/** The first day of the month a person is payable from: day 1, or their join day if they joined that month; null if they hadn't joined yet. */
export function firstPayableDay(month: string, joinDate: string): number | null {
  const last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  if (joinDate && joinDate > last) return null;
  return joinDate && joinDate.startsWith(month) ? Number(joinDate.slice(8, 10)) : 1;
}

export function computePayslip(t: SalaryTerms, c: PayInputs): PayFigures {
  const monthDays = daysIn(c.month);
  const from = firstPayableDay(c.month, c.joinDate) ?? monthDays + 1;
  const available = Math.max(0, monthDays - (from - 1));
  const paidDays = Math.min(available, Math.max(0, available - Math.max(0, c.unpaidLeaveDays) - Math.max(0, c.lopAdjust)));
  const factor = paidDays / monthDays;
  const basic = Math.round(t.basic * factor);
  const hra = Math.round(t.hra * factor);
  const allowances = Math.round(t.allowances * factor);
  const gross = basic + hra + allowances;
  const pf = Math.round((t.pfPercent / 100) * basic);
  const profTax = gross >= PROF_TAX_THRESHOLD ? Math.round(t.profTax) : 0;
  const otherDeduction = gross > 0 ? Math.round(t.otherDeduction) : 0;
  return { monthDays, paidDays, basic, hra, allowances, gross, pf, profTax, otherDeduction, netPay: Math.max(0, gross - pf - profTax - otherDeduction) };
}

// ── Salary structures ────────────────────────────────────────────────────────

const activeStaff = async (actor: Session) =>
  ((await staffRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor))).rows as StaffRow[]).filter((s) => s.status !== "Inactive");

function toSalaryDto(s: StaffRow, r: HrSalaryRow | undefined): HrSalaryDTO {
  const basic = Number(r?.basic ?? 0), hra = Number(r?.hra ?? 0), allowances = Number(r?.allowances ?? 0);
  return {
    staffId: s.id, name: s.name, role: s.role, department: s.department ?? "", employeeNo: employeeNo(s), set: !!r, basic, hra, allowances,
    pfPercent: Number(r?.pf_percent ?? DEFAULT_PF_PERCENT), profTax: Number(r?.prof_tax ?? DEFAULT_PROF_TAX), otherDeduction: Number(r?.other_deduction ?? 0), gross: basic + hra + allowances,
  };
}

export async function listSalaries(actor: Session): Promise<HrSalaryDTO[]> {
  const [staff, { rows }] = await Promise.all([activeStaff(actor), hrSalariesRepo.listRows(scopeToHospital({ unpaged: true }, actor))]);
  const by = new Map((rows as HrSalaryRow[]).map((r) => [r.staff_id, r]));
  return staff.map((s) => toSalaryDto(s, by.get(s.id)));
}

const salarySchema = {
  basic: { type: "number", required: true, min: 1, max: 10_000_000 },
  hra: { type: "number", required: false, min: 0, max: 10_000_000, default: 0 },
  allowances: { type: "number", required: false, min: 0, max: 10_000_000, default: 0 },
  pfPercent: { type: "number", required: false, min: 0, max: 100, default: DEFAULT_PF_PERCENT },
  profTax: { type: "number", required: false, min: 0, max: 100_000, default: DEFAULT_PROF_TAX },
  otherDeduction: { type: "number", required: false, min: 0, max: 10_000_000, default: 0 },
} as const;

/** Set (or change) a person's salary structure. A change applies to payroll runs generated from now on. */
export async function setSalary(staffId: number, input: unknown, actor: Session): Promise<HrSalaryDTO> {
  const staff = await staffRepo.getRow(staffId);
  assertOwnedByHospital(staff, actor, "Staff member");
  const d = validate(salarySchema, input);
  const values = { basic: d.basic, hra: d.hra, allowances: d.allowances, pf_percent: d.pfPercent, prof_tax: d.profTax, other_deduction: d.otherDeduction, updated_by: actor.name };
  const row = await withKeyLocks([`hr-salary:${staffId}`], async () => {
    const { rows } = await hrSalariesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: staffId }] }, actor));
    return rows[0] ? hrSalariesRepo.update(rows[0].id, values) : hrSalariesRepo.create({ hospital_id: requireHospitalId(actor), staff_id: staffId, ...values });
  });
  await audit(actor, "salary", "hr-payroll", staffId, { basic: d.basic });
  return toSalaryDto(staff as StaffRow, row as HrSalaryRow);
}

// ── Runs and payslips ────────────────────────────────────────────────────────

const toRunDto = (r: HrPayrollRunRow): HrPayrollRunDTO => ({
  id: r.id, month: r.month, status: r.status as HrPayrollRunDTO["status"], staffCount: Number(r.staff_count), totalGross: Number(r.total_gross), totalNet: Number(r.total_net),
  createdBy: r.created_by ?? "", createdAt: r.created_at, finalizedBy: r.finalized_by ?? null, finalizedAt: r.finalized_at ?? null,
});

const toPayslipDto = (r: HrPayslipRow): HrPayslipDTO => ({
  id: r.id, runId: r.run_id, staffId: r.staff_id, staffName: r.staff_name, employeeNo: r.employee_no, role: r.role, department: r.department ?? "", month: r.month,
  monthDays: r.month_days, paidDays: r.paid_days, unpaidLeaveDays: r.unpaid_leave_days, lopAdjust: r.lop_adjust, absentDays: r.absent_days,
  basic: r.basic, hra: r.hra, allowances: r.allowances, gross: r.gross, pf: r.pf, profTax: r.prof_tax, otherDeduction: r.other_deduction, netPay: r.net_pay,
});

export async function listRuns(actor: Session): Promise<HrPayrollRunDTO[]> {
  const { rows } = await hrPayrollRunsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "month", direction: "desc" }] }, actor));
  return (rows as HrPayrollRunRow[]).map(toRunDto);
}

async function ownedRun(id: number, actor: Session): Promise<HrPayrollRunRow> {
  const row = await hrPayrollRunsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Payroll run");
  return row as HrPayrollRunRow;
}

export async function getRun(id: number, actor: Session): Promise<HrPayrollRunDetailDTO> {
  const run = await ownedRun(id, actor);
  const [{ rows }, staff, { rows: sal }] = await Promise.all([
    hrPayslipsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "run_id", op: "eq", value: id }] }, actor)),
    activeStaff(actor),
    hrSalariesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const slips = (rows as HrPayslipRow[]).sort((a, b) => a.staff_name.localeCompare(b.staff_name));
  const have = new Set(slips.map((s) => s.staff_id));
  const withSalary = new Set(sal.map((s) => s.staff_id));
  const skipped = run.status === "Draft"
    ? staff.filter((s) => !have.has(s.id)).map((s) => ({ staffId: s.id, name: s.name, reason: !withSalary.has(s.id) ? "No salary set" : firstPayableDay(run.month, s.join_date ? isoDate(s.join_date) : "") == null ? "Joined after this month" : "Not included" }))
    : [];
  return { ...toRunDto(run), payslips: slips.map(toPayslipDto), skipped };
}

/**
 * Work out the month's payslips. A month with a Draft run is recalculated in place (HR's loss-of-pay entries are kept);
 * a finalized month can't be run again. Only the current month and earlier can be run.
 */
export async function generateRun(input: unknown, actor: Session): Promise<HrPayrollRunDetailDTO> {
  const { month } = (input ?? {}) as { month?: unknown };
  if (!monthOk(month)) throw new ValidationError([{ field: "month", message: "give a month like 2026-10" }]);
  if (month > localDate().slice(0, 7)) throw new ValidationError([{ field: "month", message: "payroll can't be run for a month that hasn't started" }]);
  const hospitalId = requireHospitalId(actor);
  const first = `${month}-01`, last = `${month}-${String(daysIn(month)).padStart(2, "0")}`;

  const runId = await withKeyLocks([`hr-payroll:${hospitalId}:${month}`], async () => {
    const { rows: runs } = await hrPayrollRunsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "month", op: "eq", value: month }] }, actor));
    const existing = runs[0] as HrPayrollRunRow | undefined;
    if (existing?.status === "Finalized") throw new ConflictError(`Payroll for ${month} is finalized and can't be run again`);
    const [staff, { rows: sal }, leave, att, old] = await Promise.all([
      activeStaff(actor),
      hrSalariesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
      approvedLeaveDays(first, last, actor),
      attendanceSummary(month, actor),
      existing ? hrPayslipsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "run_id", op: "eq", value: existing.id }] }, actor)) : Promise.resolve({ rows: [] as HrPayslipRow[] }),
    ]);
    const salary = new Map((sal as HrSalaryRow[]).map((r) => [r.staff_id, r]));
    const keptLop = new Map((old.rows as HrPayslipRow[]).map((p) => [p.staff_id, p.lop_adjust]));
    const absent = new Map(att.staff.map((s) => [s.staffId, s.absentDays]));
    const slips: Record<string, unknown>[] = [];
    for (const s of staff) {
      const r = salary.get(s.id);
      const join = s.join_date ? isoDate(s.join_date) : "";
      const from = firstPayableDay(month, join);
      if (!r || from == null) continue;
      const fromDate = `${month}-${String(from).padStart(2, "0")}`;
      const unpaid = leave.filter((l) => l.staffId === s.id && !l.paid && l.date >= fromDate).length;
      const lop = Math.min(keptLop.get(s.id) ?? 0, daysIn(month));
      const f = computePayslip({ basic: Number(r.basic), hra: Number(r.hra), allowances: Number(r.allowances), pfPercent: Number(r.pf_percent), profTax: Number(r.prof_tax), otherDeduction: Number(r.other_deduction) }, { month, joinDate: join, unpaidLeaveDays: unpaid, lopAdjust: lop });
      slips.push({
        hospital_id: hospitalId, staff_id: s.id, staff_name: s.name, employee_no: employeeNo(s), role: s.role, department: s.department ?? "", month,
        month_days: f.monthDays, paid_days: f.paidDays, unpaid_leave_days: unpaid, lop_adjust: lop, absent_days: absent.get(s.id) ?? 0,
        basic: f.basic, hra: f.hra, allowances: f.allowances, gross: f.gross, pf: f.pf, prof_tax: f.profTax, other_deduction: f.otherDeduction, net_pay: f.netPay,
      });
    }
    const totals = { staff_count: slips.length, total_gross: slips.reduce((n, p) => n + Number(p.gross), 0), total_net: slips.reduce((n, p) => n + Number(p.net_pay), 0) };
    return transactional("hr.payroll-generate", async (uow) => {
      for (const p of old.rows) await uow.remove(TABLES.hrPayslips, p.id);
      const run = existing
        ? await uow.update<HrPayrollRunRow>(TABLES.hrPayrollRuns, existing.id, totals)
        : await uow.insert<HrPayrollRunRow>(TABLES.hrPayrollRuns, { hospital_id: hospitalId, month, status: "Draft", ...totals, created_by: actor.name, finalized_by: null, finalized_at: null });
      for (const p of slips) await uow.insert(TABLES.hrPayslips, { ...p, run_id: run!.id });
      return run!.id;
    });
  });
  await audit(actor, "generate", "hr-payroll", runId, { month });
  return getRun(runId, actor);
}

const adjustSchema = {
  lopAdjust: { type: "number", required: false, min: 0, max: 31 },
  otherDeduction: { type: "number", required: false, min: 0, max: 10_000_000 },
} as const;

/** Change a draft payslip: extra loss-of-pay days, or a one-off deduction for this month. Figures are recalculated. */
export async function adjustPayslip(id: number, input: unknown, actor: Session): Promise<HrPayslipDTO> {
  const slip0 = await hrPayslipsRepo.getRow(id);
  assertOwnedByHospital(slip0, actor, "Payslip");
  const run = await ownedRun(slip0!.run_id, actor);
  const body = (input ?? {}) as Record<string, unknown>;
  const d = validate(adjustSchema, body);
  const updated = await withKeyLocks([`hr-payroll:${run.hospital_id}:${run.month}`], async () => {
    const fresh = await ownedRun(run.id, actor);
    if (fresh.status !== "Draft") throw new ConflictError("This payroll run is finalized — its payslips can't be changed");
    const slip = (await hrPayslipsRepo.getRow(id)) as HrPayslipRow;
    const { rows: sal } = await hrSalariesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "staff_id", op: "eq", value: slip.staff_id }] }, actor));
    const staff = await staffRepo.getRow(slip.staff_id);
    const s = sal[0] as HrSalaryRow | undefined;
    if (!s || !staff) throw new ConflictError("This person's salary is no longer set");
    const lop = "lopAdjust" in body ? Number(d.lopAdjust ?? 0) : slip.lop_adjust;
    const other = "otherDeduction" in body ? Number(d.otherDeduction ?? 0) : null;
    const f = computePayslip({ basic: Number(s.basic), hra: Number(s.hra), allowances: Number(s.allowances), pfPercent: Number(s.pf_percent), profTax: Number(s.prof_tax), otherDeduction: other ?? slip.other_deduction },
      { month: slip.month, joinDate: staff.join_date ? isoDate(staff.join_date) : "", unpaidLeaveDays: slip.unpaid_leave_days, lopAdjust: lop });
    const row = await hrPayslipsRepo.update(id, { lop_adjust: lop, paid_days: f.paidDays, basic: f.basic, hra: f.hra, allowances: f.allowances, gross: f.gross, pf: f.pf, prof_tax: f.profTax, other_deduction: f.otherDeduction, net_pay: f.netPay });
    const { rows: all } = await hrPayslipsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "run_id", op: "eq", value: run.id }] }, actor));
    await hrPayrollRunsRepo.update(run.id, { total_gross: all.reduce((n, p) => n + Number(p.gross), 0), total_net: all.reduce((n, p) => n + Number(p.net_pay), 0) });
    return row as HrPayslipRow;
  });
  await audit(actor, "adjust", "hr-payslip", id, { lopAdjust: body.lopAdjust, otherDeduction: body.otherDeduction });
  return toPayslipDto(updated);
}

/** Lock the run: its payslips are final. */
export async function finalizeRun(id: number, actor: Session): Promise<HrPayrollRunDTO> {
  const first = await ownedRun(id, actor);
  const row = await withKeyLocks([`hr-payroll:${first.hospital_id}:${first.month}`], async () => {
    const run = await ownedRun(id, actor);
    if (run.status !== "Draft") throw new ConflictError(`Payroll for ${run.month} is already finalized`);
    if (Number(run.staff_count) === 0) throw new ConflictError("There are no payslips to finalize — set salaries and generate the run again");
    return hrPayrollRunsRepo.update(id, { status: "Finalized", finalized_by: actor.name, finalized_at: new Date().toISOString() });
  });
  await audit(actor, "finalize", "hr-payroll", id, { month: first.month });
  return toRunDto(row as HrPayrollRunRow);
}

export async function deleteRun(id: number, actor: Session): Promise<void> {
  const first = await ownedRun(id, actor);
  await withKeyLocks([`hr-payroll:${first.hospital_id}:${first.month}`], async () => {
    const run = await ownedRun(id, actor);
    if (run.status !== "Draft") throw new ConflictError("A finalized payroll run can't be deleted");
    const { rows } = await hrPayslipsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "run_id", op: "eq", value: id }] }, actor));
    await transactional("hr.payroll-delete", async (uow) => {
      for (const p of rows) await uow.remove(TABLES.hrPayslips, p.id);
      await uow.remove(TABLES.hrPayrollRuns, id);
    });
  });
  await audit(actor, "delete", "hr-payroll", id, { month: first.month });
}
