/**
 * The inpatient chart: the day's treatment sheet (plan, instructions, investigations, when to call the doctor, the doctor's
 * sign-off), fluid balance, and the views that pull a patient's whole stay together — overview, discharge readiness and timeline.
 * Nothing here duplicates what the ward already records; the overview and timeline are worked out each time from those records.
 */
import {
  ipdRepo, ipdNotesRepo, ipdMedicationsRepo, ipdVitalsRepo, ipdIvLinesRepo, ipdDoseLogRepo, ipdSheetsRepo, ipdIoRepo,
  billsRepo, preauthFormsRepo,
} from "@/repositories";
import { toIpdVitalDTO } from "@/repositories/mappers";
import { type IpdAdmissionRow, type IpdSheetRow, type IpdIoRow } from "@/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { doseSlots } from "@/services/ipd-schedule";
import { getIpd } from "@/services/ipd-service";
import { getBoard } from "@/services/nurse-station-service";
import { listPatientConsents } from "@/services/consents-service";
import type {
  IpdCallLimitsDTO, IpdInstructionDTO, IpdIoDTO, IpdIoSummaryDTO, IpdOverviewDTO, IpdSheetDTO, IpdTimelineDTO, IpdTimelineEventDTO,
  IpdTodoDTO, IpdWardEventDTO,
} from "@shared/types/api";

const HOUR = 3_600_000;
const DEFAULT_LIMITS: IpdCallLimitsDTO = { spo2Below: 90, sbpBelow: 90, sbpAbove: 180, pulseAbove: 120, pulseBelow: 50, respAbove: 30, tempFAbove: 101, grbsBelow: 70, grbsAbove: 300 };
const DEFAULT_OTHER = [
  "New confusion, drowsiness or a fit",
  "Chest pain or a new irregular pulse",
  "Active bleeding",
  "Suspected drug reaction or rash",
  "Urine output below 0.5 mL/kg/hr",
  "Any nurse worried the patient is getting worse",
];

async function admission(id: number, actor: Session): Promise<IpdAdmissionRow> {
  const a = await ipdRepo.getRow(id);
  if (!a) throw new NotFoundError("Admission");
  assertOwnedByHospital(a, actor, "Admission");
  return a;
}

const json = <T,>(raw: string | null | undefined, fallback: T): T => {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

// ── Treatment sheet ──────────────────────────────────────────────────────────

async function sheetRows(admissionId: number): Promise<IpdSheetRow[]> {
  const { rows } = await ipdSheetsRepo.listRows({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: admissionId }], sort: [{ column: "sheet_date", direction: "desc" }] });
  return rows;
}

function sheetDto(a: IpdAdmissionRow, date: string, row: IpdSheetRow | undefined, carried: IpdSheetRow | undefined): IpdSheetDTO {
  const src = row ?? carried;
  const call = json<{ limits?: Partial<IpdCallLimitsDTO>; other?: string[] }>(src?.call_doctor, {});
  return {
    admissionId: a.id,
    date,
    diagnosis: a.diagnosis,
    plan: row ? row.plan : carried?.plan ?? "",
    carriedFrom: !row && carried ? carried.sheet_date : null,
    // Instructions and investigations stand until someone changes them, so a new day shows the last day's; a "seen" mark is that day's alone.
    instructions: json<IpdInstructionDTO[]>(src?.instructions, []).map((i) => (row ? i : { ...i, seenBy: null, seenAt: null })),
    investigations: json<string[]>(src?.investigations, []),
    callDoctor: { limits: { ...DEFAULT_LIMITS, ...(call.limits ?? {}) }, other: call.other ?? DEFAULT_OTHER },
    signedBy: row?.signed_by ?? null,
    signedAt: row?.signed_at ?? null,
    saved: Boolean(row),
  };
}

export async function getSheet(admissionId: number, date: string | undefined, actor: Session): Promise<IpdSheetDTO> {
  const a = await admission(admissionId, actor);
  const day = isDate(date) ? date : localDate();
  const rows = await sheetRows(admissionId);
  const row = rows.find((r) => r.sheet_date === day);
  const carried = rows.find((r) => r.sheet_date < day);
  return sheetDto(a, day, row, carried);
}

