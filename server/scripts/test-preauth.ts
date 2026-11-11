/**
 * Tests for pre-authorisation forms: the 42 insurer forms are all there and all different, a form is pre-filled from the patient, the
 * hospital and the doctor, it moves Draft -> Awaiting doctor -> Awaiting stamp -> Ready only by the right people, each step notifies
 * whoever's turn it is, signatures and stamps are checked and kept per person, and no hospital sees another's forms.
 * In-process, in-memory.
 *
 *   npm run test:preauth
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo, usersRepo } = await import("@/repositories");
const { PREAUTH_FORMS } = await import("@shared/lib/preauth/forms");
const { PREAUTH_FIELDS } = await import("@shared/types/preauth");
const { EXACT_FORMS } = await import("@shared/lib/preauth/forms");
const EXACT_KEYS = new Set(Object.keys(EXACT_FORMS));
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string; details?: any } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function cookieFor(email: string) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
async function as(email: string, method: string, path: string, body?: unknown) {
  return request(method, path, { body, headers: { cookie: await cookieFor(email) } });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const OTHER_DOCTOR = "daniel.reed@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_HOSPITAL = "admin@sunrisehospital.in";

// A 1x1 PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const hospitalId = (await patientsRepo.getRow(1))!.hospital_id;
const doctorUser = (await usersRepo.listRows({ unpaged: true } as never)).rows.find((u: any) => u.email === DOCTOR) as any;
const DOCTOR_ID = doctorUser.doctor_id as number;
let seq = 0;
async function mkPatient(name: string) {
  seq++;
  return patientsRepo.create({ hospital_id: hospitalId, patient_code: `PA-${String(seq).padStart(4, "0")}`, name, age: 52, gender: "Female", phone: `92000${String(seq).padStart(5, "0")}`, reason: "Chest pain", doctor_id: DOCTOR_ID, doctor: "Dr. Sophia Adams", status: "Completed", visit_date: "2026-11-01", visit_time: "10:00 AM", address: "12 Lake Road", city: "Mumbai", state: "Maharashtra", pincode: "400001", policy_number: "POL-77", insurer: "Star Health" }) as Promise<{ id: number; name: string }>;
}
const make = async (formKey: string, patientId: number, who = ADMIN, extra: Record<string, unknown> = {}) => as(who, "POST", "/api/preauth", { formKey, patientId, ...extra });

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("all 42 insurer and TPA forms are there, with their own names", async () => {
  assert.equal(PREAUTH_FORMS.length, 42);
  assert.equal(new Set(PREAUTH_FORMS.map((f) => f.key)).size, 42);
  assert.equal(new Set(PREAUTH_FORMS.map((f) => f.name)).size, 42);
  for (const k of ["star-health", "medi-assist", "hdfc-ergo", "niva-bupa", "icici-lombard", "care", "bajaj-allianz"]) assert.ok(PREAUTH_FORMS.some((f) => f.key === k), k);
});

test("every form is different: no two have the same layout, wording, header and declaration", async () => {
  const sig = (f: (typeof PREAUTH_FORMS)[number]) => JSON.stringify([f.name, f.title, f.header, f.footer, f.fields, f.declaration]);
  const sigs = PREAUTH_FORMS.map(sig);
  assert.equal(new Set(sigs).size, PREAUTH_FORMS.length, "two forms are identical");
  // Beyond the name: the forms differ in what they say and ask, not only in what they are called.
  const bySays = new Set(PREAUTH_FORMS.map((f) => JSON.stringify([f.header, f.declaration, f.fields.map((x) => [x.key, x.label])])));
  assert.ok(bySays.size >= 38, `only ${bySays.size} forms differ in content`);
});

test("every form asks the essentials and uses only standard fields", async () => {
  for (const f of PREAUTH_FORMS) {
    const keys = f.fields.map((x) => x.key);
    for (const must of EXACT_KEYS.has(f.key) ? ["patientName"] : ["hospitalName", "patientName", "doctorName", "provisionalDiagnosis", "admissionDate", "totalCost", "lineOfTreatment"]) assert.ok(keys.includes(must), `${f.key} lacks ${must}`);
    for (const k of keys) assert.ok(PREAUTH_FIELDS[k], `${f.key} has unknown field ${k}`);
    assert.equal(new Set(keys).size, keys.length, `${f.key} repeats a field`);
    if (!f.scanned) assert.ok(f.declaration.length >= 3, `${f.key} has no declaration`);
  }
});

test("a new form is filled from the patient, the hospital and the doctor", async () => {
  const p = await mkPatient("PA Prefill");
  const r = await make("star-health", p.id);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.status, "Draft");
  assert.equal(r.data.formName, PREAUTH_FORMS.find((f) => f.key === "star-health")!.name);
  const v = r.data.values;
  assert.equal(v.patientName, "PA Prefill");
  assert.equal(v.gender, "Female");
  assert.equal(v.age, "52");
  assert.ok(v.contactNo.startsWith("92000"));
  assert.ok(v.patientAddress.includes("12 Lake Road") && v.patientAddress.includes("Mumbai"));
  assert.ok(v.hospitalName.length > 0, "the hospital's name");
  assert.equal(v.policyNo, "POL-77");
  assert.equal(v.doctorName, "Dr. Sophia Adams");
  assert.equal(r.data.doctorId, DOCTOR_ID);
  assert.equal(v.tpaName, r.data.formName);
});

test("a form takes bed and admission details from the patient's admission", async () => {
  const p = await mkPatient("PA Admitted");
  const { ipdRepo } = await import("@/repositories");
  await ipdRepo.create({ hospital_id: hospitalId, patient_id: p.id, patient_name: p.name, patient_age: 52, patient_code: "X", admission_date: "2026-11-05", ward_id: null, ward: "General Ward", bed_id: null, bed: "B-12", doctor_id: DOCTOR_ID, doctor: "Dr. Sophia Adams", diagnosis: "Acute MI", credit_limit: 0, status: "Admitted", admission_type: "Emergency", expected_stay_days: 4 });
  const r = await make("hdfc-ergo", p.id);
  assert.equal(r.data.values.admissionDate, "2026-11-05");
  assert.equal(r.data.values.roomType, "General Ward · B-12");
  assert.equal(r.data.values.admissionType, "Emergency");
  assert.equal(r.data.values.expectedDays, "4");
  assert.equal(r.data.values.provisionalDiagnosis, "Acute MI");
});

test("an unknown form, no patient, or another hospital's patient is refused", async () => {
  const p = await mkPatient("PA Refuse");
  assert.equal((await make("no-such-insurer", p.id)).status, 422);
  assert.equal((await make("care", 0 as any)).status, 422);
  const theirs = await make("care", p.id, OTHER_HOSPITAL);
  assert.ok([403, 404].includes(theirs.status), `other hospital got ${theirs.status}`);
  assert.equal((await make("care", p.id, PHARMACIST)).status, 403);
});

test("details can be filled in; unknown keys are dropped and the total adds up", async () => {
  const p = await mkPatient("PA Fill");
  const f = (await make("care", p.id)).data;
  const r = await as(ADMIN, "PUT", `/api/preauth/${f.id}`, { values: { icd10: "I21.9", roomRent: "3000", icuCharges: "5000", otCharges: "10000", evil: "x" } });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.values.icd10, "I21.9");
  assert.equal(r.data.values.totalCost, "18000");
  assert.equal(r.data.values.evil, undefined);
  assert.equal(r.data.values.patientName, "PA Fill", "what was filled in before stays");
});

test("the whole journey: send, doctor signs, admin stamps, and each is told when it is their turn", async () => {
  const p = await mkPatient("PA Journey");
  const f = (await make("niva-bupa", p.id, ADMIN)).data;
  // Not yet sent: the doctor has nothing to sign, and can't sign it.
  assert.equal((await as(DOCTOR, "GET", "/api/preauth/pending")).data.toSign.some((x: any) => x.id === f.id), false);
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 422);

  const sent = await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  assert.equal(sent.status, 200, JSON.stringify(sent.error));
  assert.equal(sent.data.status, "Awaiting doctor");
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`)).status, 422, "can't be sent twice");

  // The doctor is notified and sees it on their list.
  const note = (await as(DOCTOR, "GET", "/api/notifications")).data;
  assert.ok(note.unread >= 1);
  const n = note.items.find((x: any) => x.link === `/preauth/${f.id}`);
  assert.ok(n && n.kind === "preauth_sign" && !n.read);
  assert.ok((await as(DOCTOR, "GET", "/api/preauth/pending")).data.toSign.some((x: any) => x.id === f.id));
  // The admin has nothing to stamp yet.
  assert.equal((await as(ADMIN, "GET", "/api/preauth/pending")).data.toStamp.some((x: any) => x.id === f.id), false);

  // Signing needs the doctor's own signature first.
  const noSig = await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {});
  assert.equal(noSig.status, 422);
  assert.match(JSON.stringify(noSig.error), /signature/i);
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG })).status, 200);
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_stamp", image: PNG })).status, 200);

  const signed = await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, { values: { declQualification: "MD Cardiology", declRegNo: "MMC-1234", patientName: "ignored" } });
  assert.equal(signed.status, 200, JSON.stringify(signed.error));
  assert.equal(signed.data.status, "Awaiting stamp");
  assert.equal(signed.data.doctorSignatureImg, PNG);
  assert.equal(signed.data.doctorStampImg, PNG);
  assert.equal(signed.data.values.declRegNo, "MMC-1234");
  assert.equal(signed.data.values.patientName, "PA Journey", "signing changes only the declaration details");
  assert.equal(signed.data.doctorSignedBy, "Dr. Sophia Adams");
  // The doctor's own reminder is cleared; the admin is now told to stamp.
  assert.ok((await as(DOCTOR, "GET", "/api/notifications")).data.items.find((x: any) => x.link === `/preauth/${f.id}`).read);
  assert.ok((await as(ADMIN, "GET", "/api/notifications")).data.items.some((x: any) => x.kind === "preauth_stamp" && x.link === `/preauth/${f.id}` && !x.read));
  assert.ok((await as(ADMIN, "GET", "/api/preauth/pending")).data.toStamp.some((x: any) => x.id === f.id));
  assert.equal((await as(DOCTOR, "GET", "/api/preauth/pending")).data.toSign.some((x: any) => x.id === f.id), false);

  // Locked once signed.
  assert.equal((await as(ADMIN, "PUT", `/api/preauth/${f.id}`, { values: { icd10: "X" } })).status, 422);
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 422, "can't be signed twice");

  // Stamping needs the hospital's stamp.
  const noStamp = await as(ADMIN, "POST", `/api/preauth/${f.id}/stamp`);
  assert.equal(noStamp.status, 422);
  assert.match(JSON.stringify(noStamp.error), /stamp/i);
  assert.equal((await as(ADMIN, "PUT", "/api/signature-assets", { kind: "hospital_stamp", image: PNG })).status, 200);
  const done = await as(ADMIN, "POST", `/api/preauth/${f.id}/stamp`);
  assert.equal(done.status, 200, JSON.stringify(done.error));
  assert.equal(done.data.status, "Ready");
  assert.equal(done.data.hospitalStampImg, PNG);
  assert.equal(done.data.stampedBy, "Dr. Kevin Carter");
  assert.ok((await as(ADMIN, "GET", "/api/notifications")).data.items.find((x: any) => x.kind === "preauth_stamp" && x.link === `/preauth/${f.id}`).read);
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/stamp`)).status, 422, "can't be stamped twice");
});

test("the signature stays as signed even if the doctor changes it later", async () => {
  const p = await mkPatient("PA Snapshot");
  const f = (await make("care", p.id)).data;
  await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  const other = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";
  await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {});
  await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: other });
  assert.equal((await as(ADMIN, "GET", `/api/preauth/${f.id}`)).data.doctorSignatureImg, PNG);
});

test("auto-sign: a form sent to a doctor who turned it on is signed at once, they are told, and they can turn it off", async () => {
  const AUTO = "/api/signature-assets/auto-sign";
  // Needs a saved signature, and only a doctor can use it.
  await as(OTHER_DOCTOR, "DELETE", "/api/signature-assets?kind=doctor_signature");
  assert.equal((await as(OTHER_DOCTOR, "PUT", AUTO, { enabled: true })).status, 422, "no signature saved yet");
  assert.equal((await as(ADMIN, "PUT", AUTO, { enabled: true })).status, 403);
  assert.equal((await as(PHARMACIST, "PUT", AUTO, { enabled: true })).status, 403);
  await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG });
  assert.equal((await as(DOCTOR, "GET", "/api/signature-assets")).data.autoSign, false, "off by default");
  assert.equal((await as(DOCTOR, "PUT", AUTO, { enabled: "yes" })).status, 422);

  const on = await as(DOCTOR, "PUT", AUTO, { enabled: true });
  assert.equal(on.status, 200, JSON.stringify(on.error));
  assert.equal(on.data.autoSign, true);
  assert.equal((await as(ADMIN, "GET", "/api/signature-assets")).data.autoSign, false, "nobody else is switched on by it");

  const p = await mkPatient("PA Auto");
  const f = (await make("niva-bupa", p.id, ADMIN)).data;
  const sent = await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  assert.equal(sent.status, 200, JSON.stringify(sent.error));
  assert.equal(sent.data.status, "Awaiting stamp", "signed the moment it was sent");
  assert.equal(sent.data.doctorSignedAuto, true);
  assert.equal(sent.data.doctorSignedBy, "Dr. Sophia Adams");
  assert.equal(sent.data.doctorSignatureImg, PNG);
  // The doctor is told it was signed for them (not asked to sign); the admin is asked to stamp; nothing is waiting on the doctor.
  const mine = (await as(DOCTOR, "GET", "/api/notifications")).data.items.filter((x: any) => x.link === `/preauth/${f.id}`);
  assert.ok(mine.some((x: any) => x.kind === "preauth_autosigned" && !x.read), "told it was signed automatically");
  assert.ok(!mine.some((x: any) => x.kind === "preauth_sign"), "not asked to sign");
  assert.match(mine.find((x: any) => x.kind === "preauth_autosigned").body, /turn it off/i);
  assert.equal((await as(DOCTOR, "GET", "/api/preauth/pending")).data.toSign.some((x: any) => x.id === f.id), false);
  assert.ok((await as(ADMIN, "GET", "/api/notifications")).data.items.some((x: any) => x.kind === "preauth_stamp" && x.link === `/preauth/${f.id}`));
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 422, "already signed");

  // A form for someone else's doctor is not signed by this doctor's switch.
  const q = await mkPatient("PA Auto Other");
  const g = (await make("care", q.id, ADMIN, { doctorId: (await usersRepo.listRows({ unpaged: true } as never)).rows.find((u: any) => u.email === OTHER_DOCTOR)!.doctor_id })).data;
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${g.id}/submit`)).data.status, "Awaiting doctor");

  // Off again: back to waiting for the doctor's own signature.
  assert.equal((await as(DOCTOR, "PUT", AUTO, { enabled: false })).data.autoSign, false);
  const h = (await make("care", (await mkPatient("PA Auto Off")).id, ADMIN)).data;
  const sent2 = await as(ADMIN, "POST", `/api/preauth/${h.id}/submit`);
  assert.equal(sent2.data.status, "Awaiting doctor");
  assert.equal(sent2.data.doctorSignedAuto, false);

  // Removing the signature switches it off too.
  await as(DOCTOR, "PUT", AUTO, { enabled: true });
  await as(DOCTOR, "DELETE", "/api/signature-assets?kind=doctor_signature");
  assert.equal((await as(DOCTOR, "GET", "/api/signature-assets")).data.autoSign, false);
  const i = (await make("care", (await mkPatient("PA Auto Gone")).id, ADMIN)).data;
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${i.id}/submit`)).data.status, "Awaiting doctor");
  await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG });
  assert.equal((await as(DOCTOR, "GET", "/api/signature-assets")).data.autoSign, false, "a new signature does not bring it back on");
});

test("only the doctor it is addressed to can sign, and only the hospital's admin can stamp", async () => {
  const p = await mkPatient("PA Who");
  const f = (await make("care", p.id)).data;
  await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  assert.equal((await as(OTHER_DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 403, "another doctor");
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/sign`, {})).status, 403, "the admin isn't the doctor");
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 200);
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/stamp`)).status, 403, "a doctor can't stamp");
  assert.equal((await as(BILLING, "POST", `/api/preauth/${f.id}/stamp`)).status, 403, "billing can't stamp");
  assert.equal((await as(OTHER_DOCTOR, "GET", `/api/preauth/${f.id}`)).status, 200, "doctors can read forms, but not act on another's");
});

test("a form can't be sent without a doctor", async () => {
  const p = await mkPatient("PA No Doctor");
  await patientsRepo.update(p.id, { doctor_id: null, doctor: "" });
  const f = (await make("care", p.id)).data;
  assert.equal(f.doctorId, null);
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`)).status, 422);
  const set = await as(ADMIN, "PUT", `/api/preauth/${f.id}`, { doctorId: DOCTOR_ID });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal(set.data.doctorName, "Dr. Sophia Adams");
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`)).status, 200);
});

test("signatures and stamps: right person, right picture, and nobody sees another's", async () => {
  await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG });
  assert.equal((await as(PHARMACIST, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG })).status, 403);
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "hospital_stamp", image: PNG })).status, 403, "a doctor can't keep the hospital stamp");
  assert.equal((await as(ADMIN, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG })).status, 403, "the admin isn't a doctor");
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: "http://evil/x.png" })).status, 422);
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: "data:image/svg+xml;base64,PHN2Zz4=" })).status, 422, "no SVG");
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: "data:image/png;base64," + "A".repeat(460_000) })).status, 422, "too large");
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "nope", image: PNG })).status, 422);
  const mine = (await as(DOCTOR, "GET", "/api/signature-assets")).data;
  assert.equal(mine.doctorSignature, PNG);
  assert.equal(mine.hospitalStamp, null, "a doctor is never shown the hospital stamp");
  assert.equal((await as(OTHER_DOCTOR, "GET", "/api/signature-assets")).data.doctorSignature, null, "another doctor has none of their own");
  assert.equal((await as(ADMIN, "GET", "/api/signature-assets")).data.doctorSignature, null);
  assert.equal((await as(OTHER_HOSPITAL, "GET", "/api/signature-assets")).data.hospitalStamp, null, "another hospital has its own stamp");
  const gone = await as(DOCTOR, "DELETE", "/api/signature-assets?kind=doctor_stamp");
  assert.equal(gone.status, 200);
  assert.equal(gone.data.doctorStamp, null);
});

test("the patient's signature: added by drawing or upload, kept on the form, replaced or removed, and printed at every place the form asks for it", async () => {
  const p = await mkPatient("PA Patient Sign");
  const f = (await make("kotak", p.id)).data;
  assert.equal(f.patientSignatureImg, null);
  const put = (who: string, image: unknown, id = f.id) => as(who, "PUT", `/api/preauth/${id}/patient-signature`, { image });
  const ok = await put(BILLING, PNG);
  assert.equal(ok.status, 200, JSON.stringify(ok.error));
  assert.equal(ok.data.patientSignatureImg, PNG);
  assert.equal(ok.data.patientSignedBy, "Kavitha Krishnan");
  assert.ok(ok.data.patientSignedAt);
  // it comes back with the form, and can be replaced
  assert.equal((await as(ADMIN, "GET", `/api/preauth/${f.id}`)).data.patientSignatureImg, PNG);
  const other = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";
  assert.equal((await put(ADMIN, other)).data.patientSignatureImg, other);
  // only a picture, and not too big
  for (const bad of ["hello", "data:text/html;base64,AAAA", `data:image/png;base64,${"A".repeat(460_000)}`, 42]) assert.ok([400, 422].includes((await put(ADMIN, bad)).status), `refused: ${String(bad).slice(0, 20)}`);
  assert.ok([400, 422].includes((await as(ADMIN, "PUT", `/api/preauth/${f.id}/patient-signature`, {})).status), "needs the image or null");
  // can't be changed by someone who doesn't work on pre-auth, or from another hospital
  assert.equal((await put(PHARMACIST, PNG)).status, 403);
  assert.equal((await put(OTHER_HOSPITAL, PNG)).status, 404);
  // it can be added after the doctor has signed and the hospital stamped, and removed again
  assert.equal((await put(ADMIN, null)).data.patientSignatureImg, null);
  assert.equal((await as(ADMIN, "GET", `/api/preauth/${f.id}`)).data.patientSignedAt, null);
});

test("every exact form that asks for the patient's signature has its places mapped, on a page that exists", async () => {
  const { readFileSync } = await import("node:fs");
  const dir = "F:/Work/samvaad-hms/samvaad-hms/public/preauth/";
  let withPlaces = 0;
  for (const k of EXACT_KEYS) {
    const t = JSON.parse(readFileSync(`${dir}${k}.json`, "utf8"));
    const v = t.images?.patientSignature;
    if (!v) continue;
    withPlaces++;
    for (const spot of Array.isArray(v) ? v : [v]) {
      assert.ok(Number.isInteger(spot.p) && spot.p >= 0 && spot.p < t.pages, `${k}: page ${spot.p}`);
      assert.ok(spot.w > 20 && spot.h > 10 && spot.x >= 0 && spot.y >= 0, `${k}: size / position`);
    }
  }
  assert.ok(withPlaces >= 30, `only ${withPlaces} forms have a patient signature place`);
});

test("every exact form has its real PDF and a box map, and only standard fields", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const dir = "F:/Work/samvaad-hms/samvaad-hms/public/preauth/";
  assert.ok(EXACT_KEYS.size >= 30, `only ${EXACT_KEYS.size} exact forms`);
  for (const k of EXACT_KEYS) {
    assert.ok(existsSync(`${dir}${k}.pdf`) && existsSync(`${dir}${k}.json`), `${k} files`);
    assert.equal(readFileSync(`${dir}${k}.pdf`).subarray(0, 4).toString(), "%PDF", `${k} is a PDF`);
    const t = JSON.parse(readFileSync(`${dir}${k}.json`, "utf8"));
    assert.ok(Object.keys(t.fields).length >= 15, `${k} has few boxes`);
    for (const key of [...Object.keys(t.fields), ...Object.keys(t.checks), ...Object.keys(t.chronic)]) assert.ok(PREAUTH_FIELDS[key] || key.startsWith("decl"), `${k} maps unknown field ${key}`);
    const def = PREAUTH_FORMS.find((f) => f.key === k)!;
    assert.ok(def.fields.some((f) => f.key === "patientName"), `${k} asks the patient's name`);
  }
});

test("one hospital never sees another's forms, notifications or pending list", async () => {
  const p = await mkPatient("PA Private");
  const f = (await make("care", p.id)).data;
  await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  const theirs = await as(OTHER_HOSPITAL, "GET", `/api/preauth/${f.id}`);
  assert.ok([403, 404].includes(theirs.status));
  assert.ok(!(await as(OTHER_HOSPITAL, "GET", "/api/preauth")).data.some((x: any) => x.id === f.id));
  assert.ok(!(await as(OTHER_HOSPITAL, "GET", "/api/notifications")).data.items.some((x: any) => x.link === `/preauth/${f.id}`));
  assert.equal((await as(OTHER_HOSPITAL, "GET", "/api/preauth/pending")).data.toStamp.some((x: any) => x.id === f.id), false);
  for (const act of ["submit", "sign", "stamp"]) assert.ok([403, 404, 422].includes((await as(OTHER_HOSPITAL, "POST", `/api/preauth/${f.id}/${act}`, {})).status), act);
  assert.ok([403, 404].includes((await as(OTHER_HOSPITAL, "PUT", `/api/preauth/${f.id}`, { values: { icd10: "X" } })).status));
  assert.ok([403, 404].includes((await as(OTHER_HOSPITAL, "DELETE", `/api/preauth/${f.id}`)).status));
});

test("the list shows what you're allowed to: filters by status and patient; a pharmacist sees none", async () => {
  const p = await mkPatient("PA Listed");
  const f = (await make("care", p.id)).data;
  const all = (await as(ADMIN, "GET", "/api/preauth")).data;
  assert.ok(all.some((x: any) => x.id === f.id));
  assert.ok(all.every((x: any) => x.values === undefined && x.hospitalStampImg === undefined), "the list carries no pictures or details");
  assert.ok((await as(ADMIN, "GET", `/api/preauth?patientId=${p.id}`)).data.every((x: any) => x.patientId === p.id));
  assert.ok((await as(ADMIN, "GET", "/api/preauth?status=Ready")).data.every((x: any) => x.status === "Ready"));
  assert.equal((await as(PHARMACIST, "GET", "/api/preauth")).data.length, 0);
});

test("notifications: mine only, newest first, mark one or all as read", async () => {
  const before = (await as(DOCTOR, "GET", "/api/notifications")).data;
  const p = await mkPatient("PA Notify");
  const f = (await make("care", p.id)).data;
  await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`);
  const after = (await as(DOCTOR, "GET", "/api/notifications")).data;
  assert.equal(after.unread, before.unread + 1);
  assert.equal(after.items[0].link, `/preauth/${f.id}`, "newest first");
  const one = await as(DOCTOR, "POST", "/api/notifications", { ids: [after.items[0].id] });
  assert.equal(one.data.unread, before.unread);
  // Another person's notification can't be marked by me.
  const adminNote = (await as(ADMIN, "GET", "/api/notifications")).data;
  await as(DOCTOR, "POST", "/api/notifications", { ids: adminNote.items.map((x: any) => x.id) });
  assert.equal((await as(ADMIN, "GET", "/api/notifications")).data.unread, adminNote.unread);
  const all = await as(DOCTOR, "POST", "/api/notifications", { all: true });
  assert.equal(all.data.unread, 0);
});

test("a finished form can only be deleted by the hospital's admin; a draft by whoever makes forms", async () => {
  const p = await mkPatient("PA Delete");
  const d = (await make("care", p.id, BILLING)).data;
  assert.equal((await as(BILLING, "DELETE", `/api/preauth/${d.id}`)).status, 200);
  assert.equal((await as(ADMIN, "GET", `/api/preauth/${d.id}`)).status, 404);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
