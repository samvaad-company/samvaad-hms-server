/**
 * Checklists: a hospital keeps templates (pre-operative, admission, discharge, blood transfusion, …); a nurse
 * starts one for a patient, ticks lines off — every tick records who and when — and completes it once the
 * required lines are done. A running checklist keeps its own copy of the template's lines, so editing a
 * template never rewrites a checklist already in progress.
 */
import { ipdChecklistTemplatesRepo, ipdChecklistsRepo, ipdRepo, patientsRepo } from "@/repositories";
import { type QueryOptions } from "@/db/adapter";
import {
  type ChecklistItemDef,
  type IpdChecklistRow,
  type IpdChecklistTemplateRow,
} from "@/db/tables";
import { toIpdChecklistDTO, toIpdChecklistTemplateDTO } from "@/repositories/mappers";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";

export const CHECKLIST_SCOPES = ["Inpatient (IPD)", "OPD"] as const;

// ── Templates ────────────────────────────────────────────────────────────────

interface Seed {
  name: string;
  scope: (typeof CHECKLIST_SCOPES)[number];
  description: string;
  /** A trailing * makes a line required; sub-lines follow a "> " prefix. */
  lines: string[];
}

const DEFAULTS: Seed[] = [
  {
    name: "Pre-operative checklist",
    scope: "Inpatient (IPD)",
    description: "Before the patient is shifted to the OT.",
    lines: [
      "Identity band on and checked against the file*",
      "Consents signed*", "> Surgery / procedure consent", "> Anaesthesia consent", "> High-risk consent (if advised)",
      "Nil by mouth since the advised time*",
      "Pre-anaesthesia check done and cleared*",
      "Investigations reviewed*", "> Blood reports (CBC, RFT, sugar, coagulation)", "> ECG / chest X-ray as advised", "> Viral markers",
      "Blood grouped and cross-matched / arranged",
      "Operation site prepared and marked*",
      "Jewellery, dentures, contact lenses, nail paint removed*",
      "Pre-medication given as ordered*",
      "Bladder emptied / catheter as advised*",
      "File, films and reports sent with the patient*",
    ],
  },
  {
    name: "Admission checklist (nursing)",
    scope: "Inpatient (IPD)",
    description: "The first hour on the ward.",
    lines: [
      "Identity band applied*", "Allergy band applied if allergic*", "Baseline vitals recorded*", "Height and weight recorded",
      "Fall risk assessed", "Bed, side rails and call bell checked", "Patient and family oriented to the ward and visiting hours",
      "Valuables listed and handed to the family", "Admission consent signed*", "Doctor informed of arrival", "Diet order confirmed",
    ],
  },
  {
    name: "Discharge checklist",
    scope: "Inpatient (IPD)",
    description: "Before the patient leaves the ward.",
    lines: [
      "Discharge summary given and explained*", "Medicines handed over with instructions*", "Follow-up date given*",
      "Bill cleared by billing*", "Cannulas and lines removed*", "Belongings and valuables returned",
      "Reports and films returned", "Warning signs explained and understood",
    ],
  },
  {
    name: "Blood transfusion bedside check",
    scope: "Inpatient (IPD)",
    description: "Two staff check at the bedside before the transfusion starts.",
    lines: [
      "Patient identity confirmed against the band and the file, by two staff*", "Bag label matches the patient's file*",
      "Patient and bag blood group and Rh match*", "Cross-match report checked*", "Bag expiry date and appearance checked*",
      "Transfusion consent on file*", "Baseline vitals recorded before starting*", "Rate and duration confirmed with the doctor's order",
    ],
  },
  {
    name: "OPD procedure checklist",
    scope: "OPD",
    description: "Minor procedures in the OPD.",
    lines: [
      "Patient identified*", "Procedure explained and consent taken*", "Allergies checked*", "Site prepared",
      "Post-procedure instructions given", "Follow-up advised",
    ],
  },
];

