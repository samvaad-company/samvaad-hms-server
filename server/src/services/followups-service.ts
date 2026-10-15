/**
 * Follow-ups — planned return visits. A doctor (or the front desk) books one for a patient; on the day
 * the patient is marked Done (they came) or Missed (they stayed away). A Pending one whose date has gone
 * is "due" — still waiting to be marked. We keep who booked each and who marked it, by role, so the
 * analytics can show how the doctor and the receptionist each contribute.
 */
import { followupsRepo, patientsRepo, doctorsRepo } from "@/repositories";
import { toFollowUpDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type FollowUpRow } from "@/db/tables";
import { validate } from "@/lib/validation";
import { ConflictError, ValidationError } from "@/lib/errors";
import { isoDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import type { FollowUpAnalyticsDTO, FollowUpBucketDTO, FollowUpSummaryDTO } from "@shared/types/api";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = {
  patientId: { type: "number", required: true, min: 1 },
  doctorId: { type: "number", required: false, min: 1 },
  reason: { type: "string", required: true, min: 2, max: 300 },
  dueOn: { type: "string", required: true, pattern: ISO_DAY },
  note: { type: "string", required: false, max: 500, default: "" },
} as const;

export const FOLLOWUP_LIST_CONFIG = {
  searchColumns: ["patient_name", "patient_code", "doctor", "reason"],
  filterable: ["status", "doctor_id"],
  sortable: ["due_on", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/** The role a follow-up is credited to: Doctor and Receptionist are tracked on their own, the rest are "Others". */
export const roleGroup = (role: string | null | undefined): "Doctor" | "Receptionist" | "Others" =>
  role === "Doctor" ? "Doctor" : role === "Receptionist" ? "Receptionist" : "Others";

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number); const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortLabel = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };

async function owned(id: number, actor: Session): Promise<FollowUpRow> {
  const row = await followupsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Follow-up");
  return row as FollowUpRow;
}

/** Soonest due first, so what needs attention is on top. */
export async function listFollowUps(options: QueryOptions, actor: Session) {
  const { rows } = await followupsRepo.listRows({ ...scopeToHospital(options, actor), unpaged: true });
  rows.sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id);
  const size = options.pageSize ?? 50;
  const page = options.unpaged ? rows : rows.slice(((options.page ?? 1) - 1) * size, (options.page ?? 1) * size);
  return { rows: page.map(toFollowUpDTO), total: rows.length };
}

export async function getFollowUp(id: number, actor: Session) {
  return toFollowUpDTO(await owned(id, actor));
}

export async function getFollowUpSummary(actor: Session): Promise<FollowUpSummaryDTO> {
  const { rows } = await followupsRepo.listRows({ ...scopeToHospital({}, actor), unpaged: true });
  const today = isoDate();
  const in14 = addDays(today, 14);
  const out: FollowUpSummaryDTO = { overdue: 0, dueToday: 0, next14: 0, pending: 0, done: 0, missed: 0 };
  for (const r of rows) {
    if (r.status === "Done") out.done++;
    else if (r.status === "Missed") out.missed++;
    else {
      out.pending++;
      if (r.due_on < today) out.overdue++;
      else if (r.due_on === today) out.dueToday++;
      else if (r.due_on <= in14) out.next14++;
    }
  }
  return out;
}

