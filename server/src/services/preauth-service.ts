/**
 * Pre-authorisation forms. A form is made for one patient on one insurer's layout and is pre-filled from the patient, the admission, the
 * hospital and the doctor. It is then sent for signing: the treating doctor signs it (with the signature they keep), then the hospital's
 * admin stamps it (with the hospital stamp they keep), and only then is it Ready. Each step notifies the person whose turn it is.
 * Every form belongs to one hospital and nobody else can see it.
 */
import { doctorsRepo, hospitalsRepo, ipdRepo, patientsRepo, preauthFormsRepo, staffRepo, usersRepo } from "@/repositories";
import type { DoctorRow, HospitalRow, IpdAdmissionRow, PatientRow, PreauthFormRow, SignatureAssetRow, StaffRow, UserRow } from "@/db/tables";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { can } from "@/auth/rbac";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { audit } from "@/services/audit";
import { adminUserIds, clearForLink, doctorUserIds, notifyUsers } from "@/services/notifications-service";
import { autoSigner, findAsset } from "@/services/signature-assets-service";
import { PREAUTH_FORMS } from "@shared/lib/preauth/forms.generated";
import { COST_PARTS, DECLARATION_FIELDS, PREAUTH_FIELD_KEYS, PREAUTH_FIELDS, type PreauthDTO, type PreauthPendingDTO, type PreauthSummaryDTO, type PreauthValues } from "@shared/types/preauth";

const ALLOWED_KEYS = new Set<string>([...PREAUTH_FIELD_KEYS, ...DECLARATION_FIELDS]);
const linkOf = (id: number) => `/preauth/${id}`;


const summary = (r: PreauthFormRow): PreauthSummaryDTO => ({
  id: r.id, formKey: r.form_key, formName: r.form_name, patientId: r.patient_id, patientName: r.patient_name, doctorId: r.doctor_id, doctorName: r.doctor_name,
  status: r.status as PreauthSummaryDTO["status"], createdBy: r.created_by, doctorSignedAt: r.doctor_signed_at, stampedAt: r.stamped_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const full = (r: PreauthFormRow): PreauthDTO => ({
  ...summary(r), values: r.values ?? {}, admissionId: r.admission_id, doctorSignedBy: r.doctor_signed_by, stampedBy: r.stamped_by,
  doctorSignedAuto: !!r.doctor_signed_auto, doctorSignatureImg: r.doctor_signature_img, doctorStampImg: r.doctor_stamp_img, hospitalStampImg: r.hospital_stamp_img,
});

async function load(id: number, actor: Session): Promise<PreauthFormRow> {
  const row = (await preauthFormsRepo.getRow(id)) as PreauthFormRow | null;
  assertOwnedByHospital(row, actor, "Pre-auth form");
  return row as PreauthFormRow;
}

/** Whoever works on pre-authorisations, the doctor it is addressed to, and the hospital's admin may see a form. */
function canSee(row: PreauthFormRow, actor: Session): boolean {
  return can(actor.role, "tpa", "read", actor.hospitalId) || (actor.role === "Doctor" && actor.doctorId === row.doctor_id);
}
const canEdit = (actor: Session) => can(actor.role, "tpa", "write", actor.hospitalId);

const clip = (v: unknown, n = 2000) => (v === undefined || v === null ? "" : String(v).slice(0, n));

/** The cost lines add up to the sum total unless the person typed their own. */
function withTotal(values: PreauthValues): PreauthValues {
  const sum = COST_PARTS.reduce((n, k) => n + (Number(values[k]) || 0), 0);
  if (!values.totalCost && sum > 0) return { ...values, totalCost: String(sum) };
  return values;
}

function sanitize(input: unknown): PreauthValues {
  const out: PreauthValues = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) if (ALLOWED_KEYS.has(k)) out[k] = clip(v);
  return out;
}

/** Everything the hospital already knows that goes on the form. */
function prefill(def: (typeof PREAUTH_FORMS)[number], hospital: HospitalRow | null, patient: PatientRow, adm: IpdAdmissionRow | null, doctor: DoctorRow | null): PreauthValues {
  const head = def.header.join(" ");
  const phone = /toll.?free[^\d]{0,20}([\d][\d \-\/]{7,})/i.exec(head)?.[1]?.trim() ?? "";
  const fax = /fax[^\d]{0,20}([\d][\d \-\/]{5,})/i.exec(head)?.[1]?.trim() ?? "";
  const v: PreauthValues = {
    tpaName: def.name, tollFreePhone: phone, tollFreeFax: fax,
    hospitalName: hospital?.name ?? "", hospitalAddress: hospital?.address ?? "", hospitalCity: hospital?.city ?? "", hospitalState: hospital?.state ?? "", hospitalPincode: hospital?.pincode ?? "",
    hospitalPhone: hospital?.phone ?? "", hospitalEmail: hospital?.email ?? "",
    patientName: patient.name, gender: patient.gender === "Female" ? "Female" : patient.gender === "Male" ? "Male" : patient.gender ? "Third gender" : "",
    age: String(patient.age ?? ""), dob: patient.dob ?? "", contactNo: patient.phone ?? "", altContactNo: patient.emergency_phone ?? "", insuredEmail: patient.email ?? "",
    policyNo: [patient.policy_number, patient.corporate].filter(Boolean).join(" / "),
    patientAddress: [patient.address, patient.city, patient.state, patient.pincode].filter(Boolean).join(", "),
    doctorName: doctor?.name ?? adm?.doctor ?? patient.doctor ?? "", doctorContact: doctor?.phone ?? "",
    illness: adm?.diagnosis || patient.reason || "", provisionalDiagnosis: adm?.diagnosis || "",
    firstConsultDate: patient.visit_date ?? "",
    chronicOther: patient.chronic_conditions ?? "",
    declPatientName: patient.name, declPatientContact: patient.phone ?? "", declPatientEmail: patient.email ?? "",
  };
  if (adm) {
    v.admissionDate = adm.admission_date ?? "";
    v.admissionType = adm.admission_type === "Emergency" ? "Emergency" : "Planned";
    v.roomType = [adm.ward, adm.bed].filter(Boolean).join(" · ");
    if (adm.expected_stay_days) v.expectedDays = String(adm.expected_stay_days);
    if (adm.is_mlc) v.isRta = "";
  }
  // Only what has a value: the rest stays blank for the person filling the form.
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ""));
}

