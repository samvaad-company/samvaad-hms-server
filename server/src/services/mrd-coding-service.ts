/**
 * MRD coding — the discharged admissions waiting for their diagnosis and procedure codes.
 *
 *   Pending ──start──▶ In review ──mark coded──▶ Coded ──sign off──▶ Signed off
 *                         ▲  │ raise deficiency          │ reopen (with a reason)
 *                         │  ▼                           ▼
 *                      Deficient ──(last one resolved)──▶ In review
 *
 * A case appears in the queue when an admission is discharged (and older discharges are picked up the first time
 * the queue is opened). A chart can't be marked Coded without a valid ICD-10 principal diagnosis or while any
 * deficiency is open, and a signed-off case is locked until someone reopens it and says why.
 */
import { mrdCodingCasesRepo, mrdDeficienciesRepo, mrdFileRequestsRepo, ipdRepo } from "@/repositories";
import { toMrdCodingCaseDTO, toMrdDeficiencyDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type IpdAdmissionRow, type MrdCodingCaseRow, type MrdCodingDiagnosis, type MrdDeficiencyRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { DEFICIENCY_KINDS, type MrdCodingSummaryDTO } from "@shared/types/api";

/** ICD-10 shape: a letter (not U), two characters, then an optional dot and up to four more — E03.9, S52.501A, I10. */
export const ICD10 = /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
/** A procedure code: ICD-10-PCS (seven characters) or a CPT / hospital code (three to eight letters and digits). */
export const PROCEDURE_CODE = /^[A-Z0-9]{3,8}$/;

const admissionNo = (a: IpdAdmissionRow) => a.admission_no || `ADM/${String(a.admission_date ?? "").slice(2, 4) || localDate().slice(2, 4)}/${String(a.id).padStart(5, "0")}`;

// ── Queue ────────────────────────────────────────────────────────────────────

async function createCase(a: IpdAdmissionRow, hospitalId: number) {
  return mrdCodingCasesRepo.create({
    hospital_id: hospitalId,
    admission_id: a.id,
    admission_no: admissionNo(a),
    patient_id: a.patient_id ?? null,
    patient_name: a.patient_name,
    patient_code: a.patient_code ?? "",
    doctor: a.doctor ?? "",
    admitted_on: String(a.admission_date ?? "").slice(0, 10),
    status: "Pending",
    principal_dx_code: "",
    principal_dx_text: a.diagnosis ?? "",
    secondary_dx: [],
    procedures: [],
    coder_name: null,
    coded_at: null,
    signed_off_by: null,
    signed_off_at: null,
    queued_at: String(a.updated_at ?? new Date().toISOString()),
  });
}

/** Called when an admission is discharged: it joins the coding queue (once). Never fails the discharge. */
export async function queueForCoding(admission: IpdAdmissionRow): Promise<void> {
  try {
    if (admission.hospital_id == null) return;
    await singleFlight(`mrd-coding:${admission.hospital_id}:${admission.id}`, async () => {
      const { rows } = await mrdCodingCasesRepo.listRows({ filters: [{ column: "admission_id", op: "eq", value: admission.id }], pageSize: 1 });
      if (rows.length === 0) await createCase(admission, admission.hospital_id);
    });
  } catch {
    // The next time the queue is opened it catches up on any discharge that was missed.
  }
}

/** Pick up discharges that never reached the queue (older ones, or one missed above). One pass at a time per hospital. */
function syncCodingQueue(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`mrd-coding-sync:${hospitalId}`, async () => {
    const [{ rows: admissions }, { rows: cases }] = await Promise.all([
      ipdRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Discharged" }] }, actor)),
      mrdCodingCasesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    ]);
    const have = new Set(cases.map((c) => c.admission_id));
    for (const a of admissions as IpdAdmissionRow[]) if (!have.has(a.id)) await createCase(a, hospitalId);
  });
}

export const CODING_LIST_CONFIG = {
  searchColumns: ["patient_name", "patient_code", "admission_no", "principal_dx_code"],
  filterable: ["status", "patient_id", "admission_id"],
  sortable: ["queued_at", "id"],
  defaultSort: [{ column: "queued_at" as const, direction: "desc" as const }],
};

async function openCounts(actor: Session): Promise<Map<number, number>> {
  const { rows } = await mrdDeficienciesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Open" }] }, actor));
  const counts = new Map<number, number>();
  for (const d of rows) counts.set(d.case_id, (counts.get(d.case_id) ?? 0) + 1);
  return counts;
}

export async function listCodingCases(options: QueryOptions, actor: Session) {
  await syncCodingQueue(actor);
  const [{ rows, total }, counts] = await Promise.all([mrdCodingCasesRepo.listRows(scopeToHospital(options, actor)), openCounts(actor)]);
  return { rows: (rows as MrdCodingCaseRow[]).map((r) => toMrdCodingCaseDTO(r, counts.get(r.id) ?? 0)), total };
}

async function ownedCase(id: number, actor: Session): Promise<MrdCodingCaseRow> {
  const row = await mrdCodingCasesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Coding case");
  return row as MrdCodingCaseRow;
}

