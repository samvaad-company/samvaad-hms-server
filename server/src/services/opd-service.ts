/**
 * OPD service — patient check-in queue with token generation, vitals, and
 * consultation status transitions.
 */
import { opdRepo, opdVitalsRepo, patientsRepo, doctorsRepo } from "@/repositories";
import { toOpdDTO, toOpdVitalDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type UnitOfWork } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import { type OpdVisitRow, type OpdVitalRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { allocateSequence } from "@/services/sequences";
import { localDate } from "@/lib/clock";
import { displayTime, nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { readingTime } from "@/services/nurse-station-service";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

export const OPD_PRIORITIES = ["Normal", "Urgent", "Emergency"] as const;

/** Clinical vitals, shared by check-in and update. Ranges are sanity bounds. */
const vitalsSchema = {
  bpSystolic: { type: "number", required: false, min: 40, max: 300 },
  bpDiastolic: { type: "number", required: false, min: 20, max: 200 },
  pulse: { type: "number", required: false, min: 20, max: 250 },
  temperature: { type: "number", required: false, min: 90, max: 110 },
  spo2: { type: "number", required: false, min: 50, max: 100 },
} as const;

const createSchema = {
  appointmentId: { type: "number", required: false },
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  reason: { type: "string", required: false, max: 240, default: "" },
  priority: { type: "enum", required: false, values: OPD_PRIORITIES, default: "Normal" },
  vitalsRecorded: { type: "boolean", required: false, default: false },
  ...vitalsSchema,
} as const;

const updateSchema = {
  status: { type: "enum", required: false, values: ["Waiting", "In Consultation", "Completed"] },
  doctorId: { type: "number", required: false },
  reason: { type: "string", required: false, max: 240 },
  priority: { type: "enum", required: false, values: OPD_PRIORITIES },
  vitalsRecorded: { type: "boolean", required: false },
  waitTime: { type: "string", required: false, max: 20 },
  ...vitalsSchema,
} as const;

/** True when at least one vitals reading was supplied. */
function hasAnyVital(d: Record<string, unknown>): boolean {
  return ["bpSystolic", "bpDiastolic", "pulse", "temperature", "spo2"].some(
    (k) => d[k] !== undefined && d[k] !== null,
  );
}

const READINGS = ["bpSystolic", "bpDiastolic", "pulse", "temperature", "spo2"] as const;
const READING_COLUMN = { bpSystolic: "bp_systolic", bpDiastolic: "bp_diastolic", pulse: "pulse", temperature: "temperature", spo2: "spo2" } as const;

/** Keeps one set of readings in the visit's vitals log. A patient's vitals can be taken as many times as needed, in a visit or in a day. */
async function logVitals(visit: OpdVisitRow, readings: Partial<Record<(typeof READINGS)[number], number | null>>, note: string, actor: Session, at?: string) {
  const row = await opdVitalsRepo.create({
    hospital_id: visit.hospital_id,
    visit_id: visit.id,
    patient_id: visit.patient_id ?? null,
    recorded_at: at ?? new Date().toISOString(),
    bp_systolic: readings.bpSystolic ?? null,
    bp_diastolic: readings.bpDiastolic ?? null,
    pulse: readings.pulse ?? null,
    temperature: readings.temperature ?? null,
    spo2: readings.spo2 ?? null,
    note,
    recorded_by: actor.name,
  });
  return row as OpdVitalRow;
}

export const OPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "doctor", "token_number", "reason"],
  filterable: ["status", "doctor", "priority", "patient_id", "doctor_id", "appointment_id"],
  sortable: ["check_in_time", "token_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/** The next token (T-001…) from the hospital's shared counter, so a check-in doesn't read the whole queue history and two API processes never issue the same token. */
async function nextToken(actor: Session): Promise<string> {
  const scan = async () => Number.parseInt(nextCode((await opdRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows.map((r) => r.token_number), "T-", 3).slice(2), 10) - 1;
  const { value } = await allocateSequence(`${actor.hospitalId ?? 0}|opd-token`, scan);
  return `T-${String(value).padStart(3, "0")}`;
}

export async function listOpd(options: QueryOptions, actor: Session) {
  return opdRepo.list(
    scopeToHospital(scopeToOwnDoctor(options, actor, "doctor_id"), actor),
  );
}

export async function getOpd(id: number, actor: Session) {
  const row = await opdRepo.getRow(id);
  assertOwnedByHospital(row, actor, "OPD visit");
  return toOpdDTO(row);
}

/**
 * Check a patient into the OPD queue.
 *
 * Accepts an optional unit of work so a caller (e.g. checking in a booked
 * appointment) can enlist this write in its own transaction; when omitted the
 * insert is standalone.
 */
export async function checkInOpd(
  input: unknown,
  actor: Session,
  uow?: UnitOfWork,
) {
  const data = validate(createSchema, input);
  // One live token per patient per doctor: two clerks checking in the same person must not both get one.
  if (data.patientId && data.doctorId) {
    return withKeyLocks([`opd:${actor.hospitalId}:${data.patientId}:${data.doctorId}`], () => checkInLocked(data, actor, uow));
  }
  return checkInLocked(data, actor, uow);
}

async function checkInLocked(
  data: ReturnType<typeof validate<typeof createSchema>>,
  actor: Session,
  uow?: UnitOfWork,
) {
  if (data.patientId && data.doctorId) {
    const today = localDate();
    const mine = await opdRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: data.patientId }] }, actor));
    const live = (mine.rows as OpdVisitRow[]).find((v) => v.doctor_id === data.doctorId && v.status !== "Completed" && localDate(new Date(v.created_at)) === today);
    if (live) throw new ConflictError(`${live.patient_name} is already in the queue for this doctor (token ${live.token_number})`);
  }

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }
  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    if (d) doctorName = d.name;
  }

  const token = await nextToken(actor);

  const create = uow
    ? (values: Record<string, unknown>) => uow.insert<OpdVisitRow>(TABLES.opdVisits, values)
    : (values: Record<string, unknown>) => opdRepo.create(values);

  const row = await create({
    hospital_id: actor.hospitalId,
    token_number: token,
    appointment_id: data.appointmentId ?? null,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    reason: data.reason ?? "",
    priority: data.priority ?? "Normal",
    // Recorded when the flag is set OR any reading was actually entered.
    vitals_recorded: (data.vitalsRecorded ?? false) || hasAnyVital(data),
    bp_systolic: data.bpSystolic ?? null,
    bp_diastolic: data.bpDiastolic ?? null,
    pulse: data.pulse ?? null,
    temperature: data.temperature ?? null,
    spo2: data.spo2 ?? null,
    wait_time: "0 min",
    check_in_time: displayTime(),
    check_in_at: new Date().toISOString(),
    check_out_time: "",
    check_out_at: null,
    status: "Waiting",
  });
  if (hasAnyVital(data)) await logVitals(row as OpdVisitRow, data, "At check-in", actor);
  await audit(actor, "checkin", "opd", row.id, { token });
  return toOpdDTO(row as OpdVisitRow);
}