const limitField = { type: "number", required: false, min: 0, max: 400 } as const;
const sheetSchema = {
  date: { type: "string", required: false, max: 10 },
  plan: { type: "string", required: false, max: 2000 },
} as const;

/** Saves any of: plan, instructions, investigations, callDoctor. Whatever is not sent stays as it is (carried from the day before if need be). */
export async function saveSheet(admissionId: number, input: unknown, actor: Session): Promise<IpdSheetDTO> {
  const a = await admission(admissionId, actor);
  if (a.status === "Discharged") throw new ConflictError("This patient has been discharged");
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const data = validate(sheetSchema, { date: body.date, plan: body.plan });
  const day = isDate(data.date) ? data.date : localDate();
  const rows = await sheetRows(admissionId);
  const existing = rows.find((r) => r.sheet_date === day);
  const carried = rows.find((r) => r.sheet_date < day);
  const base = sheetDto(a, day, existing, carried);

  const instructions = Array.isArray(body.instructions)
    ? (body.instructions as unknown[]).slice(0, 40).map((raw, n) => {
        const i = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
        const text = String(i.text ?? "").trim().slice(0, 300);
        if (!text) throw new BadRequestError("An instruction can't be empty");
        const seen = Boolean(i.seenAt);
        return { id: String(i.id || `i${Date.now().toString(36)}${n}`), text, kind: i.kind === "Diet" ? "Diet" : "Nursing", seenBy: seen ? String(i.seenBy || actor.name) : null, seenAt: seen ? String(i.seenAt) : null } as IpdInstructionDTO;
      })
    : base.instructions;
  const investigations = Array.isArray(body.investigations) ? (body.investigations as unknown[]).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 40) : base.investigations;

  let callDoctor = base.callDoctor;
  if (typeof body.callDoctor === "object" && body.callDoctor !== null) {
    const c = body.callDoctor as { limits?: Record<string, unknown>; other?: unknown };
    const limits = { ...base.callDoctor.limits };
    for (const k of Object.keys(DEFAULT_LIMITS) as (keyof IpdCallLimitsDTO)[]) {
      if (c.limits && k in c.limits) {
        const v = c.limits[k];
        limits[k] = v === null || v === "" ? null : validate({ v: limitField }, { v }).v ?? null;
      }
    }
    callDoctor = { limits, other: Array.isArray(c.other) ? (c.other as unknown[]).map((x) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 20) : base.callDoctor.other };
  }

  const values = {
    plan: "plan" in body ? (data.plan ?? "") : base.plan,
    instructions: JSON.stringify(instructions),
    investigations: JSON.stringify(investigations),
    call_doctor: JSON.stringify(callDoctor),
  };
  // Editing a signed day takes the sign-off off it: the doctor reviews what changed.
  const unsign = existing?.signed_at ? { signed_by: null, signed_at: null } : {};
  const row = existing
    ? await ipdSheetsRepo.update(existing.id, { ...values, ...unsign })
    : await ipdSheetsRepo.create({ hospital_id: a.hospital_id, admission_id: a.id, sheet_date: day, ...values, signed_by: null, signed_at: null });
  await audit(actor, "sheet", "ipd", a.id, { date: day });
  return sheetDto(a, day, row as IpdSheetRow, undefined);
}

/** The doctor reviews the day's sheet and signs it. */
export async function signSheet(admissionId: number, input: unknown, actor: Session): Promise<IpdSheetDTO> {
  const a = await admission(admissionId, actor);
  if (actor.role !== "Doctor" && actor.role !== "Super Admin") throw new ForbiddenError("Only a doctor can sign the treatment sheet");
  const day = isDate((input as { date?: unknown } | null)?.date) ? (input as { date: string }).date : localDate();
  const rows = await sheetRows(admissionId);
  let row = rows.find((r) => r.sheet_date === day);
  if (!row) {
    const carried = rows.find((r) => r.sheet_date < day);
    const dto = sheetDto(a, day, undefined, carried);
    row = (await ipdSheetsRepo.create({
      hospital_id: a.hospital_id, admission_id: a.id, sheet_date: day, plan: dto.plan, instructions: JSON.stringify(dto.instructions),
      investigations: JSON.stringify(dto.investigations), call_doctor: JSON.stringify(dto.callDoctor), signed_by: null, signed_at: null,
    })) as IpdSheetRow;
  }
  const signed = await ipdSheetsRepo.update(row.id, { signed_by: actor.name, signed_at: new Date().toISOString() });
  await audit(actor, "sheet-sign", "ipd", a.id, { date: day });
  return sheetDto(a, day, signed as IpdSheetRow, undefined);
}

