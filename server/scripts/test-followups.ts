/**
 * Tests for Follow-ups: booking, marking Done / Missed (and who marked), rescheduling, the due counts,
 * the analytics numbers, permissions. In-process, in-memory database (which seeds ~80 follow-ups).
 *
 *   npm run test:followups
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { followupsRepo } = await import("@/repositories");
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
const DOCTOR = "sophia.adams@samvaadhospital.in"; // linked to doctor 2
const NURSE = "rekha.menon@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const iso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("a follow-up is booked for a patient with a date; it starts Pending and remembers who booked it", async () => {
  const r = await as(RECEPTION, "POST", "/api/followups", { patientId: 1, doctorId: 2, reason: "Suture removal", dueOn: iso(7) });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.createdByRole, r.data.patientName, r.data.doctor, r.data.resolvedBy], ["Pending", "Receptionist", "Olivia Turner", "Dr. Sophia Adams", null]);
  assert.match(r.data.patientCode, /^HMS-/);
  const byDoctor = await as(DOCTOR, "POST", "/api/followups", { patientId: 2, reason: "Review labs", dueOn: iso(3) });
  assert.equal(byDoctor.data.createdByRole, "Doctor");
  assert.equal(byDoctor.data.doctorId, 2, "a doctor's own booking is assigned to them");
});

test("bad bookings are refused", async () => {
  for (const bad of [{ reason: "x", dueOn: iso(1) }, { patientId: 1, dueOn: iso(1) }, { patientId: 1, reason: "Ok reason", dueOn: "soon" }, { patientId: 9999, reason: "Ok reason", dueOn: iso(1) }]) {
    const r = await as(RECEPTION, "POST", "/api/followups", bad);
    assert.ok(r.status === 422 || r.status === 404, `${JSON.stringify(bad)} → ${r.status}`);
  }
});

test("marking Done or Missed records who did it and in what role; marking twice is refused", async () => {
  const f = (await as(RECEPTION, "POST", "/api/followups", { patientId: 3, doctorId: 1, reason: "Mark test", dueOn: iso(0) })).data;
  const done = await as(RECEPTION, "POST", `/api/followups/${f.id}/done`);
  assert.deepEqual([done.status, done.data.status, done.data.resolvedByRole, done.data.resolvedOn], [200, "Done", "Receptionist", iso(0)]);
  assert.equal((await as(RECEPTION, "POST", `/api/followups/${f.id}/done`)).status, 409);
  const missed = await as(DOCTOR, "POST", `/api/followups/${f.id}/missed`);
  assert.deepEqual([missed.data.status, missed.data.resolvedByRole], ["Missed", "Doctor"], "the latest mark wins and is credited to whoever made it");
});

test("a missed follow-up can be rescheduled back onto the list; a past date is refused; reopen undoes a mark", async () => {
  const f = (await as(RECEPTION, "POST", "/api/followups", { patientId: 4, reason: "Reschedule test", dueOn: iso(0) })).data;
  await as(RECEPTION, "POST", `/api/followups/${f.id}/missed`);
  assert.equal((await as(RECEPTION, "POST", `/api/followups/${f.id}/reschedule`, { dueOn: iso(-2) })).status, 422);
  const r = await as(RECEPTION, "POST", `/api/followups/${f.id}/reschedule`, { dueOn: iso(5) });
  assert.deepEqual([r.data.status, r.data.dueOn, r.data.reschedules, r.data.resolvedBy], ["Pending", iso(5), 1, null]);
  await as(RECEPTION, "POST", `/api/followups/${f.id}/done`);
  const reopened = await as(RECEPTION, "POST", `/api/followups/${f.id}/reopen`);
  assert.deepEqual([reopened.data.status, reopened.data.resolvedBy], ["Pending", null]);
  assert.equal((await as(RECEPTION, "POST", `/api/followups/${f.id}/reopen`)).status, 409);
});

test("the list is soonest-due first and filters by status; the summary splits overdue, today and the next 14 days", async () => {
  const list = (await as(RECEPTION, "GET", "/api/followups?all=true&status=Pending")).data as { dueOn: string; status: string }[];
  assert.ok(list.length > 0 && list.every(f => f.status === "Pending"));
  assert.deepEqual(list.map(f => f.dueOn), list.map(f => f.dueOn).slice().sort());
  const before = (await as(RECEPTION, "GET", "/api/followups/summary")).data;
  await as(RECEPTION, "POST", "/api/followups", { patientId: 5, reason: "Summary today", dueOn: iso(0) });
  await as(RECEPTION, "POST", "/api/followups", { patientId: 5, reason: "Summary soon", dueOn: iso(10) });
  await as(RECEPTION, "POST", "/api/followups", { patientId: 5, reason: "Summary far", dueOn: iso(40) });
  const after = (await as(RECEPTION, "GET", "/api/followups/summary")).data;
  assert.equal(after.dueToday, before.dueToday + 1);
  assert.equal(after.next14, before.next14 + 1, "only the one inside 14 days");
  assert.equal(after.pending, before.pending + 3);
  assert.equal(after.overdue, before.overdue);
});

test("analytics: per-day counts add up to the totals, and the totals match the rows in the period", async () => {
  const a = (await as(ADMIN, "GET", "/api/followups/analytics?days=30")).data;
  assert.equal(a.period.bucket, "day");
  assert.equal(a.buckets.length, 30);
  const sum = (k: string) => a.buckets.reduce((n: number, b: Record<string, number>) => n + b[k], 0);
  assert.deepEqual([sum("done"), sum("missed"), sum("due"), sum("upcoming")], [a.totals.done, a.totals.missed, a.totals.due, a.totals.upcoming]);
  assert.equal(a.totals.scheduled, a.totals.done + a.totals.missed + a.totals.due + a.totals.upcoming);
  // recompute straight from the stored rows
  const { rows } = await followupsRepo.listRows({ unpaged: true });
  const inWindow = rows.filter(r => r.due_on >= a.period.from && r.due_on <= a.period.to && r.hospital_id === 1);
  assert.equal(inWindow.length, a.totals.scheduled);
  assert.equal(inWindow.filter(r => r.status === "Done").length, a.totals.done);
  assert.equal(inWindow.filter(r => r.status === "Missed").length, a.totals.missed);
  assert.equal(inWindow.filter(r => r.status === "Pending").length, a.totals.due, "pending inside the window means its date has been reached");
  const kept = a.totals.done + a.totals.missed ? Math.round((a.totals.done / (a.totals.done + a.totals.missed)) * 1000) / 10 : null;
  assert.equal(a.totals.keptRate, kept);
});

test("analytics split by who booked and who marked, and by doctor; the 12-month view buckets by week; a doctor filter narrows everything", async () => {
  const a = (await as(ADMIN, "GET", "/api/followups/analytics?days=90")).data;
  assert.deepEqual(a.byRole.map((r: { role: string }) => r.role), ["Doctor", "Receptionist", "Others"]);
  const sumRole = (k: string) => a.byRole.reduce((n: number, r: Record<string, number>) => n + r[k], 0);
  assert.equal(sumRole("booked"), a.totals.scheduled, "every follow-up was booked by someone");
  assert.equal(sumRole("markedDone"), a.totals.done);
  assert.equal(sumRole("markedMissed"), a.totals.missed);
  assert.equal(a.byDoctor.reduce((n: number, d: { total: number }) => n + d.total, 0), a.totals.scheduled);
  const year = (await as(ADMIN, "GET", "/api/followups/analytics?days=365")).data;
  assert.equal(year.period.bucket, "week");
  assert.equal(year.buckets.length, Math.ceil(365 / 7));
  const one = a.byDoctor[0];
  const narrowed = (await as(ADMIN, "GET", `/api/followups/analytics?days=90&doctorId=${one.doctorId}`)).data;
  assert.equal(narrowed.totals.scheduled, one.total);
  assert.equal(narrowed.byDoctor.length, 1);
});

test("permissions: doctor and front desk can write, a nurse can only read, billing can't see it, and it needs a login", async () => {
  assert.equal((await as(NURSE, "GET", "/api/followups/summary")).status, 200);
  assert.equal((await as(NURSE, "POST", "/api/followups", { patientId: 1, reason: "Not allowed", dueOn: iso(1) })).status, 403);
  assert.equal((await as(BILLING, "GET", "/api/followups")).status, 403);
  assert.equal((await request("GET", "/api/followups/analytics")).status, 401);
  const f = (await as(RECEPTION, "POST", "/api/followups", { patientId: 6, reason: "Delete me", dueOn: iso(2) })).data;
  assert.equal((await as(RECEPTION, "DELETE", `/api/followups/${f.id}`)).status, 204);
  assert.equal((await as(RECEPTION, "GET", `/api/followups/${f.id}`)).status, 404);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
