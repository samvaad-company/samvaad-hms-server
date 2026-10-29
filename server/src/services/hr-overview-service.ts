/**
 * The HR home: headcount, who's on leave, licences that are running out, today's duty roster and the latest payroll run.
 */
import { staffRepo, hrPayrollRunsRepo } from "@/repositories";
import { type HrPayrollRunRow, type StaffRow } from "@/db/tables";
import { localDate } from "@/lib/clock";
import { isoDate } from "@/services/helpers";
import { addDays } from "@/services/mrd-files-service";
import { approvedLeaveDays, pendingLeaveCount } from "@/services/hr-leave-service";
import { dutyList } from "@/services/hr-roster-service";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import type { HrOverviewDTO } from "@shared/types/api";

/** Licences that have lapsed or lapse within this many days are flagged. */
export const LICENCE_ALERT_DAYS = 60;

const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

export async function hrOverview(actor: Session): Promise<HrOverviewDTO> {
  const today = localDate();
  const [staffRes, leave, pendingLeave, duty, runs] = await Promise.all([
    staffRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    approvedLeaveDays(today, today, actor),
    pendingLeaveCount(actor),
    dutyList(today, actor),
    hrPayrollRunsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "month", direction: "desc" }] }, actor)),
  ]);
  const staff = (staffRes.rows as StaffRow[]).filter((s) => s.status !== "Inactive");
  const away = new Set(leave.map((l) => l.staffId));
  const onLeave = staff.filter((s) => s.status === "On Leave" || away.has(s.id)).length;

  const horizon = addDays(today, LICENCE_ALERT_DAYS);
  const licences = staff
    .filter((s) => s.licence_expiry && isoDate(s.licence_expiry) <= horizon)
    .map((s) => ({ staffId: s.id, name: s.name, role: s.role, licenceNo: s.licence_no ?? "", expiry: isoDate(s.licence_expiry!), daysLeft: daysBetween(today, isoDate(s.licence_expiry!)) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const latest = (runs.rows as HrPayrollRunRow[])[0];
  return {
    today,
    staff: { total: staff.length, active: staff.length - onLeave, onLeave },
    pendingLeave,
    leaveToday: leave.filter((l) => staff.some((s) => s.id === l.staffId)).map((l) => {
      const s = staff.find((x) => x.id === l.staffId)!;
      return { staffId: s.id, name: s.name, role: s.role, code: l.code };
    }),
    licences,
    roster: duty.shifts.filter((s) => s.count > 0).map((s) => ({ shift: s.shift.name, code: s.shift.code, count: s.count })),
    unrosteredToday: duty.unrostered,
    payroll: latest ? { month: latest.month, status: latest.status as "Draft" | "Finalized", totalNet: Number(latest.total_net) } : null,
  };
}
