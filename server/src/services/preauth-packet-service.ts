/**
 * The claim packet: once a pre-auth form is filled, signed and stamped, everything the insurer wants with it — the form, the
 * prescription, the patient's reports, their Aadhaar and PAN cards and the policy — is gathered into one PDF. This service lists
 * what is on file for the patient and hands over what was chosen; the PDF itself is put together in the browser, next to the
 * form's own PDF. Only papers that belong to the form's own patient (and hospital) can go in.
 */
import { documentsRepo, labRepo, patientsRepo, preauthFormsRepo, prescriptionsRepo, radiologyRepo } from "@/repositories";
import { type DocumentRow, type PreauthFormRow } from "@/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can } from "@/auth/rbac";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { getPrescription } from "@/services/prescriptions-service";
import { readDocument, uploadDocument } from "@/services/documents-service";
import { audit } from "@/services/audit";
import type { PacketContentDTO, PacketDocKind, PacketDocumentOption, PacketFileDTO, PacketOptionsDTO, PacketPrescriptionDTO } from "@shared/types/preauth";

/** Together the chosen files may be this big (as data URLs the browser then merges). */
const MAX_PACKET_CHARS = 45_000_000;

const CATEGORY_FOR: Record<Exclude<PacketDocKind, "other">, string> = { aadhaar: "Aadhaar card", pan: "PAN card", policy: "Insurance policy" };

/** What a paper on file is, by its category, title and file name. */
export function docKind(d: { category?: string | null; title?: string | null; file_name?: string | null }): PacketDocKind {
  const text = `${d.category ?? ""} ${d.title ?? ""} ${d.file_name ?? ""}`.toLowerCase();
  if (/aadhaar|aadhar|adhaar|adhar|uidai/.test(text)) return "aadhaar";
  if (/(^|[^a-z])pan([^a-z]|$)|permanent account/.test(text)) return "pan";
  if (/polic|insurance card|e-card|ecard/.test(text)) return "policy";
  return "other";
}

async function load(id: number, actor: Session): Promise<PreauthFormRow> {
  const row = (await preauthFormsRepo.getRow(id)) as PreauthFormRow | null;
  assertOwnedByHospital(row, actor, "Pre-auth form");
  const f = row as PreauthFormRow;
  if (!(can(actor.role, "tpa", "read", actor.hospitalId) || (actor.role === "Doctor" && actor.doctorId === f.doctor_id))) throw new ForbiddenError("You can't open this form's papers.");
  return f;
}

const isDataUrl = (s: unknown): s is string => typeof s === "string" && /^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(s);
const mimeOfDataUrl = (s: string) => /^data:([^;]+);/.exec(s)?.[1] ?? "application/octet-stream";
/** Reports are kept either as a data URL or, once uploaded to the hospital's cloud storage, as a download link there. Only that storage is ever fetched. */
const STORAGE_URL = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** The report as a data URL, whichever way it is stored. */
async function reportDataUrl(stored: string | null | undefined, fileName: string | null | undefined): Promise<string> {
  if (isDataUrl(stored)) return stored;
  if (typeof stored !== "string" || !STORAGE_URL.test(stored)) throw new NotFoundError("Report file");
  const res = await fetch(stored, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res || !res.ok) throw new NotFoundError("Report file");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_FILE_BYTES) throw new BadRequestError("A report is larger than 10 MB. Leave it out, or use a smaller scan.");
  const ext = (fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  const type = MIME_BY_EXT[ext] ?? (res.headers.get("content-type") ?? "").split(";")[0] ?? "application/pdf";
  return `data:${type || "application/pdf"};base64,${buf.toString("base64")}`;
}

export async function getPacketOptions(formId: number, actor: Session): Promise<PacketOptionsDTO> {
  const form = await load(formId, actor);
  const pid = form.patient_id;
  const base: PacketOptionsDTO = { formId: form.id, formName: form.form_name, patientId: pid, patientName: form.patient_name, ready: form.status === "Ready", prescriptions: [], reports: [], documents: [] };
  if (!pid) return base;
  const byPatient = [{ column: "patient_id", op: "eq" as const, value: pid }];
  const [rx, lab, rad, docs] = await Promise.all([
    prescriptionsRepo.listRows(scopeToHospital({ unpaged: true, filters: byPatient, sort: [{ column: "id", direction: "desc" }] }, actor)),
    labRepo.listRows(scopeToHospital({ unpaged: true, filters: byPatient, sort: [{ column: "id", direction: "desc" }] }, actor)),
    radiologyRepo.listRows(scopeToHospital({ unpaged: true, filters: byPatient, sort: [{ column: "id", direction: "desc" }] }, actor)),
    documentsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "owner_type", op: "eq", value: "patient" }, { column: "owner_id", op: "eq", value: pid }], sort: [{ column: "id", direction: "desc" }] }, actor)),
  ]);
  base.prescriptions = rx.rows.map((r) => ({ id: r.id, rxNumber: r.rx_number, date: r.prescribed_date, doctor: r.doctor, diagnosis: r.diagnosis ?? "", medicineCount: r.medicine_count ?? 0 }));
  base.reports = [
    ...lab.rows.filter((t) => t.report_file).map((t) => ({ key: `report:lab:${t.id}`, group: "Lab" as const, name: t.test_name, date: t.test_date, fileName: t.report_file_name ?? "report" })),
    ...rad.rows.filter((t) => t.report_file).map((t) => ({ key: `report:radiology:${t.id}`, group: "Radiology" as const, name: t.test_name, date: t.test_date, fileName: t.report_file_name ?? "report" })),
  ];
  base.documents = (docs.rows as DocumentRow[]).map((d): PacketDocumentOption => ({
    id: d.id, title: d.title || d.file_name, category: d.category, fileName: d.file_name, mimeType: d.mime_type, sizeBytes: d.size_bytes, kind: docKind(d), uploadedAt: d.created_at,
  }));
  return base;
}

