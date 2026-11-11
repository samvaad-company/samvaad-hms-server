/**
 * Tests for the claim packet: once a pre-auth form is signed and stamped, the papers that go with it — prescription, the patient's
 * reports, Aadhaar, PAN, policy — can be listed and fetched to be merged into one PDF. Only the form's own patient's papers are
 * offered, nothing is released before the form is Ready, and nobody outside the hospital (or the pre-auth team) can ask.
 *
 *   npm run test:packet
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo, usersRepo, labRepo, radiologyRepo, prescriptionsRepo, prescriptionItemsRepo } = await import("@/repositories");
const { app } = await createApp();

async function raw(method: string, path: string, opts: { body?: BodyInit; json?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  let body = opts.body;
  if (opts.json !== undefined) { body = JSON.stringify(opts.json); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { message: string } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function cookieFor(email: string) {
  if (!cookies.has(email)) {
    const login = await raw("POST", "/api/auth/login", { json: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
const as = async (email: string, method: string, path: string, json?: unknown) => raw(method, path, { json, cookie: await cookieFor(email) });
async function upload(email: string, formId: number, kind: string, name: string, type: string, content = "x") {
  const form = new FormData();
  form.append("file", new File([content], name, { type }));
  form.append("kind", kind);
  return raw("POST", `/api/preauth/${formId}/packet/upload`, { body: form, cookie: await cookieFor(email) });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_HOSPITAL = "admin@sunrisehospital.in";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF = "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK";

const hospitalId = (await patientsRepo.getRow(1))!.hospital_id;
const doctorUser = (await usersRepo.listRows({ unpaged: true } as never)).rows.find((u: any) => u.email === DOCTOR) as any;
let seq = 0;
const mkPatient = async (name: string) => { seq++; return patientsRepo.create({ hospital_id: hospitalId, patient_code: `PK-${String(seq).padStart(4, "0")}`, name, age: 50, gender: "Male", phone: `93000${String(seq).padStart(5, "0")}`, reason: "Pain", doctor_id: doctorUser.doctor_id, doctor: "Dr. Sophia Adams", status: "Completed", visit_date: "2026-11-01", visit_time: "10:00 AM" }) as Promise<{ id: number; name: string }>; };

/** A form taken all the way to Ready. */
async function readyForm(patientId: number) {
  const f = (await as(ADMIN, "POST", "/api/preauth", { formKey: "niva-bupa", patientId })).data;
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/submit`)).status, 200);
  assert.equal((await as(DOCTOR, "PUT", "/api/signature-assets", { kind: "doctor_signature", image: PNG })).status, 200);
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${f.id}/sign`, {})).status, 200);
  assert.equal((await as(ADMIN, "PUT", "/api/signature-assets", { kind: "hospital_stamp", image: PNG })).status, 200);
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${f.id}/stamp`)).status, 200);
  return f as { id: number };
}

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

let patient: { id: number; name: string };
let other: { id: number; name: string };
let form: { id: number };
let rxId = 0, otherRxId = 0, labId = 0, radId = 0, otherLabId = 0;

test("the packet lists the patient's prescriptions, reports and papers on file — and picks out Aadhaar, PAN and policy", async () => {
  patient = await mkPatient("Packet Patient");
  other = await mkPatient("Someone Else");
  const rx = await prescriptionsRepo.create({ hospital_id: hospitalId, rx_number: "RX-9001", patient_id: patient.id, patient_name: patient.name, patient_age: 50, doctor_id: doctorUser.doctor_id, doctor: "Dr. Sophia Adams", diagnosis: "Angina", medicine_count: 2, prescribed_date: "2026-11-02", status: "Active" }) as { id: number };
  rxId = rx.id;
  await prescriptionItemsRepo.create({ prescription_id: rxId, medicine_id: null, medicine_name: "Aspirin", dosage: "75 mg", frequency: "OD", duration: "30 days", instructions: "after food" } as never);
  await prescriptionItemsRepo.create({ prescription_id: rxId, medicine_id: null, medicine_name: "Atorvastatin", dosage: "20 mg", frequency: "HS", duration: "30 days", instructions: null } as never);
  otherRxId = ((await prescriptionsRepo.create({ hospital_id: hospitalId, rx_number: "RX-9002", patient_id: other.id, patient_name: other.name, patient_age: 40, doctor_id: doctorUser.doctor_id, doctor: "Dr. Sophia Adams", diagnosis: "Flu", medicine_count: 0, prescribed_date: "2026-11-02", status: "Active" })) as { id: number }).id;
  const base = { hospital_id: hospitalId, order_number: "LAB-9", patient_name: patient.name, patient_age: 50, requested_by: "Dr. Sophia Adams", doctor_id: doctorUser.doctor_id, doctor: "Dr. Sophia Adams", priority: "Routine", sample_status: "Collected", report_status: "Ready", test_date: "2026-11-03", collection_date: "2026-11-03", amount: 500, discount: 0, discount_type: "percent", status: "Report Ready" };
  labId = ((await labRepo.create({ ...base, patient_id: patient.id, test_name: "CBC", report_file: PDF, report_file_name: "cbc.pdf" } as never)) as { id: number }).id;
  await labRepo.create({ ...base, patient_id: patient.id, test_name: "Lipid profile", report_file: null, report_file_name: null } as never);
  otherLabId = ((await labRepo.create({ ...base, patient_id: other.id, test_name: "Other CBC", report_file: PDF, report_file_name: "other.pdf" } as never)) as { id: number }).id;
  radId = ((await radiologyRepo.create({ hospital_id: hospitalId, order_number: "RAD-9", patient_id: patient.id, patient_name: patient.name, patient_age: 50, test_name: "Chest X-ray", scan_status: "Done", report_status: "Ready", test_date: "2026-11-03", amount: 800, discount: 0, discount_type: "percent", priority: "Routine", status: "Report Ready", doctor_id: doctorUser.doctor_id, doctor: "Dr. Sophia Adams", report_file: PNG, report_file_name: "xray.png" } as never)) as { id: number }).id;

  form = await readyForm(patient.id);
  for (const [kind, name, type] of [["aadhaar", "scan1.jpg", "image/jpeg"], ["pan", "scan2.png", "image/png"], ["policy", "policy.pdf", "application/pdf"]] as const) {
    const r = await upload(ADMIN, form.id, kind, name, type);
    assert.equal(r.status, 201, `${kind}: ${JSON.stringify(r.error)}`);
  }
  const o = (await as(ADMIN, "GET", `/api/preauth/${form.id}/packet`)).data;
  assert.equal(o.ready, true);
  assert.deepEqual(o.prescriptions.map((r: any) => r.rxNumber), ["RX-9001"], "only this patient's prescriptions");
  assert.deepEqual(o.reports.map((r: any) => r.name).sort(), ["CBC", "Chest X-ray"], "only reports with a file, only this patient's");
  assert.deepEqual(o.documents.map((d: any) => d.kind).sort(), ["aadhaar", "pan", "policy"]);
  assert.equal(o.documents.find((d: any) => d.kind === "aadhaar").category, "Aadhaar card");
});

test("the chosen papers come back with the content to merge: prescription lines, report files and the cards", async () => {
  const o = (await as(ADMIN, "GET", `/api/preauth/${form.id}/packet`)).data;
  const pick = { prescriptions: [rxId], reports: o.reports.map((r: any) => r.key), documents: o.documents.map((d: any) => d.id) };
  const r = await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, pick);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.prescriptions[0].items.length, 2);
  assert.equal(r.data.prescriptions[0].items[0].medicineName, "Aspirin");
  assert.equal(r.data.files.length, 5);
  assert.ok(r.data.files.every((f: any) => f.dataUrl.startsWith("data:") && f.fileName && f.mimeType));
  assert.ok(r.data.files.some((f: any) => f.label === "Aadhaar card"));
  assert.ok(r.data.files.some((f: any) => /Lab report — CBC/.test(f.label)));
  // an empty choice is fine: just the form
  assert.deepEqual((await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, {})).data, { prescriptions: [], files: [] });
  // the doctor it is addressed to can make it too
  assert.equal((await as(DOCTOR, "POST", `/api/preauth/${form.id}/packet`, { prescriptions: [rxId] })).status, 200);
});

test("only this patient's papers can go in, and an unknown report is refused", async () => {
  const o = (await as(ADMIN, "GET", `/api/preauth/${form.id}/packet`)).data;
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, { prescriptions: [otherRxId] })).status, 403);
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, { reports: [`report:lab:${otherLabId}`] })).status, 403);
  assert.ok([400, 404].includes((await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, { reports: ["report:nope:1"] })).status));
  // another patient's paper on file
  const f2 = await readyForm((await mkPatient("Packet Two")).id);
  const up = await upload(ADMIN, f2.id, "pan", "pan2.jpg", "image/jpeg");
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${form.id}/packet`, { documents: [up.data.id] })).status, 403);
  assert.ok(o.documents.length === 3, "and it is not listed for this patient");
});