/** "Label*" lines with "> sub-line" children, into item definitions with stable keys. */
export function parseLines(lines: string[]): ChecklistItemDef[] {
  const items: ChecklistItemDef[] = [];
  for (const raw of lines) {
    const text = raw.trim();
    if (!text) continue;
    if (text.startsWith(">")) {
      const last = items[items.length - 1];
      const label = text.slice(1).trim();
      if (!last || !label) continue;
      (last.children ??= []).push({ key: `${last.key}.${last.children?.length ? last.children.length + 1 : 1}`, label });
      continue;
    }
    const required = text.endsWith("*");
    items.push({ key: `i${items.length + 1}`, label: (required ? text.slice(0, -1) : text).trim(), required });
  }
  return items;
}

/** The inverse of parseLines, for editing a template as text. */
export function toLines(items: ChecklistItemDef[]): string[] {
  return items.flatMap((i) => [`${i.label}${i.required ? "*" : ""}`, ...(i.children ?? []).map((c) => `> ${c.label}`)]);
}

/** A hospital that has no templates yet gets the standard set the first time it asks. */
async function ensureDefaults(actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const { total } = await ipdChecklistTemplatesRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
  if (total > 0) return;
  for (const t of DEFAULTS) {
    await ipdChecklistTemplatesRepo.create({
      hospital_id: hospitalId,
      name: t.name,
      scope: t.scope,
      description: t.description,
      items: parseLines(t.lines),
      active: true,
    });
  }
}

const templateSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  scope: { type: "enum", required: false, values: CHECKLIST_SCOPES, default: "Inpatient (IPD)" },
  description: { type: "string", required: false, max: 300, default: "" },
  active: { type: "boolean", required: false, default: true },
} as const;

function itemsFrom(input: unknown): ChecklistItemDef[] {
  const lines = (input as { lines?: unknown })?.lines;
  if (!Array.isArray(lines) || !lines.every((l) => typeof l === "string")) throw new BadRequestError("lines must be a list of text lines");
  const items = parseLines(lines as string[]);
  if (items.length === 0) throw new BadRequestError("Add at least one line");
  if (items.length > 80) throw new BadRequestError("A checklist can have at most 80 lines");
  return items;
}

export async function listTemplates(actor: Session) {
  await ensureDefaults(actor);
  const { rows } = await ipdChecklistTemplatesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return rows.map((r) => ({ ...toIpdChecklistTemplateDTO(r), lines: toLines(r.items ?? []) }));
}

export async function createTemplate(input: unknown, actor: Session) {
  const data = validate(templateSchema, input);
  const row = await ipdChecklistTemplatesRepo.create({
    hospital_id: requireHospitalId(actor),
    name: data.name,
    scope: data.scope,
    description: data.description,
    items: itemsFrom(input),
    active: data.active,
  });
  await audit(actor, "create", "ipd-checklist-template", row.id);
  return toIpdChecklistTemplateDTO(row as IpdChecklistTemplateRow);
}

export async function updateTemplate(id: number, input: unknown, actor: Session) {
  const existing = await ipdChecklistTemplatesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Template");
  const data = validate(templateSchema, { ...existing, ...(input as object), name: (input as { name?: string })?.name ?? existing.name });
  const patch: Record<string, unknown> = { name: data.name, scope: data.scope, description: data.description, active: data.active };
  if (Array.isArray((input as { lines?: unknown })?.lines)) patch.items = itemsFrom(input);
  const row = await ipdChecklistTemplatesRepo.update(id, patch);
  await audit(actor, "update", "ipd-checklist-template", id);
  return toIpdChecklistTemplateDTO(row as IpdChecklistTemplateRow);
}

export async function deleteTemplate(id: number, actor: Session) {
  const existing = await ipdChecklistTemplatesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Template");
  await ipdChecklistTemplatesRepo.remove(id);
  await audit(actor, "delete", "ipd-checklist-template", id);
}

// ── Checklists ───────────────────────────────────────────────────────────────

