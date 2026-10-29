/**
 * MRD documents — retention and folders.
 *
 * A retention policy says how many years a class of documents (Clinical, Financial, KYC, Statutory) is kept. The sweep
 * flags a document Due once its time is up; a reviewer then Extends it to a later date or Disposes of it (the stored
 * file and its row are deleted and the audit log keeps who did it, when, and what it was). Nothing is flagged or
 * deleted by the sweep itself.
 */
import { mrdRetentionPoliciesRepo, mrdFoldersRepo, documentsRepo, patientsRepo } from "@/repositories";
import { toMrdRetentionPolicyDTO, toMrdFolderDTO } from "@/repositories/mappers";
import { DEFAULT_FOLDERS, DEFAULT_POLICIES } from "@/services/mrd-defaults";
import { type DocumentRow, type MrdFolderRow, type MrdRetentionPolicyRow } from "@/db/tables";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { singleFlight } from "@/lib/key-lock";
import { getStorage } from "@/storage";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import {
  MRD_DOC_CLASSES,
  type MrdDocClass,
  type MrdFolderDocumentDTO,
  type MrdRetentionItemDTO,
  type MrdRetentionQueueDTO,
} from "@shared/types/api";

// ── Policies ─────────────────────────────────────────────────────────────────

/** A hospital with no policies yet starts with these four; the years are the usual Indian practice and are editable. */
function ensurePolicies(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`mrd-policies:${hospitalId}`, async () => {
    const existing = await mrdRetentionPoliciesRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    for (const p of DEFAULT_POLICIES) {
      await mrdRetentionPoliciesRepo.create({
        hospital_id: hospitalId, name: p.name, class: p.class, retention_years: p.years, categories: p.categories, action_after: "Review", active: true,
      });
    }
  });
}

const policySchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  class: { type: "enum", required: true, values: MRD_DOC_CLASSES },
  retentionYears: { type: "number", required: true, min: 1, max: 100 },
  actionAfter: { type: "enum", required: false, values: ["Review", "Destroy"], default: "Review" },
  active: { type: "boolean", required: false, default: true },
} as const;

/** Categories arrive as a list of words ("Report", "ID proof"); matching ignores case and spacing. */
function parseCategories(raw: unknown): string[] {
  if (raw == null) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(",");
  const out = list.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
  if (out.length > 30 || out.some((c) => c.length > 40)) throw new ValidationError([{ field: "categories", message: "up to 30 categories, each under 40 characters" }]);
  return [...new Set(out)];
}

export async function listPolicies(actor: Session) {
  await ensurePolicies(actor);
  const { rows } = await mrdRetentionPoliciesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return rows.map(toMrdRetentionPolicyDTO);
}

export async function createPolicy(input: unknown, actor: Session) {
  const data = validate(policySchema, input);
  const categories = parseCategories((input as Record<string, unknown> | null)?.categories);
  const row = await mrdRetentionPoliciesRepo.create({
    hospital_id: requireHospitalId(actor), name: data.name, class: data.class, retention_years: data.retentionYears,
    categories, action_after: data.actionAfter, active: data.active,
  });
  await audit(actor, "create", "mrd-retention-policy", row.id);
  return toMrdRetentionPolicyDTO(row as MrdRetentionPolicyRow);
}

