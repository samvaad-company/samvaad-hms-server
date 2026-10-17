/**
 * The nurse station: what is happening on the ward right now. Almost everything here is read off records the
 * ward already keeps (admissions, medication orders, notes) plus the few things nurses add (dose log, vitals,
 * IV lines, tasks, handover notes). Alerts are not stored — they are worked out each time from those records,
 * so they can never be out of date; only a nurse's "acknowledged / dismissed" is kept, keyed by a stable id.
 */
import {
  ipdRepo,
  ipdNotesRepo,
  ipdMedicationsRepo,
  ipdVitalsRepo,
  ipdIvLinesRepo,
  ipdDoseLogRepo,
  ipdNursingTasksRepo,
  ipdHandoversRepo,
  ipdAlertAcksRepo,
  ipdChecklistsRepo,
} from "@/repositories";
import { toIpdIvLineDTO, toIpdNursingTaskDTO, toIpdHandoverDTO, toIpdVitalDTO } from "@/repositories/mappers";
import { type Filter } from "@/db/adapter";
import {
  type IpdAdmissionRow,
  type IpdMedicationRow,
  type IpdDoseLogRow,
  type IpdIvLineRow,
  type IpdNursingTaskRow,
  type IpdVitalRow,
} from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { doseSlots, shiftOf } from "@/services/ipd-schedule";
import {
  type DoseSlotDTO,
  type IpdAlertDTO,
  type IpdBoardDTO,
  type IpdLiveDTO,
  type NurseBoardDTO,
} from "@shared/types/api";

const HOUR = 3_600_000;
/** Vitals are "due" once the last set is older than this. */
const VITALS_EVERY_H = 6;
/** How far back an unrecorded dose still raises an alert. */
const MISSED_LOOKBACK_DAYS = 3;

// ── Loading ──────────────────────────────────────────────────────────────────

async function admitted(actor: Session, wardId?: number): Promise<IpdAdmissionRow[]> {
  const filters: Filter[] = [{ column: "status", op: "neq", value: "Discharged" }];
  if (wardId) filters.push({ column: "ward_id", op: "eq", value: wardId });
  const { rows } = await ipdRepo.listRows(scopeToHospital(scopeToOwnDoctor({ unpaged: true, filters }, actor, "doctor_id"), actor));
  return rows;
}

const inIds = (ids: number[]): Filter => ({ column: "admission_id", op: "in", value: ids });

interface Ward {
  admissions: IpdAdmissionRow[];
  ids: number[];
  meds: IpdMedicationRow[];
  doseLog: IpdDoseLogRow[];
  ivs: IpdIvLineRow[];
  vitals: IpdVitalRow[];
  tasks: IpdNursingTaskRow[];
}

async function loadWard(actor: Session, wardId?: number): Promise<Ward> {
  const admissions = await admitted(actor, wardId);
  const ids = admissions.map((a) => a.id);
  if (ids.length === 0) return { admissions, ids, meds: [], doseLog: [], ivs: [], vitals: [], tasks: [] };
  const [meds, doseLog, ivs, vitals, tasks] = await Promise.all([
    ipdMedicationsRepo.listRows({ unpaged: true, filters: [inIds(ids), { column: "status", op: "eq", value: "Active" }] }),
    ipdDoseLogRepo.listRows(scopeToHospital({ unpaged: true, filters: [inIds(ids)] }, actor)),
    ipdIvLinesRepo.listRows(scopeToHospital({ unpaged: true, filters: [inIds(ids), { column: "status", op: "eq", value: "Running" }] }, actor)),
    ipdVitalsRepo.listRows(scopeToHospital({ unpaged: true, filters: [inIds(ids)], sort: [{ column: "recorded_at", direction: "desc" }] }, actor)),
    ipdNursingTasksRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "To do" }] }, actor)),
  ]);
  return { admissions, ids, meds: meds.rows, doseLog: doseLog.rows, ivs: ivs.rows, vitals: vitals.rows, tasks: tasks.rows };
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

// ── Live state (admissions list, board) ──────────────────────────────────────

