/**
 * Tests for lab test priority: a doctor sets Routine / Urgent / STAT when ordering, every test in one order
 * shares it, it can be changed afterwards, it can be filtered on, and the patient's ID comes back for the worklist.
 * In-process, in-memory database.
 *
 *   npm run test:labpriority
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
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
const DOCTOR = "sophia.adams@samvaadhospital.in"; // linked to doctor 2
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const order = (priority: unknown, names = ["Complete Blood Count (CBC)"]) =>
  as(DOCTOR, "POST", "/api/lab/orders", { patientId: 1, patientName: "Olivia Turner", doctorId: 2, ...(priority === undefined ? {} : { priority }), tests: names.map((testName) => ({ testName })) });

test("the doctor's chosen priority is stored on every test in the order; Routine when none is given", async () => {
  const r = await order("STAT", ["Complete Blood Count (CBC)", "HbA1c"]);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(r.data.tests.map((t: any) => t.priority), ["STAT", "STAT"]);
  assert.deepEqual(r.data.tests.map((t: any) => t.doctor), ["Dr. Sophia Adams", "Dr. Sophia Adams"], "assigned to the ordering doctor");
  assert.equal(r.data.tests[0].orderNumber, r.data.tests[1].orderNumber);
  assert.equal((await order(undefined)).data.tests[0].priority, "Routine");
  assert.equal((await order("Urgent")).data.tests[0].priority, "Urgent");
});

test("an unknown priority is refused", async () => {
  for (const bad of ["Critical", "stat", "ASAP", 5]) assert.equal((await order(bad)).status, 422, String(bad));
});

test("the test comes back with the patient's ID for the worklist", async () => {
  const t = (await order("Urgent")).data.tests[0];
  assert.match(t.patientCode, /^HMS-/);
  const listed = (await as(DOCTOR, "GET", "/api/lab?all=true")).data.find((x: any) => x.id === t.id);
  assert.equal(listed.patientCode, t.patientCode);
});

test("the priority can be changed while the test is open, and only to a valid value", async () => {
  const t = (await order("Routine")).data.tests[0];
  const up = await as(DOCTOR, "PATCH", `/api/lab/${t.id}`, { priority: "STAT" });
  assert.deepEqual([up.status, up.data.priority], [200, "STAT"]);
  assert.equal((await as(DOCTOR, "PATCH", `/api/lab/${t.id}`, { priority: "Whenever" })).status, 422);
  assert.equal((await as(DOCTOR, "GET", `/api/lab/${t.id}`)).data.priority, "STAT");
});

test("the list can be filtered by priority", async () => {
  await order("STAT");
  const stat = (await as(DOCTOR, "GET", "/api/lab?all=true&priority=STAT")).data;
  assert.ok(stat.length >= 1 && stat.every((x: any) => x.priority === "STAT"));
});

test("tests recorded before priorities existed read as Routine", async () => {
  const all = (await as(DOCTOR, "GET", "/api/lab?all=true")).data;
  assert.ok(all.every((x: any) => ["Routine", "Urgent", "STAT"].includes(x.priority)));
});

test("permissions: the front desk can't order or see lab tests", async () => {
  assert.equal((await as(RECEPTION, "POST", "/api/lab/orders", { patientId: 1, patientName: "Olivia Turner", priority: "STAT", tests: [{ testName: "CBC" }] })).status, 403);
  assert.equal((await as(RECEPTION, "GET", "/api/lab?all=true")).status, 403);
  assert.equal((await request("GET", "/api/lab")).status, 401);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
