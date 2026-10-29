/**
 * Consents — the forms a patient signs, on paper or on their phone, in English, Hindi or Gujarati.
 *
 *   make (Draft) ──print──▶ signed on paper (+ scanned copy)
 *        │
 *        └──send to sign on phone──▶ Waiting (a link) ──▶ Signed | Refused
 *                                        │  └─ cancelled or expired: make another link
 *
 * A link's long random token is its only credential. It can be shown as a QR code, emailed, sent over WhatsApp / SMS
 * from the staff member's own device, or opened on the hospital's tablet. The first time the patient opens it is
 * recorded, so staff can see "Opened on phone". Phone signing needs a drawn signature and the patient's own name and
 * relation; the signed copy is the form, the signature and who signed when. This server doesn't send messages itself.
 */
import { randomBytes } from "node:crypto";
import { signatureRequestsRepo, patientsRepo, hospitalsRepo, mrdFoldersRepo } from "@/repositories";
import { toConsentDTO, signatureStatusOf } from "@/repositories/mappers";
import { type SignatureRequestRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError, ValidationError, isAppError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate, zonedInstant } from "@/lib/clock";
import { withKeyLocks } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { uploadDocument } from "@/services/documents-service";
import { ensureFolders } from "@/services/mrd-documents-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { CONSENT_DELIVERIES, type ConsentCountsDTO, type ConsentDocumentDTO, type ConsentDTO, type ConsentTextDTO, type PublicConsentDTO } from "@shared/types/api";
import { CONSENT_LANGUAGES, RELATIONS, consentForm } from "@shared/types/consent-catalog";
import { fillPlaceholders, resolveTemplate } from "@/services/consent-templates-service";
import { publicAppUrl, sendSigningLink } from "@/services/whatsapp-service";
import type { WhatsappSendResult } from "@shared/types/api";

const VALID_DAYS = [1, 3, 7];
const MAX_SIGNATURE_CHARS = 300_000; // a drawn PNG data URL; plenty for a signature, small enough to keep rows light
const PAPER_FOLDER = "Consent & Undertakings";

const mintToken = () => randomBytes(24).toString("base64url");

async function ownedRow(id: number, actor: Session): Promise<SignatureRequestRow> {
  const row = await signatureRequestsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Consent");
  return row as SignatureRequestRow;
}

// ── Making a consent ─────────────────────────────────────────────────────────

const makeSchema = {
  template: { type: "string", required: true, min: 1, max: 60 },
  language: { type: "enum", required: false, values: CONSENT_LANGUAGES, default: "English" },
  includeEnglish: { type: "boolean", required: false, default: false },
} as const;

/** Make a consent for a patient: nothing is sent yet; print it, sign it on paper, or send a link. */
export async function makeConsent(patientId: number, input: unknown, actor: Session): Promise<ConsentDTO> {
  const data = validate(makeSchema, input);
  const form = await resolveTemplate(data.template, actor);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const language = data.language as (typeof CONSENT_LANGUAGES)[number];
  if (!form.bodies[language]) throw new ValidationError([{ field: "language", message: `"${form.titles.English}" has no ${language} text — choose another language or add it to the template` }]);
  // Copy the finished wording onto the consent, so editing the template later never changes what was issued.
  const vars = { patientName: patient!.name, age: patient!.age ?? null };
  const texts: Record<string, ConsentTextDTO> = {};
  for (const l of CONSENT_LANGUAGES) if (form.bodies[l]) texts[l] = { title: fillPlaceholders(form.titles[l], vars), body: fillPlaceholders(form.bodies[l], vars) };
  const row = await signatureRequestsRepo.create({
    hospital_id: requireHospitalId(actor),
    patient_id: patient!.id,
    patient_name: patient!.name,
    patient_code: patient!.patient_code,
    patient_phone: patient!.phone ?? "",
    template_key: form.key,
    template_texts: texts,
    form_title: texts[language].title,
    form_body: texts[language].body,
    language,
    include_english: language !== "English" && data.includeEnglish,
    token: null,
    status: "Draft",
    sent_by: actor.name,
    sent_at: new Date().toISOString(),
    expires_at: null,
    link_sent_at: null, delivery: null, opened_at: null,
    signed_at: null, signer_name: null, signer_relation: null, signed_via: null, signed_language: null, witness_name: null, signed_document_id: null,
    signature_data: null, refused_reason: null, cancelled_at: null,
  });
  await audit(actor, "make", "consent", row.id, { patientId, form: form.key, language });
  return toConsentDTO(row as SignatureRequestRow);
}