async function dtoOf(row: MrdCodingCaseRow, actor: Session) {
  const { rows } = await mrdDeficienciesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "case_id", op: "eq", value: row.id }, { column: "status", op: "eq", value: "Open" }] }, actor));
  return toMrdCodingCaseDTO(row, rows.length);
}

export async function getCodingCase(id: number, actor: Session) {
  return dtoOf(await ownedCase(id, actor), actor);
}

// ── Coding ───────────────────────────────────────────────────────────────────

const EDITABLE = new Set(["Pending", "In review", "Deficient"]);

function parseEntries(raw: unknown, field: string, pattern: RegExp, label: string): MrdCodingDiagnosis[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) throw new ValidationError([{ field, message: "must be a list" }]);
  if (raw.length > 30) throw new ValidationError([{ field, message: "at most 30 entries" }]);
  const seen = new Set<string>();
  return raw.map((e, i) => {
    const code = String((e as { code?: unknown })?.code ?? "").trim().toUpperCase();
    const text = String((e as { text?: unknown })?.text ?? "").trim().slice(0, 200);
    if (!pattern.test(code)) throw new ValidationError([{ field: `${field}[${i}].code`, message: `"${code}" isn't a valid ${label} code` }]);
    if (seen.has(code)) throw new ValidationError([{ field: `${field}[${i}].code`, message: `${code} is listed twice` }]);
    seen.add(code);
    return { code, text };
  });
}

/** Save the codes entered so far. The first save takes the case into review under the coder's name. */
export async function saveCoding(id: number, input: unknown, actor: Session) {
  await ownedCase(id, actor);
  const body = (input ?? {}) as Record<string, unknown>;
  const principal = String(body.principalDxCode ?? "").trim().toUpperCase();
  if (principal && !ICD10.test(principal)) throw new ValidationError([{ field: "principalDxCode", message: `"${principal}" isn't a valid ICD-10 code (like E03.9)` }]);
  const text = String(body.principalDxText ?? "").trim().slice(0, 200);
  const secondary = parseEntries(body.secondaryDx, "secondaryDx", ICD10, "ICD-10");
  const procedures = parseEntries(body.procedures, "procedures", PROCEDURE_CODE, "procedure");
  if (principal && secondary.some((s) => s.code === principal)) throw new ValidationError([{ field: "secondaryDx", message: "the principal diagnosis is already the main code" }]);

  const updated = await withKeyLocks([`coding:${id}`], async () => {
    const row = await ownedCase(id, actor);
    if (!EDITABLE.has(row.status)) throw new ConflictError(`This chart is ${row.status.toLowerCase()} — reopen it to change the codes`);
    return mrdCodingCasesRepo.update(id, {
      principal_dx_code: principal, principal_dx_text: text, secondary_dx: secondary, procedures,
      status: row.status === "Pending" ? "In review" : row.status,
      coder_name: row.coder_name ?? actor.name,
    });
  });
  await audit(actor, "code", "mrd-coding", id, { principal, secondary: secondary.length, procedures: procedures.length });
  return dtoOf(updated as MrdCodingCaseRow, actor);
}

/** Take a pending case into review without entering codes yet. */
export async function startReview(id: number, actor: Session) {
  await ownedCase(id, actor);
  const updated = await withKeyLocks([`coding:${id}`], async () => {
    const row = await ownedCase(id, actor);
    if (row.status !== "Pending") throw new ConflictError(`This chart is already ${row.status.toLowerCase()}`);
    return mrdCodingCasesRepo.update(id, { status: "In review", coder_name: actor.name });
  });
  await audit(actor, "start", "mrd-coding", id);
  return dtoOf(updated as MrdCodingCaseRow, actor);
}

export async function markCoded(id: number, actor: Session) {
  await ownedCase(id, actor);
  const updated = await withKeyLocks([`coding:${id}`], async () => {
    const row = await ownedCase(id, actor);
    if (row.status === "Coded" || row.status === "Signed off") throw new ConflictError(`This chart is already ${row.status.toLowerCase()}`);
    if (!ICD10.test(row.principal_dx_code ?? "")) throw new ConflictError("Enter a valid ICD-10 principal diagnosis before marking the chart coded");
    const { rows } = await mrdDeficienciesRepo.listRows({ unpaged: true, filters: [{ column: "case_id", op: "eq", value: id }, { column: "status", op: "eq", value: "Open" }] });
    if (rows.length > 0) throw new ConflictError(`${rows.length} open ${rows.length === 1 ? "deficiency" : "deficiencies"} — resolve ${rows.length === 1 ? "it" : "them"} first`);
    return mrdCodingCasesRepo.update(id, { status: "Coded", coded_at: new Date().toISOString(), coder_name: row.coder_name ?? actor.name });
  });
  await audit(actor, "coded", "mrd-coding", id);
  return dtoOf(updated as MrdCodingCaseRow, actor);
}

