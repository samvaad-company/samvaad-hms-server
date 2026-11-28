/**
 * Patient portal: the updates feed. What has happened to this patient, newest first, built by reading the tables the HMS already has
 * (no new records are made for it):
 *   rx-<id>         a new prescription
 *   lab-<id>        a lab report is ready;  radiology-<id>  a radiology report is ready
 *   bill-<id>       a bill was raised (or paid)
 *   appt-<id>       an appointment was booked, moved or cancelled
 *   fu-<id>         a follow-up is due in the next 7 days
 *   aw-<id>         an awareness programme the hospital posted (or cancelled)
 * Whether the patient has read an item is kept in awareness_reads (the table the bell already uses) under a text `key`.
 */
import { appointmentsRepo, awarenessReadsRepo, billsRepo, followupsRepo, labRepo, prescriptionsRepo, radiologyRepo } from "@/repositories";
import { type AppointmentRow, type AwarenessReadRow, type BillRow, type FollowUpRow, type LabTestRow, type PrescriptionRow, type RadiologyTestRow } from "@/db/tables";
import { BadRequestError } from "@/lib/errors";
import { localDate } from "@/lib/clock";
import { portalMarkRead, portalNotifications } from "@/services/awareness-service";
import { addDaysTo, portalPatient } from "@/services/portal-common";

const WINDOW_DAYS = 60;
const KEY = /^(rx|lab|radiology|bill|appt|fu)-\d{1,12}$/;
const r2 = (n: number) => Math.round(n * 100) / 100;
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export interface UpdateItem {
  id: string;
  type: "prescription" | "report" | "bill" | "appointment" | "followup" | "awareness";
  title: string;
  text?: string;
  at: string;
  read: boolean;
  link?: { screen: "prescription" | "records" | "bill" | "appointment" | "awareness"; id: number | string };
}

async function readKeys(patientId: number): Promise<Set<string>> {
  const { rows } = await awarenessReadsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] } as never);
  return new Set((rows as AwarenessReadRow[]).map((r) => r.key).filter((k): k is string => !!k));
}

const byPatient = (id: number) => ({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: id }] }) as never;

export async function portalUpdates(patientId: number, since: string | null, limit: number): Promise<UpdateItem[]> {
  const patient = await portalPatient(patientId);
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const from = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : cutoff;
  const read = await readKeys(patient.id);
  const mine = <T extends { hospital_id: number }>(rows: unknown): T[] => (rows as T[]).filter((r) => r.hospital_id === patient.hospital_id);
  const out: UpdateItem[] = [];
  const add = (it: Omit<UpdateItem, "read">) => { if (it.at >= from && it.at >= cutoff) out.push({ ...it, read: read.has(it.id) }); };

  for (const r of mine<PrescriptionRow>((await prescriptionsRepo.listRows(byPatient(patient.id))).rows)) {
    if (r.status === "Draft") continue;
    add({ id: `rx-${r.id}`, type: "prescription", title: `New prescription from ${r.doctor}`, text: r.rx_number, at: r.created_at, link: { screen: "prescription", id: r.id } });
  }
  for (const [kind, rows] of [["lab", (await labRepo.listRows(byPatient(patient.id))).rows], ["radiology", (await radiologyRepo.listRows(byPatient(patient.id))).rows]] as const) {
    for (const t of mine<LabTestRow | RadiologyTestRow>(rows)) {
      if (!t.report_file || t.status === "Cancelled") continue;
      add({ id: `${kind}-${t.id}`, type: "report", title: `Your ${t.test_name} report is ready`, at: t.updated_at, link: { screen: "records", id: `${kind}-${t.id}` } });
    }
  }
  for (const b of mine<BillRow>((await billsRepo.listRows(byPatient(patient.id))).rows)) {
    const due = b.status === "Pending" ? r2(Number(b.patient_share ?? b.total)) : null;
    add({
      id: `bill-${b.id}`, type: "bill",
      title: b.status === "Paid" ? `Bill ${b.bill_number} is paid` : b.status === "Refunded" ? `Bill ${b.bill_number} was refunded` : due != null ? `New bill ${b.bill_number}: ${inr(due)} pending` : `New bill ${b.bill_number}`,
      at: b.status === "Pending" || b.status === "Partial" ? b.created_at : b.updated_at, link: { screen: "bill", id: b.id },
    });
  }
  for (const a of mine<AppointmentRow>((await appointmentsRepo.listRows(byPatient(patient.id))).rows)) {
    const when = `${a.appointment_date}, ${a.appointment_time}`;
    const title = a.status === "Cancelled" ? `Appointment on ${a.appointment_date} was cancelled` : (a.reschedule_count ?? 0) > 0 ? `Appointment moved to ${when}` : `Appointment booked for ${when} with ${a.doctor}`;
    add({ id: `appt-${a.id}`, type: "appointment", title, at: a.updated_at ?? a.created_at, link: { screen: "appointment", id: a.id } });
  }
  const today = localDate();
  const soon = addDaysTo(today, 7);
  for (const f of mine<FollowUpRow>((await followupsRepo.listRows(byPatient(patient.id))).rows)) {
    if (f.status !== "Pending" || f.due_on < today || f.due_on > soon) continue;
    add({ id: `fu-${f.id}`, type: "followup", title: `Follow-up due on ${f.due_on}`, text: f.reason || undefined, at: f.created_at });
  }
  const aw = await portalNotifications(patient.id);
  for (const n of aw.items) {
    add({ id: `aw-${n.id}`, type: "awareness", title: n.title, text: n.body, at: n.createdAt, link: { screen: "awareness", id: n.eventId } });
    const last = out[out.length - 1];
    if (last?.id === `aw-${n.id}`) last.read = n.read;
  }
  out.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return out.slice(0, limit);
}

/** Mark updates read: awareness ids (a number, or "aw-31") go to the existing bell; the other ids are kept by key. Returns the bell's list. */
export async function portalMarkUpdatesRead(patientId: number, input: unknown) {
  const patient = await portalPatient(patientId);
  const body = (input ?? {}) as { ids?: unknown; all?: unknown };
  const raw = Array.isArray(body.ids) ? body.ids : [];
  if (raw.length > 200) throw new BadRequestError("Too many at once.");
  const awareness: number[] = [];
  const keys: string[] = [];
  for (const id of raw) {
    const s = String(id);
    const aw = /^aw-(\d{1,12})$/.exec(s);
    if (aw) awareness.push(Number(aw[1]));
    else if (/^\d{1,12}$/.test(s)) awareness.push(Number(s));
    else if (KEY.test(s)) keys.push(s);
  }
  if (body.all === true) {
    for (const u of await portalUpdates(patient.id, null, 200)) if (!u.read && KEY.test(u.id)) keys.push(u.id);
  }
  const have = await readKeys(patient.id);
  for (const key of new Set(keys)) {
    if (have.has(key)) continue;
    await awarenessReadsRepo.create({ hospital_id: patient.hospital_id, patient_id: patient.id, event_id: 0, key, read_at: new Date().toISOString() } as never);
  }
  return portalMarkRead(patient.id, { ids: awareness, all: body.all === true });
}
