/**
 * Tests for wards tied to the Setup masters: a ward's class and facility area, the bed rate taken from the catalogue's bed charge
 * for the class, delete protection on the masters, and the rate plan chosen for a patient admitted to a ward.
 * In-process, in-memory.
 *
 *   npm run test:wardmasters
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { pickPlan } = await import("@/services/billing-catalog-service");
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
const master = async (kind: string) => (await as(ADMIN, "GET", `/api/setup/${kind}`)).data as any[];
const wardClass = async (code: string) => (await master("ward_class")).find((c) => c.code === code);
const area = async (code: string) => (await master("facility_area")).find((c) => c.code === code);
const wards = async () => (await as(ADMIN, "GET", "/api/wards")).data as any[];

test("a ward is filed under a ward class and a facility area, and says so", async () => {
  const [gen, ipdb] = [await wardClass("GEN"), await area("IPDB")];
  const r = await as(ADMIN, "POST", "/api/wards", { name: "Male Medical", capacity: 10, wardClassId: gen.id, facilityAreaId: ipdb.id });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.wardClass, r.data.facilityArea], ["General Ward", "IPD Block"]);
  const list = (await wards()).find((w) => w.name === "Male Medical");
  assert.deepEqual([list.wardClassId, list.facilityAreaId], [gen.id, ipdb.id]);
});

test("only this hospital's active entries of the right kind are accepted", async () => {
  const gen = await wardClass("GEN"), lab = await area("LABA"), rec = await area("REC");
  const bad = async (body: Record<string, unknown>, field: string) => {
    const r = await as(ADMIN, "POST", "/api/wards", { name: `Bad ${Math.random()}`, ...body });
    assert.equal(r.status, 422, JSON.stringify(body));
    assert.match(JSON.stringify(r.error), new RegExp(field));
  };
  await bad({ wardClassId: 999999 }, "wardClassId");
  await bad({ wardClassId: lab.id }, "wardClassId");               // a facility area's id is not a ward class
  await bad({ facilityAreaId: lab.id }, "facilityAreaId");          // a laboratory isn't somewhere a ward sits
  await bad({ facilityAreaId: rec.id }, "facilityAreaId");
  await as(ADMIN, "PATCH", `/api/setup/ward_class/${gen.id}`, { active: false });
  await bad({ wardClassId: gen.id }, "wardClassId");
  await as(ADMIN, "PATCH", `/api/setup/ward_class/${gen.id}`, { active: true });
});

test("the bed rate comes from the catalogue's bed charge for the ward's class unless the ward has its own rate", async () => {
  const w = (await wards()).find((x) => x.name === "Male Medical");
  assert.deepEqual([w.dailyRate, w.rateSource, w.ownRate], [1100, "catalogue", 0]);
  assert.match(w.rateService, /General Ward Bed/);
  const own = await as(ADMIN, "PATCH", `/api/wards/${w.id}`, { dailyRate: 1500 });
  assert.deepEqual([own.data.dailyRate, own.data.rateSource, own.data.ownRate], [1500, "ward", 1500]);
  const back = await as(ADMIN, "PATCH", `/api/wards/${w.id}`, { dailyRate: 0 });
  assert.deepEqual([back.data.dailyRate, back.data.rateSource], [1100, "catalogue"]);
  // Re-pricing the bed charge in the default rate plan reprices the ward.
  const plan = (await master("rate_plan")).find((p) => p.data.isDefault);
  const svc = (await master("service")).find((s) => s.code === "IPD-GEN");
  assert.equal(svc.data.wardClassId, (await wardClass("GEN")).id, "the bed-charge service is linked to its class");
  const set = await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: 1250 }] });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal((await wards()).find((x) => x.id === w.id).dailyRate, 1250);
});

test("beds in a ward carry the ward's rate", async () => {
  const w = (await wards()).find((x) => x.name === "Male Medical");
  const b = await as(ADMIN, "POST", "/api/beds", { bedNumber: "MM-1", ward: "Male Medical", wardId: w.id });
  assert.equal(b.status, 201, JSON.stringify(b.error));
  const found = (await as(ADMIN, "GET", "/api/beds?all=true")).data.find((x: any) => x.id === b.data.id);
  assert.equal(found.dailyRate, 1250);
  const board = (await as(ADMIN, "GET", "/api/beds/by-ward")).data;
  if (Array.isArray(board)) assert.equal(board.find((g: any) => g.ward === "Male Medical")?.beds[0].dailyRate, 1250);
});

test("a class or area that a ward uses can't be deleted; once the ward lets go, it can", async () => {
  const gen = await wardClass("GEN");
  const r = await as(ADMIN, "DELETE", `/api/setup/ward_class/${gen.id}`);
  assert.equal(r.status, 409);
  const ipdb = await area("IPDB");
  const w = (await wards()).find((x) => x.name === "Male Medical");
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/facility_area/${ipdb.id}`)).status, 409);
  assert.match(String((await as(ADMIN, "DELETE", `/api/setup/facility_area/${ipdb.id}`)).error?.message), /1 ward/);
  assert.equal((await as(ADMIN, "PATCH", `/api/wards/${w.id}`, { facilityAreaId: null })).data.facilityAreaId, null);
  assert.ok([200, 204].includes((await as(ADMIN, "DELETE", `/api/setup/facility_area/${ipdb.id}`)).status));
  assert.equal((await as(ADMIN, "GET", `/api/setup/facility_area/${ipdb.id}`)).status, 404);
});

test("a patient on a ward is priced from a rate plan made for that ward's class when the hospital has one", async () => {
  const plans = await master("rate_plan");
  const classes = await master("ward_class");
  const icu = classes.find((c) => c.code === "ICU"), gen = classes.find((c) => c.code === "GEN");
  const tpa = (await master("patient_category")).find((c) => c.code === "TPA");
  // Pure choice: a category match is kept, and among those the plan for the patient's ward class wins.
  const mk = (id: number, cat: number | null, cls: number | null, isDefault = false) => ({ id, active: true, name: `p${id}`, code: "", kind: "rate_plan", sortOrder: id, createdAt: "", updatedAt: "", data: { patientCategoryId: cat, wardClassId: cls, isDefault } }) as any;
  const list = [mk(1, null, gen.id, true), mk(2, tpa.id, gen.id), mk(3, tpa.id, icu.id)];
  assert.equal(pickPlan(list, tpa.id, "2026-10-29", icu.id)?.id, 3);
  assert.equal(pickPlan(list, tpa.id, "2026-10-29", gen.id)?.id, 2);
  assert.equal(pickPlan(list, tpa.id, "2026-10-29", null)?.id, 2, "not admitted: the first plan for the category");
  assert.equal(pickPlan(list, null, "2026-10-29", icu.id)?.id, 1, "no category: the default plan");
  assert.equal(pickPlan(list, tpa.id, "2026-10-29", 12345)?.id, 2, "no plan for that class: the category plan still applies");

  // And through the real flow: admit a TPA patient to an ICU ward and the counter prices from the ICU plan.
  const base = plans.find((p) => p.data.isDefault);
  const icuPlan = await as(ADMIN, "POST", "/api/setup/rate_plan", { name: "TPA ICU Tariff", patientCategoryId: tpa.id, wardClassId: icu.id, basePlanId: base.id, effectiveFrom: "2026-04-01" });
  assert.equal(icuPlan.status, 201, JSON.stringify(icuPlan.error));
  const ward = await as(ADMIN, "POST", "/api/wards", { name: "ICU One", capacity: 2, wardClassId: icu.id });
  const bed = await as(ADMIN, "POST", "/api/beds", { bedNumber: "ICU-1", ward: "ICU One", wardId: ward.data.id });
  const p = (await as(ADMIN, "POST", "/api/patients", { name: "Ward Plan Patient", age: 50, gender: "Male", phone: "9711111111", patientCategory: "TPA Cashless" })).data;
  const before = (await as(BILLING, "GET", `/api/billing/catalog?patientId=${p.id}`)).data;
  assert.notEqual(before.planName, "TPA ICU Tariff", "not admitted yet");
  const admit = await as(ADMIN, "POST", "/api/ipd", { patientId: p.id, patientName: p.name, bedId: bed.data.id });
  assert.equal(admit.status, 201, JSON.stringify(admit.error));
  const after = (await as(BILLING, "GET", `/api/billing/catalog?patientId=${p.id}`)).data;
  assert.equal(after.planName, "TPA ICU Tariff");
});

test("permissions: any signed-in user can read the masters a ward form needs, only ward managers can change a ward", async () => {
  assert.equal((await as(BILLING, "GET", "/api/setup/ward_class")).status, 200);
  assert.equal((await as(BILLING, "GET", "/api/setup/facility_area")).status, 200);
  assert.equal((await as(BILLING, "POST", "/api/wards", { name: "Nope" })).status, 403);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
