/**
 * Tests for Dietary & kitchen: diet types, patients' diet orders (and what discharge and bed moves do to them), the kitchen sheet
 * from generate to received, the production plan and the canteen. In-process, in-memory.
 *
 *   npm run test:dietary
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
const ADMIN = "kevin.carter@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const diets = async () => (await as(ADMIN, "GET", "/api/dietary/diets")).data as any[];
const diet = async (name: string) => (await diets()).find((d) => d.name === name);
const freeBeds = async () => (await as(ADMIN, "GET", "/api/beds?all=true&status=Available")).data as any[];
let seq = 0;
const admit = async (bedId?: number) => {
  const beds = await freeBeds();
  const bed = bedId ? beds.find((b) => b.id === bedId)! : beds[0];
  const r = await as(ADMIN, "POST", "/api/ipd", { patientId: 2 + (seq++ % 5), patientName: "Ethan Miller", bedId: bed.id });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return { admission: r.data, bed };
};
const order = (admissionId: number, dietTypeId: number, extra: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/dietary/orders", { admissionId, dietTypeId, ...extra });
const board = async (wardId?: number) => (await as(ADMIN, "GET", `/api/dietary/board${wardId ? `?wardId=${wardId}` : ""}`)).data;

test("it needs a login and the IPD permission", async () => {
  for (const p of ["/api/dietary/board", "/api/dietary/diets", "/api/dietary/kitchen", "/api/dietary/canteen", "/api/dietary/orders"]) {
    assert.equal((await request("GET", p)).status, 401, p);
    assert.equal((await as(BILLING, "GET", p)).status, 403, p);
  }
  assert.equal((await as(BILLING, "POST", "/api/dietary/sheet", { wardId: 1 })).status, 403);
});

test("the standard diets are there, and a diet can be added once, edited and switched off", async () => {
  const list = await diets();
  assert.ok(list.length >= 8);
  const hp = list.find((d: any) => d.name === "High Protein Diet");
  assert.deepEqual(hp.meals, ["Breakfast", "Lunch", "Dinner"]);
  assert.equal(list.find((d: any) => d.name.startsWith("Nil by mouth")).meals.length, 0);
  const made = await as(ADMIN, "POST", "/api/dietary/diets", { name: "Gluten Free", instructions: "No wheat", meals: ["Lunch", "Dinner"] });
  assert.equal(made.status, 201); assert.deepEqual(made.data.meals, ["Lunch", "Dinner"]);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/diets", { name: "gluten free" })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/diets", { name: "Bad Meals", meals: ["Brunch"] })).status, 422);
  const edited = (await as(ADMIN, "PATCH", `/api/dietary/diets/${made.data.id}`, { instructions: "No wheat or barley", meals: ["Dinner"], active: false })).data;
  assert.equal(edited.instructions, "No wheat or barley"); assert.deepEqual(edited.meals, ["Dinner"]); assert.equal(edited.active, false);
  const a = await admit();
  assert.equal((await order(a.admission.id, made.data.id)).status, 409, "a diet that is switched off can't be ordered");
});

test("an order copies the patient, ward and bed, defaults to the diet's meals, and replaces the one before", async () => {
  const { admission, bed } = await admit();
  const normal = await diet("Normal Regular Diet"), dia = await diet("Diabetic Diet");
  const first = (await order(admission.id, normal.id)).data;
  assert.equal(first.status, "Active"); assert.equal(first.bed, bed.bedNumber ?? first.bed); assert.equal(first.patient, admission.patientName);
  assert.deepEqual(first.meals, normal.meals); assert.equal(first.instructions, normal.instructions);
  const second = (await order(admission.id, dia.id, { meals: ["Breakfast", "Snacks"], instructions: "Half portions" })).data;
  assert.deepEqual(second.meals, ["Breakfast", "Snacks"]); assert.equal(second.instructions, "Half portions");
  const active = (await as(ADMIN, "GET", `/api/dietary/orders?status=Active`)).data.filter((o: any) => o.admissionId === admission.id);
  assert.equal(active.length, 1); assert.equal(active[0].id, second.id);
  assert.equal((await as(ADMIN, "GET", `/api/dietary/orders?status=Stopped`)).data.some((o: any) => o.id === first.id), true);
  assert.equal((await order(admission.id, normal.id, { meals: ["Supper"] })).status, 422);
  assert.equal((await order(99999, normal.id)).status, 404);
});

test("stopping an order ends it once", async () => {
  const { admission } = await admit();
  const o = (await order(admission.id, (await diet("Soft Diet")).id)).data;
  assert.equal((await as(ADMIN, "POST", `/api/dietary/orders/${o.id}/stop`)).data.status, "Stopped");
  assert.equal((await as(ADMIN, "POST", `/api/dietary/orders/${o.id}/stop`)).status, 409);
});

test("discharging ends the patient's diet order, and ordering for someone discharged is refused", async () => {
  const { admission } = await admit();
  const o = (await order(admission.id, (await diet("Renal Diet")).id)).data;
  assert.equal((await as(ADMIN, "POST", `/api/ipd/${admission.id}/discharge`)).status, 200);
  assert.equal((await as(ADMIN, "GET", "/api/dietary/orders?status=Stopped")).data.find((x: any) => x.id === o.id).stoppedOn !== null, true);
  assert.equal((await order(admission.id, (await diet("Renal Diet")).id)).status, 409);
});

test("moving a patient to another bed moves their diet order with them", async () => {
  const { admission } = await admit();
  const o = (await order(admission.id, (await diet("Liquid Diet")).id)).data;
  const target = (await freeBeds())[0];
  assert.equal((await as(ADMIN, "POST", `/api/ipd/${admission.id}/transfer`, { bedId: target.id })).status, 200);
  const moved = (await as(ADMIN, "GET", "/api/dietary/orders?status=Active")).data.find((x: any) => x.id === o.id);
  assert.equal(moved.wardId, target.wardId); assert.equal(moved.bed, target.bedNumber);
});

test("the board lists a ward's active orders; the sheet is generated, and generating again adds only what's missing", async () => {
  const bed = (await freeBeds())[0];
  const wardId = bed.wardId;
  const { admission } = await admit(bed.id);
  const hp = await diet("High Protein Diet");
  await order(admission.id, hp.id);
  let b = await board(wardId);
  assert.equal(b.wardId, wardId); assert.equal(b.sheet, null);
  const mine = b.orders.filter((o: any) => o.admissionId === admission.id);
  assert.equal(mine.length, 1); assert.deepEqual(mine[0].onSheet, []);
  const n = b.orders.reduce((t: number, o: any) => t + o.meals.length, 0);
  const g = (await as(ADMIN, "POST", "/api/dietary/sheet", { wardId })).data;
  assert.equal(g.added, n); assert.equal(g.existing, 0); assert.equal(g.sheet.status, "Draft"); assert.equal(g.sheet.lines, n);
  const again = (await as(ADMIN, "POST", "/api/dietary/sheet", { wardId })).data;
  assert.equal(again.added, 0); assert.equal(again.existing, n);
  const bed2 = (await freeBeds()).find((x: any) => x.wardId === wardId);
  if (bed2) {
    const second = await admit(bed2.id);
    await order(second.admission.id, hp.id);
    const more = (await as(ADMIN, "POST", "/api/dietary/sheet", { wardId })).data;
    assert.equal(more.added, 3); assert.equal(more.existing, n);
  }
  b = await board(wardId);
  assert.deepEqual(b.orders.find((o: any) => o.admissionId === admission.id).onSheet, ["Breakfast", "Lunch", "Dinner"]);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet", {})).status, 422, "a ward is needed");
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet", { wardId, date: "30-10-2026" })).status, 422);
});

test("a sheet is dispatched, then received, in that order, and is closed once dispatched", async () => {
  const wardId = (await board()).wards[0].id;
  const day = "2031-01-15";
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet/dispatch", { wardId, date: day })).status, 409, "no sheet yet");
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet", { wardId, date: day })).status, 200);
  const empty = (await as(ADMIN, "GET", `/api/dietary/board?wardId=${wardId}&date=${day}`)).data;
  if (!empty.sheet.lines) assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet/dispatch", { wardId, date: day })).status, 409, "nothing to send");
  const today = (await board(wardId)).date;
  const withLines = await as(ADMIN, "POST", "/api/dietary/sheet", { wardId, date: today });
  assert.equal(withLines.status, 200);
  if (withLines.data.sheet.lines === 0) return;
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet/receive", { wardId })).status, 409, "not dispatched yet");
  const d = (await as(ADMIN, "POST", "/api/dietary/sheet/dispatch", { wardId })).data;
  assert.equal(d.status, "Dispatched"); assert.ok(d.dispatchedAt && d.dispatchedBy);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet/dispatch", { wardId })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet", { wardId })).status, 409, "closed to new lines");
  const r = (await as(ADMIN, "POST", "/api/dietary/sheet/receive", { wardId })).data;
  assert.equal(r.status, "Received"); assert.ok(r.receivedAt);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/sheet/receive", { wardId })).status, 409);
  assert.equal((await board(wardId)).sheet.status, "Received");
});

test("the printable sheet is grouped by meal and carries the hospital and ward", async () => {
  const b = await board();
  const wardId = b.wardId;
  const p = (await as(ADMIN, "GET", `/api/dietary/sheet/print?wardId=${wardId}`)).data;
  assert.ok(p.hospital); assert.equal(p.date, b.date); assert.ok(p.rows.length >= 1);
  const rank = ["Breakfast", "Lunch", "Dinner", "Snacks", "Supplements"];
  assert.ok(p.rows.every((r: any, i: number) => i === 0 || rank.indexOf(p.rows[i - 1].meal) <= rank.indexOf(r.meal)), "breakfasts first");
  assert.equal((await as(ADMIN, "GET", "/api/dietary/sheet/print")).status, 422);
  assert.equal((await as(ADMIN, "GET", `/api/dietary/sheet/print?wardId=${wardId}&date=2031-02-02`)).status, 409);
});

test("the kitchen plan counts each diet at each meal across the wards", async () => {
  const k = (await as(ADMIN, "GET", "/api/dietary/kitchen")).data;
  const orders = (await as(ADMIN, "GET", "/api/dietary/orders?status=Active")).data;
  assert.equal(k.patients, orders.length);
  for (const m of k.meals) assert.equal(k.totals[m], orders.filter((o: any) => o.meals.includes(m)).length, m);
  assert.equal(k.diets.reduce((n: number, d: any) => n + d.total, 0), Object.values(k.totals as Record<string, number>).reduce((a, b) => a + b, 0));
  assert.ok(k.wards.every((w: any) => w.patients > 0 || w.sheet !== "Not generated"));
});

test("the canteen has a menu, records sales at the menu price, and totals the day", async () => {
  assert.equal((await as(ADMIN, "GET", "/api/dietary/canteen")).data.items.length, 0);
  const tea = (await as(ADMIN, "POST", "/api/dietary/canteen/items", { name: "Tea", price: 12.5 })).data;
  const thali = (await as(ADMIN, "POST", "/api/dietary/canteen/items", { name: "Thali", price: 90 })).data;
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/items", { name: "tea", price: 5 })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/sales", { itemId: tea.id, quantity: 4, buyerType: "Staff", buyer: "Nurse Rekha" })).status, 201);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/sales", { itemId: thali.id, quantity: 2, buyerType: "Attendant" })).data.total, 180);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/sales", { itemId: tea.id, quantity: 1.5 })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/sales", { itemId: tea.id, quantity: 1, buyerType: "Alien" })).status, 422);
  const c = (await as(ADMIN, "GET", "/api/dietary/canteen")).data;
  assert.deepEqual(c.totals, { sales: 2, quantity: 6, amount: 230 });
  assert.equal(c.items.find((i: any) => i.name === "Tea").soldToday, 4);
  assert.equal(c.sales[0].item, "Thali", "newest first");
  await as(ADMIN, "PATCH", `/api/dietary/canteen/items/${thali.id}`, { price: 100, active: false });
  assert.equal((await as(ADMIN, "POST", "/api/dietary/canteen/sales", { itemId: thali.id, quantity: 1 })).status, 409, "off the menu");
  assert.equal((await as(ADMIN, "GET", "/api/dietary/canteen")).data.items.find((i: any) => i.name === "Thali").price, 100);
});

test("diet sheets and orders are recorded in the audit trail under Dietary", async () => {
  const modules = (await as(ADMIN, "GET", "/api/audit")).data.modules as string[];
  assert.ok(modules.includes("Dietary"));
  const sheet = (await as(ADMIN, "GET", "/api/audit?module=Dietary&q=diet sheet")).data.rows;
  assert.ok(sheet.some((r: any) => /Generated diet sheet for/.test(r.summary)));
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
