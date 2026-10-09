/**
 * Tests for editing details: the admin's Edit on a doctor, and "My profile" for
 * every role. In-process, in-memory database.
 *
 *   npm run test:profile
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { doctorsRepo, usersRepo, appointmentsRepo } = await import("@/repositories");

// ── Harness ──────────────────────────────────────────────────────────────────

const { app } = await createApp();

if (process.env.DATABASE_DRIVER === "mongo") {
  const { getDb } = await import("@/db");
  const mongo = (await getDb()) as unknown as { database(): Promise<import("mongodb").Db> };
  const meta = (await mongo.database()).collection("_meta");
  for (let i = 0; i < 240 && !(await meta.findOne({ _id: "schema" } as never)); i++) await new Promise((r) => setTimeout(r, 500));
}

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
const RECEPTION = "deepak.nair@samvaadhospital.in";
const DOCTOR2 = "sophia.adams@samvaadhospital.in"; // linked to doctor 2
const PASSWORD = "Samvaad@123";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("an admin edits every detail of a doctor, and the new values show in the list", async () => {
  const r = await as(ADMIN, "PATCH", "/api/doctors/3", { name: "Dr. Edited Name", specialty: "Neurologist", department: "Neurology", phone: "+91 90000 11111", experience: "15 yrs", status: "On Leave" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.name, r.data.specialty, r.data.department, r.data.phone, r.data.experience, r.data.status], ["Dr. Edited Name", "Neurologist", "Neurology", "+91 90000 11111", "15 yrs", "On Leave"]);
  const list = await as(ADMIN, "GET", "/api/doctors?all=true");
  const row = (list.data.items ?? list.data).find((d: { id: number }) => d.id === 3);
  assert.equal(row.name, "Dr. Edited Name");
});

test("renaming a doctor renames them on their appointments too", async () => {
  const appt = await appointmentsRepo.create({ hospital_id: 1, patient_id: 1, patient_name: "P", patient_age: 30, doctor_id: 4, doctor: "old", appointment_date: "2099-01-05", appointment_time: "10:00 AM", type: "Booked", reason: "x", status: "Upcoming" });
  const r = await as(ADMIN, "PATCH", "/api/doctors/4", { name: "Dr. Renamed Four" });
  assert.equal(r.status, 200);
  assert.equal((await appointmentsRepo.getRow(appt.id))!.doctor, "Dr. Renamed Four");
});

test("an empty name or an invalid status is refused", async () => {
  assert.equal((await as(ADMIN, "PATCH", "/api/doctors/3", { name: "" })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", "/api/doctors/3", { status: "Gone Fishing" })).status, 422);
});

test("a receptionist and a doctor can't edit someone else's doctor record", async () => {
  assert.equal((await as(RECEPTION, "PATCH", "/api/doctors/3", { phone: "1" })).status, 403);
  assert.equal((await as(DOCTOR2, "PATCH", "/api/doctors/3", { phone: "1" })).status, 403);
});

test("every role can read and edit its own name; role and email can't be changed", async () => {
  const before = (await as(RECEPTION, "GET", "/api/auth/profile")).data;
  assert.equal(before.role, "Receptionist");
  const r = await as(RECEPTION, "PATCH", "/api/auth/profile", { name: "Deepak N. Nair", role: "Super Admin", email: "evil@x.com" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.user.name, "Deepak N. Nair");
  assert.equal(r.data.user.role, "Receptionist");
  assert.equal(r.data.user.email, before.email);
  // the cookie was re-issued, so /me shows the new name straight away
  cookies.set(RECEPTION, (r.headers.get("set-cookie") ?? "").split(";")[0]);
  assert.equal((await as(RECEPTION, "GET", "/api/auth/me")).data.name, "Deepak N. Nair");
});

test("a doctor edits their own phone, specialty and experience — and their name stays in step everywhere", async () => {
  const r = await as(DOCTOR2, "PATCH", "/api/auth/profile", { name: "Dr. Sophia A. Adams", phone: "+91 98888 22222", specialty: "Cardiologist", experience: "12 yrs", status: "On Leave", department: "Hacking" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  const d = (await doctorsRepo.getRow(2))!;
  assert.deepEqual([d.name, d.phone, d.specialty, d.experience], ["Dr. Sophia A. Adams", "+91 98888 22222", "Cardiologist", "12 yrs"]);
  assert.notEqual(d.status, "On Leave", "status and department are not self-service");
  assert.notEqual(d.department, "Hacking");
  const login = (await usersRepo.getRow(r.data.user.id))!;
  assert.equal(login.name, "Dr. Sophia A. Adams");
});

test("changing a password needs the current one, and the new one then works", async () => {
  assert.equal((await as(RECEPTION, "PATCH", "/api/auth/profile", { newPassword: "NewPass#123" })).status, 400);
  assert.equal((await as(RECEPTION, "PATCH", "/api/auth/profile", { currentPassword: "wrong-one", newPassword: "NewPass#123" })).status, 400);
  assert.equal((await as(RECEPTION, "PATCH", "/api/auth/profile", { currentPassword: PASSWORD, newPassword: "short" })).status, 422);
  assert.equal((await as(RECEPTION, "PATCH", "/api/auth/profile", { currentPassword: PASSWORD, newPassword: "NewPass#123" })).status, 200);
  assert.equal((await request("POST", "/api/auth/login", { body: { email: RECEPTION, password: PASSWORD } })).status, 401);
  assert.equal((await request("POST", "/api/auth/login", { body: { email: RECEPTION, password: "NewPass#123" } })).status, 200);
});

test("a new staff login is created with the password the admin typed; admins can reset it later", async () => {
  const r = await as(ADMIN, "POST", "/api/admin/users", { name: "New Nurse", email: "new.nurse@samvaadhospital.in", password: "Typed#Pass1", role: "Head Nurse" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal((await request("POST", "/api/auth/login", { body: { email: "new.nurse@samvaadhospital.in", password: "Typed#Pass1" } })).status, 200);
  assert.equal((await request("POST", "/api/auth/login", { body: { email: "new.nurse@samvaadhospital.in", password: "Samvaad@123" } })).status, 401, "no hidden default password");
  assert.equal((await as(ADMIN, "POST", "/api/admin/users", { name: "No Pass", email: "no.pass@x.in", role: "Head Nurse" })).status, 422, "password is required");
  assert.equal((await as(ADMIN, "PATCH", `/api/admin/users/${r.data.id}`, { password: "Reset#Pass2" })).status, 200);
  assert.equal((await request("POST", "/api/auth/login", { body: { email: "new.nurse@samvaadhospital.in", password: "Typed#Pass1" } })).status, 401);
  assert.equal((await request("POST", "/api/auth/login", { body: { email: "new.nurse@samvaadhospital.in", password: "Reset#Pass2" } })).status, 200);
});

test("a Doctor login is linked to a doctor record at creation, once, and only for the Doctor role", async () => {
  const doc = await as(ADMIN, "POST", "/api/doctors", { name: "Dr. Brand New", specialty: "General Physician", department: "OPD", phone: "1", experience: "1 yr" });
  assert.equal(doc.status, 201);
  const make = (email: string, role: string, doctorId?: number) =>
    as(ADMIN, "POST", "/api/admin/users", { name: "Dr. Brand New", email, password: "Typed#Pass1", role, doctorId });
  assert.equal((await make("x1@samvaadhospital.in", "Receptionist", doc.data.id)).status, 400, "only the Doctor role can link");
  const ok = await make("brand.new@samvaadhospital.in", "Doctor", doc.data.id);
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal(ok.data.doctorId, doc.data.id);
  assert.equal((await make("x2@samvaadhospital.in", "Doctor", doc.data.id)).status, 409, "one login per doctor");
  assert.equal((await make("x3@samvaadhospital.in", "Doctor", 99999)).status, 404, "unknown doctor");
  // the new login is a real doctor session: it sees its own doctor id and can open its schedule
  const login = await request("POST", "/api/auth/login", { body: { email: "brand.new@samvaadhospital.in", password: "Typed#Pass1" } });
  assert.equal(login.status, 200);
  cookies.set("brand.new@samvaadhospital.in", (login.headers.get("set-cookie") ?? "").split(";")[0]);
  const me = await as("brand.new@samvaadhospital.in", "GET", "/api/auth/me");
  assert.equal(me.data.doctorId, doc.data.id);
  assert.equal((await as("brand.new@samvaadhospital.in", "GET", `/api/doctors/${doc.data.id}/schedule`)).status, 200);
  // moving them off the Doctor role drops the link
  const moved = await as(ADMIN, "PATCH", `/api/admin/users/${ok.data.id}`, { role: "Receptionist" });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.doctorId, null);
});

test("profile requires a login", async () => {
  assert.equal((await request("PATCH", "/api/auth/profile", { body: { name: "x y" } })).status, 401);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}`); console.log("        " + String((err as Error).stack ?? err).split("\n").slice(0, 7).join("\n        ")); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
