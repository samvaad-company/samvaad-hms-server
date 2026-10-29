/**
 * The admin home: everything the command dashboard shows in one read — what needs attention today, the week's numbers, footfall and
 * collections, beds, doctors, retention and the queues. It only reads; each figure comes straight from the module that owns it.
 */
import { appointmentsRepo, hospitalsRepo, bedsRepo, billsRepo, followupsRepo, ipdRepo, labRepo, opdRepo, otRepo, patientsRepo, pharmacyRepo, tpaClaimsRepo, wardsRepo } from "@/repositories";
import type { AppointmentRow, BedRow, BillRow, FollowUpRow, IpdAdmissionRow, LabTestRow, OpdVisitRow, OtScheduleRow, PatientRow, PharmacyItemRow, TpaClaimRow, WardRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { getConfig, listSetup } from "@/services/setup-service";
import { localDate, parseClock } from "@/lib/clock";
import { r2 } from "@shared/types/billing";
import type { OverviewDTO } from "@shared/types/api";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
/** A stored timestamp as the hospital's calendar day. */
const dayOf = (ts: string | undefined | null): string => (ts ? localDate(new Date(ts)) : "");
const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);
const youOwe = (b: BillRow): number => Number(b.patient_share ?? b.total);

export async function getOverview(rawDays: number, actor: Session): Promise<OverviewDTO> {
  const days = [7, 14, 30].includes(rawDays) ? rawDays : 14;
  const today = localDate();
  const [patients, appts, opd, bills, labs, beds, wards, ipd, ot, followups, claims, stock, hospital, plan, classes] = await Promise.all([
    all<PatientRow>(patientsRepo, actor), all<AppointmentRow>(appointmentsRepo, actor), all<OpdVisitRow>(opdRepo, actor), all<BillRow>(billsRepo, actor),
    all<LabTestRow>(labRepo, actor), all<BedRow>(bedsRepo, actor), all<WardRow>(wardsRepo, actor), all<IpdAdmissionRow>(ipdRepo, actor), all<OtScheduleRow>(otRepo, actor),
    all<FollowUpRow>(followupsRepo, actor), all<TpaClaimRow>(tpaClaimsRepo, actor), all<PharmacyItemRow>(pharmacyRepo, actor),
    hospitalsRepo.getRow(requireHospitalId(actor)), getConfig("plan", actor), listSetup("ward_class", actor),
  ]);

  // Footfall: who came in on a day — a check-in at the OPD, or an appointment that wasn't cancelled.
  const seen = new Map<string, Set<string>>();
  const visitDays = new Map<string, Set<string>>(); // patient → days they visited
  const see = (day: string, patientId: number | null, name: string) => {
    if (!day || day > today) return;
    const key = patientId !== null ? `p${patientId}` : `n${name.toLowerCase()}`;
    (seen.get(day) ?? seen.set(day, new Set()).get(day)!).add(key);
    (visitDays.get(key) ?? visitDays.set(key, new Set()).get(key)!).add(day);
  };
  for (const v of opd) see(dayOf(v.created_at), v.patient_id, v.patient_name);
  for (const a of appts) if (a.status !== "Cancelled") see(a.appointment_date, a.patient_id, a.patient_name);

  const paid = bills.filter((b) => b.status === "Paid");
  const collectedOn = (from: string, to: string) => r2(paid.filter((b) => b.bill_date >= from && b.bill_date <= to).reduce((n, b) => n + youOwe(b), 0));
  const footfallBetween = (from: string, to: string) => { const s = new Set<string>(); for (const [d, set] of seen) if (d >= from && d <= to) set.forEach((k) => s.add(k)); return s.size; };

  const trend = Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, patients: seen.get(date)?.size ?? 0, collected: collectedOn(date, date) };
  });

  const modeFrom = addDays(today, -29);
  const byModeMap = new Map<string, { amount: number; count: number }>();
  for (const b of paid.filter((x) => x.bill_date >= modeFrom)) {
    const mode = b.payment_mode || "Not recorded";
    const g = byModeMap.get(mode) ?? { amount: 0, count: 0 };
    g.amount += youOwe(b); g.count++;
    byModeMap.set(mode, g);
  }

  // Needs you today.
  const waiting = opd.filter((v) => v.status === "Waiting");
  const openLabs = labs.filter((l) => l.report_status !== "Ready");
  const urgentLabs = openLabs.filter((l) => l.priority === "Urgent" || l.priority === "STAT");
  const unpaid = bills.filter((b) => (b.status === "Pending" || b.status === "Partial"));
  const claimed = new Set(claims.map((c) => c.bill_number));
  const unclaimed = bills.filter((b) => b.contract_id && Number(b.payer_share ?? 0) > 0 && b.status !== "Refunded" && !claimed.has(b.bill_number));

  // Appointments.
  const todays = appts.filter((a) => a.appointment_date === today && a.status !== "Cancelled").sort((a, b) => (parseClock(a.appointment_time) ?? 0) - (parseClock(b.appointment_time) ?? 0));
  const byDoctor = new Map<string, { total: number; seen: number }>();
  for (const a of todays) {
    const g = byDoctor.get(a.doctor) ?? { total: 0, seen: 0 };
    g.total++; if (a.status === "Completed") g.seen++;
    byDoctor.set(a.doctor, g);
  }

  // Beds, grouped by the ward's class (else the ward's own name).
  const className = new Map(classes.map((c) => [c.id, c.name]));
  const wardOf = new Map(wards.map((w) => [w.id, w]));
  const groups = new Map<string, { occupied: number; total: number }>();
  for (const b of beds) {
    const w = b.ward_id !== null ? wardOf.get(b.ward_id) : undefined;
    const name = (w?.ward_class_id != null ? className.get(Number(w.ward_class_id)) : undefined) ?? b.ward;
    const g = groups.get(name) ?? { occupied: 0, total: 0 };
    g.total++; if (b.status === "Occupied") g.occupied++;
    groups.set(name, g);
  }
  const occupied = beds.filter((b) => b.status === "Occupied").length;

  // Retention.
  const from30 = addDays(today, -29), from90 = addDays(today, -89);
  const past = appts.filter((a) => a.status !== "Cancelled" && a.appointment_date >= from30 && a.appointment_date < today);
  // Kept = marked completed, or the patient was checked in at the OPD against that appointment.
  const checkedIn = new Set(opd.map((v) => v.appointment_id).filter((id): id is number => id !== null));
  const missedAppts = past.filter((a) => a.status !== "Completed" && !checkedIn.has(a.id));
  const resolvedFollowUps = followups.filter((f) => f.due_on >= from30 && f.due_on <= today && (f.status === "Done" || f.status === "Missed"));
  const recent90 = [...visitDays.entries()].filter(([, ds]) => [...ds].some((d) => d >= from90));
  const recent30 = [...visitDays.entries()].filter(([, ds]) => [...ds].some((d) => d >= from30));
  const pendingFollowUps = followups.filter((f) => f.status === "Pending");
  const overdue = (f: FollowUpRow) => Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${f.due_on}T12:00:00`).getTime()) / 86_400_000);

  // What needs attention, most urgent first.
  const alerts: OverviewDTO["alerts"] = [];
  if (urgentLabs.length) {
    const names = urgentLabs.slice(0, 3).map((l) => `${l.test_name} (${l.patient_name})`).join(" · ");
    alerts.push({ tone: "red", title: `${urgentLabs.length} urgent lab order${urgentLabs.length === 1 ? "" : "s"}`, detail: names, action: "Review now", href: "/lab" });
  }
  const low = stock.filter((s) => s.status === "Low Stock" || s.status === "Out of Stock").sort((a, b) => Number(a.stock) - Number(b.stock));
  if (low.length) {
    const first = low[0];
    alerts.push({ tone: "amber", title: `${first.name} ${first.status === "Out of Stock" ? "out of stock" : "low"}`, detail: `${first.stock} left · reorder level ${first.min_stock}${low.length > 1 ? ` · +${low.length - 1} more low` : ""}`, action: "Reorder", href: "/pharmacy" });
  }
  if (unclaimed.length) alerts.push({ tone: "grey", title: `${unclaimed.length} insurance claim${unclaimed.length === 1 ? "" : "s"} to submit`, detail: "Insured bills with no claim raised yet", action: "Open claims", href: "/tpa" });

  const planName = String(plan.planName ?? "").trim() || "Samvaad HMS";
  const validUntil = String(plan.validUntil ?? "");

  return {
    today,
    hospital: hospital?.name ?? "",
    plan: { name: planName, active: !validUntil || validUntil >= today },
    summary: { patientsToday: seen.get(today)?.size ?? 0, collectedToday: collectedOn(today, today), opdWaiting: waiting.length, urgentLabs: urgentLabs.length },
    attention: {
      opdWaiting: waiting.length,
      urgentLabs: { urgent: urgentLabs.length, pending: openLabs.length },
      unpaid: { amount: r2(unpaid.reduce((n, b) => n + youOwe(b), 0)), bills: unpaid.length },
      claims: { count: unclaimed.length },
    },
    kpis: {
      patientsWeek: { value: footfallBetween(addDays(today, -6), today), previous: footfallBetween(addDays(today, -13), addDays(today, -7)) },
      collectedWeek: { value: collectedOn(addDays(today, -6), today), previous: collectedOn(addDays(today, -13), addDays(today, -7)) },
      appointments: { total: todays.length, left: todays.filter((a) => a.status !== "Completed").length },
      beds: { occupied, total: beds.length },
    },
    trend,
    byMode: [...byModeMap.entries()].map(([mode, g]) => ({ mode, amount: r2(g.amount), count: g.count })).sort((a, b) => b.amount - a.amount),
    appointmentsToday: todays.map((a) => ({ id: a.id, time: a.appointment_time, patient: a.patient_name, doctor: a.doctor, type: a.type, status: a.status })),
    bedsByClass: [...groups.entries()].map(([name, g]) => ({ name, ...g })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    admittedToday: ipd.filter((i) => i.admission_date === today).length,
    dischargedToday: ipd.filter((i) => i.status === "Discharged" && dayOf(i.updated_at) === today).length,
    doctorLoad: [...byDoctor.entries()].map(([doctor, g]) => ({ doctor, ...g })).sort((a, b) => b.total - a.total),
    retention: {
      noShowRate: pct(missedAppts.length, past.length),
      followUpsKept: pct(resolvedFollowUps.filter((f) => f.status === "Done").length, resolvedFollowUps.length),
      cameBack90: pct(recent90.filter(([, ds]) => ds.size >= 2).length, recent90.length),
      returningShare: pct(recent30.filter(([, ds]) => [...ds].some((d) => d < from30)).length, recent30.length),
      missed: missedAppts.length,
      followUpsDue: pendingFollowUps.filter((f) => f.due_on >= today && f.due_on <= addDays(today, 7)).length,
      atRisk: pendingFollowUps.filter((f) => overdue(f) >= 1 && overdue(f) <= 30).length,
      lapsed: pendingFollowUps.filter((f) => overdue(f) > 30).length,
    },
    alerts,
    opdQueue: waiting.slice(0, 6).map((v) => ({ id: v.id, token: v.token_number, patient: v.patient_name, doctor: v.doctor, priority: v.priority, wait: v.wait_time })),
    theatre: ot.filter((o) => o.scheduled_date === today && o.status !== "Cancelled").sort((a, b) => (parseClock(a.scheduled_time) ?? 0) - (parseClock(b.scheduled_time) ?? 0))
      .map((o) => ({ id: o.id, time: o.scheduled_time, procedure: o.surgery_name || o.procedure, patient: o.patient_name, room: o.ot_room, surgeon: o.surgeon, status: o.status })),
  };
}