/** The papers that were chosen: `{ prescriptions: [id], reports: ["report:lab:12"], documents: [id] }`. */
export async function getPacketContent(formId: number, input: unknown, actor: Session): Promise<PacketContentDTO> {
  const form = await load(formId, actor);
  if (form.status !== "Ready") throw new ConflictError("The packet can be made once the form is signed and stamped.");
  const pid = form.patient_id;
  if (!pid) throw new BadRequestError("This form has no patient.");
  const body = (typeof input === "object" && input !== null ? input : {}) as { prescriptions?: unknown; reports?: unknown; documents?: unknown };
  const ids = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50) : []);
  const keys = Array.isArray(body.reports) ? (body.reports as unknown[]).map(String).slice(0, 50) : [];

  const prescriptions: PacketPrescriptionDTO[] = [];
  for (const rid of ids(body.prescriptions)) {
    const rx = await getPrescription(rid, actor);
    if (rx.patientId !== pid) throw new ForbiddenError("That prescription is not this patient's.");
    prescriptions.push({
      id: rx.id, rxNumber: rx.rxNumber, date: rx.date, doctor: rx.doctor, diagnosis: rx.diagnosis, patientName: rx.patientName, patientAge: rx.patientAge,
      gender: rx.patient?.gender ?? null, allergies: rx.patient?.allergies ?? null,
      items: rx.items.map((i) => ({ medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions })),
    });
  }

  const files: PacketFileDTO[] = [];
  for (const key of keys) {
    const m = /^report:(lab|radiology):(\d+)$/.exec(key);
    if (!m) throw new BadRequestError(`Unknown report ${key}`);
    const row = m[1] === "lab" ? await labRepo.getRow(Number(m[2])) : await radiologyRepo.getRow(Number(m[2]));
    if (!row) throw new NotFoundError("Report");
    assertOwnedByHospital(row, actor, "Report");
    if (row.patient_id !== pid) throw new ForbiddenError("That report is not this patient's.");
    const dataUrl = await reportDataUrl(row.report_file, row.report_file_name);
    files.push({ key, label: `${m[1] === "lab" ? "Lab" : "Radiology"} report — ${row.test_name}`, fileName: row.report_file_name ?? "report", mimeType: mimeOfDataUrl(dataUrl), dataUrl });
  }
  for (const did of ids(body.documents)) {
    const { row, data } = await readDocument(did, actor);
    if (row.owner_type !== "patient" || row.owner_id !== pid) throw new ForbiddenError("That paper is not this patient's.");
    const kind = docKind(row);
    const label = kind === "other" ? row.title || row.file_name : CATEGORY_FOR[kind];
    files.push({ key: `document:${row.id}`, label, fileName: row.file_name, mimeType: row.mime_type, dataUrl: `data:${row.mime_type};base64,${Buffer.from(data).toString("base64")}` });
  }
  const total = files.reduce((n, f) => n + f.dataUrl.length, 0);
  if (total > MAX_PACKET_CHARS) throw new BadRequestError("These papers add up to more than 30 MB. Leave some out, or use smaller scans.");
  await audit(actor, "preauth.packet", "preauth_form", form.id, { prescriptions: prescriptions.length, files: files.length });
  return { prescriptions, files };
}

/** Puts an Aadhaar card, PAN card or policy on the patient's file, ready to go into the packet. */
export async function uploadPacketDocument(formId: number, kind: unknown, file: File, actor: Session) {
  const form = await load(formId, actor);
  if (!can(actor.role, "tpa", "write", actor.hospitalId)) throw new ForbiddenError("You can't add papers to this form.");
  if (kind !== "aadhaar" && kind !== "pan" && kind !== "policy") throw new BadRequestError("Say what the paper is: aadhaar, pan or policy.");
  if (!form.patient_id) throw new BadRequestError("This form has no patient.");
  const patient = await patientsRepo.getRow(form.patient_id);
  assertOwnedByHospital(patient, actor, "Patient");
  return uploadDocument({ file, ownerType: "patient", ownerId: form.patient_id, category: CATEGORY_FOR[kind], title: CATEGORY_FOR[kind] }, actor);
}
