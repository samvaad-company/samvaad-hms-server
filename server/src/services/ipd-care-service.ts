/**
 * Inpatient care records: nursing daily notes, doctor rounds, diet chart and
 * the medication chart. These were rendered from hardcoded arrays with no way
 * to add or update anything.
 *
 * Notes, rounds and diet entries share one table discriminated by `note_type`,
 * because they are the same shape (dated, timed, authored free text) and are
 * always read as one timeline per admission.
 */
import { ipdNotesRepo, ipdMedicationsRepo, ipdRepo } from "@/repositories";
import { toIpdNoteDTO, toIpdMedicationDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type IpdNoteRow, type IpdMedicationRow } from "@/db/tables";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { isoDate, displayTime } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital } from "@/services/hospital-scope";

/**
 * ipd_notes and ipd_medications carry no hospital_id of their own (they're
 * always reached through an admission_id), so scoping means resolving the
 * admission they belong to and checking that instead.
 */
async function assertAdmissionOwned(admissionId: number, actor: Session) {
  const admission = await ipdRepo.getRow(admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
}

/** A list call must be scoped to one admission — otherwise it would span every hospital. */
function requireAdmissionFilter(options: QueryOptions): number {
  const raw = options.filters?.find((f) => f.column === "admission_id")?.value;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError("admissionId is required");
  }
  return id;
}

export const NOTE_TYPES = ["Daily Note", "Doctor Round", "Diet"] as const;
export const MEDICATION_STATUSES = ["Active", "Stopped", "Completed"] as const;

// ── Notes / rounds / diet ───────────────────────────────────────────────────

export const IPD_NOTES_LIST_CONFIG = {
  searchColumns: ["content", "author"],
  filterable: ["admission_id", "note_type"],
  sortable: ["note_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

const noteSchema = {
  admissionId: { type: "number", required: true },
  noteType: { type: "enum", required: false, values: NOTE_TYPES, default: "Daily Note" },
  date: { type: "string", required: false, max: 40, default: "" },
  time: { type: "string", required: false, max: 20, default: "" },
  author: { type: "string", required: false, max: 120, default: "" },
  content: { type: "string", required: true, min: 2, max: 4000 },
} as const;

export async function listIpdNotes(options: QueryOptions, actor: Session) {
  await assertAdmissionOwned(requireAdmissionFilter(options), actor);
  return ipdNotesRepo.list(options);
}

export async function createIpdNote(input: unknown, actor: Session) {
  const data = validate(noteSchema, input);
  await assertAdmissionOwned(data.admissionId, actor);

  const row = await ipdNotesRepo.create({
    admission_id: data.admissionId,
    note_type: data.noteType,
    note_date: isoDate(data.date || new Date()),
    note_time: data.time || displayTime(),
    author: data.author || actor.name,
    content: data.content,
  });
  await audit(actor, "create", "ipd-note", row.id, { admissionId: data.admissionId });
  return toIpdNoteDTO(row as IpdNoteRow);
}

export async function updateIpdNote(id: number, input: unknown, actor: Session) {
  const existing = await ipdNotesRepo.getRow(id);
  if (!existing) throw new NotFoundError("Note");
  await assertAdmissionOwned(existing.admission_id, actor);
  const data = validatePartial(noteSchema, input);
  const patch: Record<string, unknown> = {};
  if ("content" in data) patch.content = data.content;
  if ("author" in data) patch.author = data.author;
  if ("date" in data) patch.note_date = isoDate(data.date);
  if ("time" in data) patch.note_time = data.time;
  if ("noteType" in data) patch.note_type = data.noteType;
  const row = await ipdNotesRepo.update(id, patch);
  await audit(actor, "update", "ipd-note", id, patch);
  return toIpdNoteDTO(row as IpdNoteRow);
}

export async function deleteIpdNote(id: number, actor: Session) {
  const existing = await ipdNotesRepo.getRow(id);
  if (!existing) throw new NotFoundError("Note");
  await assertAdmissionOwned(existing.admission_id, actor);
  await ipdNotesRepo.remove(id);
  await audit(actor, "delete", "ipd-note", id);
}

// ── Medication chart ────────────────────────────────────────────────────────

export const IPD_MEDS_LIST_CONFIG = {
  searchColumns: ["medicine_name", "notes"],
  filterable: ["admission_id", "status"],
  sortable: ["start_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

const medSchema = {
  admissionId: { type: "number", required: true },
  medicineName: { type: "string", required: true, min: 2, max: 160 },
  dosage: { type: "string", required: false, max: 80, default: "" },
  frequency: { type: "string", required: false, max: 80, default: "" },
  route: { type: "string", required: false, max: 40, default: "Oral" },
  startDate: { type: "string", required: false, max: 40, default: "" },
  endDate: { type: "string", required: false, max: 40, default: "" },
  status: { type: "enum", required: false, values: MEDICATION_STATUSES, default: "Active" },
  notes: { type: "string", required: false, max: 500, default: "" },
} as const;

export async function listIpdMedications(options: QueryOptions, actor: Session) {
  await assertAdmissionOwned(requireAdmissionFilter(options), actor);
  return ipdMedicationsRepo.list(options);
}

export async function createIpdMedication(input: unknown, actor: Session) {
  const data = validate(medSchema, input);
  await assertAdmissionOwned(data.admissionId, actor);

  const row = await ipdMedicationsRepo.create({
    admission_id: data.admissionId,
    medicine_name: data.medicineName,
    dosage: data.dosage,
    frequency: data.frequency,
    route: data.route,
    start_date: isoDate(data.startDate || new Date()),
    end_date: isoDate(data.endDate),
    status: data.status,
    last_given_at: "",
    notes: data.notes,
  });
  await audit(actor, "create", "ipd-medication", row.id);
  return toIpdMedicationDTO(row as IpdMedicationRow);
}

export async function updateIpdMedication(id: number, input: unknown, actor: Session) {
  const existing = await ipdMedicationsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Medication");
  await assertAdmissionOwned(existing.admission_id, actor);
  const data = validatePartial(medSchema, input);
  const patch: Record<string, unknown> = {};
  if ("medicineName" in data) patch.medicine_name = data.medicineName;
  if ("dosage" in data) patch.dosage = data.dosage;
  if ("frequency" in data) patch.frequency = data.frequency;
  if ("route" in data) patch.route = data.route;
  if ("startDate" in data) patch.start_date = isoDate(data.startDate);
  if ("endDate" in data) patch.end_date = isoDate(data.endDate);
  if ("status" in data) patch.status = data.status;
  if ("notes" in data) patch.notes = data.notes;
  // Explicit "given now" marker from the administer action.
  if ((input as { markGiven?: boolean })?.markGiven) {
    patch.last_given_at = `${isoDate(new Date())} ${displayTime()}`;
  }
  const row = await ipdMedicationsRepo.update(id, patch);
  await audit(actor, "update", "ipd-medication", id, patch);
  return toIpdMedicationDTO(row as IpdMedicationRow);
}

export async function deleteIpdMedication(id: number, actor: Session) {
  const existing = await ipdMedicationsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Medication");
  await assertAdmissionOwned(existing.admission_id, actor);
  await ipdMedicationsRepo.remove(id);
  await audit(actor, "delete", "ipd-medication", id);
}
