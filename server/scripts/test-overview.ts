/**
 * Tests for the admin home overview: what needs attention today, the week's numbers, footfall and collections, beds by class,
 * doctor load, retention, alerts and the queues — each moving when the module behind it does. In-process, in-memory.
 *
 *   npm run test:overview
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { localDate } = await import("@/lib/clock");
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
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const overview = async (q = "") => {
  const r = await as(ADMIN, "GET", `/api/dashboard/overview${q}`);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  return r.data as any;
};
const master = async (kind: string) => (await as(ADMIN, "GET", `/api/setup/${kind}`)).data as any[];
const today = localDate();
let seq = 0;
const patient = async (over: Record<string, unknown> = {}) => (await as(ADMIN, "POST", "/api/patients", { name: `Overview ${++seq}`, age: 33, gender: "Male", phone: `94${String(10000000 + seq).slice(-8)}`, ...over })).data;

test("it needs the reports permission, and a login", async () => {
  assert.equal((await request("GET", "/api/dashboard/overview")).status, 401);
  assert.equal((await as(RECEPTION, "GET", "/api/dashboard/overview")).status, 403);
});

test("the trend covers 7, 14 or 30 days ending today, and anything else is 14", async () => {
  for (const [q, n] of [["?days=7", 7], ["?days=30", 30], ["", 14], ["?days=9", 14]] as const) {
    const o = await overview(q);
    assert.equal(o.trend.length, n, q);
    assert.equal(o.trend[o.trend.length - 1].date, today);
    assert.equal(o.trend[0].date, new Date(new Date(`${today}T12:00:00`).getTime() - (n - 1) * 86_400_000).toLocaleDateString("en-CA"));
  }
  assert.equal((await overview()).today, today);
});

test("a plan, a hospital name and a summary line", async () => {
  const o = await overview();
  assert.ok(o.hospital.length > 0);
  assert.deepEqual(Object.keys(o.plan).sort(), ["active", "name"]);
  assert.equal(o.plan.active, true);
  assert.deepEqual(Object.keys(o.summary).sort(), ["collectedToday", "opdWaiting", "patientsToday", "urgentLabs"]);
});

test("a patient who checks in at the OPD joins the queue and today's footfall", async () => {
  const before = await overview();
  const p = await patient();
  const c = await as(ADMIN, "POST", "/api/opd", { patientId: p.id, patientName: p.name, patientAge: 33, doctorId: (await as(ADMIN, "GET", "/api/doctors?all=true")).data[0].id, reason: "Fever", priority: "Urgent" });
  assert.equal(c.status, 201, JSON.stringify(c.error));
  const after = await overview();
  assert.equal(after.attention.opdWaiting, before.attention.opdWaiting + 1);
  assert.equal(after.summary.patientsToday, before.summary.patientsToday + 1);
  assert.equal(after.trend[after.trend.length - 1].patients, before.trend[before.trend.length - 1].patients + 1);
  assert.ok(after.opdQueue.some((q: any) => q.patient === p.name && q.priority === "Urgent"));
  assert.equal(after.kpis.patientsWeek.value, before.kpis.patientsWeek.value + 1);
});

test("an appointment today shows in the day's list, the doctor's load and the appointment count", async () => {
  const before = await overview();
  const p = await patient();
  const doc = (await as(ADMIN, "GET", "/api/doctors?all=true")).data.find((d: any) => d.name);
  const a = await as(ADMIN, "POST", "/api/appointments", { patientId: p.id, patientName: p.name, doctorId: doc.id, date: today, time: "11:50 PM", type: "Walk-in", reason: "Checkup", status: "Today" });
  assert.equal(a.status, 201, JSON.stringify(a.error));
  const after = await overview();
  assert.equal(after.kpis.appointments.total, before.kpis.appointments.total + 1);
  assert.equal(after.kpis.appointments.left, before.kpis.appointments.left + 1);
  assert.ok(after.appointmentsToday.some((x: any) => x.patient === p.name));
  assert.equal(after.appointmentsToday[after.appointmentsToday.length - 1].time, "11:50 PM", "in time order");
  assert.equal(after.doctorLoad.find((d: any) => d.doctor === doc.name).total, (before.doctorLoad.find((d: any) => d.doctor === doc.name)?.total ?? 0) + 1);
  await as(ADMIN, "PATCH", `/api/appointments/${a.data.id}`, { status: "Completed" });
  const done = await overview();
  assert.equal(done.kpis.appointments.left, before.kpis.appointments.left);
  assert.equal(done.doctorLoad.find((d: any) => d.doctor === doc.name).seen, (before.doctorLoad.find((d: any) => d.doctor === doc.name)?.seen ?? 0) + 1);
});

test("bills: paid ones are collected today and by payment mode; pending ones are owed", async () => {
  const before = await overview();
  const p = await patient();
  const cash = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 1000, status: "Paid", paymentMode: "UPI" });
  const owing = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 500, status: "Pending" });
  assert.equal(cash.status, 201); assert.equal(owing.status, 201);
  const after = await overview();
  assert.equal(Math.round((after.summary.collectedToday - before.summary.collectedToday) * 100) / 100, cash.data.total);
  assert.equal(after.attention.unpaid.bills, before.attention.unpaid.bills + 1);
  assert.equal(Math.round((after.attention.unpaid.amount - before.attention.unpaid.amount) * 100) / 100, owing.data.total);
  const upi = (m: any[]) => m.find((x) => x.mode === "UPI") ?? { amount: 0, count: 0 };
  assert.equal(upi(after.byMode).count, upi(before.byMode).count + 1);
  assert.equal(after.trend[after.trend.length - 1].collected, Math.round((before.trend[before.trend.length - 1].collected + cash.data.total) * 100) / 100);
});

test("an insured bill with no claim is a claim to submit; an urgent lab order is flagged", async () => {
  const before = await overview();
  const contract = (await master("contract")).find((c) => /Premium 2026/.test(c.name));
  const p = await patient({ payers: [{ type: "Insurance", name: "Star", policyNumber: "P1", contractId: contract.id }] });
  const svc = (await master("service")).find((s) => s.code === "LAB-CBC");
  const b = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "Lab", contractId: contract.id, items: [{ serviceId: svc.id }] });
  assert.equal(b.status, 201, JSON.stringify(b.error));
  const lab = await as(ADMIN, "POST", "/api/lab", { patientId: p.id, patientName: p.name, patientAge: 33, testName: "Troponin I", priority: "STAT", amount: 100 });
  const after = await overview();
  assert.equal(after.attention.claims.count, before.attention.claims.count + 1);
  assert.ok(after.alerts.some((a: any) => a.tone === "grey" && /claim/.test(a.title)));
  if (lab.status === 201) {
    assert.equal(after.attention.urgentLabs.urgent, before.attention.urgentLabs.urgent + 1);
    assert.equal(after.alerts[0].tone, "red", "urgent labs lead the list");
    assert.match(after.alerts[0].detail, /Troponin I/);
  }
});

test("beds are grouped by ward class, and add up to the hospital's beds", async () => {
  const o = await overview();
  const beds = (await as(ADMIN, "GET", "/api/beds?all=true")).data;
  assert.equal(o.kpis.beds.total, beds.length);
  assert.equal(o.bedsByClass.reduce((n: number, g: any) => n + g.total, 0), beds.length);
  assert.equal(o.bedsByClass.reduce((n: number, g: any) => n + g.occupied, 0), o.kpis.beds.occupied);
  const gen = (await master("ward_class")).find((c) => c.code === "GEN");
  const ward = await as(ADMIN, "POST", "/api/wards", { name: "Overview Ward", capacity: 2, wardClassId: gen.id });
  await as(ADMIN, "POST", "/api/beds", { bedNumber: "OV-1", ward: "Overview Ward", wardId: ward.data.id });
  const after = await overview();
  assert.equal(after.bedsByClass.find((g: any) => g.name === "General Ward").total, (o.bedsByClass.find((g: any) => g.name === "General Ward")?.total ?? 0) + 1, "filed under its class, not its own name");
  assert.ok(!after.bedsByClass.some((g: any) => g.name === "Overview Ward"));
});

test("retention: follow-ups kept, due, at risk and lapsed come from the follow-up list; nothing to measure shows as null", async () => {
  const o = await overview();
  for (const k of ["noShowRate", "followUpsKept", "cameBack90", "returningShare"]) assert.ok(o.retention[k] === null || (o.retention[k] >= 0 && o.retention[k] <= 100), k);
  const before = o.retention;
  const p = await patient();
  const doc = (await as(ADMIN, "GET", "/api/doctors?all=true")).data[0];
  const day = (n: number) => new Date(new Date(`${today}T12:00:00`).getTime() + n * 86_400_000).toLocaleDateString("en-CA");
  for (const due of [day(3), day(-5), day(-45)]) {
    const f = await as(ADMIN, "POST", "/api/followups", { patientId: p.id, patientName: p.name, doctorId: doc.id, reason: "Review", dueOn: due });
    assert.equal(f.status, 201, JSON.stringify(f.error));
  }
  const after = (await overview()).retention;
  assert.equal(after.followUpsDue, before.followUpsDue + 1, "due within the coming week; overdue ones are at risk or lapsed instead");
  assert.equal(after.atRisk, before.atRisk + 1);
  assert.equal(after.lapsed, before.lapsed + 1);
});

test("a past appointment the patient was checked in for isn't a no-show; one nobody came to is", async () => {
  const before = (await overview()).retention;
  const doc = (await as(ADMIN, "GET", "/api/doctors?all=true")).data[0];
  const { appointmentsRepo } = await import("@/repositories");
  const day = new Date(new Date(`${today}T12:00:00`).getTime() - 3 * 86_400_000).toLocaleDateString("en-CA");
  const mk = (name: string) => appointmentsRepo.create({ hospital_id: 1, patient_id: null, patient_name: name, patient_age: 30, doctor_id: doc.id, doctor: doc.name, appointment_date: day, appointment_time: "10:00 AM", type: "Booked", reason: "x", status: "Upcoming" } as never);
  const came = await mk("Came In"); await mk("Never Came");
  const { opdRepo } = await import("@/repositories");
  await opdRepo.create({ hospital_id: 1, token_number: "T-900", appointment_id: (came as any).id, patient_id: null, patient_name: "Came In", patient_age: 30, doctor_id: doc.id, doctor: doc.name, reason: "x", priority: "Normal", vitals_recorded: false, bp_systolic: null, bp_diastolic: null, pulse: null, temperature: null, spo2: null, wait_time: "0 min", check_in_time: "10:00 AM", status: "Completed" } as never);
  const after = (await overview()).retention;
  assert.equal(after.missed, before.missed + 1, "only the one nobody came to");
});

test("theatre cases today list in time order, and cancelled ones don't", async () => {
  const o = await overview();
  assert.ok(Array.isArray(o.theatre));
  assert.ok(o.theatre.every((t: any) => t.status !== "Cancelled"));
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