/** `{ formKey, patientId, admissionId?, doctorId? }` */
export async function createForm(input: unknown, actor: Session): Promise<PreauthDTO> {
  const hid = requireHospitalId(actor);
  if (!canEdit(actor)) throw new ForbiddenError(`Your role (${actor.role}) cannot create pre-authorisation forms.`);
  const b = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const def = PREAUTH_FORMS.find((f) => f.key === b.formKey);
  if (!def) throw new ValidationError([{ field: "formKey", message: "choose an insurer or TPA form" }]);
  const patientId = Number(b.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) throw new ValidationError([{ field: "patientId", message: "choose a patient" }]);
  const patient = (await patientsRepo.getRow(patientId)) as PatientRow | null;
  assertOwnedByHospital(patient, actor, "Patient");

  let adm: IpdAdmissionRow | null = null;
  if (b.admissionId !== undefined && b.admissionId !== null && b.admissionId !== "") {
    adm = (await ipdRepo.getRow(Number(b.admissionId))) as IpdAdmissionRow | null;
    assertOwnedByHospital(adm, actor, "Admission");
    if (adm!.patient_id !== patientId) throw new ValidationError([{ field: "admissionId", message: "that admission is for a different patient" }]);
  } else {
    const { rows } = await ipdRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] }, actor));
    adm = (rows as IpdAdmissionRow[]).sort((a, c) => c.admission_date.localeCompare(a.admission_date) || c.id - a.id)[0] ?? null;
  }
  const doctorId = Number(b.doctorId) || adm?.doctor_id || patient!.doctor_id || null;
  const doctor = doctorId ? ((await doctorsRepo.getRow(doctorId)) as DoctorRow | null) : null;
  if (doctor) assertOwnedByHospital(doctor, actor, "Doctor");
  const hospital = (await hospitalsRepo.getRow(hid)) as HospitalRow | null;

  const row = (await preauthFormsRepo.create({
    hospital_id: hid, form_key: def.key, form_name: def.name, patient_id: patientId, patient_name: patient!.name, admission_id: adm?.id ?? null,
    doctor_id: doctor?.id ?? null, doctor_name: doctor?.name ?? adm?.doctor ?? "", status: "Draft", values: withTotal(prefill(def, hospital, patient!, adm, doctor)),
    created_by_id: actor.userId, created_by: actor.name, doctor_signed_at: null, doctor_signed_by: null, doctor_signature_img: null, doctor_stamp_img: null,
    stamped_at: null, stamped_by: null, hospital_stamp_img: null,
  })) as PreauthFormRow;
  await audit(actor, "preauth.create", "preauth_form", row.id, { form: def.key, patientId });
  return full(row);
}

