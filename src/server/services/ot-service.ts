/**
 * Operating Theatre service — surgery scheduling and status transitions.
 */
import { otRepo, patientsRepo, doctorsRepo } from "@/server/repositories";
import { toOtDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type OtScheduleRow } from "@/server/db/tables";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToOwnDoctor } from "@/server/services/doctor-scope";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  procedure: { type: "string", required: true, min: 2, max: 160 },
  otRoom: { type: "string", required: false, max: 60, default: "OT-1" },
  surgeonId: { type: "number", required: false },
  surgeon: { type: "string", required: false, max: 120, default: "" },
  anesthetist: { type: "string", required: false, max: 120, default: "" },
  scheduledDate: { type: "string", required: true, max: 40 },
  scheduledTime: { type: "string", required: true, max: 20 },
  status: {
    type: "enum",
    required: false,
    values: ["Scheduled", "In Progress", "Completed", "Cancelled"],
    default: "Scheduled",
  },
} as const;

export const OT_LIST_CONFIG = {
  searchColumns: ["patient_name", "procedure", "surgeon", "ot_room"],
  filterable: ["status", "ot_room"],
  sortable: ["scheduled_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listOt(options: QueryOptions, actor: Session) {
  return otRepo.list(
    scopeToHospital(scopeToOwnDoctor(options, actor, "surgeon_id"), actor),
  );
}

export async function getOt(id: number, actor: Session) {
  const row = await otRepo.getRow(id);
  assertOwnedByHospital(row, actor, "OT schedule");
  return toOtDTO(row);
}

export async function scheduleOt(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }
  let surgeon = data.surgeon ?? "";
  if (data.surgeonId) {
    const d = await doctorsRepo.getRow(data.surgeonId);
    if (d) surgeon = d.name;
  }
  const row = await otRepo.create({
    hospital_id: actor.hospitalId,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    procedure: data.procedure,
    ot_room: data.otRoom,
    surgeon_id: data.surgeonId ?? null,
    surgeon,
    anesthetist: data.anesthetist,
    scheduled_date: data.scheduledDate,
    scheduled_time: data.scheduledTime,
    status: data.status,
  });
  await audit(actor, "schedule", "ot", row.id);
  return toOtDTO(row as OtScheduleRow);
}

export async function updateOt(id: number, input: unknown, actor: Session) {
  const existing = await otRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OT schedule");
  const data = validatePartial(createSchema, input);
  const patch: Record<string, unknown> = {};
  if ("procedure" in data) patch.procedure = data.procedure;
  if ("otRoom" in data) patch.ot_room = data.otRoom;
  if ("anesthetist" in data) patch.anesthetist = data.anesthetist;
  if ("scheduledDate" in data) patch.scheduled_date = data.scheduledDate;
  if ("scheduledTime" in data) patch.scheduled_time = data.scheduledTime;
  if ("status" in data) patch.status = data.status;
  if ("surgeonId" in data) {
    patch.surgeon_id = data.surgeonId ?? null;
    const d = data.surgeonId ? await doctorsRepo.getRow(data.surgeonId) : null;
    patch.surgeon = d?.name ?? existing.surgeon;
  }
  const row = await otRepo.update(id, patch);
  await audit(actor, "update", "ot", id, patch);
  return toOtDTO(row as OtScheduleRow);
}

export async function deleteOt(id: number, actor: Session) {
  const existing = await otRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OT schedule");
  await otRepo.remove(id);
  await audit(actor, "delete", "ot", id);
}