test("nothing is handed over before the form is signed and stamped", async () => {
  const draft = (await as(ADMIN, "POST", "/api/preauth", { formKey: "niva-bupa", patientId: patient.id })).data;
  const o = (await as(ADMIN, "GET", `/api/preauth/${draft.id}/packet`)).data;
  assert.equal(o.ready, false);
  assert.equal((await as(ADMIN, "POST", `/api/preauth/${draft.id}/packet`, { prescriptions: [rxId] })).status, 409);
});

test("what a paper is, uploads are validated, and access is limited", async () => {
  assert.equal((await upload(ADMIN, form.id, "passport", "p.jpg", "image/jpeg")).status, 400, "unknown kind");
  assert.equal((await upload(ADMIN, form.id, "pan", "p.exe", "application/x-msdownload")).status, 400, "unsupported file type");
  assert.equal((await upload(PHARMACIST, form.id, "pan", "p.jpg", "image/jpeg")).status, 403);
  assert.equal((await upload(OTHER_HOSPITAL, form.id, "pan", "p.jpg", "image/jpeg")).status, 404);
  assert.equal((await as(PHARMACIST, "GET", `/api/preauth/${form.id}/packet`)).status, 403);
  assert.equal((await as(OTHER_HOSPITAL, "GET", `/api/preauth/${form.id}/packet`)).status, 404);
  assert.equal(labId > 0 && radId > 0, true);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