// ── Fluid balance ────────────────────────────────────────────────────────────

const toIo = (r: IpdIoRow): IpdIoDTO => ({ id: r.id, admissionId: r.admission_id, kind: r.kind, category: r.category, amountMl: Number(r.amount_ml) || 0, recordedAt: r.recorded_at, note: r.note ?? "", recordedBy: r.recorded_by ?? "" });

export async function listIo(admissionId: number, actor: Session): Promise<IpdIoSummaryDTO> {
  await admission(admissionId, actor);
  const { rows } = await ipdIoRepo.listRows({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: admissionId }], sort: [{ column: "recorded_at", direction: "desc" }] });
  const entries = rows.map(toIo);
  const since = Date.now() - 24 * HOUR;
  const recent = entries.filter((e) => Date.parse(e.recordedAt) >= since);
  const intakeMl = recent.filter((e) => e.kind === "In").reduce((n, e) => n + e.amountMl, 0);
  const outputMl = recent.filter((e) => e.kind === "Out").reduce((n, e) => n + e.amountMl, 0);
  return { entries: entries.slice(0, 200), intakeMl, outputMl, balanceMl: intakeMl - outputMl };
}

const ioSchema = {
  kind: { type: "enum", required: true, values: ["In", "Out"] },
  category: { type: "string", required: true, min: 1, max: 40 },
  amountMl: { type: "number", required: true, min: 1, max: 10000 },
  note: { type: "string", required: false, max: 200, default: "" },
} as const;

export async function addIo(admissionId: number, input: unknown, actor: Session): Promise<IpdIoDTO> {
  const a = await admission(admissionId, actor);
  if (a.status === "Discharged") throw new ConflictError("This patient has been discharged");
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const data = validate(ioSchema, body);
  // Entries can be for a time earlier today ("When"): not in the future, not more than two days back.
  let at = new Date();
  if (body.recordedAt) {
    at = new Date(String(body.recordedAt));
    if (Number.isNaN(at.getTime())) throw new BadRequestError("The time isn't a valid date and time");
    if (at.getTime() > Date.now() + 5 * 60_000) throw new BadRequestError("An entry can't be dated in the future");
    if (at.getTime() < Date.now() - 48 * HOUR) throw new BadRequestError("An entry can't be dated more than two days back");
  }
  const row = await ipdIoRepo.create({ hospital_id: a.hospital_id, admission_id: a.id, kind: data.kind, category: data.category, amount_ml: data.amountMl, recorded_at: at.toISOString(), note: data.note, recorded_by: actor.name });
  await audit(actor, "io", "ipd", a.id, { kind: data.kind, ml: data.amountMl });
  return toIo(row as IpdIoRow);
}

export async function deleteIo(admissionId: number, entryId: number, actor: Session) {
  const a = await admission(admissionId, actor);
  const row = await ipdIoRepo.getRow(entryId);
  if (!row || row.admission_id !== a.id) throw new NotFoundError("Entry");
  await ipdIoRepo.remove(entryId);
  await audit(actor, "io-delete", "ipd", a.id, { entryId });
}

// ── Stay details ─────────────────────────────────────────────────────────────

const staySchema = {
  allergyStatus: { type: "enum", required: false, values: ["", "No known allergies", "Has allergies"] },
  allergies: { type: "string", required: false, max: 300 },
  payer: { type: "string", required: false, min: 1, max: 80 },
  plannedDischargeDate: { type: "string", required: false, max: 10 },
  dischargeStage: { type: "enum", required: false, values: ["", "Doctor's summary", "Bill cleared"] },
} as const;

