/**
 * Tests for the prescription AI review's built-in layer and its route: allergy and duplicate checks,
 * the "AI not configured" result (never passed off as a clean review), the stored-result rules, permissions.
 * In-process, in-memory database, no network — GEMINI_API_KEY is forced empty.
 *
 *   npm run test:rxreview
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
  GEMINI_API_KEY: "",
});

const { createApp } = await import("@/app");
const { builtInFindings, parseList } = await import("@/services/prescription-ai-review");
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
const DOCTOR = "sophia.adams@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const rxWith = (allergies: string | null, names: string[]) =>
  ({
    id: 1, rxNumber: "RX-1", patientName: "P", patientAge: 30, doctor: "D", diagnosis: "x", medicineCount: names.length,
    date: "2026-01-01", status: "Pending", patientId: 1, doctorId: 1,
    patient: { code: "HMS-1", gender: "Female", allergies, chronicConditions: null },
    items: names.map((n, i) => ({ id: i + 1, prescriptionId: 1, medicineId: null, medicineName: n, dosage: "", frequency: "", duration: "", instructions: null, generic: null })),
  }) as any;

test("allergy lists ignore 'none' style entries and split on commas", async () => {
  assert.deepEqual(parseList("Penicillin, Sulfa drugs; Latex"), ["Penicillin", "Sulfa drugs", "Latex"]);
  for (const none of [null, "", "None", "NKDA", "not assessed", "No known allergies"]) assert.deepEqual(parseList(none), [], String(none));
});

test("a medicine matching a recorded allergy is a critical finding; a safe one is not", async () => {
  const hit = builtInFindings(rxWith("Penicillin", ["Penicillin V 250mg", "Paracetamol 500mg"]));
  assert.deepEqual(hit.map((f) => [f.category, f.severity, f.medicines.join()]), [["Allergy", "critical", "Penicillin V 250mg"]]);
  assert.deepEqual(builtInFindings(rxWith("Penicillin", ["Paracetamol 500mg"])), []);
  assert.deepEqual(builtInFindings(rxWith("NKDA", ["Penicillin V 250mg"])), []);
});

test("the same medicine twice (different strengths) is a duplicate warning; different medicines are not", async () => {
  const dup = builtInFindings(rxWith(null, ["Paracetamol 500mg", "Paracetamol 650mg"]));
  assert.deepEqual(dup.map((f) => [f.category, f.severity]), [["Duplicate", "warning"]]);
  assert.deepEqual(builtInFindings(rxWith(null, ["Paracetamol 500mg", "Cetirizine 10mg"])), []);
});

test("with no AI key the review says so and still reports the built-in findings", async () => {
  const rx = await as(DOCTOR, "POST", "/api/prescriptions", {
    patientId: 1, patientName: "Olivia Turner", doctorId: 2, diagnosis: "Throat infection", status: "Pending",
    items: [{ medicineName: "Penicillin V 250mg", dosage: "250mg", frequency: "Four times a day", duration: "5 days", instructions: "Before food" }],
  });
  assert.equal(rx.status, 201, JSON.stringify(rx.error));
  const seen = (await as(DOCTOR, "GET", `/api/prescriptions/${rx.data.id}`)).data;
  assert.match(seen.patient.allergies ?? "", /penicillin/i, "seed patient 1 is penicillin-allergic");
  const r = await as(DOCTOR, "POST", `/api/prescriptions/${rx.data.id}/ai-review`, {});
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.reason, r.data.mock, r.data.model, r.data.verdict], ["no-key", true, null, "hold"]);
  assert.ok(r.data.detail.includes("GEMINI_API_KEY"));
  assert.equal(r.data.findings[0].category, "Allergy");
  assert.equal(r.data.checked.medicines, 1);
});

test("a key-less result is not stored, so the stored-result endpoint stays empty", async () => {
  const list = (await as(DOCTOR, "GET", "/api/prescriptions?all=true")).data;
  const id = list[list.length - 1].id;
  assert.equal((await as(DOCTOR, "GET", `/api/prescriptions/${id}/ai-review`)).data, null);
});

test("the single-prescription fetch carries the patient's allergies and the generic names", async () => {
  const rx = (await as(DOCTOR, "GET", "/api/prescriptions/1")).data;
  assert.ok(rx.patient && "allergies" in rx.patient && rx.patient.code);
  assert.ok(rx.items.every((i: any) => "generic" in i));
});

test("a prescription with no medicines is reviewed as empty, an unknown one is 404, and access is permissioned", async () => {
  const empty = await as(DOCTOR, "POST", "/api/prescriptions", { patientId: 2, patientName: "Ethan Miller", doctorId: 2, diagnosis: "Check", status: "Draft", items: [] });
  const r = await as(DOCTOR, "POST", `/api/prescriptions/${empty.data.id}/ai-review`, {});
  assert.deepEqual([r.status, r.data.verdict, r.data.mock, r.data.findings.length], [200, "clear", false, 0]);
  assert.equal((await as(DOCTOR, "POST", "/api/prescriptions/99999/ai-review", {})).status, 404);
  assert.equal((await as(BILLING, "POST", "/api/prescriptions/1/ai-review", {})).status, 403);
  assert.equal((await request("POST", "/api/prescriptions/1/ai-review", { body: {} })).status, 401);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