export async function listForms(query: URLSearchParams, actor: Session): Promise<PreauthSummaryDTO[]> {
  requireHospitalId(actor);
  const { rows } = await preauthFormsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const status = query.get("status"), patientId = Number(query.get("patientId")) || 0, q = (query.get("search") ?? "").toLowerCase().trim();
  return (rows as PreauthFormRow[])
    .filter((r) => canSee(r, actor))
    .filter((r) => (!status || r.status === status) && (!patientId || r.patient_id === patientId) && (!q || `${r.patient_name} ${r.form_name} ${r.doctor_name}`.toLowerCase().includes(q)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
    .map(summary);
}

export async function getForm(id: number, actor: Session): Promise<PreauthDTO> {
  const row = await load(id, actor);
  if (!canSee(row, actor)) throw new ForbiddenError("You cannot open this form.");
  return full(row);
}

/** `{ values?, doctorId? }`: only while the form is still waiting for the doctor. */
export async function updateForm(id: number, input: unknown, actor: Session): Promise<PreauthDTO> {
  const row = await load(id, actor);
  const isItsDoctor = actor.role === "Doctor" && actor.doctorId === row.doctor_id;
  if (!canEdit(actor) && !isItsDoctor) throw new ForbiddenError("You cannot change this form.");
  if (row.status === "Awaiting stamp" || row.status === "Ready") throw new ValidationError([{ field: "status", message: "the doctor has signed this form, so it can't be changed" }]);
  const b = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const patch: Partial<PreauthFormRow> = {};
  if (b.values !== undefined) patch.values = withTotal({ ...(row.values ?? {}), ...sanitize(b.values) });
  if (b.doctorId !== undefined && Number(b.doctorId) !== row.doctor_id) {
    const doctor = (await doctorsRepo.getRow(Number(b.doctorId))) as DoctorRow | null;
    assertOwnedByHospital(doctor, actor, "Doctor");
    patch.doctor_id = doctor!.id; patch.doctor_name = doctor!.name;
    patch.values = { ...(patch.values ?? row.values ?? {}), doctorName: doctor!.name, doctorContact: doctor!.phone ?? "" };
  }
  const updated = (await preauthFormsRepo.update(id, patch)) as PreauthFormRow;
  return full(updated);
}

export async function removeForm(id: number, actor: Session): Promise<{ id: number }> {
  const row = await load(id, actor);
  if (!canEdit(actor)) throw new ForbiddenError("You cannot delete this form.");
  if (row.status === "Ready" && actor.role !== "Super Admin") throw new ForbiddenError("A finished form can only be deleted by the hospital's admin.");
  await preauthFormsRepo.remove(id);
  await audit(actor, "preauth.delete", "preauth_form", id);
  return { id };
}

/** Send the form to its doctor for signing. */
export async function submitForm(id: number, actor: Session): Promise<PreauthDTO> {
  const row = await load(id, actor);
  if (!canEdit(actor)) throw new ForbiddenError("You cannot send this form for signing.");
  if (row.status !== "Draft") throw new ValidationError([{ field: "status", message: "this form has already been sent for signing" }]);
  if (!row.doctor_id) throw new ValidationError([{ field: "doctorId", message: "choose the treating doctor who will sign" }]);
  const updated = (await preauthFormsRepo.update(id, { status: "Awaiting doctor" })) as PreauthFormRow;
  await audit(actor, "preauth.submit", "preauth_form", id);
  // A doctor who has switched on automatic signing doesn't wait: the form is signed as soon as it reaches them, and they are told
  // afterwards instead of being asked.
  const auto = await autoSigner(row.hospital_id, row.doctor_id);
  if (auto) return full(await applyDoctorSignature(updated, auto.user, auto.signature, {}, true, actor));
  const ids = await doctorUserIds(row.hospital_id, row.doctor_id);
  await notifyUsers(row.hospital_id, ids, { kind: "preauth_sign", title: "Pre-auth form waiting for your signature", body: `${row.patient_name} · ${row.form_name}`, link: linkOf(id) });
  return full(updated);
}

/** Puts the doctor's signature (and stamp, if they keep one) on the form and tells the admin it is ready for the hospital stamp. */
async function applyDoctorSignature(row: PreauthFormRow, signer: { id: number; name: string }, sig: SignatureAssetRow, extra: PreauthValues, auto: boolean, actor: Session): Promise<PreauthFormRow> {
  const stamp = await findAsset(row.hospital_id, "doctor_stamp", signer.id);
  const declared = Object.fromEntries(Object.entries(extra).filter(([k]) => (DECLARATION_FIELDS as readonly string[]).includes(k)));
  const values: PreauthValues = { ...(row.values ?? {}), ...declared };
  if (auto) {
    // Nobody is there to type their qualification and registration number, so take them from their staff record.
    const user = (await usersRepo.getRow(signer.id)) as UserRow | null;
    const staff = user?.staff_id ? ((await staffRepo.getRow(user.staff_id)) as StaffRow | null) : null;
    if (!values.declQualification && staff?.qualification) values.declQualification = staff.qualification;
    if (!values.declRegNo && staff?.licence_no) values.declRegNo = staff.licence_no;
  }
  const updated = (await preauthFormsRepo.update(row.id, {
    status: "Awaiting stamp", doctor_signed_at: new Date().toISOString(), doctor_signed_by: signer.name, doctor_signed_auto: auto,
    doctor_signature_img: sig.image, doctor_stamp_img: stamp?.image ?? null, values,
  })) as PreauthFormRow;
  await clearForLink(signer.id, linkOf(row.id));
  await notifyUsers(row.hospital_id, await adminUserIds(row.hospital_id), { kind: "preauth_stamp", title: "Pre-auth form waiting for the hospital stamp", body: `${row.patient_name} · ${row.form_name} · signed by ${signer.name}${auto ? " (automatically)" : ""}`, link: linkOf(row.id) });
  if (auto) {
    await notifyUsers(row.hospital_id, [signer.id], { kind: "preauth_autosigned", title: "A pre-auth form was signed for you", body: `${row.patient_name} · ${row.form_name}. Signed automatically because you turned on automatic signing. You can turn it off under Pre-auth forms → My signature and stamp.`, link: linkOf(row.id) });
  }
  await audit(actor, auto ? "preauth.sign_auto" : "preauth.sign", "preauth_form", row.id, auto ? { doctor: signer.name } : undefined);
  return updated;
}

/** The treating doctor signs. Their stored signature (and stamp, if they keep one) is copied onto the form. */
export async function signForm(id: number, input: unknown, actor: Session): Promise<PreauthDTO> {
  const row = await load(id, actor);
  if (actor.role !== "Doctor" || actor.doctorId !== row.doctor_id) throw new ForbiddenError("Only the doctor this form is addressed to can sign it.");
  if (row.status !== "Awaiting doctor") throw new ValidationError([{ field: "status", message: row.status === "Draft" ? "this form hasn't been sent for signing yet" : "this form has already been signed" }]);
  const sig = await findAsset(row.hospital_id, "doctor_signature", actor.userId);
  if (!sig) throw new ValidationError([{ field: "signature", message: "add your signature first (Pre-auth forms → My signature and stamp)" }]);
  const extra = sanitize((typeof input === "object" && input !== null ? (input as Record<string, unknown>).values : undefined) ?? {});
  return full(await applyDoctorSignature(row, { id: actor.userId, name: actor.name }, sig, extra, false, actor));
}

/** The hospital's admin stamps a form the doctor has signed, which finishes it. */
export async function stampForm(id: number, actor: Session): Promise<PreauthDTO> {
  const row = await load(id, actor);
  if (actor.role !== "Super Admin") throw new ForbiddenError("Only the hospital's admin can stamp a form.");
  if (row.status !== "Awaiting stamp") throw new ValidationError([{ field: "status", message: row.status === "Ready" ? "this form has already been stamped" : "the doctor hasn't signed this form yet" }]);
  const stamp = await findAsset(row.hospital_id, "hospital_stamp", 0);
  if (!stamp) throw new ValidationError([{ field: "stamp", message: "add the hospital stamp first (Pre-auth forms → My signature and stamp)" }]);
  const updated = (await preauthFormsRepo.update(id, { status: "Ready", stamped_at: new Date().toISOString(), stamped_by: actor.name, hospital_stamp_img: stamp.image })) as PreauthFormRow;
  await clearForLink(actor.userId, linkOf(id));
  const tell = [...(row.created_by_id ? [row.created_by_id] : []), ...(row.doctor_id ? await doctorUserIds(row.hospital_id, row.doctor_id) : [])].filter((u) => u !== actor.userId);
  await notifyUsers(row.hospital_id, tell, { kind: "preauth_ready", title: "Pre-auth form is signed, stamped and ready", body: `${row.patient_name} · ${row.form_name}`, link: linkOf(id) });
  await audit(actor, "preauth.stamp", "preauth_form", id);
  return full(updated);
}

/** The forms waiting on this person: a doctor's to sign, and for the hospital's admin the ones to stamp. */
export async function pendingForMe(actor: Session): Promise<PreauthPendingDTO> {
  requireHospitalId(actor);
  const { rows } = await preauthFormsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const all = (rows as PreauthFormRow[]).sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  return {
    toSign: actor.role === "Doctor" ? all.filter((r) => r.status === "Awaiting doctor" && r.doctor_id === actor.doctorId).map(summary) : [],
    toStamp: actor.role === "Super Admin" ? all.filter((r) => r.status === "Awaiting stamp").map(summary) : [],
  };
}

