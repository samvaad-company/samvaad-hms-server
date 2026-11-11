/**
 * Tests for OPD vitals: a patient's vitals can be taken any number of times in a day. Every reading is kept with its time, the visit
 * shows the latest, and a patient's history gathers them across visits.
 *
 *   npm run test:opdvitals
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

const NURSE = "rekha.menon@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

let visitId = 0;
let patientId = 0;

test("a visit starts with the vitals taken at check-in, logged as the first reading", async () => {
  const p = await as(NURSE, "GET", "/api/patients?pageSize=1");
  patientId = (p.data?.items ?? p.data)[0].id;
  const r = await as(NURSE, "POST", "/api/opd", { patientId, patientName: "Vitals Tester", bpSystolic: 120, bpDiastolic: 80, pulse: 72 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  visitId = r.data.id;
  const list = await as(NURSE, "GET", `/api/opd/${visitId}/vitals`);
  assert.equal(list.status, 200);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].pulse, 72);
});

test("vitals can be added again and again on the same day; earlier readings are kept, the visit shows the latest", async () => {
  for (const [sys, dia, pulse] of [[128, 84, 80], [140, 90, 92], [118, 76, 70]]) {
    const r = await as(NURSE, "POST", `/api/opd/${visitId}/vitals`, { bpSystolic: sys, bpDiastolic: dia, pulse, spo2: 98, note: `reading ${pulse}` });
    assert.equal(r.status, 201, JSON.stringify(r.error));
  }
  const list = await as(NURSE, "GET", `/api/opd/${visitId}/vitals`);
  assert.equal(list.data.length, 4, "check-in reading plus three more");
  assert.equal(list.data[0].pulse, 70, "newest first");
  assert.ok(list.data.every((v: any) => v.recordedAt && v.recordedBy));
  const visit = await as(NURSE, "GET", `/api/opd/${visitId}`);
  assert.equal(visit.data.vitals.pulse, 70, "the queue shows the latest reading");
  assert.equal(visit.data.vitalsRecorded, true);
});

test("editing the visit with new readings logs them too, but re-saving the same ones does not add a duplicate", async () => {
  const before = (await as(NURSE, "GET", `/api/opd/${visitId}/vitals`)).data.length;
  await as(NURSE, "PATCH", `/api/opd/${visitId}`, { pulse: 70 });
  assert.equal((await as(NURSE, "GET", `/api/opd/${visitId}/vitals`)).data.length, before, "unchanged reading is not logged again");
  await as(NURSE, "PATCH", `/api/opd/${visitId}`, { pulse: 66 });
  assert.equal((await as(NURSE, "GET", `/api/opd/${visitId}/vitals`)).data.length, before + 1);
});

test("a patient's history gathers their vitals across visits", async () => {
  const second = await as(NURSE, "POST", "/api/opd", { patientId, patientName: "Vitals Tester" });
  await as(NURSE, "POST", `/api/opd/${second.data.id}/vitals`, { temperature: 99.1 });
  const history = await as(NURSE, "GET", `/api/patients/${patientId}/vitals`);
  assert.equal(history.status, 200);
  assert.ok(history.data.length >= 6);
  assert.ok(history.data.some((v: any) => v.visitId === second.data.id && v.temperature === 99.1));
});

test("several sets can be added in one go, each with its own time; all are saved or none, and the visit shows the newest", async () => {
  const visit = (await as(NURSE, "POST", "/api/opd", { patientId, patientName: "Vitals Tester" })).data;
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const r = await as(NURSE, "POST", `/api/opd/${visit.id}/vitals`, { readings: [
    { pulse: 90, recordedAt: hoursAgo(1) },
    { pulse: 70, recordedAt: hoursAgo(5), note: "early" },
    { pulse: 80, bpSystolic: 130, bpDiastolic: 85, recordedAt: hoursAgo(3) },
  ] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.length, 3);
  const list = (await as(NURSE, "GET", `/api/opd/${visit.id}/vitals`)).data;
  assert.deepEqual(list.map((v: any) => v.pulse), [90, 80, 70], "newest first, by the time taken");
  assert.equal((await as(NURSE, "GET", `/api/opd/${visit.id}`)).data.vitals.pulse, 90, "the visit shows the newest set");
  // one bad set refuses the whole batch
  const before = (await as(NURSE, "GET", `/api/opd/${visit.id}/vitals`)).data.length;
  const bad = await as(NURSE, "POST", `/api/opd/${visit.id}/vitals`, { readings: [{ pulse: 75 }, { bpSystolic: 80, bpDiastolic: 90 }] });
  assert.equal(bad.status, 400);
  assert.equal((await as(NURSE, "GET", `/api/opd/${visit.id}/vitals`)).data.length, before, "nothing from a refused batch is saved");
  // a reading can't be in the future or more than two weeks back
  const future = await as(NURSE, "POST", `/api/opd/${visit.id}/vitals`, { pulse: 70, recordedAt: new Date(Date.now() + 3_600_000).toISOString() });
  assert.equal(future.status, 400);
  const old = await as(NURSE, "POST", `/api/opd/${visit.id}/vitals`, { pulse: 70, recordedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() });
  assert.equal(old.status, 400);
});

test("bad readings are refused: nothing entered, half a blood pressure, diastolic above systolic", async () => {
  for (const body of [{}, { bpSystolic: 120 }, { bpSystolic: 80, bpDiastolic: 90 }]) {
    assert.equal((await as(NURSE, "POST", `/api/opd/${visitId}/vitals`, body)).status, 400, JSON.stringify(body));
  }
});

test("only people who work the OPD queue can record vitals", async () => {
  assert.equal((await as(PHARMACIST, "POST", `/api/opd/${visitId}/vitals`, { pulse: 70 })).status, 403);
  assert.equal((await as(PHARMACIST, "GET", `/api/opd/${visitId}/vitals`)).status, 403);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
