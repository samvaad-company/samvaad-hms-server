/**
 * OPD service — patient check-in queue with token generation, vitals, and
 * consultation status transitions.
 */
import { opdRepo, patientsRepo, doctorsRepo } from "@/server/repositories";
import { toOpdDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type OpdVisitRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayTime, nextCode } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

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
  filterable: ["status", "doctor", "priority"],
  sortable: ["check_in_time", "token_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listOpd(options: QueryOptions) {
  return opdRepo.list(options);
}

export async function getOpd(id: number) {
  const o = await opdRepo.get(id);
  if (!o) throw new NotFoundError("OPD visit");
  return o;
}

export async function checkInOpd(input: unknown, actor: Session) {
  const data = validate(createSchema, input);

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

  const all = await opdRepo.listRows({ unpaged: true });
  const token = nextCode(
    all.rows.map((r) => r.token_number),
    "T-",
    3,
  );

  const row = await opdRepo.create({
    token_number: token,
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
  if (!existing) throw new NotFoundError("OPD visit");
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
  const ok = await opdRepo.remove(id);
  if (!ok) throw new NotFoundError("OPD visit");
  await audit(actor, "delete", "opd", id);
  await renumberTokens();
}

/**
 * Re-sequence tokens so the queue stays contiguous after a deletion
 * (T-001, T-002, … with no gaps). Ordered by check-in, i.e. row id.
 */
async function renumberTokens(): Promise<void> {
  const { rows } = await opdRepo.listRows({ unpaged: true });
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  for (let i = 0; i < ordered.length; i += 1) {
    const expected = `T-${String(i + 1).padStart(3, "0")}`;
    if (ordered[i].token_number !== expected) {
      await opdRepo.update(ordered[i].id, { token_number: expected });
    }
  }
}
