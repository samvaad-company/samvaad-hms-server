/**
 * Tests for the patient portal endpoints the HMS gives the portal (/api/portal/*): appointments (list, cancel), doctors and availability,
 * bills, records and downloads, uploads, profile change requests, prescriptions and the updates feed.
 *
 * Every route must prove the same few things: a missing or wrong key is 401, another patient's id is 404 (never 403), bad input is 4xx with a
 * message, and nothing leaves that a patient should not see.
 *
 *   npm run test:portal
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { appointmentsRepo, billsRepo, billItemsRepo, labRepo, radiologyRepo, documentsRepo, doctorsRepo, hospitalsRepo, prescriptionsRepo } = await import("@/repositories");
const { getStorage } = await import("@/storage");
const { localDate, localMinutes, to12h } = await import("@/lib/clock");
const { addDaysTo } = await import("@/services/portal-common");
const { sniffType } = await import("@/services/portal-records-service");
const { app } = await createApp();

const KEY = "test-portal-key-0123456789";
async function raw(method: string, path: string, opts: { key?: string | null; body?: unknown; form?: FormData; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.key !== null) headers["x-portal-key"] = opts.key ?? KEY;
  if (opts.cookie) headers.cookie = opts.cookie;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(opts.body); }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  return res;
}
async function call(method: string, path: string, opts: Parameters<typeof raw>[2] = {}) {
  const res = await raw(method, path, opts);
  const text = await res.clone().text();
  let json: { data?: any; error?: { code: string; message: string } } | null = null;
  try { json = JSON.parse(text); } catch { /* a file */ }
  return { status: res.status, data: json?.data, error: json?.error, res, text };
}
const get = (path: string) => call("GET", path);

// Staff session, for creating patients and for the staff half of the change requests.
let staffCookie = "";
async function staff(method: string, path: string, body?: unknown) {
  if (!staffCookie) {
    const r = await app.fetch(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "kevin.carter@samvaadhospital.in", password: "Samvaad@123" }) }));
    assert.equal(r.status, 200);
    staffCookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers: { cookie: staffCookie, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }));
  const j = (await res.json().catch(() => null)) as { data?: any; error?: { message: string } } | null;
  return { status: res.status, data: j?.data, error: j?.error };
}

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

