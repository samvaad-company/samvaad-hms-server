/**
 * Tests for shared sequences (patient codes, invoice numbers, tokens) and the sign-in lock-out, on the in-memory driver.
 * The MongoDB behaviour across several processes is checked by `npm run test:mongoshared`.
 *
 *   npm run test:sharedstate
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { allocateSequence } = await import("@/services/sequences");
const { getDb } = await import("@/db");
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

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("300 sequence values asked for at once are all different and consecutive", async () => {
  const got = await Promise.all(Array.from({ length: 300 }, () => allocateSequence("t|burst", async () => 0)));
  const values = got.map((g) => g.value).sort((a, b) => a - b);
  assert.deepEqual(values, Array.from({ length: 300 }, (_, i) => i + 1));
});

test("the existing records are scanned once, and the counter starts after the highest of them", async () => {
  let scans = 0;
  const scan = async () => { scans++; return 40; };
  assert.equal((await allocateSequence("t|seed", scan)).value, 41);
  assert.equal((await allocateSequence("t|seed", scan)).value, 42);
  assert.equal(scans, 1, "the table isn't read again");
});

test("a value is given back only if it is still the latest", async () => {
  const a = await allocateSequence("t|rel", async () => 0);
  const b = await allocateSequence("t|rel", async () => 0);
  await a.release();
  assert.equal((await allocateSequence("t|rel", async () => 0)).value, b.value + 1, "a was not the latest, so it stays used");
  const c = await allocateSequence("t|rel", async () => 0);
  await c.release();
  assert.equal((await allocateSequence("t|rel", async () => 0)).value, c.value, "c was the latest, so it is handed out again");
});

test("30 patients registered at once get 30 different codes", async () => {
  const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => as(ADMIN, "POST", "/api/patients", { name: `Burst Patient ${i}`, age: 30, gender: "Male", phone: `98760${String(10000 + i)}` })));
  assert.ok(rs.every((r) => r.status === 201), rs.map((r) => r.status).join(","));
  const codes = rs.map((r) => r.data.patientId);
  assert.equal(new Set(codes).size, 30);
});

test("a refused bill does not use up an invoice number", async () => {
  const a = await as(ADMIN, "POST", "/api/billing", { patientName: "Seq Patient", type: "OPD", amount: 100 });
  const bad = await as(ADMIN, "POST", "/api/billing", { patientName: "Seq Patient", type: "OPD", amount: 100, discount: 500 });
  const b = await as(ADMIN, "POST", "/api/billing", { patientName: "Seq Patient", type: "OPD", amount: 100 });
  assert.equal(a.status, 201); assert.equal(bad.status, 422); assert.equal(b.status, 201);
  const n = (x: string) => Number(x.match(/(\d+)$/)![1]);
  assert.equal(n(b.data.billNumber), n(a.data.billNumber) + 1);
});

test("rate-limit windows count, peek, and clear", async () => {
  const db = await getDb();
  assert.equal(await db.peekHits!("t:k", 60_000), 0);
  assert.equal(await db.countHit!("t:k", 60_000), 1);
  assert.equal(await db.countHit!("t:k", 60_000), 2);
  assert.equal(await db.peekHits!("t:k", 60_000), 2);
  await db.clearHits!("t:k");
  assert.equal(await db.peekHits!("t:k", 60_000), 0);
});

test("five wrong passwords lock the email out; the right password is then refused too; other emails are unaffected", async () => {
  const bad = (email: string) => request("POST", "/api/auth/login", { body: { email, password: "nope" } });
  const email = "lockme@example.test";
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await bad(email)).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 401, 429, 429]);
  const rightButLocked = await request("POST", "/api/auth/login", { body: { email: "kevin.carter@samvaadhospital.in", password: "Samvaad@123" } });
  assert.equal(rightButLocked.status, 200, "a different email signs in");
  const err = await bad(email);
  assert.match(err.error!.message, /Try again in/);
});

test("a good sign-in clears that email's count", async () => {
  const email = "kevin.carter@samvaadhospital.in";
  for (let i = 0; i < 4; i++) await request("POST", "/api/auth/login", { body: { email, password: "bad" } });
  assert.equal((await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await request("POST", "/api/auth/login", { body: { email, password: "bad" } })).status, 401);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
