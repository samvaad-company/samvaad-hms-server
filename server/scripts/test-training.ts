/**
 * Tests for Training & tours: the lessons each role is recommended, a person's progress (start, steps, finish, replay, start over),
 * the team view and the audit trail. In-process, in-memory.
 *
 *   npm run test:training
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
const { LESSONS, KNOWN_ROLES, recommendedFor } = await import("@shared/types/training");
const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const mine = async (who = DOCTOR) => (await as(who, "GET", "/api/training")).data;
const send = (who: string, lessonId: string, event: string, step?: number) => as(who, "POST", "/api/training/progress", { lessonId, event, step });

test("the catalogue is sound: unique ids, every lesson has a role to go to, and every role is given something", () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of LESSONS) { assert.ok(l.title && l.summary && l.minutes >= 1 && l.icon, l.id); assert.ok(l.roles === "all" || (l.roles.length > 0 && l.roles.every((r) => (KNOWN_ROLES as readonly string[]).includes(r))), `${l.id}: roles are real roles`); }
  for (const role of KNOWN_ROLES) assert.ok(recommendedFor(role).length >= 1, `${role} has lessons`);
  assert.ok(recommendedFor("Super Admin").length > recommendedFor("Driver").length);
  assert.deepEqual(recommendedFor("Driver").map((l) => l.id), ["getting-started"]);
  assert.ok(recommendedFor("Pharmacist").some((l) => l.id === "pharmacy") && !recommendedFor("Pharmacist").some((l) => l.id === "add-staff"));
  return Promise.resolve();
});

test("it needs a login; the team view needs the right to manage staff", async () => {
  assert.equal((await request("GET", "/api/training")).status, 401);
  assert.equal((await request("POST", "/api/training/progress", { body: { lessonId: "getting-started", event: "start" } })).status, 401);
  for (const who of [DOCTOR, RECEPTION, BILLING]) assert.equal((await as(who, "GET", "/api/training/team")).status, 403, who);
  assert.equal((await as(ADMIN, "GET", "/api/training/team")).status, 200);
});

test("what's recommended follows the person's role, and nothing is done to begin with", async () => {
  const doc = await mine(DOCTOR), rec = await mine(RECEPTION);
  assert.equal(doc.role, "Doctor");
  assert.deepEqual(doc.recommended, recommendedFor("Doctor").map((l) => l.id));
  assert.deepEqual(rec.recommended, recommendedFor("Receptionist").map((l) => l.id));
  assert.notDeepEqual(doc.recommended, rec.recommended);
  assert.ok(doc.recommended.includes("prescriptions") && rec.recommended.includes("walk-in"));
  assert.equal(doc.done, 0); assert.deepEqual(doc.lessons, []);
});

test("a tour starts, moves through its steps, and finishes — and the count of recommended lessons done follows", async () => {
  const s = (await send(DOCTOR, "getting-started", "start")).data;
  assert.equal(s.status, "In progress"); assert.equal(s.completions, 0);
  assert.equal((await send(DOCTOR, "getting-started", "step", 3)).data.stepsSeen, 3);
  assert.equal((await send(DOCTOR, "getting-started", "step", 2)).data.stepsSeen, 3, "it only moves forward");
  assert.equal((await mine()).done, 0);
  const done = (await send(DOCTOR, "getting-started", "complete", 6)).data;
  assert.equal(done.status, "Completed"); assert.equal(done.completions, 1); assert.ok(done.completedAt);
  assert.equal((await mine()).done, 1);
});

test("replaying a finished lesson doesn't undo it, and finishing again counts another completion", async () => {
  assert.equal((await send(DOCTOR, "getting-started", "start")).data.status, "Completed");
  assert.equal((await send(DOCTOR, "getting-started", "skip", 2)).data.status, "Completed");
  assert.equal((await send(DOCTOR, "getting-started", "complete", 6)).data.completions, 2);
  assert.equal((await mine()).done, 1, "still one lesson done, not two");
  assert.equal((await mine()).lessons.filter((l: any) => l.lessonId === "getting-started").length, 1, "one row per lesson");
});

test("a lesson that isn't recommended to the role still records, but doesn't count towards the recommended total", async () => {
  await send(DOCTOR, "billing", "start"); await send(DOCTOR, "billing", "complete", 4);
  assert.equal((await mine()).done, 1);
  assert.ok((await mine()).lessons.some((l: any) => l.lessonId === "billing" && l.status === "Completed"));
});

test("people's progress is their own", async () => {
  assert.equal((await mine(RECEPTION)).lessons.length, 0);
  await send(RECEPTION, "walk-in", "start");
  assert.equal((await mine(RECEPTION)).lessons.length, 1);
  assert.equal((await mine(DOCTOR)).lessons.some((l: any) => l.lessonId === "walk-in"), false);
});

test("an unknown lesson, a bad event or a missing field is refused", async () => {
  assert.equal((await send(DOCTOR, "no-such-lesson", "start")).status, 422);
  assert.equal((await send(DOCTOR, "getting-started", "dance")).status, 422);
  assert.equal((await as(DOCTOR, "POST", "/api/training/progress", { event: "start" })).status, 422);
  assert.equal((await send(DOCTOR, "getting-started", "step", -1)).status, 422);
});

test("the team view lists everyone against what's recommended to them, least done first", async () => {
  const t = (await as(ADMIN, "GET", "/api/training/team")).data;
  assert.ok(t.members.length >= 4);
  const doc = t.members.find((m: any) => m.role === "Doctor" && m.completed.includes("getting-started"));
  assert.ok(doc, "the doctor who finished a lesson shows it");
  assert.equal(doc.recommended, recommendedFor("Doctor").length); assert.equal(doc.done, 1);
  assert.equal(doc.pct, Math.round((1 / doc.recommended) * 100)); assert.ok(doc.lastActive);
  assert.ok(t.members.every((m: any, i: number) => i === 0 || t.members[i - 1].pct <= m.pct));
  const rec = t.members.find((m: any) => m.inProgress.includes("walk-in"));
  assert.ok(rec && rec.role === "Receptionist");
  assert.ok(t.average >= 0 && t.average <= 100);
});

test("starting and finishing a tour is on the audit trail, and start over clears just my progress", async () => {
  const rows = (await as(ADMIN, "GET", "/api/audit?q=guided%20tour")).data.rows;
  assert.ok(rows.some((r: any) => r.summary === 'Started the "getting-started" guided tour'));
  assert.ok(rows.some((r: any) => r.summary === 'Completed the "getting-started" guided tour'));
  const cleared = (await as(DOCTOR, "POST", "/api/training/reset")).data;
  assert.equal(cleared.cleared, 2);
  assert.deepEqual((await mine(DOCTOR)).lessons, []); assert.equal((await mine(DOCTOR)).done, 0);
  assert.equal((await mine(RECEPTION)).lessons.length, 1, "others keep theirs");
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