export async function createFollowUp(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  const patient = await patientsRepo.getRow(data.patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  let doctorId: number | null = null;
  let doctorName = "";
  const wantedDoctor = data.doctorId ?? (actor.doctorId ?? undefined);
  if (wantedDoctor) {
    const doctor = await doctorsRepo.getRow(wantedDoctor);
    assertOwnedByHospital(doctor, actor, "Doctor");
    doctorId = doctor!.id as number;
    doctorName = String((doctor as { name?: string }).name ?? "");
  }
  const row = await followupsRepo.create({
    hospital_id: requireHospitalId(actor),
    patient_id: data.patientId,
    patient_name: String((patient as { name?: string }).name ?? ""),
    patient_code: String((patient as { patient_code?: string }).patient_code ?? ""),
    doctor_id: doctorId,
    doctor: doctorName,
    reason: data.reason,
    due_on: data.dueOn,
    status: "Pending",
    created_by: actor.name,
    created_by_role: actor.role,
    resolved_by: null,
    resolved_by_role: null,
    resolved_on: null,
    reschedules: 0,
    note: data.note,
  });
  await audit(actor, "create", "followups", row.id);
  return toFollowUpDTO(row as FollowUpRow);
}

/** Mark as Done (the patient came) or Missed (the patient was absent), crediting whoever marked it. */
async function resolve(id: number, status: "Done" | "Missed", actor: Session) {
  const row = await owned(id, actor);
  if (row.status === status) throw new ConflictError(`Already marked ${status}`);
  const updated = await followupsRepo.update(id, {
    status,
    resolved_by: actor.name,
    resolved_by_role: actor.role,
    resolved_on: isoDate(),
  });
  await audit(actor, status === "Done" ? "done" : "missed", "followups", id);
  return toFollowUpDTO(updated as FollowUpRow);
}
export const markFollowUpDone = (id: number, actor: Session) => resolve(id, "Done", actor);
export const markFollowUpMissed = (id: number, actor: Session) => resolve(id, "Missed", actor);

/** Put it back on the list with a new date (e.g. after the patient missed it), or undo a mistaken mark. */
export async function rescheduleFollowUp(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  const { dueOn, note } = validate({
    dueOn: { type: "string", required: true, pattern: ISO_DAY },
    note: { type: "string", required: false, max: 500, default: "" },
  } as const, input);
  if (dueOn < isoDate()) throw new ValidationError([{ field: "dueOn", message: "can't be in the past" }]);
  const updated = await followupsRepo.update(id, {
    status: "Pending",
    due_on: dueOn,
    resolved_by: null,
    resolved_by_role: null,
    resolved_on: null,
    reschedules: Number(row.reschedules ?? 0) + 1,
    note: note || row.note,
  });
  await audit(actor, "reschedule", "followups", id, { dueOn });
  return toFollowUpDTO(updated as FollowUpRow);
}

export async function reopenFollowUp(id: number, actor: Session) {
  const row = await owned(id, actor);
  if (row.status === "Pending") throw new ConflictError("Already pending");
  const updated = await followupsRepo.update(id, { status: "Pending", resolved_by: null, resolved_by_role: null, resolved_on: null });
  await audit(actor, "reopen", "followups", id);
  return toFollowUpDTO(updated as FollowUpRow);
}

export async function deleteFollowUp(id: number, actor: Session) {
  await owned(id, actor);
  await followupsRepo.remove(id);
  await audit(actor, "delete", "followups", id);
}

/**
 * Counts for the analytics screen over the last `days` days (by due date, ending today): per day (per week
 * on the 12-month view), by who booked / marked them, and per doctor. "Due" is booked, date reached, not
 * yet marked; "upcoming" is booked for a date still ahead.
 */
export async function getFollowUpAnalytics(input: { days: number; doctorId: number | null }, actor: Session): Promise<FollowUpAnalyticsDTO> {
  const days = [30, 90, 180, 365].includes(input.days) ? input.days : 90;
  const today = isoDate();
  const from = addDays(today, -(days - 1));
  const { rows: all } = await followupsRepo.listRows({ ...scopeToHospital({}, actor), unpaged: true });
  const scoped = input.doctorId ? all.filter(r => r.doctor_id === input.doctorId) : all;
  const rows = scoped.filter(r => r.due_on >= from && r.due_on <= today);

  const bucketDays = days > 180 ? 7 : 1;
  const count = Math.ceil(days / bucketDays);
  const buckets: FollowUpBucketDTO[] = Array.from({ length: count }, (_, i) => {
    const key = addDays(from, i * bucketDays);
    return { key, label: shortLabel(key), total: 0, done: 0, missed: 0, due: 0, upcoming: 0 };
  });

  const totals = { scheduled: 0, done: 0, missed: 0, due: 0, upcoming: 0 };
  const roleRows = new Map<string, { role: string; booked: number; markedDone: number; markedMissed: number }>(
    ["Doctor", "Receptionist", "Others"].map(r => [r, { role: r, booked: 0, markedDone: 0, markedMissed: 0 }]),
  );
  const docRows = new Map<string, FollowUpAnalyticsDTO["byDoctor"][number]>();

  for (const r of rows) {
    const b = buckets[Math.min(count - 1, Math.floor(daysBetween(from, r.due_on) / bucketDays))];
    const state = r.status === "Done" ? "done" : r.status === "Missed" ? "missed" : r.due_on <= today ? "due" : "upcoming";
    b.total++; b[state]++;
    totals.scheduled++; totals[state]++;

    roleRows.get(roleGroup(r.created_by_role))!.booked++;
    if (r.status === "Done") roleRows.get(roleGroup(r.resolved_by_role))!.markedDone++;
    if (r.status === "Missed") roleRows.get(roleGroup(r.resolved_by_role))!.markedMissed++;

    const dk = String(r.doctor_id ?? r.doctor ?? "");
    const d = docRows.get(dk) ?? { doctorId: r.doctor_id ?? null, doctor: r.doctor || "Unassigned", total: 0, done: 0, missed: 0, due: 0, upcoming: 0, keptRate: null };
    d.total++; d[state]++;
    docRows.set(dk, d);
  }

  const rate = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : null);
  const in14 = addDays(today, 14);
  return {
    period: { from, to: today, days, bucket: bucketDays === 1 ? "day" : "week" },
    totals: {
      ...totals,
      keptRate: rate(totals.done, totals.done + totals.missed),
      missedRate: rate(totals.missed, totals.done + totals.missed),
      next14: scoped.filter(r => r.status === "Pending" && r.due_on > today && r.due_on <= in14).length,
    },
    buckets,
    byRole: [...roleRows.values()],
    byDoctor: [...docRows.values()]
      .map(d => ({ ...d, keptRate: rate(d.done, d.done + d.missed) }))
      .sort((a, b) => b.total - a.total || a.doctor.localeCompare(b.doctor)),
  };
}
