/**
 * Tests for Housekeeping: the cleaning board and its task life-cycle, bed turnaround on discharge, room readiness and the linen
 * ledger. In-process, in-memory.
 *
 *   npm run test:housekeeping
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
const board = async () => (await as(ADMIN, "GET", "/api/housekeeping")).data;
const linen = async () => (await as(ADMIN, "GET", "/api/housekeeping/linen")).data;
const cat = async (name: string) => (await linen()).categories.find((c: any) => c.name === name);

test("it needs a login and the beds permission", async () => {
  assert.equal((await request("GET", "/api/housekeeping")).status, 401);
  assert.equal((await as(BILLING, "GET", "/api/housekeeping")).status, 403);
  assert.equal((await as(BILLING, "POST", "/api/housekeeping/tasks", { location: "Lobby" })).status, 403);
});

test("the board raises one routine clean per ward a day, and not again on the next look", async () => {
  const b = await board();
  assert.ok(b.wards.length >= 1);
  const routine = b.tasks.filter((t: any) => t.kind === "Routine clean");
  assert.equal(routine.length, b.wards.length);
  assert.ok(routine.every((t: any) => t.status === "Pending" && t.source === "Scheduled"));
  assert.equal((await board()).tasks.filter((t: any) => t.kind === "Routine clean").length, b.wards.length);
  assert.equal(b.counts.pending, b.tasks.filter((t: any) => t.status === "Pending").length);
  assert.equal(b.counts.beds, b.rooms.length);
});

test("a task goes Pending → In progress → Completed → Verified, and then leaves the board", async () => {
  const t = (await as(ADMIN, "POST", "/api/housekeeping/tasks", { location: "OT lobby", notes: "Spill" })).data;
  assert.equal(t.status, "Pending"); assert.equal(t.kind, "Ad hoc"); assert.equal(t.title, "OT lobby");
  assert.equal((await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/verify`, {})).status, 409, "not done yet");
  assert.equal((await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/start`)).data.status, "In progress");
  assert.equal((await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/start`)).status, 409, "already started");
  assert.equal((await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/assign`, { assignee: "Meena" })).data.assignee, "Meena");
  const done = (await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/complete`, { notes: "Mopped and sanitised" })).data;
  assert.equal(done.status, "Completed"); assert.equal(done.completionNotes, "Mopped and sanitised");
  let b = await board();
  assert.ok(b.counts.toVerify >= 1);
  const v = (await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/verify`, {})).data;
  assert.equal(v.status, "Verified"); assert.ok(v.verifiedBy);
  b = await board();
  assert.ok(!b.tasks.some((x: any) => x.id === t.id), "verified jobs leave the board");
});

test("a pending task can be completed straight away, and a task needs a place", async () => {
  const t = (await as(ADMIN, "POST", "/api/housekeeping/tasks", { location: "Corridor B" })).data;
  assert.equal((await as(ADMIN, "POST", `/api/housekeeping/tasks/${t.id}/complete`, {})).data.status, "Completed");
  assert.equal((await as(ADMIN, "POST", "/api/housekeeping/tasks", { notes: "somewhere" })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/housekeeping/tasks/99999/start")).status, 404);
});

test("discharging a patient raises a bed turnaround, the bed shows as cleaning, then to verify, then ready", async () => {
  const bed = (await as(ADMIN, "GET", "/api/beds?all=true&status=Available")).data[0];
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 2, patientName: "Ethan Miller", bedId: bed.id })).data;
  let room = (await board()).rooms.find((r: any) => r.id === bed.id);
  assert.equal(room.state, "Occupied");
  assert.equal((await as(ADMIN, "POST", `/api/ipd/${a.id}/discharge`)).status, 200);
  let b = await board();
  room = b.rooms.find((r: any) => r.id === bed.id);
  assert.equal(room.state, "Cleaning");
  const task = b.tasks.find((t: any) => t.id === room.taskId);
  assert.equal(task.kind, "Bed turnaround"); assert.equal(task.source, "Discharge");
  const readyBefore = b.counts.ready;
  assert.equal((await as(ADMIN, "POST", "/api/housekeeping/beds/" + bed.id + "/clean")).status, 409, "already has a job");
  await as(ADMIN, "POST", `/api/housekeeping/tasks/${task.id}/complete`, {});
  assert.equal((await board()).rooms.find((r: any) => r.id === bed.id).state, "To verify");
  await as(ADMIN, "POST", `/api/housekeeping/tasks/${task.id}/verify`, {});
  b = await board();
  assert.equal(b.rooms.find((r: any) => r.id === bed.id).state, "Ready");
  assert.equal(b.counts.ready, readyBefore + 1);
});

test("a free bed can be sent for cleaning by hand; an occupied one can't", async () => {
  const free = (await as(ADMIN, "GET", "/api/beds?all=true&status=Available")).data[0];
  const t = (await as(ADMIN, "POST", `/api/housekeeping/beds/${free.id}/clean`)).data;
  assert.equal(t.kind, "Bed turnaround"); assert.equal(t.source, "Manual");
  assert.equal((await board()).rooms.find((r: any) => r.id === free.id).state, "Cleaning");
  const occupied = (await as(ADMIN, "GET", "/api/beds?all=true&status=Occupied")).data[0];
  if (occupied) assert.equal((await as(ADMIN, "POST", `/api/housekeeping/beds/${occupied.id}/clean`)).status, 409);
});

test("linen starts with the standard categories at nothing, and balances follow the ledger", async () => {
  const l = await linen();
  assert.ok(l.categories.length >= 8);
  const sheet = await cat("Bed Sheet");
  assert.equal(sheet.total, 0); assert.equal(sheet.reorderAt, 200); assert.equal(sheet.low, true);
  const ward = (await board()).wards[0];
  const move = async (kind: string, quantity: number, extra: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/housekeeping/linen/moves", { kind, categoryId: sheet.id, quantity, ...extra });
  assert.equal((await move("new_stock", 400)).status, 201);
  assert.equal((await move("issue_ward", 80, { wardId: ward.id })).status, 201);
  assert.equal((await move("collect_soiled", 30, { wardId: ward.id })).status, 201);
  assert.equal((await move("send_laundry", 20)).status, 201);
  assert.equal((await move("receive_clean", 5)).status, 201);
  assert.equal((await move("discard", 4)).status, 201);
  const c = await cat("Bed Sheet");
  assert.deepEqual([c.store, c.wards, c.soiled, c.laundry], [400 - 80 + 5, 80 - 30, 30 - 20 - 4, 20 - 5]);
  assert.equal(c.total, c.store + c.wards + c.soiled + c.laundry);
  assert.equal(c.low, false, "320 in store is over the reorder level of 200");
  const last = (await linen()).moves[0];
  assert.equal(last.label, "Discard / condemn"); assert.equal(last.from, "Soiled hold"); assert.equal(last.to, "—");
  assert.equal(last.fromBalance, 6);
});

test("linen can't move more than the source holds, nor from a ward that hasn't got it", async () => {
  const towel = await cat("Towel");
  const wards = (await board()).wards;
  const move = (kind: string, quantity: number, extra: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/housekeeping/linen/moves", { kind, categoryId: towel.id, quantity, ...extra });
  assert.equal((await move("issue_ward", 5, { wardId: wards[0].id })).status, 409, "nothing in the store");
  assert.equal((await move("send_laundry", 1)).status, 409, "nothing soiled");
  await move("new_stock", 50); await move("issue_ward", 10, { wardId: wards[0].id });
  if (wards[1]) assert.equal((await move("collect_soiled", 1, { wardId: wards[1].id })).status, 409, "that ward has none");
  assert.equal((await move("collect_soiled", 11, { wardId: wards[0].id })).status, 409, "only 10 there");
  assert.equal((await move("issue_ward", 3)).status, 422, "a ward is needed");
  assert.equal((await move("new_stock", 0)).status, 422);
  assert.equal((await move("new_stock", 1.5)).status, 422, "whole pieces only");
  assert.equal((await move("bogus", 1)).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/housekeeping/linen/moves", { kind: "new_stock", categoryId: 99999, quantity: 1 })).status, 404);
});

test("a linen category can be added once by name", async () => {
  const r = await as(ADMIN, "POST", "/api/housekeeping/linen/categories", { name: "Curtain", unit: "set", reorderAt: 12 });
  assert.equal(r.status, 201);
  assert.equal((await cat("Curtain")).reorderAt, 12);
  assert.equal((await as(ADMIN, "POST", "/api/housekeeping/linen/categories", { name: "curtain" })).status, 409);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