export async function updateStay(admissionId: number, input: unknown, actor: Session) {
  const a = await admission(admissionId, actor);
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const data = validate(staySchema, body);
  const patch: Record<string, unknown> = {};
  if ("allergyStatus" in body) {
    patch.allergy_status = data.allergyStatus ?? "";
    if (data.allergyStatus !== "Has allergies") patch.allergies = "";
  }
  if ("allergies" in body && (data.allergyStatus === "Has allergies" || (!("allergyStatus" in body) && a.allergy_status === "Has allergies"))) patch.allergies = data.allergies ?? "";
  if ("payer" in body && data.payer) patch.payer = data.payer;
  if ("plannedDischargeDate" in body) {
    if (body.plannedDischargeDate === null || body.plannedDischargeDate === "") patch.planned_discharge_date = null;
    else if (!isDate(data.plannedDischargeDate)) throw new BadRequestError("The planned discharge date isn't a valid date");
    else if (data.plannedDischargeDate < localDate()) throw new BadRequestError("The planned discharge date can't be in the past");
    else patch.planned_discharge_date = data.plannedDischargeDate;
  }
  if ("dischargeStage" in body) patch.discharge_stage = data.dischargeStage ?? "";
  if (Object.keys(patch).length === 0) throw new BadRequestError("Nothing to change");
  await ipdRepo.update(a.id, patch);
  await audit(actor, "stay-update", "ipd", a.id, patch);
  return getOverview(a.id, actor);
}

// ── Overview ─────────────────────────────────────────────────────────────────

const dayOf = (d: Date) => localDate(d);
const addDays = (d: string, n: number) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);

