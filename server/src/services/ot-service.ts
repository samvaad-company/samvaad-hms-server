/**
 * Operating Theatre — booking surgeries into theatres, with the team and equipment they need.
 *
 * Booking rules:
 *   - A theatre and the equipment are held for the surgery plus a 15-minute turnaround after it; a surgeon,
 *     co-surgeon or anaesthetist cannot be in two surgeries at once. A booking that clashes is refused with what
 *     it clashes with, unless the booker explicitly allows overlap.
 *   - Equipment that is out for maintenance cannot be booked at all — allowing overlap does not change that.
 *   - Anaesthetic fitness never blocks booking, only starting: a surgery can be started once the patient is
 *     recorded Fit (an emergency can start without it). Unfit blocks the start, emergency or not.
 *   - Starting records the time; completing records it again, so the register shows the real duration.
 */
import { otRepo, patientsRepo, doctorsRepo, staffRepo, otRoomsRepo, otEquipmentRepo } from "@/repositories";
import { toOtDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type OtScheduleRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { parseClock, hhmm } from "@/lib/clock";
import { isoDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToOwnDoctor } from "@/services/doctor-scope";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { OT_ANAESTHESIA_TYPES, type OtConflictDTO, type OtRecordDTO } from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

/** Minutes a theatre and its equipment stay unavailable after a surgery, for cleaning and set-up. */
export const TURNAROUND_MIN = 15;

export const CASE_TYPES = ["Elective", "Emergency", "Outdoor"] as const;
export const CATEGORIES = ["Major", "Minor", "Daycare"] as const;
export const FITNESS = ["Pending", "Fit", "Unfit"] as const;
export const OT_STATUSES = ["Scheduled", "In Progress", "Completed", "Cancelled"] as const;

/** A list of ids from the request body (the validator only handles scalars). undefined when the key is absent. */
function readIds(raw: Record<string, unknown>, key: string, max: number): number[] | undefined {
  if (!(key in raw) || raw[key] == null) return undefined;
  const v = raw[key];
  if (!Array.isArray(v) || v.length > max || !v.every((x) => Number.isInteger(x) && x > 0)) {
    throw new ValidationError([{ field: key, message: `must be a list of up to ${max} ids` }]);
  }
  return [...new Set(v as number[])];
}

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  // The free-text description. The register's name for the surgery is `surgeryName`; either one is enough.
  procedure: { type: "string", required: false, max: 160, default: "" },
  surgeryName: { type: "string", required: false, max: 160, default: "" },
  caseType: { type: "enum", required: false, values: CASE_TYPES, default: "Elective" },
  category: { type: "enum", required: false, values: CATEGORIES, default: "Major" },
  procedureCode: { type: "string", required: false, max: 40, default: "" },
  otRoom: { type: "string", required: false, max: 60, default: "" },
  roomId: { type: "number", required: false, min: 1 },
  durationMin: { type: "number", required: false, min: 15, max: 720, default: 60 },
  surgeonId: { type: "number", required: false },
  surgeon: { type: "string", required: false, max: 120, default: "" },
  coSurgeonId: { type: "number", required: false, min: 1 },
  anesthetistId: { type: "number", required: false, min: 1 },
  anesthetist: { type: "string", required: false, max: 120, default: "" },
  anaesthesiaType: { type: "enum", required: false, values: OT_ANAESTHESIA_TYPES },
  scrubNurseId: { type: "number", required: false, min: 1 },
  circulatingNurseId: { type: "number", required: false, min: 1 },
  specialRequirements: { type: "string", required: false, max: 1000, default: "" },
  allowOverlap: { type: "boolean", required: false, default: false },
  scheduledDate: { type: "string", required: true, max: 40 },
  scheduledTime: { type: "string", required: true, max: 20 },
  status: { type: "enum", required: false, values: OT_STATUSES, default: "Scheduled" },
  fitness: { type: "enum", required: false, values: FITNESS },
} as const;

