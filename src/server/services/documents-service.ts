/**
 * Documents service — file attachments for patients, lab reports, donor ID
 * proofs and similar. Binary data lives in the storage driver; only metadata
 * is persisted in the database.
 */
import { documentsRepo } from "@/server/repositories";
import { toDocumentDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type DocumentRow } from "@/server/db/tables";
import { NotFoundError, BadRequestError } from "@/server/lib/errors";
import { getStorage } from "@/server/storage";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

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
  searchColumns: ["file_name", "category"],
  filterable: ["owner_type", "owner_id", "category"],
  sortable: ["created_at", "file_name"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listDocuments(options: QueryOptions, actor: Session) {
  return documentsRepo.list(scopeToHospital(options, actor));
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
  },
  actor: Session,
) {
  const { file, ownerType, ownerId } = input;

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
    category: input.category?.trim() || "General",
    file_name: stored.fileName,
    mime_type: stored.mimeType,
    size_bytes: stored.sizeBytes,
    storage_key: stored.key,
    uploaded_by: actor.name,
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