export async function updatePolicy(id: number, input: unknown, actor: Session) {
  const existing = await mrdRetentionPoliciesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Policy");
  const data = validatePartial(policySchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("class" in data) patch.class = data.class;
  if ("retentionYears" in data) patch.retention_years = data.retentionYears;
  if ("actionAfter" in data) patch.action_after = data.actionAfter;
  if ("active" in data) patch.active = data.active;
  if (input && typeof input === "object" && "categories" in input) patch.categories = parseCategories((input as Record<string, unknown>).categories);
  const row = await mrdRetentionPoliciesRepo.update(id, patch);
  await audit(actor, "update", "mrd-retention-policy", id, patch);
  return toMrdRetentionPolicyDTO(row as MrdRetentionPolicyRow);
}

// ── The sweep ────────────────────────────────────────────────────────────────

const OWNER_CLASS: Record<string, MrdDocClass> = { patient: "Clinical", lab: "Clinical", radiology: "Clinical", donor: "KYC", staff: "KYC" };

/** The policy that covers a document: by its category, otherwise by what it is attached to. */
function policyFor(doc: DocumentRow, policies: MrdRetentionPolicyRow[]): MrdRetentionPolicyRow | null {
  const active = policies.filter((p) => p.active !== false);
  const cat = (doc.category ?? "").trim().toLowerCase();
  const byCategory = cat ? active.find((p) => (p.categories ?? []).includes(cat)) : undefined;
  if (byCategory) return byCategory;
  const cls = OWNER_CLASS[doc.owner_type];
  return (cls && active.find((p) => p.class === cls)) || null;
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const out = new Date(Date.UTC(y + years, m - 1, d));
  if (out.getUTCMonth() !== m - 1) out.setUTCDate(0); // 29 Feb + 1 year → 28 Feb
  return out.toISOString().slice(0, 10);
}

function dueDateOf(doc: DocumentRow, policy: MrdRetentionPolicyRow): string {
  return doc.retain_until || addYears(String(doc.created_at).slice(0, 10), Number(policy.retention_years));
}

/** Flag every document whose time is up. Idempotent; safe to run on every read. */
export async function runRetentionSweep(actor: Session): Promise<void> {
  await ensurePolicies(actor);
  const today = localDate();
  const [{ rows: policies }, { rows: docs }] = await Promise.all([
    mrdRetentionPoliciesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    documentsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  for (const doc of docs as DocumentRow[]) {
    const state = doc.retention_state || "Active";
    if (state === "Due") continue;
    const policy = policyFor(doc, policies as MrdRetentionPolicyRow[]);
    if (!policy) continue;
    if (dueDateOf(doc, policy) <= today) await documentsRepo.update(doc.id, { retention_state: "Due" });
  }
}

// ── The queue ────────────────────────────────────────────────────────────────

export async function retentionQueue(actor: Session): Promise<MrdRetentionQueueDTO> {
  await runRetentionSweep(actor);
  const [{ rows: policies }, { rows: docs }, { rows: folders }, { rows: patients }] = await Promise.all([
    mrdRetentionPoliciesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    documentsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "retention_state", op: "eq", value: "Due" }] }, actor)),
    mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    patientsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  const patientName = new Map(patients.map((p) => [p.id, p.name]));
  const items: MrdRetentionItemDTO[] = [];
  for (const doc of docs as DocumentRow[]) {
    const policy = policyFor(doc, policies as MrdRetentionPolicyRow[]);
    if (!policy) continue;
    items.push({
      id: doc.id,
      fileName: doc.file_name,
      category: doc.category,
      class: policy.class as MrdDocClass,
      ownerType: doc.owner_type,
      ownerId: doc.owner_id,
      patientName: doc.owner_type === "patient" ? patientName.get(doc.owner_id) ?? "" : "",
      folderName: doc.folder_id ? folderName.get(doc.folder_id) ?? "" : "",
      policyName: policy.name,
      uploadedOn: String(doc.created_at).slice(0, 10),
      dueOn: dueDateOf(doc, policy),
      actionAfter: (policy.action_after as "Review" | "Destroy") || "Review",
    });
  }
  items.sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.id - b.id));
  const n = (c: MrdDocClass) => items.filter((i) => i.class === c).length;
  return { clinicalDue: n("Clinical"), financialDue: n("Financial"), kycDue: n("KYC"), statutoryDue: n("Statutory"), items };
}

async function dueDocument(id: number, actor: Session): Promise<DocumentRow> {
  const doc = (await documentsRepo.getRow(id)) as DocumentRow | null;
  assertOwnedByHospital(doc, actor, "Document");
  if (!doc) throw new NotFoundError("Document");
  if (doc.retention_state !== "Due") throw new ConflictError("This document isn't awaiting a retention review");
  return doc;
}

/** Keep a due document longer: it leaves the queue until the new date. */
export async function extendRetention(id: number, input: unknown, actor: Session) {
  const doc = await dueDocument(id, actor);
  const data = validate({ until: { type: "date", required: true }, note: { type: "string", required: true, min: 3, max: 200 } } as const, input);
  const today = localDate();
  if (data.until <= today) throw new ValidationError([{ field: "until", message: "must be a future date" }]);
  if (data.until > addYears(today, 50)) throw new ValidationError([{ field: "until", message: "is too far ahead" }]);
  await documentsRepo.update(id, { retention_state: "Extended", retain_until: data.until, retention_note: data.note, reviewed_by: actor.name, reviewed_at: new Date().toISOString() });
  await audit(actor, "retention-extend", "document", id, { until: data.until, note: data.note, fileName: doc.file_name });
  return { id, retainUntil: data.until };
}

/** Destroy a due document: the stored file and its row go; the audit log keeps what it was and who decided. */
export async function disposeDocument(id: number, input: unknown, actor: Session) {
  const doc = await dueDocument(id, actor);
  const data = validate({ note: { type: "string", required: true, min: 3, max: 200 } } as const, input);
  await getStorage().remove(doc.storage_key);
  await documentsRepo.remove(id);
  await audit(actor, "retention-dispose", "document", id, {
    fileName: doc.file_name, category: doc.category, ownerType: doc.owner_type, ownerId: doc.owner_id, uploadedOn: String(doc.created_at).slice(0, 10), note: data.note,
  });
}

