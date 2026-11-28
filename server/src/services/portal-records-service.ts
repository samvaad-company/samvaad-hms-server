/**
 * Patient portal: the patient's reports and papers (lab, radiology and documents), downloading them, and the patient's own uploads.
 *
 * Record ids are "<kind>-<number>": lab-31, radiology-4, doc-12, so the three tables never clash.
 *  - lab / radiology: a test is listed with its report when one is attached ("Completed", hasFile true) and as "In progress" without one.
 *    No result text ever leaves the HMS here, only the report file. A report is a data URL or a Firebase Storage link; the link is fetched
 *    by the HMS and streamed to the portal, never handed out.
 *  - document: a file attached to the patient. Staff files are hidden until someone shares them (visible_to_patient). The patient's own
 *    uploads are always theirs to see, with whether staff have accepted them.
 * A patient cannot read, list or delete anything that is not theirs: those are 404.
 */
import { documentsRepo, labRepo, radiologyRepo } from "@/repositories";
import { type DocumentRow, type LabTestRow, type RadiologyTestRow } from "@/db/tables";
import { AppError, BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { getStorage } from "@/storage";
import { audit } from "@/services/audit";
import { assertPatientRecord, dayOf, portalPatient, slicePage } from "@/services/portal-common";

export const PORTAL_CATEGORIES = ["Outside lab report", "Outside prescription", "Discharge summary", "Insurance", "ID proof", "Other"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 50;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const FIREBASE_STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//;
const MAX_FETCH_BYTES = 25 * 1024 * 1024;

type Kind = "lab" | "radiology" | "document";

export interface RecordRow {
  id: string;
  kind: Kind;
  title: string;
  date: string;
  doctorName?: string;
  category?: string;
  status?: string;
  hasFile: boolean;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  source: "hospital" | "patient";
  reviewStatus: "pending" | "approved" | "rejected";
  rejectionReason?: string;
}

/** "lab-31" → { kind: "lab", n: 31 }; anything else is rejected. */
export function parseRecordId(raw: string): { kind: Kind; n: number } {
  const m = /^(lab|radiology|doc)-(\d{1,12})$/.exec(raw);
  if (!m) throw new NotFoundError("Record");
  return { kind: m[1] === "doc" ? "document" : (m[1] as Kind), n: Number(m[2]) };
}

const mimeFromName = (name: string): string => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : /^jpe?g$/.test(ext) ? "image/jpeg" : "application/octet-stream";
};

const testRow = (kind: "lab" | "radiology", t: LabTestRow | RadiologyTestRow): RecordRow => {
  const has = !!t.report_file;
  const name = t.report_file_name ?? "";
  return {
    id: `${kind}-${t.id}`, kind, title: t.test_name, date: dayOf(t.test_date) || dayOf(t.created_at),
    ...(t.doctor ? { doctorName: t.doctor } : {}),
    status: has ? "Completed" : "In progress", hasFile: has,
    ...(has ? { fileName: name || "report", mimeType: mimeFromName(name) } : {}),
    source: "hospital", reviewStatus: "approved",
  };
};

const docRow = (d: DocumentRow): RecordRow => ({
  id: `doc-${d.id}`, kind: "document", title: d.title || d.file_name, date: dayOf(d.created_at), category: d.category,
  hasFile: true, fileName: d.file_name, mimeType: d.mime_type, sizeBytes: d.size_bytes,
  source: d.source === "patient" ? "patient" : "hospital", reviewStatus: d.review_status ?? "approved",
  ...(d.review_status === "rejected" && d.rejection_reason ? { rejectionReason: d.rejection_reason } : {}),
});

/** Documents the patient may see: files shared with them, and everything they uploaded themselves. */
const visibleDocs = (docs: DocumentRow[], patientId: number, hospitalId: number) =>
  docs.filter((d) => d.owner_type === "patient" && d.owner_id === patientId && d.hospital_id === hospitalId && (d.source === "patient" || d.visible_to_patient === true));

export async function portalRecords(patientId: number, kind: string, page: number, pageSize: number): Promise<RecordRow[]> {
  const patient = await portalPatient(patientId);
  const by = [{ column: "patient_id", op: "eq" as const, value: patient.id }];
  const want = (k: Kind) => kind === "all" || kind === k;
  const out: RecordRow[] = [];
  if (want("lab")) {
    const { rows } = await labRepo.listRows({ unpaged: true, filters: by } as never);
    out.push(...(rows as LabTestRow[]).filter((t) => t.hospital_id === patient.hospital_id && t.status !== "Cancelled").map((t) => testRow("lab", t)));
  }
  if (want("radiology")) {
    const { rows } = await radiologyRepo.listRows({ unpaged: true, filters: by } as never);
    out.push(...(rows as RadiologyTestRow[]).filter((t) => t.hospital_id === patient.hospital_id && t.status !== "Cancelled").map((t) => testRow("radiology", t)));
  }
  if (want("document")) {
    const { rows } = await documentsRepo.listRows({ unpaged: true, filters: [{ column: "owner_id", op: "eq", value: patient.id }] } as never);
    out.push(...visibleDocs(rows as DocumentRow[], patient.id, patient.hospital_id).map(docRow));
  }
  out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return slicePage(out, page, pageSize);
}

// ── Download ─────────────────────────────────────────────────────────────────

export interface RecordFile { data: Buffer; mimeType: string; fileName: string }

async function reportBytes(url: string, fileName: string): Promise<RecordFile> {
  if (url.startsWith("data:")) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m) throw new NotFoundError("Report");
    const data = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
    return { data, mimeType: m[1] || mimeFromName(fileName), fileName };
  }
  // Only the hospital's own file storage: the address in a record is never fetched blindly.
  if (!FIREBASE_STORAGE_URL.test(url)) throw new NotFoundError("Report");
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res || !res.ok) throw new AppError(502, "INTERNAL", "The report could not be fetched just now. Please try again in a moment.");
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length > MAX_FETCH_BYTES) throw new AppError(502, "INTERNAL", "This report is too large to download here. Please ask the hospital for a copy.");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  return { data, mimeType: type && type !== "application/octet-stream" ? type : mimeFromName(fileName), fileName };
}