async function newPatient(name: string, phone: string) {
  const r = await staff("POST", "/api/patients", { name, phone, gender: "Female", age: 34, allergies: "Penicillin", chronic: "Asthma" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data.id as number;
}
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n% test report\n"), Buffer.alloc(200, 0x20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
const upload = (patientId: number, file: Buffer, name: string, extra: Record<string, string> = { category: "Insurance" }) => {
  const form = new FormData();
  form.append("patientId", String(patientId));
  form.append("file", new Blob([new Uint8Array(file)]), name);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return call("POST", "/api/portal/documents", { form });
};

let A = 0, B = 0;
const ids: Record<string, number> = {};

test("setup: two patients, each with records of their own", async () => {
  A = await newPatient("Portal Alice", "9876500101");
  B = await newPatient("Portal Bob", "9876500102");
  const today = localDate();
  const bill = (patient: number, name: string, n: string, over: Record<string, unknown>) => billsRepo.create({
    hospital_id: 1, bill_number: n, patient_id: patient, patient_name: name, type: "OPD", bill_date: today, bill_time: "10:00", amount: 500, discount: 0, gst: 0, total: 500, status: "Pending", ...over,
  } as never);
  ids.billP1 = ((await bill(A, "Portal Alice", "INV-P1", { total: 500, amount: 500, discount_details: { hospital: { percent: 10, amount: 50 } }, contract_name: "SecretCo", payer_share: 0 })) as { id: number }).id;
  ids.billP2 = ((await bill(A, "Portal Alice", "INV-P2", { total: 300, amount: 300, patient_share: 100, payer_share: 200, contract_id: 1, contract_name: "SecretCo" })) as { id: number }).id;
  ids.billPart = ((await bill(A, "Portal Alice", "INV-P3", { total: 200, amount: 200, status: "Partial" })) as { id: number }).id;
  ids.billPaid = ((await bill(A, "Portal Alice", "INV-P4", { total: 400, amount: 400, status: "Paid", payment_mode: "UPI" })) as { id: number }).id;
  ids.billB = ((await bill(B, "Portal Bob", "INV-B1", { total: 999, amount: 999 })) as { id: number }).id;
  await billItemsRepo.create({ hospital_id: 1, bill_id: ids.billP1, service_id: null, code: "C1", name: "Consultation", quantity: 1, unit_price: 500, gst_rate: 0, hsn_sac: "", amount: 500, payer_amount: 0 } as never);

  const lab = (patient: number, name: string, over: Record<string, unknown>) => labRepo.create({
    hospital_id: 1, order_number: `LAB-P${patient}${name}`, patient_id: patient, patient_name: "x", patient_age: 30, test_name: name, requested_by: "Dr", doctor_id: 2, doctor: "Dr. Sophia Adams",
    priority: "Routine", sample_status: "Collected", report_status: "Ready", test_date: today, collection_date: today, amount: 100, discount: 0, discount_type: "percent",
    status: "Report Ready", lab_center_id: null, report_file: null, report_file_name: null, report_note: "SECRET RESULT", report_uploaded_by: "Tech", report_uploaded_at: null, ...over,
  } as never);
  ids.labDone = ((await lab(A, "Complete Blood Count", { report_file: `data:application/pdf;base64,${PDF.toString("base64")}`, report_file_name: "cbc.pdf" })) as { id: number }).id;
  ids.labWait = ((await lab(A, "Lipid Profile", { status: "Pending", report_status: "Pending" })) as { id: number }).id;
  ids.labB = ((await lab(B, "Bob's Blood Test", { report_file: `data:application/pdf;base64,${PDF.toString("base64")}`, report_file_name: "bob.pdf" })) as { id: number }).id;
  ids.rad = ((await radiologyRepo.create({
    hospital_id: 1, order_number: "RAD-P1", patient_id: A, patient_name: "x", patient_age: 30, test_name: "Chest X-Ray", scan_status: "Done", report_status: "Ready", test_date: today,
    priority: "Routine", status: "Report Ready", doctor_id: 2, doctor: "Dr. Sophia Adams", report_file: `data:image/png;base64,${PNG.toString("base64")}`, report_file_name: "chest.png",
  } as never)) as { id: number }).id;

  const put = async (name: string, body: Buffer, mime: string) => getStorage().put({ data: body, fileName: name, mimeType: mime });
  const doc = async (owner: number, title: string, over: Record<string, unknown>) => {
    const s = await put(`${title}.pdf`, PDF, "application/pdf");
    return (await documentsRepo.create({ hospital_id: 1, owner_type: "patient", owner_id: owner, category: "General", title, file_name: s.fileName, mime_type: "application/pdf", size_bytes: s.sizeBytes, storage_key: s.key, uploaded_by: "Staff", retention_state: "Active", ...over } as never)) as { id: number };
  };
  ids.docHidden = (await doc(A, "Internal note", {})).id;
  ids.docShared = (await doc(A, "Discharge summary", { visible_to_patient: true })).id;
  ids.docB = (await doc(B, "Bob's file", { visible_to_patient: true })).id;
});

test("every new route refuses a missing or wrong key", async () => {
  const paths = [
    ["GET", `/api/portal/appointments?patientId=${A}`], ["POST", "/api/portal/appointments/1/cancel"], ["GET", `/api/portal/doctors?patientId=${A}`],
    ["GET", `/api/portal/doctors/2/availability?patientId=${A}`], ["GET", `/api/portal/bills?patientId=${A}`], ["GET", `/api/portal/bills/${ids.billP1}?patientId=${A}`],
    ["GET", `/api/portal/records?patientId=${A}`], ["GET", `/api/portal/records/lab-${ids.labDone}/download?patientId=${A}`], ["POST", "/api/portal/documents"],
    ["DELETE", `/api/portal/documents/1?patientId=${A}`], ["GET", `/api/portal/profile?patientId=${A}`], ["POST", "/api/portal/profile/update-request"],
    ["GET", `/api/portal/profile/update-requests?patientId=${A}`], ["GET", `/api/portal/prescriptions?patientId=${A}`], ["GET", `/api/portal/prescriptions/1?patientId=${A}`],
    ["GET", `/api/portal/updates?patientId=${A}`],
  ] as const;
  for (const [m, p] of paths) {
    assert.equal((await call(m, p, { key: null })).status, 401, `${m} ${p} without a key`);
    assert.equal((await call(m, p, { key: "wrong-key-wrong-key-wrong-key" })).status, 401, `${m} ${p} with a wrong key`);
  }
  // A missing or bad patient id is a 400.
  assert.equal((await get("/api/portal/bills")).status, 400);
  assert.equal((await get("/api/portal/bills?patientId=abc")).status, 400);
});

test("bills: the pending total is the sum of what is listed; no payer, contract or discount-decision data leaves", async () => {
  const r = await get(`/api/portal/bills?patientId=${A}&status=all`);
  assert.equal(r.status, 200);
  // Pending: 500 (whole bill) + 100 (the patient's share of a sponsor-covered bill). The Partial bill has no known amount due.
  assert.deepEqual(r.data.summary, { pendingCount: 3, pendingTotal: 600, partialCount: 1, currency: "INR" });
  const byNo = Object.fromEntries(r.data.items.map((b: any) => [b.billNumber, b]));
  assert.equal(byNo["INV-P1"].due, 500);
  assert.equal(byNo["INV-P2"].due, 100);
  assert.equal(byNo["INV-P3"].due, null, "never guess an amount owed");
  assert.equal(byNo["INV-P4"].due, 0);
  assert.equal(r.data.items.some((b: any) => b.billNumber === "INV-B1"), false, "another patient's bill");
  const sum = r.data.items.filter((b: any) => b.status === "Pending").reduce((n: number, b: any) => n + b.due, 0);
  assert.equal(sum, r.data.summary.pendingTotal);
  assert.equal((await get(`/api/portal/bills?patientId=${A}&status=pending`)).data.items.length, 3);
  assert.equal((await get(`/api/portal/bills?patientId=${A}&status=paid`)).data.items.length, 1);
  for (const bad of ["payer", "contract", "discountDetails", "SecretCo", "patientShare", "policy"]) assert.ok(!r.text.includes(bad), `no "${bad}" in the list`);
  const one = await get(`/api/portal/bills/${ids.billP1}?patientId=${A}`);
  assert.equal(one.status, 200);
  assert.deepEqual(one.data.items, [{ name: "Consultation", quantity: 1, rate: 500, amount: 500 }]);
  for (const bad of ["payer", "contract", "discountDetails", "SecretCo", "policy"]) assert.ok(!one.text.includes(bad), `no "${bad}" in the detail`);
  const paid = await get(`/api/portal/bills/${ids.billPaid}?patientId=${A}`);
  assert.equal(paid.data.paymentMode, "UPI");
  assert.match(paid.data.paidOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.res.headers.get("cache-control"), "private, no-store");
});

test("bills: another patient's bill is 404, not 403", async () => {
  assert.equal((await get(`/api/portal/bills/${ids.billB}?patientId=${A}`)).status, 404);
  assert.equal((await get(`/api/portal/bills/${ids.billP1}?patientId=${B}`)).status, 404);
  assert.equal((await get(`/api/portal/bills/999999?patientId=${A}`)).status, 404);
  assert.equal((await get(`/api/portal/bills/${ids.billB}?patientId=${B}`)).status, 200);
});

test("records: lab, radiology and shared documents are listed; staff-only documents and other patients' records are not", async () => {
  const r = await get(`/api/portal/records?patientId=${A}`);
  assert.equal(r.status, 200);
  const byId = Object.fromEntries(r.data.map((x: any) => [x.id, x]));
  assert.equal(byId[`lab-${ids.labDone}`].status, "Completed");
  assert.equal(byId[`lab-${ids.labDone}`].hasFile, true);
  assert.equal(byId[`lab-${ids.labDone}`].mimeType, "application/pdf");
  assert.equal(byId[`lab-${ids.labWait}`].status, "In progress");
  assert.equal(byId[`lab-${ids.labWait}`].hasFile, false);
  assert.equal(byId[`radiology-${ids.rad}`].kind, "radiology");
  assert.ok(byId[`doc-${ids.docShared}`], "a shared document");
  assert.equal(byId[`doc-${ids.docHidden}`], undefined, "a staff document that was not shared");
  assert.equal(byId[`lab-${ids.labB}`], undefined);
  assert.equal(byId[`doc-${ids.docB}`], undefined);
  assert.ok(!r.text.includes("SECRET RESULT"), "no result text, only files");
  assert.deepEqual((await get(`/api/portal/records?patientId=${A}&kind=lab`)).data.map((x: any) => x.kind), ["lab", "lab"]);
  for (const x of r.data) assert.match(x.id, /^(lab|radiology|doc)-\d+$/);
});

test("records: a file downloads with its type and name; anything else is 404", async () => {
  const d = await call("GET", `/api/portal/records/lab-${ids.labDone}/download?patientId=${A}`);
  assert.equal(d.status, 200);
  assert.equal(d.res.headers.get("content-type"), "application/pdf");
  assert.match(d.res.headers.get("content-disposition") ?? "", /^attachment; filename="cbc.pdf"/);
  assert.equal(d.res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(d.res.headers.get("cache-control"), "private, no-store");
  assert.ok(d.text.startsWith("%PDF"));
  assert.match((await call("GET", `/api/portal/records/lab-${ids.labDone}/download?patientId=${A}&inline=1`)).res.headers.get("content-disposition") ?? "", /^inline;/);
  assert.equal((await call("GET", `/api/portal/records/radiology-${ids.rad}/download?patientId=${A}`)).res.headers.get("content-type"), "image/png");
  assert.equal((await call("GET", `/api/portal/records/doc-${ids.docShared}/download?patientId=${A}`)).status, 200);
  // Not this patient's, not shared, no file, or not a valid record id.
  for (const id of [`lab-${ids.labB}`, `doc-${ids.docB}`, `doc-${ids.docHidden}`, `lab-${ids.labWait}`, "lab-999999", "x-1", "lab-1;drop", "../etc/passwd"]) {
    assert.equal((await call("GET", `/api/portal/records/${encodeURIComponent(id)}/download?patientId=${A}`)).status, 404, id);
  }
  assert.equal((await call("GET", `/api/portal/records/lab-${ids.labDone}/download?patientId=${B}`)).status, 404);
});

test("upload: a PDF or photo is accepted and waits for review; the wrong kind of file, a big one and a bad category are refused", async () => {
  const ok1 = await upload(A, PDF, "../../my card.pdf", { category: "Insurance", title: "Insurance card", note: "front side" });
  assert.equal(ok1.status, 201, JSON.stringify(ok1.error));
  assert.equal(ok1.data.source, "patient");
  assert.equal(ok1.data.reviewStatus, "pending");
  assert.equal(ok1.data.title, "Insurance card");
  assert.ok(!ok1.data.fileName.includes("/") && !ok1.data.fileName.includes(".."), "the name is cleaned");
  ids.upload = Number(ok1.data.id.replace("doc-", ""));
  const listed = (await get(`/api/portal/records?patientId=${A}&kind=document`)).data.find((x: any) => x.id === ok1.data.id);
  assert.equal(listed.source, "patient");
  assert.equal((await call("GET", `/api/portal/records/${ok1.data.id}/download?patientId=${A}`)).status, 200, "the patient can read their own upload");
  assert.equal((await upload(A, PNG, "photo.png", { category: "ID proof" })).status, 201);
  // A program renamed .pdf, a plain text file and an empty one.
  assert.equal((await upload(A, Buffer.from("MZ\x90\x00 this is an exe"), "invoice.pdf")).status, 415);
  assert.equal((await upload(A, Buffer.from("just text"), "notes.pdf")).status, 415);
  assert.equal((await upload(A, Buffer.alloc(0), "empty.pdf")).status, 400);
  assert.equal((await upload(A, Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]), "big.pdf")).status, 413);
  assert.equal((await upload(A, PDF, "x.pdf", { category: "Hacking" })).status, 400);
  assert.equal((await upload(A, PDF, "x.pdf", { category: "Other", title: "t".repeat(121) })).status, 400);
  assert.equal(sniffType(Buffer.from("%PDF-1")), "application/pdf");
});

test("upload: the 51st file is refused; staff accepting or rejecting changes what the patient sees", async () => {
  const mine = (await get(`/api/portal/records?patientId=${A}&kind=document&pageSize=50`)).data.filter((x: any) => x.source === "patient").length;
  for (let i = mine; i < 50; i++) {
    const s = await getStorage().put({ data: PDF, fileName: `fill${i}.pdf`, mimeType: "application/pdf" });
    await documentsRepo.create({ hospital_id: 1, owner_type: "patient", owner_id: A, category: "Other", file_name: s.fileName, mime_type: "application/pdf", size_bytes: 10, storage_key: s.key, uploaded_by: "Patient (portal)", visible_to_patient: true, source: "patient", review_status: "pending", retention_state: "Active" } as never);
  }
  const over = await upload(A, PDF, "one-too-many.pdf");
  assert.equal(over.status, 409, over.text);
  // Staff reject one with a reason: the patient sees why. Accept another.
  const s1 = await staff("PUT", `/api/documents/${ids.upload}`, { reviewStatus: "rejected" });
  assert.equal(s1.status, 400, "a reason is needed");
  const s2 = await staff("PUT", `/api/documents/${ids.upload}`, { reviewStatus: "rejected", rejectionReason: "The photo is blurred" });
  assert.equal(s2.status, 200, JSON.stringify(s2.error));
  const row = (await get(`/api/portal/records?patientId=${A}&kind=document&pageSize=50`)).data.find((x: any) => x.id === `doc-${ids.upload}`);
  assert.deepEqual([row.reviewStatus, row.rejectionReason], ["rejected", "The photo is blurred"]);
  // Staff share a file with the patient.
  assert.equal((await staff("PUT", `/api/documents/${ids.docHidden}`, { visibleToPatient: true })).status, 200);
  const pages = [...(await get(`/api/portal/records?patientId=${A}&kind=document&pageSize=50&page=1`)).data, ...(await get(`/api/portal/records?patientId=${A}&kind=document&pageSize=50&page=2`)).data];
  assert.ok(pages.some((x: any) => x.id === `doc-${ids.docHidden}`), "shared by staff, so the patient sees it (page 2: there are over 50 files now)");
  assert.equal((await staff("PUT", `/api/documents/${ids.docShared}`, { reviewStatus: "approved" })).status, 400, "only a patient's own file can be accepted or rejected");
});

test("upload: the patient can remove their own file only while it is pending", async () => {
  const fresh = await upload(B, PDF, "mine.pdf", { category: "Other" });
  assert.equal(fresh.status, 201);
  const n = fresh.data.id.replace("doc-", "");
  assert.equal((await call("DELETE", `/api/portal/documents/${n}?patientId=${A}`)).status, 404, "another patient's file");
  assert.equal((await call("DELETE", `/api/portal/documents/${ids.docB}?patientId=${B}`)).status, 404, "a staff file, not an upload");
  assert.equal((await call("DELETE", `/api/portal/documents/${ids.upload}?patientId=${A}`)).status, 409, "already rejected: staff have looked at it");
  assert.equal((await call("DELETE", `/api/portal/documents/${n}?patientId=${B}`)).status, 200);
  assert.equal((await call("GET", `/api/portal/records/doc-${n}/download?patientId=${B}`)).status, 404, "gone");
});

test("profile: change requests change nothing until the front desk applies them", async () => {
  const p = await get(`/api/portal/profile?patientId=${A}`);
  assert.equal(p.status, 200);
  assert.deepEqual([p.data.name, p.data.allergies, p.data.chronicConditions], ["Portal Alice", ["Penicillin"], ["Asthma"]]);
  const req = (changes: unknown, patientId = A) => call("POST", "/api/portal/profile/update-request", { body: { patientId, changes } });
  const good = await req({ phone: "9876500199", city: "Pune", allergies: ["Penicillin", "Dust"] });
  assert.equal(good.status, 201, JSON.stringify(good.error));
  assert.equal(good.data.status, "pending");
  assert.deepEqual(good.data.previous.allergies, ["Penicillin"]);
  assert.equal((await get(`/api/portal/profile?patientId=${A}`)).data.phone, "9876500101", "the record is untouched");
  // Not allowed, malformed, or no change at all.
  assert.equal((await req({ name: "Someone Else" })).status, 422);
  assert.equal((await req({ gender: "Male" })).status, 422);
  assert.equal((await req({ dob: "1990-01-01" })).status, 422);
  assert.equal((await req({ phone: "12" })).status, 422);
  assert.equal((await req({ email: "not-an-email" })).status, 422);
  assert.equal((await req({ allergies: "Dust" })).status, 422);
  assert.equal((await req({ city: "Pune", phone: "9876500199" })).status, 201, "a second, different request");
  assert.equal((await req({})).status, 400);
  assert.equal((await req({ city: "Mumbai" }, 999999)).status, 404);
  // The patient sees only their own requests.
  assert.equal((await get(`/api/portal/profile/update-requests?patientId=${A}`)).data.length, 2);
  assert.equal((await get(`/api/portal/profile/update-requests?patientId=${B}`)).data.length, 0);
  // Staff apply the first and reject the second.
  const list = await staff("GET", `/api/patients/${A}/update-requests`);
  assert.equal(list.status, 200);
  const [second, first] = list.data;
  assert.equal((await staff("POST", `/api/patients/${A}/update-requests/${second.id}`, { decision: "reject" })).status, 400, "a reason is needed");
  assert.equal((await staff("POST", `/api/patients/${A}/update-requests/${second.id}`, { decision: "reject", note: "Please bring ID proof" })).data.status, "rejected");
  assert.equal((await staff("POST", `/api/patients/${A}/update-requests/${first.id}`, { decision: "apply" })).data.status, "applied");
  const after = (await get(`/api/portal/profile?patientId=${A}`)).data;
  assert.deepEqual([after.phone, after.city, after.allergies], ["9876500199", "Pune", ["Penicillin", "Dust"]]);
  assert.equal((await staff("POST", `/api/patients/${A}/update-requests/${first.id}`, { decision: "apply" })).status, 409, "already dealt with");
  const mine = (await get(`/api/portal/profile/update-requests?patientId=${A}`)).data;
  assert.deepEqual(mine.map((r: any) => [r.status, r.decisionNote]), [["rejected", "Please bring ID proof"], ["applied", ""]]);
});

test("prescriptions: the half prescription has the medicines and directions, never the examination, history or a draft", async () => {
  const consult = {
    chiefComplaint: "SECRET complaint", history: { past: "SECRET past", family: "SECRET family", personal: "x", medical: "x" },
    patientHistory: [{ type: "Allergy", text: "Sulfa drugs", since: "" }],
    vitals: { bp: "120/80", pulse: "72", temp: "98.6", spo2: "98", weight: "70", height: "170", source: "x" },
    general: [{ id: "g", label: "Pallor", kind: "text", value: "SECRET exam" }], systemic: [], investigations: ["SECRET CBC"], secondaryDiagnosis: "Hypertension",
    followUp: addDaysTo(localDate(), 7), advice: { diet: "SECRET diet", exercise: "", other: "" }, remarks: "Avoid cold drinks.",
  };
  const make = (status: string, diagnosis: string) => staff("POST", "/api/prescriptions", {
    patientId: A, patientName: "Portal Alice", patientAge: 34, doctorId: 2, diagnosis, status, language: "Hindi", consultation: consult,
    items: [{ medicineName: "Paracetamol 500mg", dosage: "1 tablet", frequency: "1-0-1", duration: "5 days", timing: "After Meal", quantity: "10 tablets" }],
  });
  const shown = await make("Pending", "Viral fever");
  assert.equal(shown.status, 201, JSON.stringify(shown.error));
  const draft = await make("Draft", "Draft only");
  ids.rx = shown.data.id; ids.rxDraft = draft.data.id;
  const hospital = await hospitalsRepo.getRow(1);
  await hospitalsRepo.update(1, { letterhead_url: "data:image/png;base64,AAAA", letterhead_design: JSON.stringify({ enabled: true, logo: "data:image/png;base64,AAAA", name: "Patel Hospital", tagline: "ICU", useDoctorName: true, leftLines: ["MBBS"], footerLines: ["HOSPITAL : Vadodara"], accent: "#c0392b", watermark: true }) } as never);

  const list = await get(`/api/portal/prescriptions?patientId=${A}`);
  assert.equal(list.status, 200);
  assert.ok(list.data.some((r: any) => r.id === ids.rx));
  assert.equal(list.data.some((r: any) => r.id === ids.rxDraft), false, "no drafts");
  assert.equal((await get(`/api/portal/prescriptions?patientId=${B}`)).data.length, 0);

  const d = await get(`/api/portal/prescriptions/${ids.rx}?patientId=${A}`);
  assert.equal(d.status, 200, JSON.stringify(d.error));
  assert.equal(d.data.language, "Hindi");
  assert.equal(d.data.items[0].name, "Paracetamol 500mg");
  assert.equal(d.data.items[0].pattern, "1-0-1");
  assert.match(d.data.items[0].directions, /खाने/, "the directions are in the prescription's language");
  assert.equal((await get(`/api/portal/prescriptions/${ids.rx}?patientId=${A}&lang=English`)).data.items[0].timing, "After Meal");
  assert.match(d.data.vitals, /BLOOD PRESSURE - 120\/80mmHg/);
  assert.match(d.data.vitals, /BMI - 24\.2/);
  assert.deepEqual(d.data.diagnosis, ["Viral fever", "Hypertension (secondary)"]);
  assert.deepEqual(d.data.remarks, ["Avoid cold drinks."]);
  assert.deepEqual(d.data.allergies.sort(), ["Dust", "Penicillin", "Sulfa drugs"], "the record (changed above) and the prescription");
  assert.equal(d.data.followUp, consult.followUp);
  assert.equal(d.data.letterhead.enabled, true);
  assert.equal(d.data.letterhead.name, "Patel Hospital");
  for (const secret of ["SECRET", "chiefComplaint", "systemic", "investigations", "letterhead_url", "letterheadUrl", "ai_review", "aiReview"]) assert.ok(!d.text.includes(secret), `"${secret}" must not leave`);
  assert.equal((await get(`/api/portal/prescriptions/${ids.rx}?patientId=${B}`)).status, 404);
  assert.equal((await get(`/api/portal/prescriptions/${ids.rxDraft}?patientId=${A}`)).status, 404, "a draft");
  assert.equal((await get(`/api/portal/prescriptions/999999?patientId=${A}`)).status, 404);
  // Without a text letterhead the portal gets a plain { enabled: false }.
  await hospitalsRepo.update(1, { letterhead_design: null } as never);
  assert.deepEqual((await get(`/api/portal/prescriptions/${ids.rx}?patientId=${A}`)).data.letterhead, { enabled: false });
  void hospital; void prescriptionsRepo;
});

test("appointments: the patient's list, in both scopes, and cancelling one's own", async () => {
  // Find an open in-person time for Dr. Sophia Adams in the next week and book it as patient A.
  let booked: any = null;
  for (let i = 2; i < 9 && !booked; i++) {
    const day = addDaysTo(localDate(), i);
    const slots = await get(`/api/portal/appointments/slots?doctorId=2&date=${day}&mode=in_person`);
    const open = slots.data?.slots?.find((s: any) => s.status === "open");
    if (!open) continue;
    const r = await call("POST", "/api/portal/appointments", { body: { patientId: A, doctorId: 2, date: day, time: open.value, reason: "Fever for 3 days" } });
    assert.equal(r.status, 201, JSON.stringify(r.error));
    booked = r.data;
  }
  assert.ok(booked, "an open time was found");
  ids.appt = booked.appointmentId;
  const up = await get(`/api/portal/appointments?patientId=${A}&scope=upcoming`);
  assert.equal(up.status, 200);
  const row = up.data.find((a: any) => a.appointmentId === ids.appt);
  assert.ok(row);
  assert.equal(row.hospital.name.length > 0, true);
  assert.ok("consultAmount" in row && "paymentStatus" in row && "canReschedule" in row);
  assert.equal((await get(`/api/portal/appointments?patientId=${B}&scope=all`)).data.length, 0);
  assert.equal((await get(`/api/portal/appointments?patientId=${A}&scope=past`)).data.some((a: any) => a.appointmentId === ids.appt), false);
  assert.equal((await get(`/api/portal/appointments?patientId=999999`)).status, 404);

  // Another patient cannot cancel it; the owner can; twice is refused.
  assert.equal((await call("POST", `/api/portal/appointments/${ids.appt}/cancel`, { body: { patientId: B } })).status, 404);
  const gone = await call("POST", `/api/portal/appointments/${ids.appt}/cancel`, { body: { patientId: A, reason: "Cannot come" } });
  assert.equal(gone.status, 200, JSON.stringify(gone.error));
  assert.equal(gone.data.status, "Cancelled");
  assert.equal((await call("POST", `/api/portal/appointments/${ids.appt}/cancel`, { body: { patientId: A } })).status, 409);
  assert.equal((await get(`/api/portal/appointments?patientId=${A}&scope=upcoming`)).data.some((a: any) => a.appointmentId === ids.appt), false);
  assert.equal((await get(`/api/portal/appointments?patientId=${A}&scope=past`)).data.find((a: any) => a.appointmentId === ids.appt).status, "Cancelled");
  // The freed time can be booked again.
  assert.equal((await call("POST", "/api/portal/appointments", { body: { patientId: B, doctorId: 2, date: booked.date, time: booked.time, reason: "Check-up" } })).status, 201);
});

test("appointments: cancelling is refused inside the last hour", async () => {
  const nowMin = localMinutes();
  const soon = (nowMin + 10) % 1440;
  const date = nowMin + 10 >= 1440 ? addDaysTo(localDate(), 1) : localDate();
  const a = await appointmentsRepo.create({
    hospital_id: 1, patient_id: A, patient_name: "Portal Alice", patient_age: 34, doctor_id: 2, doctor: "Dr. Sophia Adams", appointment_date: date, appointment_time: to12h(soon),
    type: "Consultation", reason: "Soon", status: "Upcoming", slot_minutes: 30,
  } as never) as { id: number };
  const r = await call("POST", `/api/portal/appointments/${a.id}/cancel`, { body: { patientId: A } });
  assert.equal(r.status, 409);
  assert.match(r.error!.message, /call the hospital/);
  assert.equal((await appointmentsRepo.getRow(a.id))!.status, "Upcoming");
  // A completed appointment cannot be cancelled either.
  await appointmentsRepo.update(a.id, { status: "Completed" } as never);
  assert.equal((await call("POST", `/api/portal/appointments/${a.id}/cancel`, { body: { patientId: A } })).status, 409);
});

test("doctors and availability: weekly hours, next open time, a day-by-day count, and a closed day with its reason", async () => {
  const list = await get(`/api/portal/doctors?patientId=${A}&mode=in_person`);
  assert.equal(list.status, 200);
  assert.ok(list.data.length > 0);
  const d = list.data.find((x: any) => x.id === 2);
  assert.ok(d, "Dr. Sophia Adams");
  assert.ok(d.weeklyHours.length > 0 && /^\d\d:\d\d$/.test(d.weeklyHours[0].start));
  assert.ok(d.nextAvailable === null || (/^\d{4}-\d{2}-\d{2}$/.test(d.nextAvailable.date) && /^\d\d:\d\d$/.test(d.nextAvailable.time)));
  assert.ok(!list.text.includes("hospital_id"));
  const av = await get(`/api/portal/doctors/2/availability?patientId=${A}&mode=in_person&from=${addDaysTo(localDate(), 1)}&days=14`);
  assert.equal(av.status, 200, JSON.stringify(av.error));
  assert.equal(av.data.days.length, 14);
  assert.ok(av.data.days.every((x: any) => x.open <= x.total));
  assert.ok(av.data.days.some((x: any) => x.total > 0));
  assert.equal((await get(`/api/portal/doctors/2/availability?patientId=${A}&days=200`)).data.days.length, 31, "capped at 31 days");
  assert.equal((await get(`/api/portal/doctors/2/availability?patientId=${A}&from=2020-01-01`)).status, 400, "a date in the past");
  assert.equal((await get(`/api/portal/doctors/999999/availability?patientId=${A}`)).status, 404);
  // On leave: every day is closed and says why.
  await doctorsRepo.update(2, { status: "On Leave" } as never);
  const leave = await get(`/api/portal/doctors/2/availability?patientId=${A}&mode=in_person&from=${addDaysTo(localDate(), 1)}&days=3`);
  assert.ok(leave.data.days.every((x: any) => x.open === 0 && /on leave/i.test(x.closedReason)));
  assert.equal((await get(`/api/portal/doctors?patientId=${A}&mode=in_person`)).data.some((x: any) => x.id === 2), false, "not offered while on leave");
  await doctorsRepo.update(2, { status: "Available" } as never);
});

test("updates: a feed of what happened, with read state; one patient never sees another's", async () => {
  const r = await get(`/api/portal/updates?patientId=${A}`);
  assert.equal(r.status, 200);
  const byId = Object.fromEntries(r.data.map((u: any) => [u.id, u]));
  assert.ok(byId[`rx-${ids.rx}`], "the prescription");
  assert.equal(byId[`rx-${ids.rx}`].type, "prescription");
  assert.deepEqual(byId[`rx-${ids.rx}`].link, { screen: "prescription", id: ids.rx });
  assert.equal(byId[`rx-${ids.rxDraft}`], undefined, "no drafts");
  assert.ok(byId[`lab-${ids.labDone}`] && byId[`lab-${ids.labDone}`].type === "report", "the report that is ready");
  assert.equal(byId[`lab-${ids.labWait}`], undefined, "no report yet");
  assert.match(byId[`bill-${ids.billP1}`].title, /INV-P1: ₹500 pending/);
  assert.match(byId[`bill-${ids.billPaid}`].title, /paid/);
  assert.ok(byId[`appt-${ids.appt}`], "the appointment");
  assert.ok(r.data.every((u: any) => typeof u.at === "string" && typeof u.read === "boolean"));
  assert.deepEqual(r.data.map((u: any) => u.at), [...r.data.map((u: any) => u.at)].sort().reverse(), "newest first");
  assert.equal(r.data.some((u: any) => u.id === `bill-${ids.billB}` || u.id === `lab-${ids.labB}`), false);
  assert.ok(!r.text.includes("SECRET"));
  assert.equal((await get(`/api/portal/updates?patientId=${A}&limit=2`)).data.length, 2);
  assert.equal((await get(`/api/portal/updates?patientId=${A}&since=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`)).data.length, 0);
  assert.equal((await get(`/api/portal/updates?patientId=${B}`)).data.some((u: any) => u.id === `rx-${ids.rx}`), false);

  // Mark some read (strings), the rest with all; awareness numbers still work.
  const mark = await call("POST", "/api/portal/notifications/read", { body: { patientId: A, ids: [`rx-${ids.rx}`, `bill-${ids.billP1}`, "x-1", "rx-1;drop", 987654] } });
  assert.equal(mark.status, 200, JSON.stringify(mark.error));
  assert.ok("unread" in mark.data && Array.isArray(mark.data.items), "the bell's list comes back");
  const after = Object.fromEntries((await get(`/api/portal/updates?patientId=${A}`)).data.map((u: any) => [u.id, u]));
  assert.equal(after[`rx-${ids.rx}`].read, true);
  assert.equal(after[`bill-${ids.billP1}`].read, true);
  assert.equal(after[`appt-${ids.appt}`].read, false);
  assert.equal((await get(`/api/portal/updates?patientId=${B}`)).data.every((u: any) => u.read === false), true, "reading is per patient");
  await call("POST", "/api/portal/notifications/read", { body: { patientId: A, all: true } });
  assert.equal((await get(`/api/portal/updates?patientId=${A}`)).data.every((u: any) => u.read), true);
  assert.equal((await call("POST", "/api/portal/notifications/read", { body: { patientId: 999999, all: true } })).status, 404);
});

test("the portal's existing calls still work", async () => {
  assert.equal((await get(`/api/portal/teleconsult/doctors?patientId=${A}`)).status, 200);
  assert.equal((await get(`/api/portal/notifications?patientId=${A}`)).status, 200);
  assert.equal((await get(`/api/portal/awareness?patientId=${A}`)).status, 200);
  assert.equal((await get(`/api/portal/teleconsult/config?patientId=${A}`)).status, 200);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 8).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