export async function getConsent(id: number, actor: Session) {
  return toConsentDTO(await ownedRow(id, actor));
}

/** A patient's consents, newest first. */
export async function listPatientConsents(patientId: number, actor: Session) {
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const { rows } = await signatureRequestsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "desc" }] }, actor));
  return (rows as SignatureRequestRow[]).filter((r) => r.patient_id === patientId).map(toConsentDTO);
}

export type ConsentBucket = "draft" | "waiting" | "signed" | "refused" | "ended" | "all";

/** Every consent in the hospital (newest first) with the filter counts; `bucket` and `q` narrow the list, not the counts. */
export async function listConsents(actor: Session, bucket: ConsentBucket = "all", q = ""): Promise<{ items: ConsentDTO[]; counts: ConsentCountsDTO }> {
  const { rows } = await signatureRequestsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "desc" }] }, actor));
  const all = (rows as SignatureRequestRow[]).map(toConsentDTO);
  const counts: ConsentCountsDTO = {
    draft: all.filter((r) => r.status === "Draft").length,
    waiting: all.filter((r) => r.status === "Waiting").length,
    signed: all.filter((r) => r.status === "Signed").length,
    refused: all.filter((r) => r.status === "Refused").length,
    expiredOrCancelled: all.filter((r) => r.status === "Cancelled" || r.status === "Expired").length,
    all: all.length,
  };
  const term = q.trim().toLowerCase();
  const items = all.filter((r) => {
    if (bucket === "draft" && r.status !== "Draft") return false;
    if (bucket === "waiting" && r.status !== "Waiting") return false;
    if (bucket === "signed" && r.status !== "Signed") return false;
    if (bucket === "refused" && r.status !== "Refused") return false;
    if (bucket === "ended" && r.status !== "Cancelled" && r.status !== "Expired") return false;
    return !term || r.patientName.toLowerCase().includes(term) || r.formTitle.toLowerCase().includes(term) || r.patientCode.toLowerCase().includes(term);
  });
  return { items, counts };
}

/** A consent that was only made (never sent or signed) can be thrown away. */
export async function deleteConsent(id: number, actor: Session) {
  await ownedRow(id, actor);
  await withKeyLocks([`consent:${id}`], async () => {
    const row = await ownedRow(id, actor);
    if (row.status !== "Draft") throw new ConflictError("Only a form that hasn't been sent or signed can be deleted");
    await signatureRequestsRepo.remove(id);
  });
  await audit(actor, "delete", "consent", id);
}

// ── Sending a link ───────────────────────────────────────────────────────────

const linkSchema = {
  signerName: { type: "string", required: false, max: 80, default: "" },
  delivery: { type: "enum", required: true, values: CONSENT_DELIVERIES },
  validDays: { type: "number", required: false, default: 3 },
  email: { type: "string", required: false, max: 160, default: "" },
  phone: { type: "string", required: false, max: 24, default: "" },
} as const;

