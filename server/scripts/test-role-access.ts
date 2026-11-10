/**
 * Tests for Roles & access: the five levels (none, read, add, edit, full) are enforced on the server per request kind, only the
 * hospital's Super Admin can change them, a change reaches the person's own view of their permissions, one hospital's changes never
 * touch another, and the built-in levels are untouched until someone changes them.
 *
 *   npm run test:role-access
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
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string; details?: any } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function cookieFor(email: string) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
async function as(email: string, method: string, path: string, body?: unknown) {
  return request(method, path, { body, headers: { cookie: await cookieFor(email) } });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in"; // Receptionist: enquiries "write" out of the box
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_HOSPITAL_ADMIN = "admin@sunrisehospital.in";

const setLevel = (level: string, role = "Receptionist", resource = "enquiries") => as(ADMIN, "PUT", "/api/admin/role-access", { role, levels: { [resource]: level } });
const lead = () => ({ name: "Test Lead", mobile: "9876500000" });
let n = 0;
const create = () => as(RECEPTION, "POST", "/api/enquiries", { ...lead(), name: `Test Lead ${++n}` });

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("nothing changes until an admin changes it: a receptionist can add, change and delete enquiries as before", async () => {
  const made = await create();
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(RECEPTION, "PUT", `/api/enquiries/${made.data.id}`, { ...lead(), notes: "x" })).status, 200);
  assert.equal((await as(RECEPTION, "DELETE", `/api/enquiries/${made.data.id}`)).status, 204);
  const me = (await as(RECEPTION, "GET", "/api/auth/me")).data;
  assert.equal(me.permissions.enquiries, "write");
  const matrix = (await as(ADMIN, "GET", "/api/admin/role-access")).data;
  assert.equal(matrix.roles.find((r: any) => r.role === "Receptionist").changed, 0);
});

test("read only: can look, can't add, change or delete", async () => {
  const keep = (await create()).data.id;
  assert.equal((await setLevel("read")).status, 200);
  assert.equal((await as(RECEPTION, "GET", "/api/enquiries")).status, 200);
  const add = await as(RECEPTION, "POST", "/api/enquiries", lead());
  assert.equal(add.status, 403);
  assert.match(add.error!.message, /cannot add to enquiries/);
  assert.equal((await as(RECEPTION, "PUT", `/api/enquiries/${keep}`, { ...lead(), notes: "x" })).status, 403);
  assert.equal((await as(RECEPTION, "DELETE", `/api/enquiries/${keep}`)).status, 403);
  assert.equal((await as(RECEPTION, "GET", "/api/auth/me")).data.permissions.enquiries, "read");
});

test("add: can create, can't change or delete", async () => {
  assert.equal((await setLevel("add")).status, 200);
  const made = await create();
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(RECEPTION, "PUT", `/api/enquiries/${made.data.id}`, { ...lead(), notes: "x" })).status, 403);
  assert.equal((await as(RECEPTION, "DELETE", `/api/enquiries/${made.data.id}`)).status, 403);
});

test("add & edit: can create and change, can't delete", async () => {
  assert.equal((await setLevel("edit")).status, 200);
  const made = await create();
  assert.equal(made.status, 201);
  assert.equal((await as(RECEPTION, "PUT", `/api/enquiries/${made.data.id}`, { ...lead(), notes: "changed" })).status, 200);
  const del = await as(RECEPTION, "DELETE", `/api/enquiries/${made.data.id}`);
  assert.equal(del.status, 403);
  assert.match(del.error!.message, /cannot delete from enquiries/);
});

test("no access: even looking is refused, and the part disappears from their permissions", async () => {
  assert.equal((await setLevel("none")).status, 200);
  assert.equal((await as(RECEPTION, "GET", "/api/enquiries")).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/enquiries", lead())).status, 403);
  assert.equal((await as(RECEPTION, "GET", "/api/auth/me")).data.permissions.enquiries, "none");
});

test("full: back to everything, including delete", async () => {
  assert.equal((await setLevel("write")).status, 200);
  const made = await create();
  assert.equal(made.status, 201);
  assert.equal((await as(RECEPTION, "DELETE", `/api/enquiries/${made.data.id}`)).status, 204);
});

test("a change affects only that role: other roles keep their levels", async () => {
  await setLevel("none");
  assert.equal((await as(PHARMACIST, "GET", "/api/medicines")).status, 200, "pharmacist untouched");
  const matrix = (await as(ADMIN, "GET", "/api/admin/role-access")).data;
  const rec = matrix.roles.find((r: any) => r.role === "Receptionist");
  assert.equal(rec.changed, 1);
  assert.equal(rec.current.enquiries, "none");
  assert.equal(rec.defaults.enquiries, "write");
  assert.equal(matrix.roles.find((r: any) => r.role === "Pharmacist").changed, 0);
});

test("only the hospital Super Admin can change levels, and reading the matrix needs admin access", async () => {
  const body = { role: "Receptionist", levels: { enquiries: "read" } };
  assert.equal((await as(RECEPTION, "PUT", "/api/admin/role-access", body)).status, 403);
  assert.equal((await as(PHARMACIST, "PUT", "/api/admin/role-access", body)).status, 403);
  assert.equal((await as(RECEPTION, "GET", "/api/admin/role-access")).status, 403, "reading the matrix needs admin access");
});

test("the hospital's admin and outside partners can't be changed; unknown roles, parts and levels are refused", async () => {
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Super Admin", levels: { patients: "none" } })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Platform Admin", levels: { patients: "none" } })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Lab Partner", levels: { lab: "none" } })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Wizard", levels: { patients: "none" } })).status, 422);
  assert.equal((await setLevel("sometimes")).status, 422);
  assert.equal((await setLevel("read", "Receptionist", "spaceship")).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist" })).status, 422, "levels are needed");
  const admin = (await as(ADMIN, "GET", "/api/admin/role-access")).data.roles.find((r: any) => r.role === "Super Admin");
  assert.equal(admin.locked, true);
});

test("one hospital's changes never touch another hospital", async () => {
  const other = (await as(OTHER_HOSPITAL_ADMIN, "GET", "/api/admin/role-access")).data;
  assert.equal(other.roles.find((r: any) => r.role === "Receptionist").changed, 0);
  assert.equal(other.roles.find((r: any) => r.role === "Receptionist").current.enquiries, "write");
  // And the other hospital's admin changing a role doesn't reach this one.
  const res = await as(OTHER_HOSPITAL_ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", levels: { patients: "read" } });
  assert.equal(res.status, 200, JSON.stringify(res.error));
  const here = (await as(ADMIN, "GET", "/api/admin/role-access")).data.roles.find((r: any) => r.role === "Receptionist");
  assert.equal(here.current.patients, "write");
  await as(OTHER_HOSPITAL_ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", reset: true });
});

test("reset puts a role back to the built-in levels", async () => {
  const reset = await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", reset: true });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.roles.find((r: any) => r.role === "Receptionist").changed, 0);
  assert.equal((await as(RECEPTION, "POST", "/api/enquiries", lead())).status, 201);
  assert.equal((await as(RECEPTION, "GET", "/api/auth/me")).data.permissions.enquiries, "write");
});

test("setting a level back to the built-in one stores nothing extra", async () => {
  await setLevel("write"); // the built-in for this role
  assert.equal((await as(ADMIN, "GET", "/api/admin/role-access")).data.roles.find((r: any) => r.role === "Receptionist").changed, 0);
});

test("the change is recorded in the audit log", async () => {
  await setLevel("read");
  const log = await as(ADMIN, "GET", "/api/audit");
  assert.equal(log.status, 200);
  const items = JSON.stringify(log.data);
  assert.match(items, /role_access\.update/);
  await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", reset: true });
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}\n${(e as Error).stack?.split("\n").slice(1, 3).join("\n")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