export const CHECKLIST_LIST_CONFIG = {
  searchColumns: ["name", "patient_name", "patient_code"],
  filterable: ["status", "admission_id", "patient_id", "scope"],
  sortable: ["created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listChecklists(options: QueryOptions, actor: Session) {
  return ipdChecklistsRepo.list(scopeToHospital(options, actor));
}

async function owned(id: number, actor: Session): Promise<IpdChecklistRow> {
  const row = await ipdChecklistsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Checklist");
  return row as IpdChecklistRow;
}

export async function getChecklist(id: number, actor: Session) {
  return toIpdChecklistDTO(await owned(id, actor));
}

const startSchema = {
  templateId: { type: "number", required: true, min: 1 },
  patientId: { type: "number", required: true, min: 1 },
} as const;

export async function startChecklist(input: unknown, actor: Session) {
  const data = validate(startSchema, input);
  const template = await ipdChecklistTemplatesRepo.getRow(data.templateId);
  assertOwnedByHospital(template, actor, "Template");
  if (template.active === false) throw new ConflictError("That template is switched off");
  const patient = await patientsRepo.getRow(data.patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  // Tie it to the patient's current admission, if they have one.
  const { rows: stays } = await ipdRepo.listRows(
    scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }, { column: "status", op: "neq", value: "Discharged" }] }, actor),
  );
  const row = await ipdChecklistsRepo.create({
    hospital_id: requireHospitalId(actor),
    template_id: template.id,
    name: template.name,
    scope: template.scope,
    admission_id: stays[0]?.id ?? null,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_code: patient.patient_code,
    items: JSON.parse(JSON.stringify(template.items ?? [])),
    ticks: {},
    status: "In progress",
    started_by: actor.name,
    completed_by: null,
    completed_at: null,
    cancelled_reason: null,
  });
  await audit(actor, "start", "ipd-checklist", row.id, { templateId: template.id, patientId: patient.id });
  return toIpdChecklistDTO(row as IpdChecklistRow);
}

/** Tickable keys: a heading with sub-lines is ticked through its sub-lines. */
const leafKeys = (items: ChecklistItemDef[]) => new Set(items.flatMap((i) => (i.children?.length ? i.children.map((c) => c.key) : [i.key])));

export async function tickChecklist(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  if (row.status !== "In progress") throw new ConflictError(`This checklist is ${row.status.toLowerCase()}`);
  const { key, done } = (input ?? {}) as { key?: unknown; done?: unknown };
  if (typeof key !== "string" || !leafKeys(row.items ?? []).has(key)) throw new BadRequestError("Unknown checklist line");
  const ticks = { ...(row.ticks ?? {}) };
  ticks[key] = done === false ? { done: false, by: null, at: null } : { done: true, by: actor.name, at: new Date().toISOString() };
  const updated = await ipdChecklistsRepo.update(id, { ticks });
  return toIpdChecklistDTO(updated as IpdChecklistRow);
}

export async function completeChecklist(id: number, actor: Session) {
  const row = await owned(id, actor);
  if (row.status !== "In progress") throw new ConflictError(`This checklist is already ${row.status.toLowerCase()}`);
  const left = toIpdChecklistDTO(row).requiredLeft;
  if (left > 0) throw new ConflictError(`${left} required ${left === 1 ? "line is" : "lines are"} not done yet`);
  const updated = await ipdChecklistsRepo.update(id, { status: "Complete", completed_by: actor.name, completed_at: new Date().toISOString() });
  await audit(actor, "complete", "ipd-checklist", id);
  return toIpdChecklistDTO(updated as IpdChecklistRow);
}

export async function cancelChecklist(id: number, input: unknown, actor: Session) {
  const row = await owned(id, actor);
  if (row.status !== "In progress") throw new ConflictError(`This checklist is already ${row.status.toLowerCase()}`);
  const reason = String((input as { reason?: unknown } | null)?.reason ?? "").trim().slice(0, 300);
  const updated = await ipdChecklistsRepo.update(id, { status: "Cancelled", cancelled_reason: reason || null });
  await audit(actor, "cancel", "ipd-checklist", id);
  return toIpdChecklistDTO(updated as IpdChecklistRow);
}
