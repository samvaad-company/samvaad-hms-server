/**
 * OPD service — patient check-in queue with token generation, vitals, and
 * consultation status transitions.
 */
import { opdRepo, patientsRepo, doctorsRepo } from "@/repositories";
import { toOpdDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type UnitOfWork } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import { type OpdVisitRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { ConflictError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { displayTime, nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
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

export const OPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "doctor", "token_number", "reason"],
  filterable: ["status", "doctor", "priority", "patient_id", "doctor_id", "appointment_id"],
  sortable: ["check_in_time", "token_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/** The highest token number issued per hospital, remembered so a check-in doesn't read the whole queue history. */
const lastToken = new Map<number, number>();

async function nextToken(actor: Session): Promise<string> {
  const hospital = actor.hospitalId ?? 0;
  let top = lastToken.get(hospital);
  if (top === undefined) {
    const seeded = nextCode((await opdRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows.map((r) => r.token_number), "T-", 3);
    top = Number.parseInt(seeded.slice(2), 10) - 1;
  }
  // Synchronous from here: two check-ins can't be handed the same number.
  const next = Math.max(lastToken.get(hospital) ?? 0, top) + 1;
  lastToken.set(hospital, next);
  return `T-${String(next).padStart(3, "0")}`;
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
    status: "Waiting",
  });
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
    if (data.status === "Completed") patch.wait_time = "—";
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

  const row = await opdRepo.update(id, patch);
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