/** Make the link the patient signs through. A form that already has a live link keeps it (show its QR code instead). */
export async function createLink(id: number, input: unknown, actor: Session): Promise<ConsentDTO> {
  await ownedRow(id, actor);
  const data = validate(linkSchema, input);
  if (!VALID_DAYS.includes(Number(data.validDays))) throw new ValidationError([{ field: "validDays", message: "choose 1, 3 or 7 days" }]);
  if (data.delivery === "email" && !/^\S+@\S+\.\S+$/.test(data.email)) throw new ValidationError([{ field: "email", message: "enter an email address like name@example.com" }]);
  const updated = await withKeyLocks([`consent:${id}`], async () => {
    const row = await ownedRow(id, actor);
    const status = signatureStatusOf(row);
    if (status === "Waiting") throw new ConflictError("This form already has a live link — cancel it to make a new one");
    if (status === "Signed") throw new ConflictError("This form has already been signed");
    if (status === "Refused") throw new ConflictError("The patient declined this form — make a new one if they have changed their mind");
    const now = Date.now();
    return signatureRequestsRepo.update(id, {
      token: mintToken(),
      status: "Waiting",
      signer_name: data.signerName.trim() || row.patient_name,
      delivery: data.delivery,
      link_sent_at: new Date(now).toISOString(),
      expires_at: new Date(now + Number(data.validDays) * 86_400_000).toISOString(),
      opened_at: null,
      cancelled_at: null,
    });
  });
  await audit(actor, "send", "consent", id, { delivery: data.delivery, validDays: data.validDays });
  const dto: ConsentDTO = toConsentDTO(updated as SignatureRequestRow);
  // WhatsApp goes out through the hospital's connected number when it has one; without one the screen falls back to the device's share menu.
  if (data.delivery === "whatsapp") {
    // The link exists either way; if sending couldn't start (no number, no public address) say why instead of failing the request.
    const sent: WhatsappSendResult = await sendConsentWhatsApp(id, { phone: data.phone }, actor).catch((e) => {
      if (isAppError(e)) return { state: "failed" as const, detail: (e.details as { fields?: { message: string }[] } | undefined)?.fields?.[0]?.message ?? e.message };
      throw e;
    });
    if (sent.state !== "not_connected") return { ...dto, whatsapp: sent };
  }
  return dto;
}

/** The message that goes with the link, in the language of the form. */
function signingMessage(c: { formTitle: string; language: string; patientName: string }, url: string): string {
  if (c.language === "Hindi") return `कृपया "${c.formTitle}" पढ़ें और हस्ताक्षर करें (${c.patientName}): ${url}`;
  if (c.language === "Gujarati") return `કૃપા કરીને "${c.formTitle}" વાંચો અને સહી કરો (${c.patientName}): ${url}`;
  return `Please read and sign "${c.formTitle}" (${c.patientName}): ${url}`;
}

/** Send a live signing link to the patient on WhatsApp — to `phone`, or the number on their record. Used on creating the link and to resend it. */
export async function sendConsentWhatsApp(id: number, input: unknown, actor: Session): Promise<WhatsappSendResult> {
  const row = await ownedRow(id, actor);
  const dto = toConsentDTO(row);
  if (!dto.link) throw new ConflictError("This form has no live link — make one first");
  const base = publicAppUrl();
  if (!base) throw new BadRequestError("The public address patients open isn't known — set PUBLIC_APP_URL on the server");
  const typed = String((input as { phone?: unknown } | null)?.phone ?? "").trim();
  const phone = typed || row.patient_phone || "";
  if (!phone) throw new ValidationError([{ field: "phone", message: "there is no number on the patient's record — enter one" }]);
  const url = `${base}${dto.link}`;
  const result = await sendSigningLink(actor.hospitalId as number, { to: phone, patientName: dto.signerName || dto.patientName, formTitle: dto.formTitle, link: url, message: signingMessage(dto, url) });
  await audit(actor, "send", "consent", id, { delivery: "whatsapp", state: result.state });
  return result;
}

export async function cancelLink(id: number, actor: Session) {
  await ownedRow(id, actor);
  const updated = await withKeyLocks([`consent:${id}`], async () => {
    const row = await ownedRow(id, actor);
    const status = signatureStatusOf(row);
    if (status !== "Waiting") throw new ConflictError(`There is no live link to cancel — this form is ${status === "Draft" ? "not sent" : status.toLowerCase()}`);
    return signatureRequestsRepo.update(id, { status: "Cancelled", cancelled_at: new Date().toISOString() });
  });
  await audit(actor, "cancel-link", "consent", id);
  return toConsentDTO(updated as SignatureRequestRow);
}

// ── Signed on paper ──────────────────────────────────────────────────────────

const paperSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  relation: { type: "enum", required: false, values: RELATIONS, default: "Self" },
  witness: { type: "string", required: false, max: 80, default: "" },
  signedOn: { type: "date", required: false },
} as const;

/** Record that the patient signed the printed form, and file the scanned copy if there is one. */
export async function signOnPaper(id: number, input: unknown, file: File | null, actor: Session): Promise<ConsentDTO> {
  const first = await ownedRow(id, actor);
  const data = validate(paperSchema, input);
  const today = localDate();
  const signedOn = data.signedOn ?? today;
  if (signedOn > today) throw new ValidationError([{ field: "signedOn", message: "can't be in the future" }]);
  if (file && file.size === 0) throw new BadRequestError("The scanned copy is empty");
  const updated = await withKeyLocks([`consent:${id}`], async () => {
    const row = await ownedRow(id, actor);
    if (row.status === "Signed") throw new ConflictError("This form has already been signed");
    let documentId: number | null = null;
    if (file) {
      await ensureFolders(actor);
      const { rows } = await mrdFoldersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
      const folder = rows.find((f) => f.name === PAPER_FOLDER);
      const doc = await uploadDocument({
        file, ownerType: "patient", ownerId: first.patient_id ?? 0, category: PAPER_FOLDER, folderId: folder?.id ?? null,
        title: `${row.form_title} — signed on paper`,
      }, actor);
      documentId = doc.id;
    }
    return signatureRequestsRepo.update(id, {
      status: "Signed",
      signed_via: "paper",
      signed_at: signedOn === today ? new Date().toISOString() : zonedInstant(signedOn, 12 * 60).toISOString(),
      signer_name: data.name,
      signer_relation: data.relation,
      witness_name: data.witness.trim() || null,
      signed_language: row.language,
      signed_document_id: documentId,
    });
  });
  await audit(actor, "signed-on-paper", "consent", id, { signer: data.name, relation: data.relation });
  return toConsentDTO(updated as SignatureRequestRow);
}

// ── The document itself (print / signed copy) ────────────────────────────────

/** The form in every language it exists in; a form made before the catalog existed has only its own text. */
function textsOf(row: SignatureRequestRow): Record<string, ConsentTextDTO> {
  if (row.template_texts && Object.keys(row.template_texts).length > 0) return row.template_texts;
  const def = consentForm(row.template_key ?? "");
  if (!def) return { [row.language]: { title: row.form_title, body: row.form_body } };
  const out: Record<string, ConsentTextDTO> = {};
  for (const l of CONSENT_LANGUAGES) out[l] = { title: def.title[l], body: def.body[l] };
  return out;
}

async function documentOf(row: SignatureRequestRow, includeSignature: boolean): Promise<ConsentDocumentDTO> {
  const [hospital, patient] = await Promise.all([hospitalsRepo.getRow(row.hospital_id), row.patient_id != null ? patientsRepo.getRow(row.patient_id) : Promise.resolve(null)]);
  const address = [hospital?.address, hospital?.city, hospital?.state, hospital?.pincode].filter(Boolean).join(", ");
  return {
    hospital: { name: hospital?.name ?? "", address, phone: hospital?.phone || hospital?.mobile || "", email: hospital?.email ?? "", gstNumber: hospital?.gst_number ?? "" },
    patient: { name: row.patient_name, code: row.patient_code ?? "", age: patient?.age ?? null, gender: patient?.gender ?? "" },
    language: row.language,
    includeEnglish: !!row.include_english,
    texts: textsOf(row),
    status: signatureStatusOf(row),
    madeAt: row.sent_at,
    signerName: row.signer_name ?? null,
    signerRelation: row.signer_relation ?? null,
    signedAt: row.signed_at ?? null,
    signedVia: (row.signed_via as ConsentDocumentDTO["signedVia"]) ?? null,
    signedLanguage: row.signed_language ?? null,
    witnessName: row.witness_name ?? null,
    signatureData: includeSignature && row.status === "Signed" ? row.signature_data ?? null : null,
  };
}

