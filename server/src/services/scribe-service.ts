/**
 * Scribe service — stores AI-assisted consultation notes captured while the
 * patient is with the doctor. Transcription and brief generation are handled by
 * the Gemini integration (see gemini-scribe.ts); this service persists the results.
 */
import { scribeNotesRepo } from "@/repositories";
import { toScribeNoteDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type ScribeNoteRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

export const SCRIBE_STATUSES = ["Draft", "Saved", "Signed"] as const;

const scribeSchema = {
  appointmentId: { type: "number", required: false, min: 1 },
  patientId: { type: "number", required: false, min: 1 },
  patientName: { type: "string", required: false, max: 120, default: "" },
  doctorId: { type: "number", required: false, min: 1 },
  doctorName: { type: "string", required: false, max: 120, default: "" },
  transcript: { type: "string", required: true, min: 1, max: 20000 },
  brief: { type: "string", required: false, max: 20000, default: "" },
  language: { type: "string", required: false, max: 20, default: "en-IN" },
  durationSec: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: SCRIBE_STATUSES, default: "Saved" },
} as const;

export const SCRIBE_LIST_CONFIG = {
  searchColumns: ["patient_name", "doctor_name", "transcript"],
  filterable: ["status", "appointment_id", "patient_id", "doctor_id"],
  sortable: ["created_at", "patient_name"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listScribeNotes(options: QueryOptions, actor: Session) {
  return scribeNotesRepo.list(scopeToHospital(options, actor));
}

export async function getScribeNote(id: number, actor: Session) {
  const row = await scribeNotesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Scribe note");
  return toScribeNoteDTO(row);
}

export async function createScribeNote(input: unknown, actor: Session) {
  const data = validate(scribeSchema, input);
  const row = await scribeNotesRepo.create({
    hospital_id: actor.hospitalId,
    appointment_id: data.appointmentId ?? null,
    patient_id: data.patientId ?? null,
    patient_name: data.patientName,
    doctor_id: data.doctorId ?? actor.doctorId ?? null,
    doctor_name: data.doctorName || actor.name,
    transcript: data.transcript,
    brief: data.brief,
    language: data.language,
    duration_sec: data.durationSec,
    status: data.status,
  });
  await audit(actor, "create", "scribe-note", row.id);
  return toScribeNoteDTO(row as ScribeNoteRow);
}

export async function updateScribeNote(id: number, input: unknown, actor: Session) {
  const existing = await scribeNotesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Scribe note");
  const data = validatePartial(scribeSchema, input);
  const patch: Record<string, unknown> = {};
  if ("transcript" in data) patch.transcript = data.transcript;
  if ("brief" in data) patch.brief = data.brief;
  if ("language" in data) patch.language = data.language;
  if ("durationSec" in data) patch.duration_sec = data.durationSec;
  if ("status" in data) patch.status = data.status;
  const row = await scribeNotesRepo.update(id, patch);
  await audit(actor, "update", "scribe-note", id, patch);
  return toScribeNoteDTO(row as ScribeNoteRow);
}

export async function deleteScribeNote(id: number, actor: Session) {
  const existing = await scribeNotesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Scribe note");
  await scribeNotesRepo.remove(id);
  await audit(actor, "delete", "scribe-note", id);
}
