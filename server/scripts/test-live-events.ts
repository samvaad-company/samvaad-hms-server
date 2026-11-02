/**
 * Tests for the live dashboard events: GET /api/events/stream delivers a new appointment to the open dashboards of its hospital
 * (a doctor's dashboard: only their own), and to nobody else. In-process, in-memory.
 *
 *   npm run test:liveevents
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { localDate } = await import("@/lib/clock");
const { publishAppointmentCreatedFromFeed } = await import("@/services/live-events");
const { appointmentsRepo } = await import("@/repositories");
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
async function cookieFor(email: string, password: string) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password } });
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
async function as(email: string, method: string, path: string, body?: unknown, password = "Samvaad@123") {
  return request(method, path, { body, headers: { cookie: await cookieFor(email, password) } });
}

/** Open the stream as `email` and collect what it sends. */
async function listen(email: string, password = "Samvaad@123") {
  const ac = new AbortController();
  const res = await app.fetch(new Request("http://localhost/api/events/stream", { headers: { cookie: await cookieFor(email, password) }, signal: ac.signal }));
  const out = { status: res.status, type: res.headers.get("content-type") ?? "", raw: "", events: [] as { event: string; data: any; id?: string }[], close: () => ac.abort() };
  if (res.status !== 200 || !res.body) return out;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  void (async () => {
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        out.raw += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(block)?.[1]; const data = /^data: (.+)$/m.exec(block)?.[1]; const id = /^id: (.+)$/m.exec(block)?.[1];
          if (ev && data) out.events.push({ event: ev, data: JSON.parse(data), id });
        }
      }
    } catch { /* aborted */ }
  })();
  return out;
}
const until = async (cond: () => boolean, ms = 3000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 25)); return cond(); };
const quiet = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const PLATFORM = "platform-admin@samvaad.dev";
const ADMIN = "kevin.carter@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const DOCTOR2 = "sophia.adams@samvaadhospital.in"; // linked to doctor 2
const today = localDate();

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const walkIn = (doctorId: number, name: string, by = RECEPTION) =>
  as(by, "POST", "/api/appointments", { patientName: name, doctorId, date: today, time: "10:00 AM", type: "Walk-in", reason: "check-up", status: "Today" });

test("only the hospital admin, the front desk and doctors may open the stream", async () => {
  const anon = await app.fetch(new Request("http://localhost/api/events/stream"));
  assert.equal(anon.status, 401);
  const open = async (email: string) => (await app.fetch(new Request("http://localhost/api/events/stream", { headers: { cookie: await cookieFor(email, "Samvaad@123") } }))).status;
  for (const [who, email] of [["pharmacist", "arun.tiwari@samvaadhospital.in"], ["billing", "kavitha.krishnan@samvaadhospital.in"], ["head nurse", "rekha.menon@samvaadhospital.in"]] as const) {
    assert.equal(await open(email), 403, `${who} is not sent appointment events`);
  }
  assert.equal(await open(PLATFORM), 403, "nor is the platform operator");
});

test("it opens as an event stream and says it is ready", async () => {
  const s = await listen(ADMIN);
  assert.equal(s.status, 200);
  assert.match(s.type, /text\/event-stream/);
  assert.ok(await until(() => s.events.some((e) => e.event === "ready")), s.raw);
  s.close();
});

test("a new appointment reaches the hospital's open dashboards at once, in the shape the appointments list uses", async () => {
  const [a, r, d2] = await Promise.all([listen(ADMIN), listen(RECEPTION), listen(DOCTOR2)]);
  await until(() => [a, r, d2].every((s) => s.events.some((e) => e.event === "ready")));
  const made = await walkIn(2, "Live Patient One");
  assert.equal(made.status, 201, JSON.stringify(made.error));
  for (const s of [a, r, d2]) {
    assert.ok(await until(() => s.events.some((e) => e.event === "appointment.created")), "delivered");
    const ev = s.events.find((e) => e.event === "appointment.created")!;
    assert.equal(ev.data.type, "appointment.created");
    assert.equal(ev.data.data.id, made.data.id);
    assert.deepEqual(ev.data.data, made.data, "the same shape as the API's own answer");
    assert.ok(ev.id);
    assert.equal(ev.data.source, "staff");
    assert.equal(ev.data.by.name, "Deepak Nair", "who booked it, so their own screen needn't announce it back");
  }
  [a, r, d2].forEach((s) => s.close());
});

