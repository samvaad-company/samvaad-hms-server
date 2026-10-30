/**
 * Tests for Ambulance dispatch: the fleet board, opening calls (queued or with a vehicle), the steps of a call, billing the fare,
 * freeing the vehicle, call numbers and the dashboard. In-process, in-memory.
 *
 *   npm run test:ambulance
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
const { localDate } = await import("@/lib/clock");
const ADMIN = "kevin.carter@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const today = localDate();

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const vehicles = async () => (await as(ADMIN, "GET", "/api/ambulance/vehicles?all=true")).data as any[];
const calls = async () => (await as(ADMIN, "GET", "/api/ambulance/calls?all=true")).data as any[];
const call = async (id: number) => (await calls()).find((c) => c.id === id);
const vehicle = async (id: number) => (await vehicles()).find((v) => v.id === id);
const addVehicle = async (extra: Record<string, unknown> = {}) => {
  const r = await as(ADMIN, "POST", "/api/ambulance/vehicles", { vehicleNumber: `GJ-06-${Math.floor(1000 + Math.random() * 8999)}`, vehicleType: "Neonatal", ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data;
};
const open = (extra: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/ambulance/calls", { pickupLocation: "Akota, Vadodara", ...extra });
const step = (id: number, what: string, body?: unknown) => as(ADMIN, "POST", `/api/ambulance/calls/${id}/${what}`, body);

test("it needs a login and the ambulance permission", async () => {
  for (const p of ["/api/ambulance/calls", "/api/ambulance/vehicles", "/api/ambulance/dashboard"]) assert.equal((await request("GET", p)).status, 401, p);
  assert.equal((await as(BILLING, "GET", "/api/ambulance/dashboard")).status, 403);
  assert.equal((await as(BILLING, "POST", "/api/ambulance/calls", { pickupLocation: "x y" })).status, 403);
});

test("a vehicle gets a board code and a type, and a code can't be used twice", async () => {
  const v = await addVehicle({ vehicleType: "Advanced Life Support (ALS)" });
  assert.match(v.code, /^AMB-\d\d$/); assert.equal(v.vehicleType, "Advanced Life Support (ALS)"); assert.equal(v.status, "Available");
  const named = await addVehicle({ code: "AMB-77" });
  assert.equal(named.code, "AMB-77");
  assert.equal((await as(ADMIN, "POST", "/api/ambulance/vehicles", { vehicleNumber: "GJ-06-0001", code: "amb-77" })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/ambulance/vehicles", { vehicleNumber: "GJ-06-0002", vehicleType: "Hovercraft" })).status, 422);
  const all = await vehicles();
  assert.ok(all.every((x: any) => x.code), "older vehicles are shown with a derived code");
});

test("a call opened with an available vehicle starts dispatched, numbered AMB/yy/nnnnn, and puts the vehicle on call", async () => {
  const v = await addVehicle();
  const r = await open({ callType: "Emergency pickup", ambulanceId: v.id, dropLocation: "City Hospital" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.match(r.data.callNo, new RegExp(`^AMB/${today.slice(2, 4)}/\\d{5}$`)); assert.equal(r.data.status, "Dispatched");
  assert.equal(r.data.vehicleNumber, v.vehicleNumber); assert.ok(r.data.dispatchedAt); assert.equal(r.data.patientName, "Unidentified");
  assert.equal((await vehicle(v.id)).status, "On Call");
  const next = await open({ ambulanceId: (await addVehicle()).id });
  const n = (s: string) => Number(s.split("/")[2]);
  assert.equal(n(next.data.callNo), n(r.data.callNo) + 1, "the next call takes the next number");
});

test("a call with no vehicle waits queued, and an emergency pickup with no destination is taken to the hospital", async () => {
  const q = (await open({ callType: "Emergency pickup" })).data;
  assert.equal(q.status, "Queued"); assert.equal(q.vehicleNumber, ""); assert.equal(q.dispatchedAt, null); assert.ok(q.dropLocation, "defaults to this hospital");
  const transfer = (await open({ callType: "Inter-hospital transfer" })).data;
  assert.equal(transfer.dropLocation, "");
  assert.equal((await step(q.id, "arrive")).status, 409, "no vehicle yet");
  assert.equal((await step(q.id, "complete")).status, 409, "can't complete a call with no vehicle");
  assert.equal((await step(q.id, "cancel")).data.status, "Cancelled");
});

test("a queued call is dispatched by giving it a free vehicle, once", async () => {
  const q = (await open()).data;
  const v = await addVehicle();
  const d = (await step(q.id, "dispatch", { ambulanceId: v.id })).data;
  assert.equal(d.status, "Dispatched"); assert.equal(d.vehicleNumber, v.vehicleNumber); assert.ok(d.dispatchedAt);
  assert.equal((await vehicle(v.id)).status, "On Call");
  assert.equal((await step(q.id, "dispatch", { ambulanceId: (await addVehicle()).id })).status, 409, "already dispatched");
  const q2 = (await open()).data;
  assert.equal((await step(q2.id, "dispatch", { ambulanceId: v.id })).status, 409, "that vehicle is busy");
  assert.equal((await step(q2.id, "dispatch", {})).status, 422);
  assert.equal((await step(q2.id, "dispatch", { ambulanceId: 99999 })).status, 404);
});

test("a call goes Dispatched → At scene → Transporting → Completed, each step in order, and frees the vehicle", async () => {
  const v = await addVehicle();
  const c = (await open({ ambulanceId: v.id })).data;
  assert.equal((await step(c.id, "transport")).status, 409, "not at the scene yet");
  const a = (await step(c.id, "arrive")).data; assert.equal(a.status, "At scene"); assert.ok(a.atSceneAt);
  assert.equal((await step(c.id, "arrive")).status, 409);
  assert.equal((await step(c.id, "transport")).data.status, "Transporting");
  const done = (await step(c.id, "complete", {})).data;
  assert.equal(done.status, "Completed"); assert.ok(done.closedAt);
  assert.equal((await vehicle(v.id)).status, "Available");
  assert.equal((await step(c.id, "complete", {})).status, 409);
  assert.equal((await step(c.id, "cancel")).status, 409, "a closed call can't be cancelled");
});

test("completing with a fare raises an Ambulance bill for the patient; cancelling raises none", async () => {
  const patient = (await as(ADMIN, "POST", "/api/patients", { name: "Amb Patient", age: 52, gender: "Male", phone: "9410077001" })).data;
  const v = await addVehicle();
  const c = (await open({ ambulanceId: v.id, patientId: patient.id, amount: 1500 })).data;
  assert.equal(c.patientName, "Amb Patient"); assert.equal(c.patientId, patient.id);
  const before = (await as(ADMIN, "GET", "/api/billing?all=true")).data.filter((b: any) => b.type === "Ambulance").length;
  assert.equal((await step(c.id, "complete", { amount: 1800 })).data.amount, 1800, "the fare can be settled on completion");
  const bills = (await as(ADMIN, "GET", "/api/billing?all=true")).data.filter((b: any) => b.type === "Ambulance");
  assert.equal(bills.length, before + 1); assert.ok(bills.some((b: any) => b.patientName === "Amb Patient"));
  const v2 = await addVehicle();
  const free = (await open({ ambulanceId: v2.id })).data;
  await step(free.id, "complete", {});
  assert.equal((await as(ADMIN, "GET", "/api/billing?all=true")).data.filter((b: any) => b.type === "Ambulance").length, before + 1, "no fare, no bill");
  const v3 = await addVehicle();
  const gone = (await open({ ambulanceId: v3.id, amount: 900 })).data;
  await step(gone.id, "cancel");
  assert.equal((await vehicle(v3.id)).status, "Available");
  assert.equal((await as(ADMIN, "GET", "/api/billing?all=true")).data.filter((b: any) => b.type === "Ambulance").length, before + 1);
});

test("a vehicle that is busy or off the road can't take a call", async () => {
  const v = await addVehicle();
  await open({ ambulanceId: v.id });
  const busy = await open({ ambulanceId: v.id });
  assert.equal(busy.status, 409); assert.match(busy.error?.message ?? "", /another call/);
  const off = await addVehicle({ status: "Maintenance" });
  const r = await open({ ambulanceId: off.id });
  assert.equal(r.status, 409); assert.match(r.error?.message ?? "", /off the road/);
  assert.equal((await as(ADMIN, "PATCH", `/api/ambulance/vehicles/${v.id}`, { status: "Maintenance" })).status, 409, "can't be put off road mid-call");
  assert.equal((await as(ADMIN, "DELETE", `/api/ambulance/vehicles/${v.id}`)).status, 409);
});

test("a call needs a pickup and a known call type and patient", async () => {
  assert.equal((await as(ADMIN, "POST", "/api/ambulance/calls", { callType: "Emergency pickup" })).status, 422);
  assert.equal((await open({ callType: "Joyride" })).status, 422);
  assert.equal((await open({ patientId: 99999 })).status, 404);
});

test("the old PATCH { status } still completes and cancels a call", async () => {
  const v = await addVehicle();
  const c = (await open({ ambulanceId: v.id })).data;
  assert.equal((await as(ADMIN, "PATCH", `/api/ambulance/calls/${c.id}`, { status: "Completed", amount: 0 })).data.status, "Completed");
  assert.equal((await vehicle(v.id)).status, "Available");
  const c2 = (await open({ ambulanceId: v.id })).data;
  assert.equal((await as(ADMIN, "PATCH", `/api/ambulance/calls/${c2.id}`, { status: "Cancelled" })).data.status, "Cancelled");
});

test("deleting an open call frees its vehicle", async () => {
  const v = await addVehicle();
  const c = (await open({ ambulanceId: v.id })).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/ambulance/calls/${c.id}`)).status, 204);
  assert.equal((await vehicle(v.id)).status, "Available");
  assert.equal((await call(c.id)), undefined);
});

test("the dashboard counts calls, response times, types, vehicles and the fleet", async () => {
  for (const [q, n] of [["?days=7", 7], ["?days=90", 90], ["", 30], ["?days=11", 30]] as const) {
    const d = (await as(ADMIN, "GET", `/api/ambulance/dashboard${q}`)).data;
    assert.equal(d.days, n, q); assert.equal(d.series.length, n); assert.equal(d.series[n - 1].date, today);
  }
  const d = (await as(ADMIN, "GET", "/api/ambulance/dashboard")).data;
  assert.ok(d.calls.total >= 5 && d.calls.completed >= 1 && d.calls.cancelled >= 1);
  assert.equal(d.series.reduce((n: number, s: any) => n + s.calls, 0), d.calls.total);
  assert.equal(d.byType.reduce((n: number, t: any) => n + t.count, 0), d.calls.total);
  assert.ok(d.response.dispatchMin !== null && d.response.dispatchMin >= 0);
  assert.equal(d.fleet.total, d.fleet.available + d.fleet.dispatched + d.fleet.offRoad);
  assert.equal(d.byVehicle.length, d.fleet.total);
  assert.ok(d.calls.revenue >= 1800);
  assert.equal(d.calls.active, (await calls()).filter((c: any) => ["Dispatched", "At scene", "Transporting"].includes(c.status)).length);
});

test("dispatches are on the audit trail", async () => {
  const rows = (await as(ADMIN, "GET", "/api/audit?q=AMB%2F")).data.rows;
  assert.ok(rows.length >= 1);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
