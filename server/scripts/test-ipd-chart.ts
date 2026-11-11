/**
 * Tests for the inpatient chart: the day's treatment sheet (carried forward, edited, signed by a doctor), fluid balance, the details of
 * the stay, the overview (to-do and discharge readiness) and the timeline of the whole stay.
 *
 *   npm run test:ipdchart
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { message: string } } | null;
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
const DOCTOR = "sophia.adams@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
let adm = 0;

test("the treatment sheet starts with the usual call-the-doctor limits, and a day's plan carries forward until it is changed", async () => {
  // a patient who is not already in hospital
  const patients = (await as(ADMIN, "GET", "/api/patients?pageSize=200")).data;
  const inHospital = new Set(((await as(ADMIN, "GET", "/api/ipd?pageSize=500")).data?.items ?? (await as(ADMIN, "GET", "/api/ipd")).data ?? []).filter((r: any) => r.status !== "Discharged").map((r: any) => r.patientRefId));
  const free = (patients.items ?? patients).find((p: any) => !inHospital.has(p.id));
  assert.ok(free, "a patient who is not admitted");
  const made = await as(ADMIN, "POST", "/api/ipd", { patientId: free.id, patientName: free.name, diagnosis: "Pneumonia" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  adm = made.data.id;
  const empty = (await as(DOCTOR, "GET", `/api/ipd/${adm}/sheet`)).data;
  assert.equal(empty.plan, "");
  assert.equal(empty.callDoctor.limits.spo2Below, 90);
  assert.ok(empty.callDoctor.other.length >= 3);
  // a plan written for an earlier day shows on today's sheet until today's is written
  const old = await as(DOCTOR, "PUT", `/api/ipd/${adm}/sheet`, { date: daysAgo(3), plan: "Antibiotics, review in 48h", investigations: ["CBC"], instructions: [{ text: "Strict I/O charting", kind: "Nursing" }] });
  assert.equal(old.status, 200, JSON.stringify(old.error));
  const carried = (await as(DOCTOR, "GET", `/api/ipd/${adm}/sheet`)).data;
  assert.equal(carried.plan, "Antibiotics, review in 48h");
  assert.equal(carried.carriedFrom, daysAgo(3));
  assert.equal(carried.saved, false);
  assert.deepEqual(carried.investigations, ["CBC"]);
  assert.equal(carried.instructions[0].text, "Strict I/O charting");
  const written = (await as(DOCTOR, "PUT", `/api/ipd/${adm}/sheet`, { plan: "Step down to oral antibiotics" })).data;
  assert.equal(written.plan, "Step down to oral antibiotics");
  assert.equal(written.carriedFrom, null);
  assert.deepEqual(written.investigations, ["CBC"], "what was not sent stays");
});

test("an instruction can be marked seen by a nurse; limits can be changed; blank instructions are refused", async () => {
  const sheet = (await as(DOCTOR, "GET", `/api/ipd/${adm}/sheet`)).data;
  const marked = sheet.instructions.map((i: any) => ({ ...i, seenAt: new Date().toISOString() }));
  const r = await as(NURSE, "PUT", `/api/ipd/${adm}/sheet`, { instructions: marked });
  assert.equal(r.status, 200);
  assert.equal(r.data.instructions[0].seenBy, "Rekha Menon");
  const lim = (await as(DOCTOR, "PUT", `/api/ipd/${adm}/sheet`, { callDoctor: { limits: { spo2Below: 92, pulseAbove: null } } })).data;
  assert.equal(lim.callDoctor.limits.spo2Below, 92);
  assert.equal(lim.callDoctor.limits.pulseAbove, null);
  assert.equal(lim.callDoctor.limits.sbpBelow, 90, "untouched limits stay");
  assert.equal((await as(DOCTOR, "PUT", `/api/ipd/${adm}/sheet`, { instructions: [{ text: "  " }] })).status, 400);
});

test("only a doctor signs the day's sheet, and changing it afterwards takes the signature off", async () => {
  assert.equal((await as(NURSE, "POST", `/api/ipd/${adm}/sheet/sign`, {})).status, 403);
  const signed = await as(DOCTOR, "POST", `/api/ipd/${adm}/sheet/sign`, {});
  assert.equal(signed.status, 200);
  assert.ok(signed.data.signedBy);
  const edited = (await as(DOCTOR, "PUT", `/api/ipd/${adm}/sheet`, { plan: "Continue, review tomorrow" })).data;
  assert.equal(edited.signedBy, null);
});

test("fluid balance: intake and output are charted any number of times, with the last 24 hours' totals", async () => {
  for (const b of [{ kind: "In", category: "Oral fluids", amountMl: 250 }, { kind: "In", category: "IV fluids", amountMl: 500 }, { kind: "Out", category: "Urine", amountMl: 300 }]) {
    assert.equal((await as(NURSE, "POST", `/api/ipd/${adm}/io`, b)).status, 201);
  }
  const earlier = await as(NURSE, "POST", `/api/ipd/${adm}/io`, { kind: "Out", category: "Urine", amountMl: 200, recordedAt: new Date(Date.now() - 3 * 3_600_000).toISOString() });
  assert.equal(earlier.status, 201);
  const io = (await as(NURSE, "GET", `/api/ipd/${adm}/io`)).data;
  assert.equal(io.entries.length, 4);
  assert.equal(io.intakeMl, 750);
  assert.equal(io.outputMl, 500);
  assert.equal(io.balanceMl, 250);
  assert.ok([400, 422].includes((await as(NURSE, "POST", `/api/ipd/${adm}/io`, { kind: "In", category: "Oral fluids", amountMl: 0 })).status));
  assert.equal((await as(NURSE, "POST", `/api/ipd/${adm}/io`, { kind: "In", category: "Oral fluids", amountMl: 100, recordedAt: new Date(Date.now() + 3_600_000).toISOString() })).status, 400);
  assert.equal((await as(NURSE, "DELETE", `/api/ipd/${adm}/io/${io.entries[0].id}`)).status, 200);
  assert.equal((await as(NURSE, "GET", `/api/ipd/${adm}/io`)).data.entries.length, 3);
  assert.equal((await as(PHARMACIST, "GET", `/api/ipd/${adm}/io`)).status, 403);
});

test("the overview lists what is still to do, and the list shrinks as things are done", async () => {
  const before = (await as(DOCTOR, "GET", `/api/ipd/${adm}/overview`)).data;
  const keys = before.todo.map((t: any) => t.key);
  for (const k of ["allergy", "vitals", "note", "round", "consent", "deposit"]) assert.ok(keys.includes(k), `to do: ${k}`);
  assert.equal(before.payer, "Self pay");
  await as(NURSE, "POST", "/api/ipd/nurse/vitals", { admissionId: adm, pulse: 80, tempC: 37 });
  await as(DOCTOR, "POST", "/api/ipd/notes", { admissionId: adm, noteType: "Doctor Round", content: "Stable" });
  const stay = await as(NURSE, "PATCH", `/api/ipd/${adm}/stay`, { allergyStatus: "Has allergies", allergies: "Penicillin", payer: "Star Health" });
  assert.equal(stay.status, 200, JSON.stringify(stay.error));
  assert.equal(stay.data.allergies, "Penicillin");
  const after = (await as(DOCTOR, "GET", `/api/ipd/${adm}/overview`)).data;
  const left = after.todo.map((t: any) => t.key);
  for (const k of ["allergy", "vitals", "round"]) assert.ok(!left.includes(k), `done: ${k}`);
  assert.equal(after.payer, "Star Health");
  assert.equal(after.stats.doctorVisitsToday, 1);
  assert.equal(after.lastVitals.pulse, 80);
});

test("stay details: no known allergies clears the list; the planned discharge date can't be in the past", async () => {
  const none = (await as(NURSE, "PATCH", `/api/ipd/${adm}/stay`, { allergyStatus: "No known allergies" })).data;
  assert.equal(none.allergyStatus, "No known allergies");
  assert.equal(none.allergies, "");
  assert.equal((await as(DOCTOR, "PATCH", `/api/ipd/${adm}/stay`, { plannedDischargeDate: daysAgo(1) })).status, 400);
  const planned = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  assert.equal((await as(DOCTOR, "PATCH", `/api/ipd/${adm}/stay`, { plannedDischargeDate: planned })).data.plannedDischargeDate, planned);
  assert.equal((await as(DOCTOR, "PATCH", `/api/ipd/${adm}/stay`, { plannedDischargeDate: null })).data.plannedDischargeDate, null);
  assert.equal((await as(DOCTOR, "PATCH", `/api/ipd/${adm}/stay`, {})).status, 400);
});

test("the timeline brings every department's steps for the stay together, newest first, with the gaps between them", async () => {
  await as(NURSE, "POST", "/api/ipd/nurse/iv", { admissionId: adm, fluid: "Normal saline", volumeMl: 500, rateMlHr: 100 });
  const t = (await as(DOCTOR, "GET", `/api/ipd/${adm}/timeline`)).data;
  assert.ok(t.timeInHospitalMin >= 0);
  const kinds = new Set(t.events.map((e: any) => e.kind));
  for (const k of ["Admission", "Vitals", "Note", "IV", "Fluids"]) assert.ok(kinds.has(k), `has ${k}`);
  for (let i = 1; i < t.events.length; i++) assert.ok(t.events[i - 1].at >= t.events[i].at, "newest first");
  assert.ok(t.events.some((e: any) => e.sincePrevMin != null));
});

test("another hospital can't read the chart, and the pharmacy has no access", async () => {
  assert.equal((await as("admin@sunrisehospital.in", "GET", `/api/ipd/${adm}/overview`)).status, 404);
  assert.equal((await as(PHARMACIST, "GET", `/api/ipd/${adm}/sheet`)).status, 403);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
