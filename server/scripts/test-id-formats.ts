/**
 * Tests for numbering by the hospital's ID formats (Setup → ID formats): the mask, prefix, reset cycle, check digit and gender
 * token shape each new number; an unedited format numbers exactly as the HMS always has; a format switched off falls back.
 * In-process, in-memory.
 *
 *   npm run test:idformats
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { setupRecordsRepo } = await import("@/repositories");
const { seriesPattern, LIVE_ID_FORMATS } = await import("@/services/id-service");
const { ID_FORMAT_DEFAULTS } = await import("@/services/setup-defaults");
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
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
let seq = 0;
const formats = async () => (await as(ADMIN, "GET", "/api/setup/id_format")).data as any[];
const format = async (code: string) => (await formats()).find((f) => f.code === code);
const setFormat = (id: number, patch: Record<string, unknown>) => as(ADMIN, "PATCH", `/api/setup/id_format/${id}`, patch);
const newPatient = async (over: Record<string, unknown> = {}) => {
  const r = await as(ADMIN, "POST", "/api/patients", { name: `Numbered Patient ${++seq}`, age: 30, gender: "Male", phone: `97${String(20000000 + seq).slice(-8)}`, ...over });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data.patientId as string;
};
const newBill = async () => {
  const r = await as(BILLING, "POST", "/api/billing", { patientName: "Walk-in", type: "OPD", amount: 100 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data.billNumber as string;
};

// A format row written the way the older seed did, before any setup screen has been opened: the first read brings it up to date.
const OLD_UHID = "{FY}-{SEQ:6}";
await setupRecordsRepo.create({
  hospital_id: 1, kind: "id_format", code: "uhid", name: "UHID", active: true, sort_order: 1,
  data: { mask: OLD_UHID, prefix: "", reset: "Every FY", scope: "Org-wide", luhn: false, gender: false, custom: false, defaultMask: OLD_UHID },
} as never);
const edited = await setupRecordsRepo.create({
  hospital_id: 1, kind: "id_format", code: "admission", name: "Admission no.", active: true, sort_order: 2,
  data: { mask: "A{SEQ:3}", prefix: "", reset: "Never", scope: "Org-wide", luhn: false, gender: false, custom: true, defaultMask: "ADM-{FY}-{SEQ:5}" },
} as never);

test("formats seeded before numbering followed them move to the starting mask; ones a hospital edited are left alone", async () => {
  const all = await formats();
  const uhid = all.find((f) => f.code === "uhid");
  assert.deepEqual([uhid.data.mask, uhid.data.defaultMask, uhid.data.custom], ["HMS-{SEQ:4}", "HMS-{SEQ:4}", false]);
  assert.equal(all.find((f) => f.id === (edited as any).id).data.mask, "A{SEQ:3}");
  // Clear the two hand-made rows so the hospital's own defaults seed in for the tests that follow.
  const { rows } = await setupRecordsRepo.listRows({ unpaged: true } as never);
  for (const r of rows) await setupRecordsRepo.remove(r.id);
});

test("every number the HMS issues has a format, and an unedited format numbers as the HMS always has", async () => {
  const all = await formats();
  for (const key of LIVE_ID_FORMATS) assert.ok(all.some((f) => f.code === key), `format for ${key}`);
  assert.equal(ID_FORMAT_DEFAULTS.filter((d) => LIVE_ID_FORMATS.includes(d.code as never)).length, LIVE_ID_FORMATS.length);
  const a = await newPatient(); const b = await newPatient();
  assert.match(a, /^HMS-\d{4}$/);
  assert.equal(Number(b.slice(4)), Number(a.slice(4)) + 1);
  const x = await newBill(); const y = await newBill();
  assert.match(x, /^INV-\d{8}$/);
  assert.equal(Number(y.slice(4)), Number(x.slice(4)) + 1);
});

test("editing a mask starts a new series with that shape: prefix, year, width, counting from 1 and then on", async () => {
  const f = await format("uhid");
  assert.equal((await setFormat(f.id, { mask: "{PREFIX}{YY}-{SEQ:5}", prefix: "P", reset: "Every year" })).status, 200);
  const yy = String(new Date().getFullYear()).slice(2);
  assert.equal(await newPatient(), `P${yy}-00001`);
  assert.equal(await newPatient(), `P${yy}-00002`);
  assert.equal((await setFormat(f.id, { mask: "HMS-{SEQ:4}", prefix: "", reset: "Never" })).status, 200);
  const back = await newPatient();
  assert.match(back, /^HMS-\d{4}$/);
  assert.ok(Number(back.slice(4)) >= 3, "the old series carries on where it stopped");
});

test("a check digit is appended and doesn't disturb the count; {GENDER} follows the patient", async () => {
  const f = await format("uhid");
  assert.equal((await setFormat(f.id, { mask: "{GENDER}{SEQ:4}", luhn: true, reset: "Never" })).status, 200);
  const a = await newPatient({ gender: "Female" });
  const b = await newPatient({ gender: "Male" });
  const c = await newPatient({ gender: "Other" });
  assert.match(a, /^F0001\d$/); assert.match(b, /^M0002\d$/); assert.match(c, /^O0003\d$/);
  await setFormat(f.id, { mask: "HMS-{SEQ:4}", luhn: false, reset: "Never" });
});

test("the invoice format: hospital invoice prefix fills {PREFIX}, and the format's own prefix is used otherwise", async () => {
  const f = await format("invoice");
  assert.equal((await setFormat(f.id, { mask: "{PREFIX}/{FYP2}/{SEQ:5}", prefix: "OPD", reset: "Every FY" })).status, 200);
  const first = await newBill();
  assert.match(first, /^OPD\/\d{2}-\d{2}\/00001$/);
  assert.equal(Number((await newBill()).slice(-5)), 2);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/hospital", { invoicePrefix: "SH" })).status, 200);
  assert.match(await newBill(), /^SH\/\d{2}-\d{2}\/00001$/);
  await as(ADMIN, "PUT", "/api/setup/config/hospital", { invoicePrefix: "" });
  await setFormat(f.id, { mask: "{PREFIX}-{SEQ:8}", prefix: "INV", reset: "Never" });
  const back = await newBill();
  assert.match(back, /^INV-\d{8}$/);
});

test("a format switched off falls back to the old numbering instead of stopping", async () => {
  const f = await format("uhid");
  await as(ADMIN, "PATCH", `/api/setup/id_format/${f.id}`, { active: false, mask: "ZZ{SEQ:2}" });
  assert.match(await newPatient(), /^HMS-\d{4}$/);
  await as(ADMIN, "PATCH", `/api/setup/id_format/${f.id}`, { active: true, mask: "HMS-{SEQ:4}" });
});

test("reset cycle: which tokens must match today decides when the counter restarts", async () => {
  const mk = (mask: string, reset: string, now: Date) => seriesPattern(mask, { prefix: "", reset, fyStartMonth: 4, luhn: false, now });
  const mar2027 = new Date(2027, 2, 15), apr2027 = new Date(2027, 3, 2), jan2027 = new Date(2027, 0, 10);
  // Financial year: March 2027 is still FY 2026-27; April 2027 starts 2027-28.
  assert.ok(mk("X/{FYP2}/{SEQ:3}", "Every FY", mar2027).test("X/26-27/012"));
  assert.ok(!mk("X/{FYP2}/{SEQ:3}", "Every FY", apr2027).test("X/26-27/012"));
  // A calendar-year token in an FY series doesn't restart it: Jan–Mar of the FY have a different year but the same FY.
  assert.ok(mk("{FY}/{YYYY}-{SEQ:3}", "Every FY", jan2027).test("2026/2026-009"));
  assert.equal(mk("{FY}/{YYYY}-{SEQ:3}", "Every FY", jan2027).exec("2026/2026-009")?.[1], "009");
  // Calendar year and month.
  assert.ok(!mk("{YYYY}-{SEQ:4}", "Every year", jan2027).test("2026-0001"));
  assert.ok(mk("{YYYY}-{MM}-{SEQ:3}", "Every year", jan2027).test("2027-05-004"), "month changes don't restart a yearly series");
  assert.ok(!mk("{YYYY}-{MM}-{SEQ:3}", "Every month", jan2027).test("2027-05-004"));
  assert.ok(mk("{YYYY}-{MM}-{SEQ:3}", "Every month", jan2027).test("2027-01-004"));
  // Never: the year in the number moves on but the count doesn't restart.
  assert.equal(mk("{YYYY}-{SEQ:4}", "Never", jan2027).exec("2019-0412")?.[1], "0412");
  // Other series' numbers never match.
  assert.ok(!mk("ADM/{YYYY}/{SEQ:5}", "Every year", jan2027).test("OT/2027/00001"));
});

test("ID formats still need an admin; numbering needs no extra permission from the person raising the document", async () => {
  const f = await format("uhid");
  assert.equal((await as(BILLING, "PATCH", `/api/setup/id_format/${f.id}`, { mask: "X{SEQ:3}" })).status, 403);
  assert.equal((await as(BILLING, "POST", "/api/billing", { patientName: "Walk-in", type: "OPD", amount: 50 })).status, 201);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