// ── Folders ──────────────────────────────────────────────────────────────────

const folderSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  class: { type: "enum", required: false, values: [...MRD_DOC_CLASSES, "General"], default: "General" },
  description: { type: "string", required: false, max: 200, default: "" },
} as const;

async function assertFolderNameFree(name: string, actor: Session, exceptId?: number) {
  const { rows } = await mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  if (rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase())) throw new ConflictError(`A folder called "${name}" already exists`);
}

export function ensureFolders(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`mrd-folders:${hospitalId}`, async () => {
    const { rows } = await mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const have = new Set(rows.map((r) => r.name.trim().toLowerCase()));
    for (const f of DEFAULT_FOLDERS) {
      if (!have.has(f.name.toLowerCase())) await mrdFoldersRepo.create({ hospital_id: hospitalId, name: f.name, class: f.class, description: f.description });
    }
  });
}

export async function listFolders(actor: Session) {
  await ensureFolders(actor);
  const [{ rows }, { rows: docs }] = await Promise.all([
    mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor)),
    documentsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const counts = new Map<number, number>();
  for (const d of docs as DocumentRow[]) if (d.folder_id != null) counts.set(d.folder_id, (counts.get(d.folder_id) ?? 0) + 1);
  return rows.map((r) => toMrdFolderDTO(r, counts.get(r.id) ?? 0));
}

export async function createFolder(input: unknown, actor: Session) {
  const data = validate(folderSchema, input);
  await assertFolderNameFree(data.name, actor);
  const row = await mrdFoldersRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, class: data.class, description: data.description });
  await audit(actor, "create", "mrd-folder", row.id);
  return toMrdFolderDTO(row as MrdFolderRow);
}

export async function updateFolder(id: number, input: unknown, actor: Session) {
  const existing = await mrdFoldersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Folder");
  const data = validatePartial(folderSchema, input);
  const patch: Record<string, unknown> = {};
  for (const k of ["class", "description"] as const) if (k in data) patch[k] = data[k];
  if ("name" in data && data.name !== existing.name) { await assertFolderNameFree(data.name as string, actor, id); patch.name = data.name; }
  const row = await mrdFoldersRepo.update(id, patch);
  await audit(actor, "update", "mrd-folder", id, patch);
  return toMrdFolderDTO(row as MrdFolderRow);
}

export async function deleteFolder(id: number, actor: Session) {
  const existing = await mrdFoldersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Folder");
  const { rows } = await documentsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "folder_id", op: "eq", value: id }] }, actor));
  if (rows.length > 0) throw new ConflictError(`${existing.name} holds ${rows.length} ${rows.length === 1 ? "document" : "documents"} — move or remove them first`);
  await mrdFoldersRepo.remove(id);
  await audit(actor, "delete", "mrd-folder", id);
}

/** The documents filed in a folder, newest first. */
export async function folderDocuments(folderId: number, actor: Session): Promise<MrdFolderDocumentDTO[]> {
  const folder = await mrdFoldersRepo.getRow(folderId);
  assertOwnedByHospital(folder, actor, "Folder");
  const [{ rows }, { rows: patients }] = await Promise.all([
    documentsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "folder_id", op: "eq", value: folderId }], sort: [{ column: "id", direction: "desc" }] }, actor)),
    patientsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const names = new Map(patients.map((p) => [p.id, p.name]));
  return (rows as DocumentRow[]).map((d) => ({
    id: d.id, fileName: d.file_name, category: d.category, ownerType: d.owner_type, ownerId: d.owner_id,
    patientName: d.owner_type === "patient" ? names.get(d.owner_id) ?? "" : "",
    sizeBytes: d.size_bytes, uploadedBy: d.uploaded_by, uploadedOn: String(d.created_at).slice(0, 10),
    retentionState: (d.retention_state as MrdFolderDocumentDTO["retentionState"]) || "Active",
  }));
}

/** Put an existing document into a folder (or take it out with folderId = null). */
export async function fileDocument(documentId: number, input: unknown, actor: Session) {
  const doc = await documentsRepo.getRow(documentId);
  assertOwnedByHospital(doc, actor, "Document");
  const { folderId } = validate({ folderId: { type: "number", required: false, min: 1 } } as const, input);
  if (folderId != null) assertOwnedByHospital(await mrdFoldersRepo.getRow(folderId), actor, "Folder");
  await documentsRepo.update(documentId, { folder_id: folderId ?? null });
  await audit(actor, "file", "document", documentId, { folderId: folderId ?? null });
}
