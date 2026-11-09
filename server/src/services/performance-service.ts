/**
 * Reports → AI monitor → Hospital performance: how the hospital is doing and growing over a period the user chooses,
 * set against the stretch before it (or the same stretch last year). Patients, appointments, follow-ups, retention,
 * billing and revenue, with filters for the doctor, the kind of bill and the kind of visit. Read-only.
 *
 * "Seen" means an OPD check-in or an appointment that wasn't cancelled. Retention is the share of the patients seen in the
 * stretch just before who came back in this one; the repeat rate is the share of this stretch's patients who came on more than
 * one day.
 */
import { appointmentsRepo, billsRepo, doctorsRepo, followupsRepo, ipdRepo, opdRepo, patientsRepo } from "@/repositories";
import type { AppointmentRow, BillRow, DoctorRow, FollowUpRow, IpdAdmissionRow, OpdVisitRow, PatientRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { localDate } from "@/lib/clock";
import type { PerfKpi, PerformanceDTO } from "@shared/types/api";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r1 = (n: number): number => Math.round(n * 10) / 10;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const diffDays = (a: string, b: string): number => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
const dayOf = (ts: string | null | undefined): string => (ts ? localDate(new Date(ts)) : "");
const monthStart = (iso: string): string => `${iso.slice(0, 8)}01`;
const addMonths = (iso: string, n: number): string => { const d = new Date(`${monthStart(iso)}T12:00:00`); d.setMonth(d.getMonth() + n); return d.toLocaleDateString("en-CA"); };
const endOfMonth = (iso: string): string => addDays(addMonths(iso, 1), -1);
const shortDate = (iso: string, o: Intl.DateTimeFormatOptions): string => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", o);
const mondayOf = (iso: string): string => addDays(iso, -((new Date(`${iso}T12:00:00`).getDay() + 6) % 7));
const sameDayLastYear = (iso: string): string => { const d = new Date(`${iso}T12:00:00`); d.setFullYear(d.getFullYear() - 1); return d.toLocaleDateString("en-CA"); };
function* eachDay(from: string, to: string): Generator<string> { for (let d = from; d <= to; d = addDays(d, 1)) yield d; }

const paidAmount = (b: BillRow): number => Number(b.patient_share ?? b.total);
const pctChange = (value: number | null, previous: number | null): number | null =>
  value !== null && previous !== null && previous > 0 ? r1(((value - previous) / previous) * 100) : null;

interface Range { from: string; to: string }
type Interval = "day" | "week" | "month";

export async function getPerformance(query: URLSearchParams, actor: Session): Promise<PerformanceDTO> {
  requireHospitalId(actor);
  const today = localDate();

  // ── The question: a period, what to compare it with, and the filters ─────────────────────────────────────────────────
  let to = ISO.test(query.get("to") ?? "") ? query.get("to")! : today;
  let from = ISO.test(query.get("from") ?? "") ? query.get("from")! : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (diffDays(from, to) > 1100) from = addDays(to, -1100);
  const days = diffDays(from, to) + 1;
  const mode = query.get("compare") === "year" ? "year" : query.get("compare") === "none" ? "none" : "previous";
  const rawInterval = query.get("interval");
  const interval: Interval = rawInterval === "day" || rawInterval === "week" || rawInterval === "month" ? rawInterval : days <= 31 ? "day" : days <= 180 ? "week" : "month";
  const doctorId = Number(query.get("doctorId")) || null;
  const billType = query.get("billType") || null;
  const visitType = query.get("visitType") || null;

  const cur: Range = { from, to };
  const before = (r: Range): Range => { const len = diffDays(r.from, r.to) + 1; return { from: addDays(r.from, -len), to: addDays(r.from, -1) }; };
  const prev: Range | null = mode === "none" ? null : mode === "year" ? { from: sameDayLastYear(from), to: sameDayLastYear(to) } : before(cur);

  // ── The data, with the filters applied ───────────────────────────────────────────────────────────────────────────────
  const [patientsAll, apptsAll, opdAll, billsAll, followAll, ipdAll, doctors] = await Promise.all([
    all<PatientRow>(patientsRepo, actor), all<AppointmentRow>(appointmentsRepo, actor), all<OpdVisitRow>(opdRepo, actor), all<BillRow>(billsRepo, actor),
    all<FollowUpRow>(followupsRepo, actor), all<IpdAdmissionRow>(ipdRepo, actor), all<DoctorRow>(doctorsRepo, actor),
  ]);
  const byDoctor = <T extends { doctor_id?: number | null }>(rows: T[]): T[] => (doctorId ? rows.filter((r) => r.doctor_id === doctorId) : rows);
  const patients = byDoctor(patientsAll);
  const appts = byDoctor(apptsAll).filter((a) => !visitType || a.type === visitType);
  const opd = visitType ? [] : byDoctor(opdAll);
  const bills = byDoctor(billsAll).filter((b) => !billType || b.type === billType);
  const follow = byDoctor(followAll);
  const ipd = byDoctor(ipdAll);

  // ── Per-day tallies, so any stretch is a cheap sum ───────────────────────────────────────────────────────────────────
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => { if (k) (m.get(k) ?? m.set(k, []).get(k)!).push(v); };
  const seenDay = new Map<string, Set<string>>();
  const see = (day: string, patientId: number | null, name: string) => {
    if (!day || day > today) return;
    (seenDay.get(day) ?? seenDay.set(day, new Set()).get(day)!).add(patientId !== null ? `p${patientId}` : `n${name.toLowerCase()}`);
  };
  for (const v of opd) see(dayOf(v.created_at), v.patient_id, v.patient_name);
  for (const a of appts) if (a.status !== "Cancelled") see(a.appointment_date, a.patient_id, a.patient_name);
  const newDay = new Map<string, number>(); for (const p of patients) { const d = dayOf(p.created_at); if (d) newDay.set(d, (newDay.get(d) ?? 0) + 1); }
  const apptDay = new Map<string, AppointmentRow[]>(); for (const a of appts) push(apptDay, a.appointment_date, a);
  const followDay = new Map<string, FollowUpRow[]>(); for (const f of follow) push(followDay, f.due_on, f);
  const billDay = new Map<string, BillRow[]>(); for (const b of bills) push(billDay, b.bill_date, b);
  const admDay = new Map<string, number>(); for (const a of ipd) admDay.set(a.admission_date, (admDay.get(a.admission_date) ?? 0) + 1);

  const sumDays = <T,>(r: Range, m: Map<string, T[]>, f: (rows: T[]) => number): number => { let n = 0; for (const d of eachDay(r.from, r.to)) { const rows = m.get(d); if (rows) n += f(rows); } return n; };
  const rowsIn = <T,>(r: Range, m: Map<string, T[]>): T[] => { const out: T[] = []; for (const d of eachDay(r.from, r.to)) { const rows = m.get(d); if (rows) out.push(...rows); } return out; };
  const seenIn = (r: Range): Set<string> => { const s = new Set<string>(); for (const d of eachDay(r.from, r.to)) seenDay.get(d)?.forEach((k) => s.add(k)); return s; };
  const newIn = (r: Range): number => { let n = 0; for (const d of eachDay(r.from, r.to)) n += newDay.get(d) ?? 0; return n; };
  const admIn = (r: Range): number => { let n = 0; for (const d of eachDay(r.from, r.to)) n += admDay.get(d) ?? 0; return n; };

  /** Everything the page shows for one stretch. */
  const measure = (r: Range) => {
    const seen = seenIn(r);
    const ap = rowsIn(r, apptDay);
    const fu = rowsIn(r, followDay);
    const bl = rowsIn(r, billDay);
    const paid = bl.filter((b) => b.status === "Paid");
    const billed = r2(bl.reduce((n, b) => n + Number(b.total), 0));
    const collected = r2(paid.reduce((n, b) => n + paidAmount(b), 0));
    const done = fu.filter((f) => f.status === "Done").length;
    const missed = fu.filter((f) => f.status === "Missed").length;
    const overdue = fu.filter((f) => f.status === "Pending" && f.due_on < today).length;
    // Retention: of the patients seen in the stretch before this one, how many came back in it.
    const earlier = seenIn(before(r));
    let returned = 0; earlier.forEach((k) => { if (seen.has(k)) returned++; });
    // Repeat: patients seen on more than one day in this stretch.
    const visitDays = new Map<string, number>();
    for (const d of eachDay(r.from, r.to)) seenDay.get(d)?.forEach((k) => visitDays.set(k, (visitDays.get(k) ?? 0) + 1));
    const repeaters = [...visitDays.values()].filter((n) => n >= 2).length;
    const cancelled = ap.filter((a) => a.status === "Cancelled").length;
    return {
      seen, ap, fu, bl, paid, billed, collected, done, missed, overdue, earlier, returned, visitDays, repeaters, cancelled,
      newPatients: newIn(r), completed: ap.filter((a) => a.status === "Completed").length,
      outstanding: r2(bl.filter((b) => b.status === "Pending" || b.status === "Partial").reduce((n, b) => n + Number(b.total), 0)),
      admissions: admIn(r),
      retention: earlier.size ? r1((returned / earlier.size) * 100) : null as number | null,
      repeatRate: seen.size ? r1((repeaters / seen.size) * 100) : null as number | null,
    };
  };
  const m = measure(cur);
  const pm = prev ? measure(prev) : null;

  // ── The headline figures ─────────────────────────────────────────────────────────────────────────────────────────────
  const rate = (a: number, b: number): number | null => (b > 0 ? r1((a / b) * 100) : null);
  const defs: { key: string; group: PerfKpi["group"]; label: string; kind: PerfKpi["kind"]; lowerIsBetter?: boolean; hint?: string; f: (x: ReturnType<typeof measure>) => number | null }[] = [
    { key: "newPatients", group: "patients", label: "New patients", kind: "count", hint: "Registered in the period", f: (x) => x.newPatients },
    { key: "patientsSeen", group: "patients", label: "Patients seen", kind: "count", hint: "Different people who came (OPD or appointment)", f: (x) => x.seen.size },
    { key: "retention", group: "patients", label: "Retention rate", kind: "pct", hint: "Patients seen in the period before who came back", f: (x) => x.retention },
    { key: "repeatRate", group: "patients", label: "Repeat-visit rate", kind: "pct", hint: "Patients who came on more than one day", f: (x) => x.repeatRate },
    { key: "appointments", group: "appointments", label: "Appointments", kind: "count", f: (x) => x.ap.length },
    { key: "completed", group: "appointments", label: "Completed", kind: "count", f: (x) => x.completed },
    { key: "completionRate", group: "appointments", label: "Completion rate", kind: "pct", f: (x) => rate(x.completed, x.ap.length) },
    { key: "cancellationRate", group: "appointments", label: "Cancellation rate", kind: "pct", lowerIsBetter: true, f: (x) => rate(x.cancelled, x.ap.length) },
    { key: "followUps", group: "followups", label: "Follow-ups due", kind: "count", f: (x) => x.fu.length },
    { key: "followUpDone", group: "followups", label: "Follow-ups done", kind: "count", f: (x) => x.done },
    { key: "followUpMissed", group: "followups", label: "Missed or overdue", kind: "count", lowerIsBetter: true, f: (x) => x.missed + x.overdue },
    { key: "followUpRate", group: "followups", label: "Follow-up completion", kind: "pct", hint: "Done out of those done, missed or overdue", f: (x) => rate(x.done, x.done + x.missed + x.overdue) },
    { key: "billsRaised", group: "billing", label: "Bills raised", kind: "count", f: (x) => x.bl.length },
    { key: "billed", group: "billing", label: "Billed", kind: "money", f: (x) => x.billed },
    { key: "collected", group: "billing", label: "Revenue collected", kind: "money", hint: "Paid bills, net of what the insurer owes", f: (x) => x.collected },
    { key: "collectionRate", group: "billing", label: "Collection rate", kind: "pct", hint: "Collected out of billed", f: (x) => rate(x.collected, x.billed) },
    { key: "outstanding", group: "billing", label: "Outstanding", kind: "money", lowerIsBetter: true, hint: "Billed in the period but not yet paid", f: (x) => x.outstanding },
    { key: "avgBill", group: "billing", label: "Average bill", kind: "money", f: (x) => (x.bl.length ? r2(x.billed / x.bl.length) : null) },
    { key: "revenuePerPatient", group: "billing", label: "Revenue per patient", kind: "money", f: (x) => (x.seen.size ? r2(x.collected / x.seen.size) : null) },
    { key: "admissions", group: "ipd", label: "IPD admissions", kind: "count", f: (x) => x.admissions },
  ];
  const kpis: PerfKpi[] = defs.map((d) => {
    const value = d.f(m);
    const previous = pm ? d.f(pm) : null;
    const isPct = d.kind === "pct";
    return {
      key: d.key, group: d.group, label: d.label, kind: d.kind, value, previous,
      change: isPct ? (value !== null && previous !== null ? r1(value - previous) : null) : pctChange(value, previous),
      changeUnit: isPct ? "pts" : "pct", lowerIsBetter: d.lowerIsBetter, hint: d.hint,
    };
  });

  // ── Growth: this period against the one before it (or last year), and month by month ────────────────────────────────
  const against = pm ?? measure(before(cur));
  const parts = [
    { key: "collected", label: "Revenue", change: pctChange(m.collected, against.collected) },
    { key: "patientsSeen", label: "Patients seen", change: pctChange(m.seen.size, against.seen.size) },
    { key: "appointments", label: "Appointments", change: pctChange(m.ap.length, against.ap.length) },
    { key: "newPatients", label: "New patients", change: pctChange(m.newPatients, against.newPatients) },
  ];
  const known = parts.filter((p) => p.change !== null) as { key: string; label: string; change: number }[];
  const growthRate = known.length ? r1(known.reduce((n, p) => n + p.change, 0) / known.length) : null;

  const monthPoints = Array.from({ length: 13 }, (_, i) => { const s = addMonths(today, i - 12); return { from: s, to: endOfMonth(s) > today ? today : endOfMonth(s), month: s.slice(0, 7), label: shortDate(s, { month: "short", year: "2-digit" }) }; });
  const monthly = monthPoints.map((p) => { const x = measure({ from: p.from, to: p.to }); return { label: p.label, month: p.month, revenue: x.collected, patients: x.seen.size, newPatients: x.newPatients, appointments: x.ap.length }; });
  const months = monthly.slice(1).map((x, i) => ({ ...x, revenueGrowth: pctChange(x.revenue, monthly[i].revenue), patientsGrowth: pctChange(x.patients, monthly[i].patients) }));

  // ── The trend across the chosen period, bucketed by day, week or month ──────────────────────────────────────────────
  const buckets: { label: string; r: Range }[] = [];
  if (interval === "day") for (const d of eachDay(from, to)) buckets.push({ label: shortDate(d, { day: "numeric", month: "short" }), r: { from: d, to: d } });
  else if (interval === "week") for (let s = mondayOf(from); s <= to; s = addDays(s, 7)) buckets.push({ label: shortDate(s, { day: "numeric", month: "short" }), r: { from: s < from ? from : s, to: addDays(s, 6) > to ? to : addDays(s, 6) } });
  else for (let s = monthStart(from); s <= to; s = addMonths(s, 1)) buckets.push({ label: shortDate(s, { month: "short", year: "2-digit" }), r: { from: s < from ? from : s, to: endOfMonth(s) > to ? to : endOfMonth(s) } });
  const offset = prev ? diffDays(from, prev.from) : 0;
  const trend = buckets.map(({ label, r }) => {
    const x = measure(r);
    const px = prev ? measure({ from: addDays(r.from, offset), to: addDays(r.to, offset) }) : null;
    return { label, patients: x.seen.size, newPatients: x.newPatients, appointments: x.ap.length, followUps: x.fu.length, billed: x.billed, collected: x.collected, prevCollected: px ? px.collected : null, prevPatients: px ? px.seen.size : null };
  });

  // ── Retention, revenue mix, doctors ─────────────────────────────────────────────────────────────────────────────────
  const freq = [0, 0, 0]; m.visitDays.forEach((n) => { freq[Math.min(2, n - 1)]++; });
  let returning = 0; m.seen.forEach((k) => { if (m.earlier.has(k)) returning++; });
  const retention = {
    rate: m.retention, previousPatients: m.earlier.size, returned: m.returned, repeatRate: m.repeatRate,
    newPatients: m.seen.size - returning, returning,
    visitFrequency: [{ label: "Came once", patients: freq[0] }, { label: "Came twice", patients: freq[1] }, { label: "Came 3+ times", patients: freq[2] }],
  };

  const typeTotals = new Map<string, { collected: number; bills: number }>();
  for (const b of m.paid) { const e = typeTotals.get(b.type) ?? { collected: 0, bills: 0 }; e.collected += paidAmount(b); e.bills += 1; typeTotals.set(b.type, e); }
  const revenueByType = [...typeTotals].map(([type, e]) => ({ type, collected: r2(e.collected), bills: e.bills, share: m.collected > 0 ? r1((e.collected / m.collected) * 100) : 0 })).sort((a, b) => b.collected - a.collected);

  const doc = new Map<string, { id: number | null; name: string; people: Set<string>; appointments: number; completed: number; collected: number }>();
  const docEntry = (id: number | null, name: string) => { const k = id !== null ? `d${id}` : `n${name}`; return doc.get(k) ?? doc.set(k, { id, name, people: new Set(), appointments: 0, completed: 0, collected: 0 }).get(k)!; };
  for (const a of m.ap) { const e = docEntry(a.doctor_id, a.doctor || "Unassigned"); e.appointments++; if (a.status === "Completed") e.completed++; if (a.status !== "Cancelled") e.people.add(a.patient_id !== null ? `p${a.patient_id}` : `n${a.patient_name.toLowerCase()}`); }
  for (const v of opd) if (v.created_at && dayOf(v.created_at) >= from && dayOf(v.created_at) <= to) docEntry(v.doctor_id, v.doctor || "Unassigned").people.add(v.patient_id !== null ? `p${v.patient_id}` : `n${v.patient_name.toLowerCase()}`);
  for (const b of m.paid) if (b.doctor_name || b.doctor_id) docEntry(b.doctor_id ?? null, b.doctor_name || "Unassigned").collected += paidAmount(b);
  const doctorRows = [...doc.values()].map((e) => ({ id: e.id, name: e.name, patients: e.people.size, appointments: e.appointments, completed: e.completed, collected: r2(e.collected) }))
    .sort((a, b) => b.collected - a.collected || b.patients - a.patients).slice(0, 8);

  const statusTotals = new Map<string, number>(); for (const a of m.ap) statusTotals.set(a.status, (statusTotals.get(a.status) ?? 0) + 1);

  return {
    today, from, to, days, interval,
    compare: prev && mode !== "none" ? { mode, from: prev.from, to: prev.to } : null,
    applied: { doctorId, billType, visitType },
    options: {
      doctors: doctors.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
      billTypes: [...new Set(billsAll.map((b) => b.type).filter(Boolean))].sort(),
      visitTypes: [...new Set(apptsAll.map((a) => a.type).filter(Boolean))].sort(),
    },
    growth: { rate: growthRate, basis: prev ? (mode === "year" ? "the same period last year" : "the period before") : "the period before", components: parts, months },
    kpis, trend, retention, revenueByType, byDoctor: doctorRows,
    appointmentsByStatus: [...statusTotals].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count),
    followUps: { due: m.fu.length, done: m.done, missed: m.missed, pending: m.fu.filter((f) => f.status === "Pending").length, overdue: m.overdue, completionRate: rate(m.done, m.done + m.missed + m.overdue) },
  };
}
