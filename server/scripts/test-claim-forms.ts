/**
 * Tests for claim forms: only admitted patients paid by an insurer or TPA are listed, each is matched to the insurer's claim form,
 * and the details the hospital holds come back under the standard claim keys. In-process, in-memory database.
 *
 *   npm run test:claim-forms
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { matchClaimForm, claimFormFor, CLAIM_FORMS } = await import("@shared/lib/claims/forms");
const { signatureRequestsRepo } = await import("@/repositories");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}
const ADMIN = "kevin.carter@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

let seq = 0;
const mobile = () => `97${String(40000000 + ++seq * 13)}`;
async function admit(payer: string, name: string) {
  const patient = (await as(ADMIN, "POST", "/api/patients", { name, gender: "Male", phone: mobile(), dob: "1985-03-14", address: "12 Green Park", city: "Mumbai" })).data;
  // An admission needs the patient's signed admission consent.
  const consent = await as(ADMIN, "POST", `/api/patients/${patient.id}/consents`, { template: "admission-consent", language: "English" });
  assert.equal(consent.status, 201, JSON.stringify(consent.error));
  await signatureRequestsRepo.update(consent.data.id, { status: "Signed", signed_via: "paper", signed_at: new Date().toISOString(), signer_name: "Self", signer_relation: "Self" } as never);
  const made = await as(ADMIN, "POST", "/api/ipd", { patientId: patient.id, patientName: patient.name, diagnosis: "Acute appendicitis" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  if (payer) assert.equal((await as(ADMIN, "PATCH", `/api/ipd/${made.data.id}/stay`, { payer })).status, 200);
  return { admissionId: made.data.id as number, patient };
}

test("the payer's name points at the right insurer's claim form", async () => {
  assert.equal(matchClaimForm("Star Health and Allied Insurance")?.key, "star-health");
  assert.equal(matchClaimForm("HDFC ERGO General Insurance")?.key, "hdfc-ergo");
  assert.equal(matchClaimForm("ICICI Lombard GIC")?.key, "icici-lombard");
  assert.equal(matchClaimForm("ICICI Prudential Life")?.key, "icici-pru");
  assert.equal(matchClaimForm("Niva Bupa (Max Bupa)")?.key, "niva-bupa");
  assert.equal(matchClaimForm("Self pay"), null);
  assert.equal(matchClaimForm("Acme Corporate Scheme"), null);
  assert.equal(matchClaimForm("Starlight Foundation"), null, "a word that only begins with an alias is not that insurer");
  assert.equal(claimFormFor("Acme Corporate Scheme")?.key, "generic", "an unknown payer gets the standard form");
  assert.equal(claimFormFor("Self pay"), null);
  assert.equal(new Set(CLAIM_FORMS.map((f) => f.key)).size, CLAIM_FORMS.length);
});

test("only admitted patients paid by an insurer or TPA are listed", async () => {
  const self = await admit("", "Claim Selfpay Sam");
  const star = await admit("Star Health Insurance", "Claim Star Sunil");
  const other = await admit("Acme Corporate Scheme", "Claim Other Omkar");
  const list = (await as(ADMIN, "GET", "/api/claim-forms")).data as any[];
  assert.ok(!list.some((c) => c.admissionId === self.admissionId), "a self-pay patient is not listed");
  const s = list.find((c) => c.admissionId === star.admissionId);
  assert.ok(s, "the insured patient is listed");
  assert.equal(s.formKey, "star-health");
  assert.equal(s.formName, "Star Health and Allied Insurance");
  const o = list.find((c) => c.admissionId === other.admissionId);
  assert.ok(o, "a payer with no matching form is still listed");
  assert.equal(o.formKey, "generic");
  const found = (await as(ADMIN, "GET", "/api/claim-forms?search=sunil")).data as any[];
  assert.deepEqual(found.map((c) => c.admissionId), [star.admissionId]);
});

test("a discharged patient is left out, and shows again within 60 days when asked", async () => {
  const a = await admit("HDFC ERGO", "Claim Discharged Dev");
  const before = (await as(ADMIN, "GET", "/api/claim-forms")).data as any[];
  assert.ok(before.some((c) => c.admissionId === a.admissionId));
  const gone = await as(ADMIN, "PATCH", `/api/ipd/${a.admissionId}`, { status: "Discharged" });
  assert.ok([200, 201].includes(gone.status), JSON.stringify(gone.error));
  const after = (await as(ADMIN, "GET", "/api/claim-forms")).data as any[];
  assert.ok(!after.some((c) => c.admissionId === a.admissionId), "discharged patients are not listed by default");
  const withOld = (await as(ADMIN, "GET", "/api/claim-forms?discharged=1")).data as any[];
  const row = withOld.find((c) => c.admissionId === a.admissionId);
  assert.ok(row, "listed when discharged patients are asked for");
  assert.equal(row.status, "Discharged");
});

test("the draft holds the patient, the stay and the hospital's details under the standard keys", async () => {
  const a = await admit("Star Health Insurance", "Claim Draft Dhruv");
  const d = (await as(ADMIN, "GET", `/api/claim-forms/${a.admissionId}`)).data;
  assert.equal(d.candidate.formKey, "star-health");
  const v = d.values;
  assert.equal(v.patientName, "Claim Draft Dhruv");
  assert.equal(v.dob, "14/03/1985", "dates are written day / month / year");
  assert.equal(v.gender, "Male");
  assert.ok(v.address.includes("12 Green Park"), "the patient's address");
  assert.ok(v.hospitalName, "the hospital's name");
  assert.ok(v.hospitalAddress, "the hospital's address");
  assert.ok(/^\d{2}\/\d{2}\/\d{4}$/.test(v.admissionDate), `admission date ${v.admissionDate}`);
  assert.equal(v.diagnosis, "Acute appendicitis");
  assert.equal(v.insurerName, "Star Health and Allied Insurance");
  assert.ok(!("hospitalReg" in v) || v.hospitalReg, "a detail with no value is left out, not sent blank");
});

test("a role that does not work on insurance cannot open claim forms", async () => {
  const r = await as(NURSE, "GET", "/api/claim-forms");
  assert.equal(r.status, 403);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