test("a doctor is sent only their own appointments", async () => {
  const d2 = await listen(DOCTOR2);
  const admin = await listen(ADMIN);
  await until(() => d2.events.some((e) => e.event === "ready") && admin.events.some((e) => e.event === "ready"));
  const other = await walkIn(3, "Someone Else's Patient"); // doctor 3's
  assert.equal(other.status, 201);
  assert.ok(await until(() => admin.events.some((e) => e.event === "appointment.created")));
  await quiet();
  assert.equal(d2.events.filter((e) => e.event === "appointment.created").length, 0, "doctor 2 hears nothing about doctor 3's patient");
  const mine = await walkIn(2, "Doctor Two's Patient");
  assert.ok(await until(() => d2.events.some((e) => e.event === "appointment.created")));
  assert.equal(d2.events.find((e) => e.event === "appointment.created")!.data.data.id, mine.data.id);
  d2.close(); admin.close();
});

test("a doctor login that isn't linked to a doctor record is sent nothing", async () => {
  const made = await as(ADMIN, "POST", "/api/admin/users", { name: "Unlinked Doc", email: "unlinked.doc@samvaadhospital.in", password: "Samvaad@123", role: "Doctor" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  const unlinked = await listen("unlinked.doc@samvaadhospital.in");
  const admin = await listen(ADMIN);
  await until(() => unlinked.events.some((e) => e.event === "ready") && admin.events.some((e) => e.event === "ready"));
  await walkIn(2, "Nobody's Doctor Sees This");
  assert.ok(await until(() => admin.events.some((e) => e.event === "appointment.created")));
  await quiet();
  assert.equal(unlinked.events.filter((e) => e.event === "appointment.created").length, 0);
  unlinked.close(); admin.close();
});

test("another hospital hears nothing", async () => {
  const mk = await as(PLATFORM, "POST", "/api/hospitals", { name: "Quiet Clinic", adminName: "Q Admin", adminEmail: "admin@quiet.test", adminPassword: "Quiet@12345" });
  assert.equal(mk.status, 201);
  const quietAdmin = await listen("admin@quiet.test", "Quiet@12345");
  const ours = await listen(ADMIN);
  await until(() => quietAdmin.events.some((e) => e.event === "ready") && ours.events.some((e) => e.event === "ready"));
  await walkIn(2, "Not For Quiet Clinic");
  assert.ok(await until(() => ours.events.some((e) => e.event === "appointment.created")));
  await quiet(400);
  assert.equal(quietAdmin.events.filter((e) => e.event === "appointment.created").length, 0);
  quietAdmin.close(); ours.close();
});

test("a booked appointment (through the doctor's schedule) is announced too", async () => {
  const s = await listen(ADMIN);
  await until(() => s.events.some((e) => e.event === "ready"));
  let booked: Awaited<ReturnType<typeof as>> | null = null;
  for (let i = 1; i <= 10 && !booked?.data; i++) {
    const day = new Date(Date.now() + i * 86_400_000).toLocaleDateString("en-CA");
    const slots = (await as(ADMIN, "GET", `/api/appointments/slots?doctorId=3&date=${day}`)).data;
    const free = (slots?.slots ?? []).find((x: any) => !x.full && !x.disabled) ?? slots?.slots?.[0];
    if (!free) continue;
    const r = await as(ADMIN, "POST", "/api/appointments", { patientName: "Booked Live", doctorId: 3, date: day, time: free.value ?? free.label, type: "Booked", reason: "x" });
    if (r.status === 201) booked = r;
  }
  assert.ok(booked, "booked an appointment");
  assert.ok(await until(() => s.events.some((e) => e.event === "appointment.created" && e.data.data.id === booked!.data.id)));
  s.close();
});

test("an appointment announced twice (by the code that saved it and by the database feed) is delivered once", async () => {
  const s = await listen(ADMIN);
  await until(() => s.events.some((e) => e.event === "ready"));
  const made = await walkIn(2, "Echo Patient");
  await until(() => s.events.some((e) => e.event === "appointment.created"));
  const row = await appointmentsRepo.getRow(made.data.id);
  publishAppointmentCreatedFromFeed(row as never, 10); // what the change feed does
  await quiet(300);
  assert.equal(s.events.filter((e) => e.event === "appointment.created" && e.data.data.id === made.data.id).length, 1);
  s.close();
});

test("an appointment that was saved and then removed (a lost booking race) is not announced from the feed", async () => {
  const s = await listen(ADMIN);
  await until(() => s.events.some((e) => e.event === "ready"));
  const row = await appointmentsRepo.create({ hospital_id: 1, patient_id: null, patient_name: "Phantom", patient_age: 30, doctor_id: 2, doctor: "Dr", appointment_date: today, appointment_time: "11:00 AM", type: "Booked", reason: "", status: "Upcoming" });
  await appointmentsRepo.remove(row.id);
  publishAppointmentCreatedFromFeed(row as never, 10);
  await quiet(300);
  assert.equal(s.events.filter((e) => e.event === "appointment.created").length, 0);
  s.close();
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