/** The bytes of one record, or 404 when it is not this patient's (or has no file). Every download is audited. */
export async function portalRecordFile(recordId: string, patientId: number): Promise<RecordFile> {
  const patient = await portalPatient(patientId);
  const { kind, n } = parseRecordId(recordId);
  let file: RecordFile;
  if (kind === "document") {
    const row = await documentsRepo.getRow(n) as DocumentRow | null;
    // A document names its owner, not a patient id: it must be a patient file owned by this patient and visible to them.
    if (!row || row.owner_type !== "patient" || row.owner_id !== patient.id || row.hospital_id !== patient.hospital_id || !(row.source === "patient" || row.visible_to_patient === true)) throw new NotFoundError("Record");
    const data = await getStorage().get(row.storage_key);
    if (!data) throw new NotFoundError("Record");
    file = { data, mimeType: row.mime_type, fileName: row.file_name };
  } else {
    const repo = kind === "lab" ? labRepo : radiologyRepo;
    const row = assertPatientRecord(await repo.getRow(n) as LabTestRow | null, patient, "Record");
    if (!row.report_file || row.status === "Cancelled") throw new NotFoundError("Record");
    file = await reportBytes(row.report_file, row.report_file_name || `${row.test_name}.pdf`);
  }
  await audit(null, "download", kind === "document" ? "document" : kind, n, { via: "patient-portal" });
  return file;
}

// ── Upload and delete ────────────────────────────────────────────────────────

/** The file type judged by its first bytes, not by its name or the type the sender claims. */
export function sniffType(b: Buffer): string | null {
  if (b.length >= 4 && b.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length >= 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.length >= 12 && b.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)/.test(b.subarray(8, 12).toString("latin1"))) return "image/heic";
  return null;
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

/** A file name that cannot carry a path or odd characters, with an extension that matches what the file really is. */
function cleanName(name: string, type: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "").replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 80) || "upload";
  return `${base}.${EXT[type]}`;
}

export async function portalUpload(patientId: number, file: File, fields: { category?: unknown; title?: unknown; note?: unknown }) {
  const patient = await portalPatient(patientId);
  const category = String(fields.category ?? "");
  if (!(PORTAL_CATEGORIES as readonly string[]).includes(category)) throw new BadRequestError(`Choose what this is: ${PORTAL_CATEGORIES.join(", ")}.`);
  const title = String(fields.title ?? "").trim();
  if (title.length > 120) throw new BadRequestError("The title is too long (120 characters at most).");
  const note = String(fields.note ?? "").trim().slice(0, 500);
  if (file.size === 0) throw new BadRequestError("The file is empty.");
  if (file.size > MAX_BYTES) throw new AppError(413, "BAD_REQUEST", "That file is too large. The most we can take is 10 MB.");
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (!type) throw new AppError(415, "BAD_REQUEST", "That kind of file can't be uploaded. Please send a PDF or a photo (JPG, PNG, WEBP or HEIC).");

  const { rows } = await documentsRepo.listRows({ unpaged: true, filters: [{ column: "owner_id", op: "eq", value: patient.id }] } as never);
  const mine = (rows as DocumentRow[]).filter((d) => d.owner_type === "patient" && d.hospital_id === patient.hospital_id && d.source === "patient");
  if (mine.length >= MAX_FILES) throw new ConflictError("You have reached the limit of 50 uploaded files. Please ask the hospital to clear some.");
  if (mine.reduce((n, d) => n + d.size_bytes, 0) + data.length > MAX_TOTAL_BYTES) throw new ConflictError("You have reached the storage limit for uploaded files. Please ask the hospital to clear some.");

  const fileName = cleanName(file.name, type);
  const stored = await getStorage().put({ data, fileName, mimeType: type });
  const row = await documentsRepo.create({
    hospital_id: patient.hospital_id, owner_type: "patient", owner_id: patient.id, category, title: title || null, reference_no: null,
    file_name: stored.fileName, mime_type: stored.mimeType, size_bytes: stored.sizeBytes, storage_key: stored.key,
    uploaded_by: "Patient (portal)", folder_id: null, retention_state: "Active",
    visible_to_patient: true, source: "patient", review_status: "pending", rejection_reason: null, upload_note: note || null,
  } as never) as DocumentRow;
  await audit(null, "upload", "document", row.id, { via: "patient-portal", category, sizeBytes: stored.sizeBytes });
  return docRow(row);
}

/** The patient removes their own upload, only while staff have not yet looked at it. */
export async function portalDeleteUpload(recordId: string, patientId: number) {
  const patient = await portalPatient(patientId);
  const { kind, n } = parseRecordId(recordId.startsWith("doc-") ? recordId : `doc-${recordId}`);
  if (kind !== "document") throw new NotFoundError("Record");
  const row = await documentsRepo.getRow(n) as DocumentRow | null;
  if (!row || row.owner_type !== "patient" || row.owner_id !== patient.id || row.hospital_id !== patient.hospital_id || row.source !== "patient") throw new NotFoundError("Record");
  if ((row.review_status ?? "pending") !== "pending") throw new ConflictError("The hospital has already looked at this file, so it can't be removed here. Please call the hospital.");
  await getStorage().remove(row.storage_key);
  await documentsRepo.remove(row.id);
  await audit(null, "delete", "document", row.id, { via: "patient-portal" });
}
