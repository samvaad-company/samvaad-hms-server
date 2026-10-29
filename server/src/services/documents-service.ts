/**
 * Documents service — file attachments for patients, lab reports, donor ID
 * proofs and similar. Binary data lives in the storage driver; only metadata
 * is persisted in the database.
 */
import { documentsRepo, mrdFoldersRepo } from "@/repositories";
import { toDocumentDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type DocumentRow } from "@/db/tables";
import { NotFoundError, BadRequestError } from "@/lib/errors";
import { getStorage } from "@/storage";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { validatePartial } from "@/lib/validation";

export const OWNER_TYPES = ["patient", "lab", "radiology", "donor", "staff"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

/** 10 MB per file — enough for scans and reports, small enough to stay quick. */
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
];

export const DOCUMENTS_LIST_CONFIG = {
  searchColumns: ["file_name", "category", "title", "reference_no"],
  filterable: ["owner_type", "owner_id", "category", "folder_id"],
  sortable: ["created_at", "file_name"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listDocuments(options: QueryOptions, actor: Session) {
  const [result, { rows: folders }] = await Promise.all([
    documentsRepo.list(scopeToHospital(options, actor)),
    mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const names = new Map(folders.map((f) => [f.id, f.name]));
  return { ...result, rows: result.rows.map((d) => ({ ...d, folderName: d.folderId != null ? names.get(d.folderId) ?? "" : "" })) };
}

export async function getDocumentRow(id: number, actor: Session): Promise<DocumentRow> {
  const row = await documentsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Document");
  return row;
}

/** Persist an uploaded file and record its metadata. */
export async function uploadDocument(
  input: {
    file: File;
    ownerType: string;
    ownerId: number;
    category?: string;
    /** MRD folder to file it in. */
    folderId?: number | null;
    /** The name shown in lists; defaults to the file name. */
    title?: string;
    referenceNo?: string;
  },
  actor: Session,
) {
  const { file, ownerType, ownerId } = input;
  let folderName = "";
  if (input.folderId != null) {
    const folder = await mrdFoldersRepo.getRow(input.folderId);
    assertOwnedByHospital(folder, actor, "Folder");
    folderName = folder!.name;
  }
  if ((input.title ?? "").length > 120) throw new BadRequestError("The title is too long (120 characters at most)");
  if ((input.referenceNo ?? "").length > 60) throw new BadRequestError("The reference number is too long (60 characters at most)");

  if (!OWNER_TYPES.includes(ownerType as OwnerType)) {
    throw new BadRequestError(
      `ownerType must be one of: ${OWNER_TYPES.join(", ")}`,
    );
  }
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    throw new BadRequestError("A valid ownerId is required");
  }
  if (file.size === 0) {
    throw new BadRequestError("The uploaded file is empty");
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestError(
      `File is too large (max ${MAX_BYTES / 1024 / 1024} MB)`,
    );
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.includes(mime)) {
    throw new BadRequestError(
      `Unsupported file type "${mime}". Allowed: PDF, PNG, JPEG, WebP, HEIC.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put({
    data: buffer,
    fileName: file.name || "document",
    mimeType: mime,
  });

  const row = await documentsRepo.create({
    hospital_id: actor.hospitalId,
    owner_type: ownerType,
    owner_id: ownerId,
    category: input.category?.trim() || folderName || "General",
    title: input.title?.trim() || null,
    reference_no: input.referenceNo?.trim() || null,
    file_name: stored.fileName,
    mime_type: stored.mimeType,
    size_bytes: stored.sizeBytes,
    storage_key: stored.key,
    uploaded_by: actor.name,
    folder_id: input.folderId ?? null,
    retention_state: "Active",
  });

  await audit(actor, "upload", "document", row.id, {
    ownerType,
    ownerId,
    fileName: stored.fileName,
  });
  return toDocumentDTO(row as DocumentRow);
}

/** Fetch the binary contents for download. */
export async function readDocument(id: number, actor: Session) {
  const row = await getDocumentRow(id, actor);
  const data = await getStorage().get(row.storage_key);
  if (!data) throw new NotFoundError("Document file");
  return { row, data };
}

export async function deleteDocument(id: number, actor: Session) {
  const row = await getDocumentRow(id, actor);
  await getStorage().remove(row.storage_key);
  await documentsRepo.remove(id);
  await audit(actor, "delete", "document", id);
}

const editSchema = {
  title: { type: "string", required: false, max: 120 },
  referenceNo: { type: "string", required: false, max: 60 },
  category: { type: "string", required: false, max: 60 },
  folderId: { type: "number", required: false, min: 1 },
} as const;

/** Rename a document, change its folder or category, or set its reference number. `folderId: null` takes it out of a folder. */
export async function updateDocument(id: number, input: unknown, actor: Session) {
  const row = await getDocumentRow(id, actor);
  const body = (input ?? {}) as Record<string, unknown>;
  const data = validatePartial(editSchema, body);
  const patch: Record<string, unknown> = {};
  if ("title" in data) patch.title = String(data.title ?? "").trim() || null;
  if ("referenceNo" in data) patch.reference_no = String(data.referenceNo ?? "").trim() || null;
  if ("category" in data && String(data.category ?? "").trim()) patch.category = String(data.category).trim();
  if ("folderId" in body) {
    if (body.folderId == null || body.folderId === "") patch.folder_id = null;
    else {
      const folder = await mrdFoldersRepo.getRow(Number(body.folderId));
      assertOwnedByHospital(folder, actor, "Folder");
      patch.folder_id = folder!.id;
      if (!("category" in data)) patch.category = folder!.name;
    }
  }
  const updated = await documentsRepo.update(id, patch);
  await audit(actor, "update", "document", id, { fields: Object.keys(patch), fileName: row.file_name });
  return toDocumentDTO(updated as DocumentRow);
}