export async function signOffCase(id: number, actor: Session) {
  await ownedCase(id, actor);
  const updated = await withKeyLocks([`coding:${id}`], async () => {
    const row = await ownedCase(id, actor);
    if (row.status !== "Coded") throw new ConflictError(row.status === "Signed off" ? "This chart is already signed off" : "Only a coded chart can be signed off");
    return mrdCodingCasesRepo.update(id, { status: "Signed off", signed_off_by: actor.name, signed_off_at: new Date().toISOString() });
  });
  await audit(actor, "sign-off", "mrd-coding", id);
  return dtoOf(updated as MrdCodingCaseRow, actor);
}

/** Open a coded or signed-off chart again for correction. The reason is kept in the audit log. */
export async function reopenCase(id: number, input: unknown, actor: Session) {
  await ownedCase(id, actor);
  const { reason } = validate({ reason: { type: "string", required: true, min: 3, max: 200 } } as const, input);
  const updated = await withKeyLocks([`coding:${id}`], async () => {
    const row = await ownedCase(id, actor);
    if (row.status !== "Coded" && row.status !== "Signed off") throw new ConflictError("Only a coded or signed-off chart can be reopened");
    return mrdCodingCasesRepo.update(id, { status: "In review", coded_at: null, signed_off_by: null, signed_off_at: null });
  });
  await audit(actor, "reopen", "mrd-coding", id, { reason });
  return dtoOf(updated as MrdCodingCaseRow, actor);
}

// ── Deficiencies ─────────────────────────────────────────────────────────────

export async function listDeficiencies(caseId: number, actor: Session) {
  await ownedCase(caseId, actor);
  const { rows } = await mrdDeficienciesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "case_id", op: "eq", value: caseId }], sort: [{ column: "id", direction: "desc" }] }, actor));
  return rows.map(toMrdDeficiencyDTO);
}

export async function raiseDeficiency(caseId: number, input: unknown, actor: Session) {
  await ownedCase(caseId, actor);
  const data = validate({
    kind: { type: "enum", required: true, values: DEFICIENCY_KINDS },
    note: { type: "string", required: false, max: 200, default: "" },
  } as const, input);
  if (data.kind === "Other" && !data.note) throw new ValidationError([{ field: "note", message: "say what is missing" }]);
  const row = await withKeyLocks([`coding:${caseId}`], async () => {
    const c = await ownedCase(caseId, actor);
    if (c.status === "Signed off") throw new ConflictError("This chart is signed off — reopen it before raising a deficiency");
    const created = await mrdDeficienciesRepo.create({
      hospital_id: requireHospitalId(actor), case_id: caseId, kind: data.kind, note: data.note, status: "Open",
      raised_by: actor.name, raised_at: new Date().toISOString(), resolved_by: null, resolved_at: null,
    });
    await mrdCodingCasesRepo.update(caseId, { status: "Deficient", coded_at: null, coder_name: c.coder_name ?? actor.name });
    return created;
  });
  await audit(actor, "deficiency", "mrd-coding", caseId, { kind: data.kind });
  return toMrdDeficiencyDTO(row as MrdDeficiencyRow);
}

export async function resolveDeficiency(id: number, actor: Session) {
  const first = await mrdDeficienciesRepo.getRow(id);
  assertOwnedByHospital(first, actor, "Deficiency");
  const resolved = await withKeyLocks([`coding:${first!.case_id}`], async () => {
    const d = (await mrdDeficienciesRepo.getRow(id)) as MrdDeficiencyRow;
    if (d.status !== "Open") throw new ConflictError("This deficiency is already resolved");
    const row = await mrdDeficienciesRepo.update(id, { status: "Resolved", resolved_by: actor.name, resolved_at: new Date().toISOString() });
    const { rows: stillOpen } = await mrdDeficienciesRepo.listRows({ unpaged: true, filters: [{ column: "case_id", op: "eq", value: d.case_id }, { column: "status", op: "eq", value: "Open" }] });
    const c = await ownedCase(d.case_id, actor);
    if (stillOpen.length === 0 && c.status === "Deficient") await mrdCodingCasesRepo.update(c.id, { status: "In review" });
    return row;
  });
  await audit(actor, "resolve-deficiency", "mrd-coding", first!.case_id, { deficiencyId: id });
  return toMrdDeficiencyDTO(resolved as MrdDeficiencyRow);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function codingSummary(actor: Session): Promise<MrdCodingSummaryDTO> {
  await syncCodingQueue(actor);
  const [{ rows: cases }, { rows: open }, { rows: requests }] = await Promise.all([
    mrdCodingCasesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    mrdDeficienciesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Open" }] }, actor)),
    mrdFileRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Pending" }] }, actor)),
  ]);
  const n = (s: string) => cases.filter((c) => c.status === s).length;
  return {
    awaitingCoding: n("Pending") + n("In review"),
    pending: n("Pending"),
    deficient: n("Deficient"),
    coded: n("Coded"),
    signedOff: n("Signed off"),
    openDeficiencies: open.length,
    pendingFileRequests: requests.length,
  };
}
