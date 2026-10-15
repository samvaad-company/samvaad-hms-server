/**
 * Enquiries — leads captured before registration. Someone asks about a service; the front desk
 * records them, follows up (each contact is counted and kept in the history), and either converts
 * them into a registered patient or closes the lead.
 *
 *   Open ──follow up──▶ Follow-up ──convert──▶ Converted
 *     └────────────────────close────────────▶ Closed ──(follow up / convert reopens)
 */
import { enquiriesRepo, patientsRepo } from "@/repositories";
import { toEnquiryDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type EnquiryRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { ConflictError, ValidationError } from "@/lib/errors";
import { isoDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";

/** Both allow an empty value: a mobile or a follow-up date is optional. */
const ISO_DAY = /^(\d{4}-\d{2}-\d{2})?$/;
const PHONE = /^(\+?\d[\d\s-]{5,17})?$/;

export const ENQUIRY_STATUSES = ["Open", "Follow-up", "Converted", "Closed"] as const;

const enquirySchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  mobile: { type: "string", required: false, max: 20, default: "", pattern: PHONE },
  department: { type: "string", required: false, max: 80, default: "" },
  interestedIn: { type: "string", required: false, max: 160, default: "" },
  source: { type: "string", required: false, max: 80, default: "" },
  estimatedValue: { type: "number", required: false, min: 0, max: 1_000_000_000, default: 0 },
  followUpOn: { type: "string", required: false, default: "", pattern: ISO_DAY },
  notes: { type: "string", required: false, max: 1000, default: "" },
} as const;

export const ENQUIRY_LIST_CONFIG = {
  searchColumns: ["name", "mobile", "interested_in", "source"],
  filterable: ["status", "department", "source"],
  sortable: ["created_at", "follow_up_on", "name"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

/** Leads that still need work come first (soonest follow-up on top), then converted, then closed. */
const RANK: Record<string, number> = { "Follow-up": 0, Open: 1, Converted: 2, Closed: 3 };

export async function listEnquiries(options: QueryOptions, actor: Session) {
  const { rows } = await enquiriesRepo.listRows({ ...scopeToHospital(options, actor), unpaged: true });
  rows.sort((a, b) =>
    (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) ||
    (a.follow_up_on || "9999").localeCompare(b.follow_up_on || "9999") ||
    b.id - a.id,
  );
  const total = rows.length;
  const size = options.pageSize ?? 50;
  const page = options.unpaged ? rows : rows.slice(((options.page ?? 1) - 1) * size, (options.page ?? 1) * size);
  return { rows: page.map(toEnquiryDTO), total };
}

export async function getEnquirySummary(actor: Session) {
  const { rows } = await enquiriesRepo.listRows({ ...scopeToHospital({}, actor), unpaged: true });
  const today = isoDate();
  const counts = { Open: 0, "Follow-up": 0, Converted: 0, Closed: 0 };
  let dueToday = 0;
  for (const r of rows) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
    if ((r.status === "Open" || r.status === "Follow-up") && r.follow_up_on && r.follow_up_on <= today) dueToday++;
  }
  return { total: rows.length, ...counts, dueToday };
}

async function owned(id: number, actor: Session): Promise<EnquiryRow> {
  const row = await enquiriesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Enquiry");
  return row as EnquiryRow;
}

export async function getEnquiry(id: number, actor: Session) {
  return toEnquiryDTO(await owned(id, actor));
}

export async function createEnquiry(input: unknown, actor: Session) {
  const data = validate(enquirySchema, input);
  const followUpOn = data.followUpOn || null;
  const row = await enquiriesRepo.create({
    hospital_id: requireHospitalId(actor),
    name: data.name,
    mobile: data.mobile,
    department: data.department,
    interested_in: data.interestedIn,
    source: data.source,
    estimated_value: data.estimatedValue,
    follow_up_on: followUpOn,
    notes: data.notes,
    // A lead with a follow-up already planned is in follow-up from the start.
    status: followUpOn ? "Follow-up" : "Open",
    contacts: 1,
    converted_patient_id: null,
    history: [],
  });
  await audit(actor, "create", "enquiries", row.id);
  return toEnquiryDTO(row as EnquiryRow);
}

export async function updateEnquiry(id: number, input: unknown, actor: Session) {
  await owned(id, actor);
  const data = validatePartial(enquirySchema, input);
  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    name: "name", mobile: "mobile", department: "department", interestedIn: "interested_in",
    source: "source", estimatedValue: "estimated_value", notes: "notes",
  };
  for (const [k, col] of Object.entries(map)) if (k in data) patch[col] = (data as Record<string, unknown>)[k];
  if ("followUpOn" in data) patch.follow_up_on = data.followUpOn || null;
  const row = await enquiriesRepo.update(id, patch);
  await audit(actor, "update", "enquiries", id, patch);
  return toEnquiryDTO(row as EnquiryRow);
}

export async function deleteEnquiry(id: number, actor: Session) {
  await owned(id, actor);
  await enquiriesRepo.remove(id);
  await audit(actor, "delete", "enquiries", id);
}

const followUpSchema = {
  note: { type: "string", required: false, max: 500, default: "" },
  nextOn: { type: "string", required: false, default: "", pattern: ISO_DAY },
} as const;

/** Log a contact: counts it, remembers what was said, and sets (or clears) the next follow-up date. */
export async function followUpEnquiry(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  if (row.status === "Converted") throw new ConflictError("This lead has already become a patient");
  const data = validate(followUpSchema, input);
  const nextOn = data.nextOn || null;
  if (nextOn && nextOn < isoDate()) throw new ValidationError([{ field: "nextOn", message: "can't be in the past" }]);
  const updated = await enquiriesRepo.update(id, {
    status: "Follow-up",
    contacts: Number(row.contacts ?? 1) + 1,
    follow_up_on: nextOn,
    history: [...(row.history ?? []), { at: new Date().toISOString(), by: actor.name, note: data.note, nextOn }],
  });
  await audit(actor, "follow-up", "enquiries", id);
  return toEnquiryDTO(updated as EnquiryRow);
}

/** The lead registered as a patient: link the patient and finish the lead. */
export async function convertEnquiry(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  if (row.status === "Converted") throw new ConflictError("This lead has already become a patient");
  const { patientId } = validate({ patientId: { type: "number", required: true, min: 1 } } as const, input);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const updated = await enquiriesRepo.update(id, {
    status: "Converted",
    converted_patient_id: patientId,
    follow_up_on: null,
    history: [...(row.history ?? []), { at: new Date().toISOString(), by: actor.name, note: "Registered as a patient", nextOn: null }],
  });
  await audit(actor, "convert", "enquiries", id, { patientId });
  return toEnquiryDTO(updated as EnquiryRow);
}

export async function closeEnquiry(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  if (row.status === "Converted") throw new ConflictError("This lead has already become a patient");
  const { reason } = validate({ reason: { type: "string", required: false, max: 300, default: "" } } as const, input);
  const updated = await enquiriesRepo.update(id, {
    status: "Closed",
    follow_up_on: null,
    history: [...(row.history ?? []), { at: new Date().toISOString(), by: actor.name, note: reason ? `Closed: ${reason}` : "Closed", nextOn: null }],
  });
  await audit(actor, "close", "enquiries", id);
  return toEnquiryDTO(updated as EnquiryRow);
}
