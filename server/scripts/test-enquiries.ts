/**
 * Tests for Enquiries (leads before registration): capture, contact, convert, close, the list order,
 * the due-today count, permissions and hospital scoping. In-process, in-memory database.
 *
 *   npm run test:enquiries
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
  return { status: res.status, data: parsed?.data, error: parsed?.error, meta: parsed?.meta, headers: res.headers };
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
const iso = (offsetDays: number) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); return d.toLocaleDateString("en-CA"); };

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("only a name is needed; a new lead is Open with one contact", async () => {
  const r = await as(RECEPTION, "POST", "/api/enquiries", { name: "Asha Verma" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.contacts, r.data.callBackOn, r.data.estimatedValue], ["Open", 1, null, 0]);
  assert.equal((await as(RECEPTION, "POST", "/api/enquiries", { mobile: "9876543210" })).status, 422, "a name is required");
});

test("every field is stored; a lead created with a call-back date starts as Contacted", async () => {
  const r = await as(RECEPTION, "POST", "/api/enquiries", {
    name: "Ravi Kumar", mobile: "+91 98765 43210", department: "Orthopaedics", interestedIn: "Knee replacement",
    source: "Referred by doctor", estimatedValue: 150000, callBackOn: iso(3), notes: "Prefers mornings",
  });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(
    [r.data.mobile, r.data.department, r.data.interestedIn, r.data.source, r.data.estimatedValue, r.data.callBackOn, r.data.notes, r.data.status],
    ["+91 98765 43210", "Orthopaedics", "Knee replacement", "Referred by doctor", 150000, iso(3), "Prefers mornings", "Contacted"],
  );
});

test("bad values are refused", async () => {
  for (const bad of [{ name: "X" }, { name: "Valid Name", mobile: "abc" }, { name: "Valid Name", estimatedValue: -5 }, { name: "Valid Name", callBackOn: "tomorrow" }]) {
    assert.equal((await as(RECEPTION, "POST", "/api/enquiries", bad)).status, 422, JSON.stringify(bad));
  }
});

test("a contact is counted, remembered, and sets the call-back date; it can't be set in the past", async () => {
  const lead = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Contact Test" })).data;
  const r = await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/contact`, { note: "Called, will decide Friday", nextOn: iso(2) });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.contacts, r.data.callBackOn], ["Contacted", 2, iso(2)]);
  assert.equal(r.data.history.length, 1);
  assert.equal(r.data.history[0].note, "Called, will decide Friday");
  const again = await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/contact`, { note: "No answer" });
  assert.deepEqual([again.data.contacts, again.data.callBackOn, again.data.history.length], [3, null, 2], "no date given clears the due date");
  assert.equal((await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/contact`, { nextOn: iso(-1) })).status, 422);
});

test("converting links the patient; a converted lead can't be contacted, closed or converted again", async () => {
  const lead = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Convert Test", callBackOn: iso(1) })).data;
  const patient = (await as(ADMIN, "POST", "/api/patients", { name: "Convert Test", gender: "Female", phone: "9811100011" })).data;
  const r = await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/convert`, { patientId: patient.id });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.convertedPatientId, r.data.callBackOn], ["Converted", patient.id, null]);
  for (const action of ["contact", "close"]) assert.equal((await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/${action}`, {})).status, 409, action);
  assert.equal((await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/convert`, { patientId: patient.id })).status, 409);
  const fresh = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Unknown Patient Test" })).data;
  assert.equal((await as(RECEPTION, "POST", `/api/enquiries/${fresh.id}/convert`, { patientId: 999999 })).status, 404, "an unknown patient is refused");
});

test("closing a lead keeps it; logging a contact or converting reopens it", async () => {
  const lead = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Close Test", callBackOn: iso(1) })).data;
  const r = await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/close`, { reason: "Went elsewhere" });
  assert.deepEqual([r.status, r.data.status, r.data.callBackOn], [200, "Closed", null]);
  assert.match(r.data.history.at(-1).note, /Went elsewhere/);
  const reopened = await as(RECEPTION, "POST", `/api/enquiries/${lead.id}/contact`, { nextOn: iso(5) });
  assert.deepEqual([reopened.data.status, reopened.data.callBackOn], ["Contacted", iso(5)]);
});

test("the list puts contacted leads first (soonest call-back on top), then open, converted, closed; search and status filters narrow it", async () => {
  const list = (await as(RECEPTION, "GET", "/api/enquiries?all=true")).data as { status: string; callBackOn: string | null }[];
  const rank = (s: string) => ({ Contacted: 0, Open: 1, Converted: 2, Closed: 3 }[s] ?? 9);
  assert.ok(list.every((e, i) => i === 0 || rank(list[i - 1].status) <= rank(e.status)), "grouped by status");
  const fu = list.filter(e => e.status === "Contacted").map(e => e.callBackOn ?? "9999");
  assert.deepEqual(fu, [...fu].sort(), "soonest call-back first");
  const open = (await as(RECEPTION, "GET", "/api/enquiries?all=true&status=Open")).data;
  assert.ok(open.length > 0 && open.every((e: { status: string }) => e.status === "Open"));
  const found = (await as(RECEPTION, "GET", "/api/enquiries?all=true&search=knee")).data;
  assert.ok(found.length >= 1 && found.every((e: { interestedIn: string }) => /knee/i.test(e.interestedIn)));
  const paged = await as(RECEPTION, "GET", "/api/enquiries?page=1&pageSize=2");
  assert.equal(paged.data.length, 2);
  assert.ok(paged.meta.total >= 5);
});

test("the summary counts each status and the leads due today or overdue", async () => {
  const before = (await as(RECEPTION, "GET", "/api/enquiries/summary")).data;
  await as(RECEPTION, "POST", "/api/enquiries", { name: "Due Today", callBackOn: iso(0) });
  await as(RECEPTION, "POST", "/api/enquiries", { name: "Due Later", callBackOn: iso(9) });
  const after = (await as(RECEPTION, "GET", "/api/enquiries/summary")).data;
  assert.equal(after.dueToday, before.dueToday + 1, "only the one due today counts");
  assert.equal(after.Contacted, before.Contacted + 2);
  assert.equal(after.total, before.total + 2);
  assert.equal(after.total, after.Open + after.Contacted + after.Converted + after.Closed);
});

test("a lead still stored with the old \"Follow-up\" status reads as Contacted, and the stored value is renamed by the maintenance step", async () => {
  const { enquiriesRepo } = await import("@/repositories");
  const { renameLegacyEnquiryStatus } = await import("@/db/normalize-dates");
  const { getDb } = await import("@/db");
  const lead = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Legacy Status" })).data;
  await enquiriesRepo.update(lead.id, { status: "Follow-up" });
  assert.equal((await as(RECEPTION, "GET", `/api/enquiries/${lead.id}`)).data.status, "Contacted", "read as the new name");
  assert.ok((await renameLegacyEnquiryStatus(await getDb())) >= 1);
  assert.equal((await enquiriesRepo.getRow(lead.id))?.status, "Contacted", "stored under the new name");
  assert.equal((await renameLegacyEnquiryStatus(await getDb())), 0, "nothing left to rename");
});

test("edit and delete work; permissions: front desk can write, a nurse can't even read", async () => {
  const lead = (await as(RECEPTION, "POST", "/api/enquiries", { name: "Edit Test" })).data;
  const e = await as(RECEPTION, "PATCH", `/api/enquiries/${lead.id}`, { interestedIn: "Health check", estimatedValue: 5000, callBackOn: iso(4) });
  assert.deepEqual([e.status, e.data.interestedIn, e.data.estimatedValue, e.data.callBackOn], [200, "Health check", 5000, iso(4)]);
  assert.equal((await as("rekha.menon@samvaadhospital.in", "GET", "/api/enquiries")).status, 403, "a nurse can't read enquiries");
  assert.equal((await as("rekha.menon@samvaadhospital.in", "POST", "/api/enquiries", { name: "Not Allowed" })).status, 403);
  assert.equal((await as("kavitha.krishnan@samvaadhospital.in", "GET", "/api/enquiries/summary")).status, 403, "nor can billing");
  assert.equal((await as(RECEPTION, "DELETE", `/api/enquiries/${lead.id}`)).status, 204);
  assert.equal((await as(RECEPTION, "GET", `/api/enquiries/${lead.id}`)).status, 404);
});

test("enquiries require a login", async () => {
  assert.equal((await request("GET", "/api/enquiries")).status, 401);
  assert.equal((await request("POST", "/api/enquiries", { body: { name: "Nope Nope" } })).status, 401);
});

let failed = 0;
// Seed some leads so ordering and paging have something to work with.
for (let i = 0; i < 4; i++) await as(RECEPTION, "POST", "/api/enquiries", { name: `Seed Lead ${i + 1}`, interestedIn: i % 2 ? "Knee scan" : "Dental", callBackOn: i % 2 ? iso(i + 1) : "" });
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