/** The consent as a printable page: the blank form to sign on paper, or the signed copy. */
export async function consentDocument(id: number, actor: Session) {
  return documentOf(await ownedRow(id, actor), true);
}

// ── The patient's side (no login; the token is the credential) ───────────────

async function byToken(token: string | null | undefined): Promise<SignatureRequestRow> {
  const t = (token ?? "").trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) throw new NotFoundError("This link");
  const { rows } = await signatureRequestsRepo.listRows({ filters: [{ column: "token", op: "eq", value: t }], pageSize: 1 });
  if (!rows[0]) throw new NotFoundError("This link");
  return rows[0] as SignatureRequestRow;
}

/** What the patient's phone shows. Opening a live link for the first time is recorded. */
export async function publicForm(token: string | null): Promise<PublicConsentDTO> {
  let row = await byToken(token);
  if (signatureStatusOf(row) === "Waiting" && !row.opened_at) {
    row = (await signatureRequestsRepo.update(row.id, { opened_at: new Date().toISOString() })) as SignatureRequestRow;
  }
  const hospital = await hospitalsRepo.getRow(row.hospital_id);
  return {
    hospitalName: hospital?.name ?? "",
    patientName: row.patient_name,
    language: row.language,
    includeEnglish: !!row.include_english,
    texts: textsOf(row),
    status: signatureStatusOf(row),
    expiresAt: row.expires_at ?? null,
    signedAt: row.signed_at ?? null,
    signerName: row.signer_name ?? null,
  };
}

const signSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  relation: { type: "enum", required: false, values: RELATIONS, default: "Self" },
  agree: { type: "boolean", required: true },
  language: { type: "enum", required: false, values: CONSENT_LANGUAGES },
} as const;

const notOpen = (status: string) =>
  status === "Signed" ? "This form has already been signed" : status === "Expired" ? "This link is no longer valid (it expired)" : status === "Draft" ? "This link isn't active" : `This link is ${status.toLowerCase()}`;

export async function publicSign(token: string | null, input: unknown) {
  const data = validate(signSchema, input);
  if (!data.agree) throw new ValidationError([{ field: "agree", message: "tick the box to confirm you have read and agree" }]);
  const drawn = (input as Record<string, unknown>)?.signature;
  if (typeof drawn !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(drawn) || drawn.length > MAX_SIGNATURE_CHARS) {
    throw new ValidationError([{ field: "signature", message: "please sign in the box with your finger" }]);
  }
  const first = await byToken(token);
  const updated = await withKeyLocks([`consent:${first.id}`], async () => {
    const row = (await signatureRequestsRepo.getRow(first.id)) as SignatureRequestRow;
    const status = signatureStatusOf(row);
    if (status !== "Waiting") throw new ConflictError(notOpen(status));
    return signatureRequestsRepo.update(row.id, {
      status: "Signed", signed_via: "phone", signed_at: new Date().toISOString(), signer_name: data.name, signer_relation: data.relation,
      signed_language: data.language ?? row.language, signature_data: drawn, opened_at: row.opened_at ?? new Date().toISOString(),
    });
  });
  return { status: "Signed" as const, signedAt: (updated as SignatureRequestRow).signed_at, signerName: data.name };
}

export async function publicRefuse(token: string | null, input: unknown) {
  const { reason } = validate({ reason: { type: "string", required: false, max: 200, default: "" } } as const, input ?? {});
  const first = await byToken(token);
  await withKeyLocks([`consent:${first.id}`], async () => {
    const row = (await signatureRequestsRepo.getRow(first.id)) as SignatureRequestRow;
    const status = signatureStatusOf(row);
    if (status !== "Waiting") throw new ConflictError(notOpen(status));
    return signatureRequestsRepo.update(row.id, { status: "Refused", refused_reason: reason || null });
  });
  return { status: "Refused" as const };
}

/** The patient's own signed copy, once it is signed. */
export async function publicCopy(token: string | null): Promise<ConsentDocumentDTO> {
  const row = await byToken(token);
  if (row.status !== "Signed") throw new ConflictError("There is no signed copy yet");
  return documentOf(row, true);
}

