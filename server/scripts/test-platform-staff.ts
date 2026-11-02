/**
 * Tests for the platform admin adding staff and logins to a hospital (POST /api/hospitals/:id/users | staff).
 * In-process, in-memory.
 *
 *   npm run test:platformstaff
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
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string }; meta?: any } | null;
  return { status: res.status, data: parsed?.data, meta: parsed?.meta, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown, password = "Samvaad@123") {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password } });
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}
const PLATFORM = "platform-admin@samvaad.dev";
const ADMIN = "kevin.carter@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
let hid = 0;
let other = 0;

test("the platform admin onboards two hospitals", async () => {
  const a = await as(PLATFORM, "POST", "/api/hospitals", { name: "North Clinic", adminName: "N Admin", adminEmail: "admin@north.test", adminPassword: "North@12345" });
  const b = await as(PLATFORM, "POST", "/api/hospitals", { name: "South Clinic", adminName: "S Admin", adminEmail: "admin@south.test", adminPassword: "South@12345" });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  hid = a.data.id; other = b.data.id;
});

test("only the platform admin can use these endpoints", async () => {
  assert.equal((await request("GET", `/api/hospitals/${hid}/users`)).status, 401);
  for (const [m, p] of [["GET", `/api/hospitals/${hid}/users`], ["POST", `/api/hospitals/${hid}/users`], ["GET", `/api/hospitals/${hid}/staff`], ["POST", `/api/hospitals/${hid}/staff`], ["GET", "/api/hospitals/roles"]] as const) {
    assert.equal((await as(ADMIN, m, p, m === "POST" ? {} : undefined)).status, 403, `${m} ${p}`);
  }
});

test("the role list leaves out Platform Admin and the centre-linked partner roles", async () => {
  const r = await as(PLATFORM, "GET", "/api/hospitals/roles");
  assert.equal(r.status, 200);
  assert.ok(r.data.includes("Super Admin") && r.data.includes("Receptionist") && r.data.includes("Doctor"));
  for (const x of ["Platform Admin", "Radiology Partner", "Lab Partner"]) assert.ok(!r.data.includes(x), x);
});

test("a login is created in the chosen hospital, can sign in, and is seen only there", async () => {
  const r = await as(PLATFORM, "POST", `/api/hospitals/${hid}/users`, { name: "Rita Desk", email: "Rita@north.test", password: "Rita@12345", role: "Receptionist" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.email, "rita@north.test"); assert.equal(r.data.role, "Receptionist");
  const me = await as("rita@north.test", "GET", "/api/auth/me", undefined, "Rita@12345");
  assert.equal(me.status, 200);
  const north = (await as(PLATFORM, "GET", `/api/hospitals/${hid}/users`)).data;
  assert.ok(north.some((u: any) => u.email === "rita@north.test") && north.some((u: any) => u.email === "admin@north.test"));
  const south = (await as(PLATFORM, "GET", `/api/hospitals/${other}/users`)).data;
  assert.ok(!south.some((u: any) => u.email === "rita@north.test"));
  const rita = await as("rita@north.test", "GET", "/api/patients");
  assert.equal(rita.status, 200, "she works in North, not in the demo hospital");
  assert.equal(rita.data.length, 0);
});

test("a login with a staff record is on the staff list and linked to it", async () => {
  const r = await as(PLATFORM, "POST", `/api/hospitals/${hid}/users`, { name: "Nina Nurse", email: "nina@north.test", password: "Nina@12345", role: "Head Nurse", staff: { phone: "9811100001", employeeNo: "N-01", qualification: "BSc Nursing" } });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.ok(r.data.staffId, "linked");
  const staff = await as(PLATFORM, "GET", `/api/hospitals/${hid}/staff`);
  assert.equal(staff.status, 200);
  const row = staff.data.find((s: any) => s.name === "Nina Nurse");
  assert.ok(row && row.role === "Head Nurse" && row.employeeNo === "N-01");
  assert.equal(staff.meta.total, 1);
  assert.equal((await as(PLATFORM, "GET", `/api/hospitals/${other}/staff`)).data.length, 0, "the other hospital's directory is untouched");
});

test("a staff member without a login can be added to a hospital's directory", async () => {
  const r = await as(PLATFORM, "POST", `/api/hospitals/${hid}/staff`, { name: "Ravi Driver", role: "Driver", phone: "9811100002" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const list = (await as(PLATFORM, "GET", `/api/hospitals/${hid}/staff`)).data;
  assert.equal(list.filter((s: any) => s.name === "Ravi Driver").length, 1);
  assert.equal((await as("admin@north.test", "GET", "/api/staff", undefined, "North@12345")).data.length, 2, "and the hospital's own admin sees both");
});

test("bad requests are refused", async () => {
  const p = (body: unknown, id = hid) => as(PLATFORM, "POST", `/api/hospitals/${id}/users`, body);
  assert.equal((await p({ name: "X Y", email: "x@north.test", password: "Pass@123", role: "Platform Admin" })).status, 400, "no minting platform admins");
  assert.equal((await p({ name: "X Y", email: "x@north.test", password: "Pass@123", role: "Lab Partner" })).status, 400);
  assert.equal((await p({ name: "X Y", email: "x@north.test", password: "Pass@123", role: "Wizard" })).status, 400);
  assert.equal((await p({ name: "Dup", email: "rita@north.test", password: "Pass@123", role: "Receptionist" })).status, 409, "email is unique across the platform");
  assert.equal((await p({ name: "X", email: "bad", password: "1", role: "Receptionist" })).status, 422);
  assert.equal((await p({ name: "X Y", email: "x@north.test", password: "Pass@123", role: "Receptionist" }, 99999)).status, 404);
  assert.equal((await as(PLATFORM, "GET", "/api/hospitals/99999/staff")).status, 404);
});

test("a removed hospital can't be added to; a paused one can", async () => {
  assert.equal((await as(PLATFORM, "POST", `/api/hospitals/${other}/pause`)).status, 200);
  assert.equal((await as(PLATFORM, "POST", `/api/hospitals/${other}/staff`, { name: "Paused Pat", role: "Cleaner" })).status, 201);
  assert.equal((await as(PLATFORM, "POST", `/api/hospitals/${other}/remove`)).status, 200);
  assert.equal((await as(PLATFORM, "POST", `/api/hospitals/${other}/staff`, { name: "Late Lee", role: "Cleaner" })).status, 409);
});

test("the platform admin's name is on the hospital's audit trail", async () => {
  const log = await as("admin@north.test", "GET", "/api/audit?pageSize=200", undefined, "North@12345");
  assert.equal(log.status, 200);
  assert.ok(log.data.rows.some((r: any) => r.actor === "Platform Operations" && /user|staff/i.test(r.entity)));
  assert.equal(log.data.chain.intact, true);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