export async function getBoard(actor: Session): Promise<IpdBoardDTO> {
  const ward = await loadWard(actor);
  if (ward.admissions.length === 0) return { live: [], rounds: null };
  const now = new Date();
  const today = localDate(now);
  const { rows: notes } = await ipdNotesRepo.listRows({
    unpaged: true,
    filters: [inIds(ward.ids), { column: "note_type", op: "eq", value: "Doctor Round" }, { column: "note_date", op: "gte", value: today }],
    sort: [{ column: "id", direction: "desc" }],
  });
  const { rows: checklists } = await ipdChecklistsRepo.listRows(
    scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "In progress" }] }, actor),
  );
  const slots = doseSlots(ward.meds, ward.doseLog, addDays(today, -MISSED_LOOKBACK_DAYS), today, now);
  const dayAgo = now.getTime() - 24 * HOUR;

  const live: IpdLiveDTO[] = ward.admissions.map((a) => {
    const mine = slots.filter((s) => s.admissionId === a.id);
    const lastRound = notes.find((n) => n.admission_id === a.id);
    const lastVitals = ward.vitals.find((v) => v.admission_id === a.id);
    const meds = ward.meds.filter((m) => m.admission_id === a.id);
    const upcoming = mine.filter((s) => s.state === "upcoming" && localDate(new Date(s.scheduledAt)) === today)[0];
    const nameMatch = Boolean(a.primary_nurse) && a.primary_nurse === actor.name;
    const doctorMatch = actor.doctorId != null && a.doctor_id === actor.doctorId;
    return {
      admissionId: a.id,
      mine: nameMatch || doctorMatch,
      seenToday: Boolean(lastRound),
      lastRoundAt: lastRound ? `${lastRound.note_date} ${lastRound.note_time}` : null,
      lastRoundBy: lastRound?.author ?? null,
      ivRunning: ward.ivs.filter((i) => i.admission_id === a.id).length,
      dosesDue: mine.filter((s) => s.state === "due").length,
      dosesMissed: mine.filter((s) => s.state === "missed").length,
      nextDoseAt: upcoming?.scheduledAt ?? null,
      newOrders: meds.filter((m) => new Date(m.created_at).getTime() >= dayAgo && !ward.doseLog.some((l) => l.medication_id === m.id)).length,
      vitalsDue: !lastVitals || now.getTime() - new Date(lastVitals.recorded_at).getTime() > VITALS_EVERY_H * HOUR,
      lastVitalsAt: lastVitals?.recorded_at ?? null,
      openTasks: ward.tasks.filter((t) => t.admission_id === a.id).length,
      openChecklists: checklists.filter((c) => c.admission_id === a.id).length,
      stayDay: Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${(a.admission_date || today).slice(0, 10)}T00:00:00Z`)) / 86_400_000) + 1),
    };
  });

  const mineOnly = live.filter((l) => l.mine);
  const basis = mineOnly.length > 0 && actor.doctorId != null ? mineOnly : live;
  const rounds = actor.role === "Doctor" || actor.doctorId != null ? { seen: basis.filter((l) => l.seenToday).length, total: basis.length } : null;
  return { live, rounds };
}

// ── Alerts ───────────────────────────────────────────────────────────────────

/** Out-of-range vitals worth stopping everything for. */
export function criticalReasons(v: IpdVitalRow): string[] {
  const out: string[] = [];
  if (v.spo2 != null && v.spo2 < 90) out.push(`SpO₂ ${v.spo2}%`);
  if (v.temp_c != null && (v.temp_c >= 39.5 || v.temp_c <= 35)) out.push(`Temp ${v.temp_c}°C`);
  if (v.pulse != null && (v.pulse > 130 || v.pulse < 40)) out.push(`Pulse ${v.pulse}`);
  if (v.bp_systolic != null && (v.bp_systolic < 90 || v.bp_systolic > 200)) out.push(`BP ${v.bp_systolic}/${v.bp_diastolic ?? "?"}`);
  if (v.resp_rate != null && (v.resp_rate > 30 || v.resp_rate < 8)) out.push(`Resp ${v.resp_rate}`);
  return out;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata" });

export async function getNurseBoard(actor: Session): Promise<NurseBoardDTO> {
  const ward = await loadWard(actor);
  const now = new Date();
  const today = localDate(now);
  const who = new Map(ward.admissions.map((a) => [a.id, { name: a.patient_name, code: a.patient_code }]));
  const alerts: IpdAlertDTO[] = [];
  const add = (a: Omit<IpdAlertDTO, "patientName" | "patientCode">) => {
    const p = who.get(a.admissionId);
    if (p) alerts.push({ ...a, patientName: p.name, patientCode: p.code });
  };

  // Doses nobody recorded, and doses deliberately held.
  const slots = doseSlots(ward.meds, ward.doseLog, addDays(today, -MISSED_LOOKBACK_DAYS), today, now);
  for (const s of slots.filter((x) => x.state === "missed")) {
    add({ key: `dose-missed:${s.key}`, kind: "Dose missed", severity: "warning", admissionId: s.admissionId, title: `Missed dose: ${s.medicineName}`, detail: [s.dosage, s.route].filter(Boolean).join(" · "), at: s.scheduledAt });
  }
  for (const l of ward.doseLog.filter((x) => x.status === "Held" && now.getTime() - new Date(x.given_at).getTime() < 24 * HOUR)) {
    const med = ward.meds.find((m) => m.id === l.medication_id);
    add({ key: `dose-held:${l.id}`, kind: "Dose held", severity: "warning", admissionId: l.admission_id, title: `Dose held: ${med?.medicine_name ?? "medicine"}`, detail: l.note || "Held — no reason noted", at: l.given_at });
  }
  // Latest vitals per patient, if out of range and recent.
  const seen = new Set<number>();
  for (const v of ward.vitals) {
    if (seen.has(v.admission_id)) continue;
    seen.add(v.admission_id);
    const reasons = criticalReasons(v);
    if (reasons.length && now.getTime() - new Date(v.recorded_at).getTime() < 24 * HOUR) {
      add({ key: `vitals:${v.id}`, kind: "Critical vitals", severity: "critical", admissionId: v.admission_id, title: "Critical vitals", detail: reasons.join(" · "), at: v.recorded_at });
    }
  }
  // Bottles about to finish, or already dry.
  for (const iv of ward.ivs.map(toIpdIvLineDTO)) {
    const left = new Date(iv.endsAt).getTime() - now.getTime();
    if (left <= 30 * 60_000) {
      add({ key: `iv:${iv.id}`, kind: "IV bottle", severity: "warning", admissionId: iv.admissionId, title: left <= 0 ? `IV bottle finished: ${iv.fluid}` : `IV bottle finishing: ${iv.fluid}`, detail: `${iv.volumeMl} ml at ${iv.rateMlHr} ml/hr · ends ${fmtTime(iv.endsAt)}`, at: iv.endsAt });
    }
  }
  // Orders written in the last day that nobody has started.
  for (const m of ward.meds) {
    if (now.getTime() - new Date(m.created_at).getTime() < 24 * HOUR && !ward.doseLog.some((l) => l.medication_id === m.id)) {
      add({ key: `order:${m.id}`, kind: "New order", severity: "info", admissionId: m.admission_id, title: `New order: ${m.medicine_name}`, detail: [m.dosage, m.frequency, m.route].filter(Boolean).join(" · "), at: m.created_at });
    }
  }
  // Ward jobs past their time.
  for (const t of ward.tasks) {
    if (t.due_at && new Date(t.due_at).getTime() < now.getTime() && t.admission_id != null) {
      add({ key: `task:${t.id}`, kind: "Nursing task", severity: "warning", admissionId: t.admission_id, title: t.title, detail: `Was due ${fmtTime(t.due_at)}`, at: t.due_at });
    }
  }

  const { rows: acks } = await ipdAlertAcksRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const done = new Set(acks.map((a) => a.alert_key));
  const rank = { critical: 0, warning: 1, info: 2 } as const;
  const open = alerts.filter((a) => !done.has(a.key)).sort((a, b) => rank[a.severity] - rank[b.severity] || b.at.localeCompare(a.at));
  return { alerts: open, tasks: await listTasks(actor, "To do") };
}

export async function ackAlerts(input: unknown, actor: Session) {
  const body = (input ?? {}) as { keys?: unknown; action?: unknown };
  const keys = (Array.isArray(body.keys) ? body.keys : []).filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 120).slice(0, 500);
  if (keys.length === 0) throw new BadRequestError("keys is required");
  const action = body.action === "Dismissed" ? "Dismissed" : "Acknowledged";
  const hospitalId = requireHospitalId(actor);
  const { rows: existing } = await ipdAlertAcksRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const have = new Set(existing.map((a) => a.alert_key));
  for (const key of keys.filter((k) => !have.has(k))) {
    await ipdAlertAcksRepo.create({ hospital_id: hospitalId, alert_key: key, action, by: actor.name });
  }
  await audit(actor, "ack", "ipd-alert", 0, { count: keys.length, action });
  return { acknowledged: keys.length };
}

// ── Doses ────────────────────────────────────────────────────────────────────

export async function listDoses(actor: Session, date?: string, wardId?: number): Promise<DoseSlotDTO[]> {
  const ward = await loadWard(actor, wardId);
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDate();
  return doseSlots(ward.meds, ward.doseLog, day, day);
}

const doseSchema = {
  medicationId: { type: "number", required: true, min: 1 },
  scheduledAt: { type: "string", required: true, max: 40 },
  status: { type: "enum", required: false, values: ["Given", "Held"], default: "Given" },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

export async function recordDose(input: unknown, actor: Session) {
  const data = validate(doseSchema, input);
  const med = await ipdMedicationsRepo.getRow(data.medicationId);
  if (!med) throw new NotFoundError("Medication");
  const admission = await ipdRepo.getRow(med.admission_id);
  assertOwnedByHospital(admission, actor, "Admission");
  const at = new Date(data.scheduledAt);
  if (Number.isNaN(at.getTime())) throw new BadRequestError("scheduledAt must be a date and time");
  if (data.status === "Held" && !data.note) throw new BadRequestError("Say why the dose is being held");
  const iso = at.toISOString();
  const { rows } = await ipdDoseLogRepo.listRows({ unpaged: true, filters: [{ column: "medication_id", op: "eq", value: med.id }] });
  if (rows.some((l) => new Date(l.scheduled_at).getTime() === at.getTime())) throw new ConflictError("That dose is already recorded");
  const row = await ipdDoseLogRepo.create({
    hospital_id: admission.hospital_id,
    admission_id: admission.id,
    medication_id: med.id,
    scheduled_at: iso,
    status: data.status,
    given_at: new Date().toISOString(),
    given_by: actor.name,
    note: data.note,
  });
  if (data.status === "Given") await ipdMedicationsRepo.update(med.id, { last_given_at: new Date().toISOString() });
  await audit(actor, data.status === "Given" ? "dose-given" : "dose-held", "ipd-medication", med.id, { scheduledAt: iso });
  return row;
}

// ── Vitals ───────────────────────────────────────────────────────────────────

const vitalSchema = {
  admissionId: { type: "number", required: true, min: 1 },
  tempC: { type: "number", required: false, min: 25, max: 45 },
  pulse: { type: "number", required: false, min: 10, max: 300 },
  bpSystolic: { type: "number", required: false, min: 30, max: 300 },
  bpDiastolic: { type: "number", required: false, min: 20, max: 200 },
  spo2: { type: "number", required: false, min: 30, max: 100 },
  respRate: { type: "number", required: false, min: 2, max: 80 },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

export async function recordVitals(input: unknown, actor: Session) {
  const data = validate(vitalSchema, input);
  const admission = await ipdRepo.getRow(data.admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
  const readings = [data.tempC, data.pulse, data.bpSystolic, data.spo2, data.respRate];
  if (readings.every((r) => r == null)) throw new BadRequestError("Enter at least one reading");
  if ((data.bpSystolic == null) !== (data.bpDiastolic == null)) throw new BadRequestError("Enter both parts of the blood pressure");
  if (data.bpSystolic != null && data.bpDiastolic != null && data.bpDiastolic >= data.bpSystolic) {
    throw new BadRequestError("Diastolic pressure must be lower than systolic");
  }
  const row = await ipdVitalsRepo.create({
    hospital_id: admission.hospital_id,
    admission_id: admission.id,
    recorded_at: new Date().toISOString(),
    temp_c: data.tempC ?? null,
    pulse: data.pulse ?? null,
    bp_systolic: data.bpSystolic ?? null,
    bp_diastolic: data.bpDiastolic ?? null,
    spo2: data.spo2 ?? null,
    resp_rate: data.respRate ?? null,
    note: data.note,
    recorded_by: actor.name,
  });
  await audit(actor, "vitals", "ipd", admission.id);
  return toIpdVitalDTO(row as IpdVitalRow);
}

/** Recent vitals for one patient, newest first. */
export async function listVitals(admissionId: number, actor: Session) {
  const admission = await ipdRepo.getRow(admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
  const { rows } = await ipdVitalsRepo.listRows({
    unpaged: true,
    filters: [{ column: "admission_id", op: "eq", value: admissionId }],
    sort: [{ column: "recorded_at", direction: "desc" }],
  });
  return rows.slice(0, 30).map(toIpdVitalDTO);
}

/** The latest set of vitals for every admitted patient, keyed by admission. */
export async function latestVitals(actor: Session) {
  const ward = await loadWard(actor);
  const seen = new Set<number>();
  const out: ReturnType<typeof toIpdVitalDTO>[] = [];
  for (const v of ward.vitals) {
    if (seen.has(v.admission_id)) continue;
    seen.add(v.admission_id);
    out.push(toIpdVitalDTO(v));
  }
  return out;
}

// ── IV lines ─────────────────────────────────────────────────────────────────

const ivSchema = {
  admissionId: { type: "number", required: true, min: 1 },
  fluid: { type: "string", required: true, min: 2, max: 120 },
  volumeMl: { type: "number", required: true, min: 10, max: 5000 },
  rateMlHr: { type: "number", required: true, min: 1, max: 1500 },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

export async function listIvLines(actor: Session) {
  const ward = await loadWard(actor);
  return ward.ivs.map(toIpdIvLineDTO).sort((a, b) => a.endsAt.localeCompare(b.endsAt));
}

export async function startIvLine(input: unknown, actor: Session) {
  const data = validate(ivSchema, input);
  const admission = await ipdRepo.getRow(data.admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
  if (admission.status === "Discharged") throw new ConflictError("This patient has been discharged");
  const row = await ipdIvLinesRepo.create({
    hospital_id: admission.hospital_id,
    admission_id: admission.id,
    fluid: data.fluid,
    volume_ml: data.volumeMl,
    rate_ml_hr: data.rateMlHr,
    started_at: new Date().toISOString(),
    stopped_at: null,
    status: "Running",
    started_by: actor.name,
    note: data.note,
  });
  await audit(actor, "iv-start", "ipd", admission.id, { fluid: data.fluid });
  return toIpdIvLineDTO(row as IpdIvLineRow);
}

export async function stopIvLine(id: number, input: unknown, actor: Session) {
  const line = await ipdIvLinesRepo.getRow(id);
  if (!line) throw new NotFoundError("IV line");
  assertOwnedByHospital(line, actor, "IV line");
  if (line.status !== "Running") throw new ConflictError("This bottle is already stopped");
  const completed = (input as { completed?: boolean } | null)?.completed === true;
  const row = await ipdIvLinesRepo.update(id, { status: completed ? "Completed" : "Stopped", stopped_at: new Date().toISOString() });
  await audit(actor, completed ? "iv-complete" : "iv-stop", "ipd", line.admission_id);
  return toIpdIvLineDTO(row as IpdIvLineRow);
}

// ── Tasks ────────────────────────────────────────────────────────────────────

const taskSchema = {
  title: { type: "string", required: true, min: 2, max: 200 },
  admissionId: { type: "number", required: false, min: 1 },
  dueAt: { type: "string", required: false, max: 40 },
} as const;

export async function listTasks(actor: Session, status: "To do" | "Done" = "To do") {
  const { rows } = await ipdNursingTasksRepo.listRows(
    scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: status }], sort: [{ column: "due_at", direction: "asc" }] }, actor),
  );
  const today = localDate();
  // "Done" is this shift's finished work — only today's.
  const shown = status === "Done" ? rows.filter((t) => t.done_at && localDate(new Date(t.done_at)) === today) : rows;
  return shown.map(toIpdNursingTaskDTO);
}

export async function createTask(input: unknown, actor: Session) {
  const data = validate(taskSchema, input);
  const hospitalId = requireHospitalId(actor);
  if (data.admissionId) assertOwnedByHospital(await ipdRepo.getRow(data.admissionId), actor, "Admission");
  let dueAt: string | null = null;
  if (data.dueAt) {
    const d = new Date(data.dueAt);
    if (Number.isNaN(d.getTime())) throw new BadRequestError("dueAt must be a date and time");
    dueAt = d.toISOString();
  }
  const row = await ipdNursingTasksRepo.create({
    hospital_id: hospitalId,
    admission_id: data.admissionId ?? null,
    title: data.title,
    due_at: dueAt,
    status: "To do",
    created_by: actor.name,
    done_by: null,
    done_at: null,
  });
  await audit(actor, "create", "ipd-task", row.id);
  return toIpdNursingTaskDTO(row as IpdNursingTaskRow);
}

export async function setTaskDone(id: number, input: unknown, actor: Session) {
  const task = await ipdNursingTasksRepo.getRow(id);
  assertOwnedByHospital(task, actor, "Task");
  const undo = (input as { undo?: boolean } | null)?.undo === true;
  const row = await ipdNursingTasksRepo.update(id, undo ? { status: "To do", done_by: null, done_at: null } : { status: "Done", done_by: actor.name, done_at: new Date().toISOString() });
  await audit(actor, undo ? "task-reopen" : "task-done", "ipd-task", id);
  return toIpdNursingTaskDTO(row as IpdNursingTaskRow);
}

// ── Handover ─────────────────────────────────────────────────────────────────

const handoverSchema = {
  admissionId: { type: "number", required: true, min: 1 },
  note: { type: "string", required: true, min: 2, max: 1000 },
} as const;

/** Handover notes for the current shift (or a given one). */
export async function listHandover(actor: Session, shift?: string, date?: string) {
  const now = shiftOf();
  const useShift = shift === "Morning" || shift === "Evening" || shift === "Night" ? shift : now.shift;
  const useDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : now.date;
  const { rows } = await ipdHandoversRepo.listRows(
    scopeToHospital({ unpaged: true, filters: [{ column: "shift", op: "eq", value: useShift }, { column: "shift_date", op: "eq", value: useDate }], sort: [{ column: "id", direction: "desc" }] }, actor),
  );
  return { shift: useShift, shiftDate: useDate, notes: rows.map(toIpdHandoverDTO) };
}

export async function addHandover(input: unknown, actor: Session) {
  const data = validate(handoverSchema, input);
  const admission = await ipdRepo.getRow(data.admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
  const now = shiftOf();
  const row = await ipdHandoversRepo.create({
    hospital_id: admission.hospital_id,
    admission_id: admission.id,
    shift: now.shift,
    shift_date: now.date,
    note: data.note,
    author: actor.name,
  });
  await audit(actor, "handover", "ipd", admission.id);
  return toIpdHandoverDTO(row as Parameters<typeof toIpdHandoverDTO>[0]);
}

// ── Diet ─────────────────────────────────────────────────────────────────────

/** Every admitted patient's diet instruction, with the newest diet note from their chart. */
export async function listDiet(actor: Session) {
  const admissions = await admitted(actor);
  if (admissions.length === 0) return [];
  const { rows: notes } = await ipdNotesRepo.listRows({
    unpaged: true,
    filters: [inIds(admissions.map((a) => a.id)), { column: "note_type", op: "eq", value: "Diet" }],
    sort: [{ column: "id", direction: "desc" }],
  });
  return admissions.map((a) => {
    const note = notes.find((n) => n.admission_id === a.id);
    return { admissionId: a.id, diet: a.diet ?? "", note: note ? { content: note.content, at: `${note.note_date} ${note.note_time}`, author: note.author } : null };
  });
}
