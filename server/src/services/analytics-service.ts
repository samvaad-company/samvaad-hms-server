/**
 * Reports → Analytics: the trend of collections and footfall over days, weeks or months — with the period so far set against the
 * one before it — and today's figures for revenue, the OPD, beds, the pharmacy and the lab. Read-only.
 */
import { appointmentsRepo, bedsRepo, billsRepo, ipdRepo, labRepo, opdRepo, pharmacyBatchesRepo, pharmacyRepo } from "@/repositories";
import type { AppointmentRow, BedRow, BillRow, IpdAdmissionRow, LabTestRow, OpdVisitRow, PharmacyBatchRow, PharmacyItemRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import { localDate, localMinutes, parseClock } from "@/lib/clock";
import type { AnalyticsDTO, AnalyticsRange, AnalyticsTrendStat } from "@shared/types/api";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

const r2 = (n: number): number => Math.round(n * 100) / 100;
const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const dayOf = (ts: string | null | undefined): string => (ts ? localDate(new Date(ts)) : "");
const mondayOf = (iso: string): string => { const d = new Date(`${iso}T12:00:00`); return addDays(iso, -((d.getDay() + 6) % 7)); };
const monthStart = (iso: string): string => `${iso.slice(0, 8)}01`;
const addMonths = (iso: string, n: number): string => { const d = new Date(`${monthStart(iso)}T12:00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString("en-CA"); };
const daysIn = (iso: string): number => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0).getDate();
const SHORT = (iso: string, o: Intl.DateTimeFormatOptions): string => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", o);

const paidAmount = (b: BillRow): number => Number(b.patient_share ?? b.total);
const NOT_OUT = (s: string): boolean => s !== "Discharged";

export async function getAnalytics(rawRange: string, actor: Session): Promise<AnalyticsDTO> {
  const range: AnalyticsRange = rawRange === "week" || rawRange === "month" ? rawRange : "day";
  const today = localDate();
  const [bills, appts, opd, ipd, beds, labs, stock, batches] = await Promise.all([
    all<BillRow>(billsRepo, actor), all<AppointmentRow>(appointmentsRepo, actor), all<OpdVisitRow>(opdRepo, actor), all<IpdAdmissionRow>(ipdRepo, actor),
    all<BedRow>(bedsRepo, actor), all<LabTestRow>(labRepo, actor), all<PharmacyItemRow>(pharmacyRepo, actor), all<PharmacyBatchRow>(pharmacyBatchesRepo, actor),
  ]);

  // Who came in on a day: an OPD check-in, or an appointment that wasn't cancelled.
  const seen = new Map<string, Set<string>>();
  const see = (day: string, patientId: number | null, name: string) => {
    if (!day || day > today) return;
    (seen.get(day) ?? seen.set(day, new Set()).get(day)!).add(patientId !== null ? `p${patientId}` : `n${name.toLowerCase()}`);
  };
  for (const v of opd) see(dayOf(v.created_at), v.patient_id, v.patient_name);
  for (const a of appts) if (a.status !== "Cancelled") see(a.appointment_date, a.patient_id, a.patient_name);

  const paid = bills.filter((b) => b.status === "Paid");
  const collected = (from: string, to: string) => r2(paid.filter((b) => b.bill_date >= from && b.bill_date <= to).reduce((n, b) => n + paidAmount(b), 0));
  const patients = (from: string, to: string) => { const s = new Set<string>(); for (const [d, set] of seen) if (d >= from && d <= to) set.forEach((k) => s.add(k)); return s.size; };
  const admissions = (from: string, to: string) => ipd.filter((a) => a.admission_date >= from && a.admission_date <= to).length;
  const avgCharge = (type: string, from: string, to: string): number | null => {
    const list = bills.filter((b) => b.type === type && b.bill_date >= from && b.bill_date <= to);
    return list.length ? r2(list.reduce((n, b) => n + Number(b.total), 0) / list.length) : null;
  };

  // The period so far, and the same stretch of the period before it.
  let cur: [string, string]; let prev: [string, string]; let rangeNote: string;
  if (range === "day") { cur = [today, today]; prev = [addDays(today, -1), addDays(today, -1)]; rangeNote = "this day vs last"; }
  else if (range === "week") {
    const start = mondayOf(today); const elapsed = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000);
    cur = [start, today]; prev = [addDays(start, -7), addDays(start, -7 + elapsed)]; rangeNote = `this week so far (${elapsed + 1} of 7 days) vs last`;
  } else {
    const start = monthStart(today); const elapsed = Number(today.slice(8, 10)); const before = addMonths(today, -1);
    cur = [start, today]; prev = [before, addDays(before, Math.min(elapsed, daysIn(before)) - 1)]; rangeNote = `this month so far (${elapsed} of ${daysIn(today)} days) vs last`;
  }

  const stat = (key: string, label: string, kind: "money" | "count", f: (from: string, to: string) => number | null): AnalyticsTrendStat => {
    const value = f(...cur); const previous = f(...prev);
    // A figure with nothing before it to compare with (or nothing now) has no meaningful % change.
    const change = value !== null && previous !== null && previous > 0 ? Math.round(((value - previous) / previous) * 100) : null;
    return { key, label, kind, value, previous, change };
  };
  const stats = [
    stat("collected", "Collected (net)", "money", collected), stat("opd", "OPD patients", "count", patients), stat("admissions", "Admissions", "count", admissions),
    stat("avgOpd", "Avg charge · OPD", "money", (f, t) => avgCharge("OPD", f, t)), stat("avgIpd", "Avg charge · IPD", "money", (f, t) => avgCharge("IPD", f, t)),
  ];

  const points: [string, string, string][] = range === "day"
    ? Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return [SHORT(d, { day: "numeric", month: "short" }), d, d] as [string, string, string]; })
    : range === "week"
      ? Array.from({ length: 12 }, (_, i) => { const s = addDays(mondayOf(today), (i - 11) * 7); return [SHORT(s, { day: "numeric", month: "short" }), s, addDays(s, 6) > today ? today : addDays(s, 6)] as [string, string, string]; })
      : Array.from({ length: 12 }, (_, i) => { const s = addMonths(today, i - 11); return [SHORT(s, { month: "short", year: "2-digit" }), s, addDays(addMonths(s, 1), -1) > today ? today : addDays(addMonths(s, 1), -1)] as [string, string, string]; });
  const series = points.map(([label, from, to]) => ({ label, patients: patients(from, to), collected: collected(from, to) }));

  const todaysBills = bills.filter((b) => b.bill_date === today);
  const todaysAppts = appts.filter((a) => a.appointment_date === today && a.status !== "Cancelled");
  const todaysOpd = opd.filter((v) => dayOf(v.created_at) === today);
  const occupied = beds.filter((b) => b.status === "Occupied").length;
  const nearLimit = addDays(today, 90);

  return {
    today, range, rangeNote, stats, series,
    revenue: { collected: collected(today, today), billsRaised: todaysBills.length, outstanding: r2(bills.filter((b) => b.status === "Pending" || b.status === "Partial").reduce((n, b) => n + paidAmount(b), 0)) },
    opd: {
      appointments: todaysAppts.length, arrived: todaysOpd.length, completed: todaysOpd.filter((v) => v.status === "Completed").length,
      // A no-show: the slot was over an hour ago and the patient never checked in.
      noShow: todaysAppts.filter((a) => {
        const at = parseClock(a.appointment_time);
        return a.status !== "Completed" && at !== null && at + 60 < localMinutes() && !todaysOpd.some((v) => (a.patient_id != null ? v.patient_id === a.patient_id : v.patient_name === a.patient_name));
      }).length,
    },
    ipd: {
      admitted: ipd.filter((a) => NOT_OUT(a.status)).length, admissionsToday: admissions(today, today), dischargesToday: ipd.filter((a) => a.status === "Discharged" && dayOf(a.updated_at) === today).length,
      occupancyPct: beds.length ? Math.round((occupied / beds.length) * 100) : 0, occupied, beds: beds.length,
    },
    stores: {
      lowStock: stock.filter((i) => Number(i.stock) <= Number(i.min_stock)).length,
      nearExpiry: batches.filter((b) => Number(b.quantity) > 0 && b.expiry_date && b.expiry_date >= today && b.expiry_date <= nearLimit).length,
      labPending: labs.filter((l) => l.status === "Pending" || l.status === "Sample Collected").length,
      labReportedToday: labs.filter((l) => dayOf(l.report_uploaded_at) === today).length,
    },
  };
}