export const OT_LIST_CONFIG = {
  searchColumns: ["patient_name", "procedure", "surgery_name", "surgeon", "ot_room", "booking_no"],
  filterable: ["status", "ot_room", "room_id", "scheduled_date", "case_type"],
  sortable: ["scheduled_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

/** The patient's hospital ID isn't copied onto the booking, so it is joined in for display. */
async function withPatientCode(rows: OtRecordDTO[]): Promise<OtRecordDTO[]> {
  const ids = [...new Set(rows.map((r) => r.patientId).filter((v): v is number => v != null))];
  const patients = await Promise.all(ids.map((id) => patientsRepo.getRow(id)));
  const code = new Map(patients.filter((p) => p != null).map((p) => [p.id, p.patient_code]));
  return rows.map((r) => ({ ...r, patientCode: r.patientId != null ? (code.get(r.patientId) ?? null) : null }));
}

export async function listOt(options: QueryOptions, actor: Session) {
  const res = await otRepo.list(scopeToHospital(scopeToOwnDoctor(options, actor, "surgeon_id"), actor));
  return { ...res, rows: await withPatientCode(res.rows) };
}

export async function getOt(id: number, actor: Session) {
  const row = await otRepo.getRow(id);
  assertOwnedByHospital(row, actor, "OT schedule");
  return (await withPatientCode([toOtDTO(row)]))[0];
}

// ── Conflicts ────────────────────────────────────────────────────────────────

export interface SlotInput {
  date: string;
  time: string;
  durationMin: number;
  roomId?: number | null;
  roomName?: string;
  doctorIds: number[];
  equipmentIds: number[];
  /** A booking being edited — it doesn't clash with itself. */
  excludeId?: number;
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;
const span = (start: number, end: number) => `${hhmm(start)}–${hhmm(end % 1440)}`;

/** Everything the proposed slot clashes with: the theatre, the people, the equipment. */
export async function findConflicts(slot: SlotInput, actor: Session): Promise<OtConflictDTO[]> {
  const start = parseClock(slot.time);
  if (start == null) return [];
  const end = start + slot.durationMin;
  const { rows } = await otRepo.listRows(
    scopeToHospital({ unpaged: true, filters: [{ column: "scheduled_date", op: "eq", value: slot.date }] }, actor),
  );
  const equipment = new Map((await otEquipmentRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows.map((e) => [e.id, e.name]));
  const out: OtConflictDTO[] = [];

  for (const b of rows) {
    if (b.id === slot.excludeId || b.status === "Cancelled") continue;
    const bStart = parseClock(b.scheduled_time);
    if (bStart == null) continue;
    const bEnd = bStart + (Number(b.duration_min) > 0 ? Number(b.duration_min) : 60);
    const who = `${b.surgery_name || b.procedure} (${b.patient_name})`;

    // Theatre and equipment are held through the turnaround, so a surgery can't start inside it.
    const held = overlaps(start, end + TURNAROUND_MIN, bStart, bEnd + TURNAROUND_MIN);
    const sameRoom = (slot.roomId != null && b.room_id === slot.roomId) || (slot.roomId == null && slot.roomName && b.ot_room === slot.roomName);
    if (held && sameRoom) {
      out.push({ kind: "room", bookingId: b.id, message: `${b.ot_room || "This theatre"} is booked ${span(bStart, bEnd)} for ${who}, plus ${TURNAROUND_MIN} min turnaround` });
    }
    if (held) {
      for (const id of (b.equipment_ids ?? []).filter((e) => slot.equipmentIds.includes(e))) {
        out.push({ kind: "equipment", bookingId: b.id, refId: id, message: `${equipment.get(id) ?? "Equipment"} is in use ${span(bStart, bEnd)} for ${who}` });
      }
    }
    // People can't be in two places, but need no turnaround.
    if (overlaps(start, end, bStart, bEnd)) {
      const busy = [b.surgeon_id, b.co_surgeon_id, b.anesthetist_id].filter((v): v is number => v != null);
      const names: Record<number, string> = {};
      if (b.surgeon_id) names[b.surgeon_id] = b.surgeon;
      if (b.co_surgeon_id) names[b.co_surgeon_id] = b.co_surgeon ?? "";
      if (b.anesthetist_id) names[b.anesthetist_id] = b.anesthetist;
      for (const id of [...new Set(slot.doctorIds.filter((d) => busy.includes(d)))]) {
        out.push({ kind: "surgeon", bookingId: b.id, refId: id, message: `${names[id] || "A team member"} is already in ${who} ${span(bStart, bEnd)}` });
      }
    }
  }
  return out;
}

async function equipmentOffline(ids: number[], actor: Session): Promise<string[]> {
  if (ids.length === 0) return [];
  const { rows } = await otEquipmentRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const known = new Map(rows.map((e) => [e.id, e]));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length) throw new ValidationError([{ field: "equipmentIds", message: "includes equipment that doesn't exist" }]);
  return ids.map((id) => known.get(id)!).filter((e) => e.status === "Maintenance").map((e) => e.name);
}

// ── Team lookups ─────────────────────────────────────────────────────────────

async function doctorName(id: number | undefined | null, actor: Session, field: string): Promise<string> {
  if (!id) return "";
  const d = await doctorsRepo.getRow(id);
  if (!d || (actor.hospitalId != null && d.hospital_id !== actor.hospitalId)) throw new ValidationError([{ field, message: "isn't a doctor at this hospital" }]);
  return d.name;
}

async function staffName(id: number | undefined | null, actor: Session, field: string): Promise<string> {
  if (!id) return "";
  const s = await staffRepo.getRow(id);
  if (!s || (actor.hospitalId != null && s.hospital_id !== actor.hospitalId)) throw new ValidationError([{ field, message: "isn't staff at this hospital" }]);
  return s.name;
}

async function resolveRoom(roomId: number | undefined, roomName: string | undefined, actor: Session): Promise<{ id: number | null; name: string }> {
  if (roomId) {
    const room = await otRoomsRepo.getRow(roomId);
    assertOwnedByHospital(room, actor, "Theatre");
    if (room.active === false) throw new ConflictError(`${room.name} is switched off`);
    return { id: room.id, name: room.name };
  }
  return { id: null, name: roomName ?? "" };
}

// ── Booking ──────────────────────────────────────────────────────────────────

async function nextBookingNo(date: string, actor: Session): Promise<string> {
  const prefix = `OT/${date.slice(0, 4)}/`;
  const { rows } = await otRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  return nextNumber("ot", actor, rows.map((r) => r.booking_no ?? ""), { prefix, pad: 4 }, { now: new Date(`${date}T12:00:00`) });
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function requireSlot(date: string, time: string) {
  if (!ISO_DAY.test(date)) throw new ValidationError([{ field: "scheduledDate", message: "must be a date (yyyy-mm-dd)" }]);
  if (parseClock(time) == null) throw new ValidationError([{ field: "scheduledTime", message: "must be a time like 09:30" }]);
}

export async function scheduleOt(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  const hospitalId = requireHospitalId(actor);
  const date = isoDate(data.scheduledDate);
  requireSlot(date, data.scheduledTime);
  const surgeryName = data.surgeryName || data.procedure;
  if (surgeryName.trim().length < 2) throw new ValidationError([{ field: "surgeryName", message: "is required" }]);

  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    assertOwnedByHospital(p, actor, "Patient");
    patientName = p.name;
  }
  const room = await resolveRoom(data.roomId, data.otRoom, actor);
  if (!room.name) throw new ValidationError([{ field: "roomId", message: "pick a theatre" }]);
  const surgeon = (await doctorName(data.surgeonId, actor, "surgeonId")) || data.surgeon;
  const coSurgeon = await doctorName(data.coSurgeonId, actor, "coSurgeonId");
  const anesthetist = (await doctorName(data.anesthetistId, actor, "anesthetistId")) || data.anesthetist;
  const scrub = await staffName(data.scrubNurseId, actor, "scrubNurseId");
  const circulating = await staffName(data.circulatingNurseId, actor, "circulatingNurseId");
  const raw = (input ?? {}) as Record<string, unknown>;
  const techIds = readIds(raw, "technicianIds", 3) ?? [];
  const technicians = await Promise.all(techIds.map((id) => staffName(id, actor, "technicianIds")));
  const equipmentIds = readIds(raw, "equipmentIds", 30) ?? [];

  const offline = await equipmentOffline(equipmentIds, actor);
  if (offline.length) throw new ConflictError(`${offline.join(", ")} ${offline.length === 1 ? "is" : "are"} out for maintenance and can't be booked`);
  if (!data.allowOverlap) {
    const conflicts = await findConflicts(
      { date, time: data.scheduledTime, durationMin: data.durationMin ?? 60, roomId: room.id, roomName: room.name, doctorIds: [data.surgeonId, data.coSurgeonId, data.anesthetistId].filter((v): v is number => Boolean(v)), equipmentIds },
      actor,
    );
    if (conflicts.length) throw new ConflictError(`${conflicts.map((c) => c.message).join("; ")}. Allow overlap to book anyway.`);
  }

  const equipmentNames = (await otEquipmentRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows.filter((e) => equipmentIds.includes(e.id)).map((e) => e.name);
  const row = await otRepo.create({
    hospital_id: hospitalId,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    procedure: data.procedure || surgeryName,
    surgery_name: surgeryName,
    case_type: data.caseType,
    category: data.category,
    procedure_code: data.procedureCode,
    ot_room: room.name,
    room_id: room.id,
    duration_min: data.durationMin ?? 60,
    surgeon_id: data.surgeonId ?? null,
    surgeon,
    co_surgeon_id: data.coSurgeonId ?? null,
    co_surgeon: coSurgeon,
    anesthetist_id: data.anesthetistId ?? null,
    anesthetist,
    anaesthesia_type: data.anaesthesiaType ?? "",
    scrub_nurse_id: data.scrubNurseId ?? null,
    scrub_nurse: scrub,
    circulating_nurse_id: data.circulatingNurseId ?? null,
    circulating_nurse: circulating,
    technician_ids: techIds,
    technicians,
    equipment_ids: equipmentIds,
    equipment: equipmentNames,
    special_requirements: data.specialRequirements,
    allow_overlap: data.allowOverlap,
    fitness: data.fitness ?? "Pending",
    booking_no: await nextBookingNo(date, actor),
    scheduled_date: date,
    scheduled_time: data.scheduledTime,
    status: data.status,
    started_at: null,
    ended_at: null,
  });
  await audit(actor, "schedule", "ot", row.id, { bookingNo: (row as OtScheduleRow).booking_no });
  return (await withPatientCode([toOtDTO(row as OtScheduleRow)]))[0];
}

/** Check a slot without booking it — the Book dialog shows these as you pick. */
export async function previewConflicts(input: unknown, actor: Session): Promise<{ conflicts: OtConflictDTO[]; offline: string[] }> {
  const b = (input ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  const date = isoDate(String(b.scheduledDate ?? ""));
  const time = String(b.scheduledTime ?? "");
  if (!ISO_DAY.test(date) || parseClock(time) == null) return { conflicts: [], offline: [] };
  const equipmentIds = (Array.isArray(b.equipmentIds) ? b.equipmentIds : []).map(num).filter((v): v is number => v != null);
  const room = num(b.roomId) ? await resolveRoom(num(b.roomId), undefined, actor).catch(() => ({ id: null, name: "" })) : { id: null, name: "" };
  const conflicts = await findConflicts(
    {
      date, time, durationMin: Math.min(720, Math.max(15, num(b.durationMin) ?? 60)), roomId: room.id, roomName: room.name,
      doctorIds: [num(b.surgeonId), num(b.coSurgeonId), num(b.anesthetistId)].filter((v): v is number => v != null),
      equipmentIds, excludeId: num(b.excludeId),
    },
    actor,
  );
  return { conflicts, offline: await equipmentOffline(equipmentIds, actor).catch(() => []) };
}

// ── Update / status ──────────────────────────────────────────────────────────

export async function updateOt(id: number, input: unknown, actor: Session) {
  const existing = await otRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OT schedule");
  const data = validatePartial(createSchema, input);
  const raw = (input ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("procedure" in data) patch.procedure = data.procedure;
  if ("surgeryName" in data) patch.surgery_name = data.surgeryName;
  if ("caseType" in data) patch.case_type = data.caseType;
  if ("category" in data) patch.category = data.category;
  if ("procedureCode" in data) patch.procedure_code = data.procedureCode;
  if ("anaesthesiaType" in data) patch.anaesthesia_type = data.anaesthesiaType ?? "";
  if ("specialRequirements" in data) patch.special_requirements = data.specialRequirements;
  if ("fitness" in data) patch.fitness = data.fitness;
  if ("anesthetist" in data) patch.anesthetist = data.anesthetist;
  // Nurses and technicians don't affect clashes, so they are simply updated. `null` clears one.
  if ("scrubNurseId" in raw) { patch.scrub_nurse_id = data.scrubNurseId ?? null; patch.scrub_nurse = await staffName(data.scrubNurseId, actor, "scrubNurseId"); }
  if ("circulatingNurseId" in raw) { patch.circulating_nurse_id = data.circulatingNurseId ?? null; patch.circulating_nurse = await staffName(data.circulatingNurseId, actor, "circulatingNurseId"); }
  const techs = readIds(raw, "technicianIds", 3);
  if (techs) { patch.technician_ids = techs; patch.technicians = await Promise.all(techs.map((t) => staffName(t, actor, "technicianIds"))); }

  // Anything that moves the surgery or changes who and what it needs gets the conflict check again.
  const moving = ["scheduledDate", "scheduledTime", "durationMin", "roomId", "otRoom", "surgeonId", "coSurgeonId", "anesthetistId", "equipmentIds"].some((k) => k in raw);
  if (moving) {
    if (existing.status === "Completed" || existing.status === "Cancelled") throw new ConflictError(`A ${existing.status.toLowerCase()} surgery can't be changed`);
    const date = "scheduledDate" in data ? isoDate(data.scheduledDate as string) : existing.scheduled_date;
    const time = "scheduledTime" in data ? (data.scheduledTime as string) : existing.scheduled_time;
    requireSlot(date, time);
    const durationMin = "durationMin" in data ? (data.durationMin as number) : Number(existing.duration_min) || 60;
    const room = "roomId" in data || "otRoom" in data
      ? await resolveRoom(data.roomId, data.otRoom, actor)
      : { id: existing.room_id ?? null, name: existing.ot_room };
    const surgeonId = "surgeonId" in data ? (data.surgeonId ?? null) : existing.surgeon_id;
    const coId = "coSurgeonId" in raw ? (data.coSurgeonId ?? null) : (existing.co_surgeon_id ?? null);
    const anId = "anesthetistId" in raw ? (data.anesthetistId ?? null) : (existing.anesthetist_id ?? null);
    const newEquipment = readIds(raw, "equipmentIds", 30);
    const equipmentIds = newEquipment ?? (existing.equipment_ids ?? []);
    const offline = await equipmentOffline(equipmentIds.filter((e) => !(existing.equipment_ids ?? []).includes(e)), actor);
    if (offline.length) throw new ConflictError(`${offline.join(", ")} ${offline.length === 1 ? "is" : "are"} out for maintenance and can't be booked`);
    const overlapOk = "allowOverlap" in data ? Boolean(data.allowOverlap) : Boolean(existing.allow_overlap);
    if (!overlapOk) {
      const conflicts = await findConflicts(
        { date, time, durationMin, roomId: room.id, roomName: room.name, doctorIds: [surgeonId, coId, anId].filter((v): v is number => v != null), equipmentIds, excludeId: id },
        actor,
      );
      if (conflicts.length) throw new ConflictError(`${conflicts.map((c) => c.message).join("; ")}. Allow overlap to save anyway.`);
    }
    patch.scheduled_date = date;
    patch.scheduled_time = time;
    patch.duration_min = durationMin;
    patch.ot_room = room.name;
    patch.room_id = room.id;
    patch.allow_overlap = overlapOk;
    if ("surgeonId" in data) { patch.surgeon_id = surgeonId; patch.surgeon = (await doctorName(surgeonId, actor, "surgeonId")) || existing.surgeon; }
    if ("coSurgeonId" in raw) { patch.co_surgeon_id = coId; patch.co_surgeon = await doctorName(coId, actor, "coSurgeonId"); }
    if ("anesthetistId" in raw) { patch.anesthetist_id = anId; patch.anesthetist = (await doctorName(anId, actor, "anesthetistId")) || ""; }
    if (newEquipment) {
      const all = (await otEquipmentRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows;
      patch.equipment_ids = equipmentIds;
      patch.equipment = all.filter((e) => equipmentIds.includes(e.id)).map((e) => e.name);
    }
  }

  if ("status" in data && data.status !== existing.status) {
    const to = data.status as (typeof OT_STATUSES)[number];
    const from = existing.status;
    if (from === "Completed" || from === "Cancelled") throw new ConflictError(`This surgery is already ${from.toLowerCase()}`);
    if (to === "In Progress") {
      if (from !== "Scheduled") throw new ConflictError("Only a scheduled surgery can be started");
      const fitness = (patch.fitness as string | undefined) ?? existing.fitness ?? "Pending";
      if (fitness === "Unfit") throw new ConflictError("The patient is recorded unfit for anaesthesia — it can't be started");
      if (fitness !== "Fit" && (existing.case_type ?? "Elective") !== "Emergency") {
        throw new ConflictError("Anaesthetic fitness isn't recorded as Fit yet — record it before starting (an emergency can start without it)");
      }
      patch.started_at = new Date().toISOString();
    }
    if (to === "Completed") patch.ended_at = new Date().toISOString();
    if (to === "Scheduled") throw new ConflictError("A surgery can't go back to scheduled");
    patch.status = to;
  }

  const row = await otRepo.update(id, patch);
  await audit(actor, "update", "ot", id, patch);
  return (await withPatientCode([toOtDTO(row as OtScheduleRow)]))[0];
}

export async function deleteOt(id: number, actor: Session) {
  const existing = await otRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "OT schedule");
  await otRepo.remove(id);
  await audit(actor, "delete", "ot", id);
}