export async function updateOpd(id: number, input: unknown, actor: Session) {
  const existing = await opdRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OPD visit");
  const data = validatePartial(updateSchema, input);
  const patch: Record<string, unknown> = {};
  if ("status" in data) {
    patch.status = data.status;
    if (data.status === "Completed") {
      patch.wait_time = "—";
      // Checked out now — unless the visit already has a check-out (set again only if it was reopened in between).
      if (!existing.check_out_at) { const now = new Date(); patch.check_out_at = now.toISOString(); patch.check_out_time = displayTime(now); }
    } else if (existing.check_out_at || existing.check_out_time) {
      // Reopened: it has not left yet.
      patch.check_out_at = null; patch.check_out_time = "";
    }
  }
  if ("doctorId" in data) {
    patch.doctor_id = data.doctorId ?? null;
    const d = data.doctorId ? await doctorsRepo.getRow(data.doctorId) : null;
    patch.doctor = d?.name ?? existing.doctor;
  }
  if ("reason" in data) patch.reason = data.reason;
  if ("priority" in data) patch.priority = data.priority;
  if ("vitalsRecorded" in data) patch.vitals_recorded = data.vitalsRecorded;
  if ("waitTime" in data) patch.wait_time = data.waitTime;
  if ("bpSystolic" in data) patch.bp_systolic = data.bpSystolic;
  if ("bpDiastolic" in data) patch.bp_diastolic = data.bpDiastolic;
  if ("pulse" in data) patch.pulse = data.pulse;
  if ("temperature" in data) patch.temperature = data.temperature;
  if ("spo2" in data) patch.spo2 = data.spo2;
  // Entering any reading implicitly marks vitals as recorded.
  if (hasAnyVital(data) && !("vitalsRecorded" in data)) patch.vitals_recorded = true;

  // New readings (different from what the visit already holds) are added to the vitals log rather than lost when the latest is overwritten.
  const changed = READINGS.some((k) => k in data && data[k] != null && data[k] !== existing[READING_COLUMN[k]]);
  const row = await opdRepo.update(id, patch);
  if (changed) {
    const merged: Partial<Record<(typeof READINGS)[number], number | null>> = {};
    for (const k of READINGS) merged[k] = (k in data ? data[k] : existing[READING_COLUMN[k]]) ?? null;
    await logVitals(row as OpdVisitRow, merged, "", actor);
  }
  await audit(actor, "update", "opd", id, patch);
  return toOpdDTO(row as OpdVisitRow);
}

export async function deleteOpd(id: number, actor: Session) {
  const existing = await opdRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OPD visit");
  await opdRepo.remove(id);
  await audit(actor, "delete", "opd", id);
  await renumberTokens(actor);
}