export async function getOverview(admissionId: number, actor: Session): Promise<IpdOverviewDTO> {
  const a = await admission(admissionId, actor);
  const dto = await getIpd(admissionId, actor);
  const now = new Date();
  const today = dayOf(now);
  const byAdm = [{ column: "admission_id", op: "eq" as const, value: a.id }];
  const [meds, doseLog, ivs, vitals, notes, bills, forms] = await Promise.all([
    ipdMedicationsRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdDoseLogRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdIvLinesRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdVitalsRepo.listRows({ unpaged: true, filters: byAdm, sort: [{ column: "recorded_at", direction: "desc" }] }),
    ipdNotesRepo.listRows({ unpaged: true, filters: byAdm, sort: [{ column: "id", direction: "desc" }] }),
    a.patient_id ? billsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: a.patient_id }] }, actor)) : Promise.resolve({ rows: [] as never[] }),
    a.patient_id ? preauthFormsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: a.patient_id }] }, actor)) : Promise.resolve({ rows: [] as never[] }),
  ]);
  const consents = a.patient_id ? await listPatientConsents(a.patient_id, actor) : [];
  const live = a.status === "Discharged" ? null : (await getBoard(actor)).live.find((l) => l.admissionId === a.id) ?? null;

  const ipdBills = (bills.rows as { type: string; status: string; total: number }[]).filter((b) => b.type === "IPD");
  const unpaid = ipdBills.filter((b) => b.status === "Pending" || b.status === "Partial");
  const balanceDue = unpaid.reduce((n, b) => n + Number(b.total), 0);
  const billed = ipdBills.reduce((n, b) => n + Number(b.total), 0);

  const slots = doseSlots(meds.rows, doseLog.rows, addDays(today, -1), today, now);
  const onWard: IpdWardEventDTO[] = slots
    .filter((s) => (s.state === "given" || s.state === "missed" || s.state === "held") && Date.parse(s.scheduledAt) >= now.getTime() - 24 * HOUR)
    .sort((x, y) => y.scheduledAt.localeCompare(x.scheduledAt))
    .map((s) => ({ at: s.givenAt ?? s.scheduledAt, medicineName: s.medicineName, dosage: s.dosage, route: s.route, state: s.state as "given" | "missed" | "held", by: s.givenBy }));
  const missedAll = doseSlots(meds.rows, doseLog.rows, a.admission_date.slice(0, 10), today, now).filter((s) => s.state === "missed").length;

  const roundsToday = notes.rows.filter((n) => n.note_type === "Doctor Round" && n.note_date === today).length;
  const lastVitals = vitals.rows[0] ? toIpdVitalDTO(vitals.rows[0]) : null;
  const hasAdmissionConsent = consents.some((c) => /admission/i.test(c.templateKey) || /admission/i.test(c.formTitle));
  const allergyStatus = (a.allergy_status ?? "") as IpdOverviewDTO["allergyStatus"];

  const todo: IpdTodoDTO[] = [];
  const add = (key: string, text: string, tab: string) => todo.push({ key, text, tab });
  if (a.status !== "Discharged") {
    if (!allergyStatus) add("allergy", "Ask about allergies and record the answer", "summary");
    if (!lastVitals || now.getTime() - Date.parse(lastVitals.recordedAt) > 6 * HOUR) add("vitals", lastVitals ? `Take vitals — last set was ${new Date(lastVitals.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, ${new Date(lastVitals.recordedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}` : "Take the first set of vitals", "nursing");
    if (!a.primary_nurse) add("nurse", "Assign a primary nurse", "summary");
    if (!notes.rows.some((n) => n.note_date === today)) add("note", "No progress note written today", "rounds");
    if (roundsToday === 0) add("round", "No doctor round logged today", "rounds");
    if (!hasAdmissionConsent) add("consent", "Create the admission consent", "consents");
    if (missedAll > 0) add("missed", `${missedAll} missed ${missedAll === 1 ? "dose" : "doses"} with no record of being given`, "medicines");
    if (Number(a.deposit_amount ?? 0) <= 0) add("deposit", "No deposit taken yet", "summary");
  }

  const runningIv = ivs.rows.filter((i) => i.status === "Running").length;
  const dosesPending = live ? live.dosesDue : 0;
  return {
    admission: dto,
    live,
    allergyStatus,
    allergies: a.allergies ?? "",
    payer: a.payer || "Self pay",
    plannedDischargeDate: a.planned_discharge_date ?? null,
    dischargeStage: a.discharge_stage ?? "",
    stats: { dosesDue: live?.dosesDue ?? 0, ivRunning: runningIv, doctorVisitsToday: roundsToday, openOrders: live?.newOrders ?? 0, balanceDue, billed, deposit: Number(a.deposit_amount ?? 0) },
    onWard,
    todo,
    lastVitals,
    consents: { total: consents.length, signed: consents.filter((c) => c.status === "Signed").length, hasAdmission: hasAdmissionConsent },
    preauth: { total: forms.rows.length, ready: (forms.rows as { status: string }[]).filter((f) => f.status === "Ready").length },
    readiness: { ivRunning: runningIv, dosesPending, unbilledDoses: missedAll, balanceDue, admissionConsent: hasAdmissionConsent },
  };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const label = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

