/**
 * IPD: no admission without a signed consent, no discharge without a final bill, and no discharge until every department the
 * patient used has cleared them.
 *
 *   npx tsx scripts/test-ipd-discharge.ts
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo, signatureRequestsRepo, pharmacyDispensesRepo, labRepo, radiologyRepo } = await import("@/repositories");
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
const PHARMACIST = "arun.tiwari@samvaadhospital.in";

const hospitalId = (await patientsRepo.getRow(1))!.hospital_id;
let seq = 0;
async function mkPatient(name: string) {
  seq++;
  return patientsRepo.create({ hospital_id: hospitalId, patient_code: `ID-${String(seq).padStart(4, "0")}`, name, age: 41, gender: "Female", phone: `92000${String(seq).padStart(5, "0")}`, reason: "", doctor_id: null, doctor: "", status: "Completed", visit_date: "2026-01-01", visit_time: "10:00 AM", address: "A-22 Society", city: "Surat" }) as Promise<{ id: number; name: string }>;
}

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

async function madeConsent(p: { id: number }) {
  const c = await as(ADMIN, "POST", `/api/patients/${p.id}/consents`, { template: "admission-consent", language: "English" });
  assert.equal(c.status, 201, JSON.stringify(c.error));
  return c.data as { id: number };
}
const sign = (id: number) => signatureRequestsRepo.update(id, { status: "Signed", signed_via: "paper", signed_at: new Date().toISOString(), signer_name: "Self", signer_relation: "Self" } as never);
const today = () => new Date().toISOString().slice(0, 10);

test("no admission until the admission consent is signed; one consent covers one admission", async () => {
  const p = await mkPatient("IPD Consent");
  const body = { patientId: p.id, patientName: p.name };
  let r = await as(ADMIN, "POST", "/api/ipd", body);
  assert.equal(r.status, 409); assert.equal(r.error?.details?.code, "consent_required");
  const c = await madeConsent(p);
  assert.equal((await as(ADMIN, "GET", `/api/ipd/admission-consent?patientId=${p.id}`)).data.ready, false);
  assert.equal((await as(ADMIN, "POST", "/api/ipd", body)).status, 409, "made but unsigned must not admit");
  await sign(c.id);
  assert.equal((await as(ADMIN, "GET", `/api/ipd/admission-consent?patientId=${p.id}`)).data.ready, true);
  r = await as(ADMIN, "POST", "/api/ipd", body);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const st = (await as(ADMIN, "GET", `/api/ipd/admission-consent?patientId=${p.id}`)).data;
  assert.equal(st.ready, false); assert.deepEqual(st.usedIds, [c.id]);
});

test("discharge needs the final bill, then every in-house department the patient used to clear them", async () => {
  const p = await mkPatient("IPD Clearance");
  await sign((await madeConsent(p)).id);
  const adm = (await as(ADMIN, "POST", "/api/ipd", { patientId: p.id, patientName: p.name })).data;
  const base = { hospital_id: hospitalId, patient_id: p.id, patient_name: p.name };
  await pharmacyDispensesRepo.create({ ...base, dispense_no: "DSP/T/1", walk_in_note: "", prescription_id: null, rx_number: "", billing: "none", bill_id: null, bill_number: null, admission_id: adm.id, admission_no: null, subtotal: 100, status: "Dispensed", dispensed_by: "t" } as never);
  const lab = { ...base, order_number: "LAB-T", patient_age: 40, requested_by: "", doctor_id: null, doctor: "", priority: "Routine", sample_status: "Pending", report_status: "Pending", collection_date: "", amount: 0, discount: 0, discount_type: "amount", status: "Pending", report_file: null, report_file_name: null, report_note: null, report_uploaded_by: null, report_uploaded_at: null, test_date: today() };
  await labRepo.create({ ...lab, test_name: "CBC", lab_center_id: null } as never);
  await labRepo.create({ ...lab, test_name: "Outside", lab_center_id: 999 } as never);
  await radiologyRepo.create({ ...base, order_number: "RAD-T", patient_age: 40, test_name: "X-ray", scan_status: "Pending", report_status: "Pending", amount: 0, discount: 0, discount_type: "amount", priority: "Routine", status: "Pending", doctor_id: null, doctor: "", radiology_center_id: 999, report_file: null, report_file_name: null, report_note: null, report_uploaded_by: null, report_uploaded_at: null, test_date: today() } as never);

  // 1. no final bill
  let r = await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`);
  assert.equal(r.status, 409); assert.equal(r.error?.details?.code, "bill_missing");
  const b = await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", status: "Paid", items: [{ description: "Ward", quantity: 1, unitPrice: 1000, gstRate: 0 }] });
  assert.equal(b.status, 201, JSON.stringify(b.error));

  // 2. departments asked: pharmacy and in-house lab, NOT the outside lab or outside radiology
  r = await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`);
  assert.equal(r.status, 409); assert.equal(r.error?.details?.code, "clearance_pending");
  const list = (await as(ADMIN, "GET", `/api/ipd/${adm.id}/clearances`)).data as { id: number; department: string; status: string }[];
  assert.deepEqual(list.map((c) => c.department).sort(), ["lab", "pharmacy"]);
  const pharm = list.find((c) => c.department === "pharmacy")!, labC = list.find((c) => c.department === "lab")!;

  // 3. the pharmacist sees only their own, flags a bill: the discharge says payment is pending
  const inbox = (await as(PHARMACIST, "GET", "/api/ipd/clearances")).data;
  assert.ok(inbox.waiting.some((c: any) => c.id === pharm.id) && !inbox.waiting.some((c: any) => c.id === labC.id), "pharmacy sees only its own");
  assert.equal((await as(PHARMACIST, "POST", `/api/ipd/clearances/${labC.id}`, { decision: "Cleared" })).status, 403, "pharmacy can't answer for the lab");
  assert.equal((await as(PHARMACIST, "POST", `/api/ipd/clearances/${pharm.id}`, { decision: "Flagged" })).status, 400, "a flag needs an amount or note");
  assert.equal((await as(PHARMACIST, "POST", `/api/ipd/clearances/${pharm.id}`, { decision: "Flagged", amountDue: 250, note: "Bill DSP/T/1" })).status, 200);
  assert.equal((await as(ADMIN, "POST", `/api/ipd/clearances/${labC.id}`, { decision: "Cleared" })).status, 200);
  r = await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`);
  assert.equal(r.status, 409); assert.match(r.error!.message, /payment is pending: Pharmacy/);

  // 4. the patient pays, IPD asks again (round 2), the pharmacist clears, the discharge goes through
  const again = (await as(ADMIN, "POST", `/api/ipd/${adm.id}/clearances`, { department: "pharmacy" })).data as any[];
  assert.equal(again.find((c) => c.department === "pharmacy").status, "Pending");
  assert.equal(again.find((c) => c.department === "pharmacy").round, 2);
  assert.equal((await as(PHARMACIST, "POST", `/api/ipd/clearances/${pharm.id}`, { decision: "Cleared" })).status, 200);
  r = await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`);
  assert.equal(r.status, 200, JSON.stringify(r.error));
});

test("a patient who used no department can be discharged once billed", async () => {
  const p = await mkPatient("IPD Plain");
  await sign((await madeConsent(p)).id);
  const adm = (await as(ADMIN, "POST", "/api/ipd", { patientId: p.id, patientName: p.name })).data;
  await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "IPD", status: "Paid", items: [{ description: "Ward", quantity: 1, unitPrice: 500, gstRate: 0 }] });
  const r = await as(ADMIN, "POST", `/api/ipd/${adm.id}/discharge`);
  assert.equal(r.status, 200, JSON.stringify(r.error));
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