/**
 * Re-sequence tokens so the queue stays contiguous after a deletion
 * (T-001, T-002, … with no gaps). Ordered by check-in, i.e. row id.
 */
async function renumberTokens(actor: Session): Promise<void> {
  const { rows } = await opdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  for (let i = 0; i < ordered.length; i += 1) {
    const expected = `T-${String(i + 1).padStart(3, "0")}`;
    if (ordered[i].token_number !== expected) {
      await opdRepo.update(ordered[i].id, { token_number: expected });
    }
  }
}

// ── Vitals log: any number of readings per visit and per day ────────────────

const newVitalsSchema = {
  bpSystolic: { type: "number", required: false, min: 40, max: 300 },
  bpDiastolic: { type: "number", required: false, min: 20, max: 200 },
  pulse: { type: "number", required: false, min: 20, max: 250 },
  temperature: { type: "number", required: false, min: 90, max: 110 },
  spo2: { type: "number", required: false, min: 50, max: 100 },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

/**
 * Adds vitals to a visit and never replaces an earlier set. Send one set, or `readings: [...]` to add several at once (each may carry its
 * own `recordedAt`); the whole batch is checked first, so either every set is saved or none is. The visit shows its newest set.
 */
export async function recordOpdVitals(visitId: number, input: unknown, actor: Session) {
  const visit = await opdRepo.getRow(visitId);
  assertOwnedByHospital(visit, actor, "OPD visit");
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const many = Array.isArray(body.readings);
  const sets = many ? (body.readings as unknown[]) : [body];
  if (many && (sets.length === 0 || sets.length > 24)) throw new BadRequestError("Add between 1 and 24 sets of vitals at a time");
  const parsed = sets.map((one) => {
    const raw = (typeof one === "object" && one !== null ? one : {}) as Record<string, unknown>;
    const data = validate(newVitalsSchema, raw);
    if (!hasAnyVital(data)) throw new BadRequestError("Enter at least one reading");
    if ((data.bpSystolic == null) !== (data.bpDiastolic == null)) throw new BadRequestError("Enter both parts of the blood pressure");
    if (data.bpSystolic != null && data.bpDiastolic != null && data.bpDiastolic >= data.bpSystolic) throw new BadRequestError("Diastolic pressure must be lower than systolic");
    return { data, at: readingTime(raw.recordedAt) };
  });
  const out: OpdVitalRow[] = [];
  for (const { data, at } of parsed) out.push(await logVitals(visit as OpdVisitRow, data, data.note ?? "", actor, at));
  // The visit shows its newest set, whichever order they were entered in.
  const newest = [...out].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  const { rows: all } = await opdVitalsRepo.listRows({ unpaged: true, filters: [{ column: "visit_id", op: "eq", value: visitId }], sort: [{ column: "recorded_at", direction: "desc" }] });
  if (all[0]?.id === newest.id) {
    const patch: Record<string, unknown> = { vitals_recorded: true };
    for (const k of READINGS) { const v = newest[READING_COLUMN[k]]; if (v != null) patch[READING_COLUMN[k]] = v; }
    await opdRepo.update(visitId, patch);
  } else {
    await opdRepo.update(visitId, { vitals_recorded: true });
  }
  await audit(actor, "vitals", "opd", visitId, out.length > 1 ? { sets: out.length } : undefined);
  return many ? out.map(toOpdVitalDTO) : toOpdVitalDTO(out[0]);
}

/** Every set of vitals taken at one visit, newest first. */
export async function listOpdVitals(visitId: number, actor: Session) {
  const visit = await opdRepo.getRow(visitId);
  assertOwnedByHospital(visit, actor, "OPD visit");
  const { rows } = await opdVitalsRepo.listRows({ unpaged: true, filters: [{ column: "visit_id", op: "eq", value: visitId }], sort: [{ column: "recorded_at", direction: "desc" }] });
  // A visit whose vitals were taken before readings were logged one by one: show the set it holds as its first reading.
  if (rows.length === 0 && hasAnyVital({ bpSystolic: visit.bp_systolic, bpDiastolic: visit.bp_diastolic, pulse: visit.pulse, temperature: visit.temperature, spo2: visit.spo2 })) {
    return [toOpdVitalDTO({ id: -visit.id, hospital_id: visit.hospital_id, visit_id: visit.id, patient_id: visit.patient_id, recorded_at: visit.created_at, bp_systolic: visit.bp_systolic, bp_diastolic: visit.bp_diastolic, pulse: visit.pulse, temperature: visit.temperature, spo2: visit.spo2, note: "Earlier reading", recorded_by: "", created_at: visit.created_at, updated_at: visit.updated_at })];
  }
  return rows.map(toOpdVitalDTO);
}

/** A patient's vitals across all their visits, newest first. */
export async function listPatientVitals(patientId: number, actor: Session) {
  const { rows } = await opdVitalsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }], sort: [{ column: "recorded_at", direction: "desc" }] }, actor));
  return rows.map(toOpdVitalDTO);
}
