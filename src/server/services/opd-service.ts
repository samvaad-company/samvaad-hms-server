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

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  vitalsRecorded: { type: "boolean", required: false, default: false },
} as const;

const updateSchema = {
  status: { type: "enum", required: false, values: ["Waiting", "In Consultation", "Completed"] },
  vitalsRecorded: { type: "boolean", required: false },
  waitTime: { type: "string", required: false, max: 20 },
} as const;

export const OPD_LIST_CONFIG = {
  searchColumns: ["patient_name", "doctor", "token_number"],
  filterable: ["status", "doctor"],
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
    vitals_recorded: data.vitalsRecorded ?? false,
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
  if ("vitalsRecorded" in data) patch.vitals_recorded = data.vitalsRecorded;
  if ("waitTime" in data) patch.wait_time = data.waitTime;
  const row = await opdRepo.update(id, patch);
  await audit(actor, "update", "opd", id, patch);
  return toOpdDTO(row as OpdVisitRow);
}

export async function deleteOpd(id: number, actor: Session) {
  const ok = await opdRepo.remove(id);
  if (!ok) throw new NotFoundError("OPD visit");
  await audit(actor, "delete", "opd", id);
}