export async function getTimeline(admissionId: number, actor: Session): Promise<IpdTimelineDTO> {
  const a = await admission(admissionId, actor);
  const byAdm = [{ column: "admission_id", op: "eq" as const, value: a.id }];
  const now = new Date();
  const [meds, doseLog, ivs, vitals, notes, io, bills, forms] = await Promise.all([
    ipdMedicationsRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdDoseLogRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdIvLinesRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdVitalsRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdNotesRepo.listRows({ unpaged: true, filters: byAdm }),
    ipdIoRepo.listRows({ unpaged: true, filters: byAdm }),
    a.patient_id ? billsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: a.patient_id }] }, actor)) : Promise.resolve({ rows: [] as never[] }),
    a.patient_id ? preauthFormsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: a.patient_id }] }, actor)) : Promise.resolve({ rows: [] as never[] }),
  ]);
  const consents = a.patient_id ? await listPatientConsents(a.patient_id, actor) : [];
  const start = a.admission_date.slice(0, 10);
  const startAt = Date.parse(a.created_at) || Date.parse(`${start}T00:00:00Z`);

  const raw: Omit<IpdTimelineEventDTO, "sincePrevMin">[] = [
    { at: new Date(startAt).toISOString(), kind: "Admission", title: `Admitted (${a.admission_no || `ADM/${start.slice(0, 4)}/${String(a.id).padStart(5, "0")}`})`, detail: a.diagnosis, by: "" },
  ];
  for (const s of doseSlots(meds.rows, doseLog.rows, start, localDate(now), now)) {
    if (s.state === "given") raw.push({ at: s.givenAt ?? s.scheduledAt, kind: "Medication", title: `Given ${s.medicineName}${s.dosage ? ` ${s.dosage}` : ""}`, detail: s.route, by: s.givenBy ?? "" });
    else if (s.state === "held") raw.push({ at: s.givenAt ?? s.scheduledAt, kind: "Medication", title: `Held ${s.medicineName}`, detail: s.note, by: s.givenBy ?? "" });
    else if (s.state === "missed") raw.push({ at: s.scheduledAt, kind: "Medication", title: `Missed ${s.medicineName}${s.dosage ? ` ${s.dosage}` : ""}`, detail: "Not recorded within its window", by: "" });
  }
  for (const v of vitals.rows) raw.push({ at: v.recorded_at, kind: "Vitals", title: "Vitals", detail: [v.temp_c != null ? `${v.temp_c}°C` : null, v.pulse != null ? `P ${v.pulse}` : null, v.bp_systolic != null ? `BP ${v.bp_systolic}/${v.bp_diastolic}` : null, v.spo2 != null ? `SpO₂ ${v.spo2}` : null].filter(Boolean).join(" · "), by: v.recorded_by });
  for (const n of notes.rows) raw.push({ at: n.created_at, kind: "Note", title: n.note_type, detail: n.content.slice(0, 200), by: n.author });
  for (const i of ivs.rows) {
    raw.push({ at: i.started_at, kind: "IV", title: `IV started — ${i.fluid}`, detail: `${i.volume_ml} mL at ${i.rate_ml_hr} mL/hr`, by: i.started_by });
    if (i.stopped_at) raw.push({ at: i.stopped_at, kind: "IV", title: `IV ${i.status === "Completed" ? "completed" : "stopped"} — ${i.fluid}`, detail: "", by: "" });
  }
  for (const e of io.rows) raw.push({ at: e.recorded_at, kind: "Fluids", title: `${e.kind === "In" ? "Intake" : "Output"} — ${e.category}`, detail: `${e.amount_ml} mL`, by: e.recorded_by });
  for (const b of bills.rows as { type: string; bill_number: string; bill_date: string; total: number; status: string; created_at: string }[]) if (b.type === "IPD") raw.push({ at: b.created_at, kind: "Billing", title: `Bill ${b.bill_number}`, detail: `₹${Number(b.total).toLocaleString("en-IN")} · ${b.status}`, by: "" });
  for (const c of consents) raw.push({ at: c.madeAt, kind: "Consent", title: c.formTitle, detail: c.status, by: c.madeBy });
  for (const f of forms.rows as { form_name: string; status: string; created_at: string; created_by: string }[]) raw.push({ at: f.created_at, kind: "Insurance", title: `Pre-auth: ${f.form_name}`, detail: f.status, by: f.created_by });
  if (a.status === "Discharged") raw.push({ at: a.updated_at, kind: "Discharge", title: "Discharged", detail: "", by: "" });

  const sorted = raw.filter((e) => !Number.isNaN(Date.parse(e.at))).sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  let longest = 0, longestLabel = "";
  const events: IpdTimelineEventDTO[] = sorted.map((e, n) => {
    const prev = sorted[n - 1];
    const since = prev ? Math.max(0, Math.round((Date.parse(e.at) - Date.parse(prev.at)) / 60_000)) : null;
    if (since != null && since > longest && e.kind !== "Admission") { longest = since; longestLabel = e.title; }
    return { ...e, sincePrevMin: since };
  });
  const end = a.status === "Discharged" ? Date.parse(a.updated_at) : now.getTime();
  return { timeInHospitalMin: Math.max(0, Math.round((end - startAt) / 60_000)), longestWaitMin: longest, longestWaitLabel: longest ? `${label(longest)} before ${longestLabel}` : "", events: events.slice(-600).reverse() };
}
