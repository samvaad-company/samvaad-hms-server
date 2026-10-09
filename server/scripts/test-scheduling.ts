/**
 * Tests for doctor scheduling: patients per hour, in-person vs video hours,
 * the "this hour is full" message, and rescheduling by staff, doctors and
 * patients. In-process, in-memory database, fake Google — nothing leaves the
 * machine.
 *
 *   npm run test:scheduling          # one pass
 *   npm run test:scheduling -- 4     # four passes in a row
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});
delete process.env.RAZORPAY_KEY_ID; // staff bookings only: no gateway involved
delete process.env.RAZORPAY_KEY_SECRET;
const PORTAL_KEY = process.env.PORTAL_API_KEY!;

const { createApp } = await import("@/app");
const repos = await import("@/repositories");
const { appointmentsRepo, doctorsRepo, hospitalsRepo, googleConnectionsRepo, opdRepo, teleconsultBookingsRepo } = repos;
const { encryptToken } = await import("@/services/google-meet");
const { fullMessage } = await import("@/services/scheduling-service");

// ── Fake Google ──────────────────────────────────────────────────────────────

const CAL = "https://www.googleapis.com/auth/calendar.events";
const MEET = "https://www.googleapis.com/auth/meetings.space.created";
interface FakeEvent { id: string; location?: string; start?: { dateTime: string }; end?: { dateTime: string } }
const g = { events: new Map<string, FakeEvent>(), spaces: 0, patchFails: false, patches: [] as { id: string; start: string; end: string }[] };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const letters = (n: number) => String(n).split("").map((d) => "abcdefghij"[Number(d)]).join("");
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init?.method ?? "GET").toUpperCase();
  if (url.includes("oauth2.googleapis.com/token")) return json({ access_token: "tok", scope: `${CAL} ${MEET}` });
  if (url.startsWith("https://meet.googleapis.com/v2/spaces")) {
    g.spaces++;
    const code = `${letters(g.spaces)}-room-abc`;
    return json({ name: `spaces/${code}`, meetingUri: `https://meet.google.com/${code}`, meetingCode: code });
  }
  if (url.includes("www.googleapis.com/calendar/v3/calendars/primary/events")) {
    const path = url.split("/events")[1] ?? "";
    const id = decodeURIComponent(path.replace(/^\//, "").split("?")[0]);
    if (method === "POST") {
      const b = JSON.parse(String(init?.body)) as FakeEvent;
      // The real API only accepts base32hex ids (0-9, a-v), 5-1024 characters.
      if (!/^[0-9a-v]{5,1024}$/.test(b.id)) return json({ error: { message: "Invalid resource id value." } }, 400);
      if (g.events.has(b.id)) return json({ error: { message: "exists" } }, 409);
      g.events.set(b.id, b);
      return json(b);
    }
    if (method === "PATCH") {
      if (g.patchFails) return json({ error: { message: "Calendar is down" } }, 500);
      const ev = g.events.get(id);
      if (!ev) return json({ error: { message: "Not Found" } }, 404);
      const b = JSON.parse(String(init?.body)) as { start: { dateTime: string }; end: { dateTime: string } };
      ev.start = b.start;
      ev.end = b.end;
      g.patches.push({ id, start: b.start.dateTime, end: b.end.dateTime });
      return json(ev);
    }
    const ev = g.events.get(id);
    return ev ? json(ev) : json({ error: { message: "Not Found" } }, 404);
  }
  return realFetch(input, init);
}) as typeof fetch;

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
const portal = (method: string, path: string, body?: unknown) => request(method, path, { body, headers: { "x-portal-key": PORTAL_KEY } });

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
const admin = (m: string, p: string, b?: unknown) => as(ADMIN, m, p, b);
/** Receptionists can view but not book or move appointments in this system's permission matrix — used to prove that. */
const receptionOnly = (m: string, p: string, b?: unknown) => as(RECEPTION, m, p, b);
const doctor2 = (m: string, p: string, b?: unknown) => as(DOCTOR2, m, p, b);

// Dates: future weekdays (the seed hospital is open Mon–Fri 9–1 and 4–8, Saturday 9–2, closed Sunday).
const istDate = (offset: number) => new Date(Date.now() + offset * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dowOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
let dateCounter = 0;
/** A fresh future date on the given weekday (1=Mon … 6=Sat, 0=Sun), never reused within a run. */
function freshDate(dow: number): string {
  for (let i = 3 + dateCounter * 7; i < 3 + dateCounter * 7 + 60; i++) {
    const d = istDate(i);
    if (dowOf(d) === dow) { dateCounter++; return d; }
  }
  throw new Error("no date");
}
let doctorCounter = 0;
const DOCTORS = [1, 3, 4, 5, 6, 9, 10]; // not 2: that's the logged-in doctor, used on purpose elsewhere
const nextDoctor = () => DOCTORS[doctorCounter++ % DOCTORS.length];
let patientCounter = 0;
const nextPatient = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][patientCounter++ % 10];

type VideoWindow = { day: string; start: string; end: string };
async function setDoctor(id: number, cfg: { perHour?: number; video?: boolean; windows?: VideoWindow[]; status?: string }) {
  await doctorsRepo.update(id, {
    patients_per_hour: cfg.perHour ?? 2, video_enabled: cfg.video ?? false, video_hours: cfg.windows ?? [], status: cfg.status ?? "Active",
  });
}
async function hospitalVideo(on: boolean) {
  await hospitalsRepo.update(1, { teleconsult_enabled: on, teleconsult_price: 500, teleconsult_meet_access: "OPEN" });
}
async function connectGoogle() {
  const existing = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: 1 }]);
  if (!existing) await googleConnectionsRepo.create({ hospital_id: 1, account_email: "h@example.com", refresh_token_enc: await encryptToken("r"), connected_by: 1, scopes: `${CAL} ${MEET}`, needs_reconnect: false, last_error: null });
}

const staffBook = (doctorId: number, date: string, time: string, extra: Record<string, unknown> = {}) =>
  admin("POST", "/api/appointments", { patientId: nextPatient(), patientName: "Test Patient", doctorId, date, time, type: "Booked", reason: "check-up", status: "Upcoming", ...extra });
const portalBook = (doctorId: number, date: string, time: string, patientId = nextPatient()) =>
  portal("POST", "/api/portal/appointments", { patientId, doctorId, date, time, reason: "check-up" });
const slotsOf = async (doctorId: number, date: string, mode: "in_person" | "video" = "in_person") => {
  const r = await admin("GET", `/api/appointments/slots?doctorId=${doctorId}&date=${date}&mode=${mode}`);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  return r.data as { isOpen: boolean; closedReason: string | null; slotMinutes: number; patientsPerHour: number; slots: { value: string; status: string }[]; hours: { label: string; booked: number; capacity: number; full: boolean }[] };
};
const statusAt = (s: Awaited<ReturnType<typeof slotsOf>>, time: string) => s.slots.find((x) => x.value === time)?.status ?? "absent";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

// ── Patients per hour ────────────────────────────────────────────────────────

test("a doctor's patients-per-hour sets the slot length and how many fit in an hour", async () => {
  const doc = nextDoctor();
  const date = freshDate(3); // Wednesday: 9–13 and 16–20 = 8 open hours
  for (const [n, minutes] of [[1, 60], [2, 30], [4, 15], [6, 10], [12, 5]] as const) {
    await setDoctor(doc, { perHour: n });
    const s = await slotsOf(doc, date);
    assert.equal(s.slotMinutes, minutes, `${n}/hour → ${minutes}-minute slots`);
    assert.equal(s.patientsPerHour, n);
    assert.equal(s.slots.length, 8 * n, `${n}/hour over 8 open hours`);
    const nine = s.hours.find((h) => h.label.startsWith("9:00 AM"))!;
    assert.deepEqual([nine.booked, nine.capacity, nine.full], [0, n, false]);
  }
});

test("once the hour's places are taken nobody can book it, and everyone sees the same message", async () => {
  const doc = nextDoctor();
  const date = freshDate(2); // Tuesday
  await setDoctor(doc, { perHour: 2 });
  assert.equal((await staffBook(doc, date, "10:00")).status, 201);
  assert.equal((await portalBook(doc, date, "10:30")).status, 201);

  const s = await slotsOf(doc, date);
  assert.equal(statusAt(s, "10:00"), "booked");
  assert.equal(statusAt(s, "10:30"), "booked");
  assert.equal(statusAt(s, "11:00"), "open", "the next hour is untouched");
  const ten = s.hours.find((h) => h.label.startsWith("10:00 AM"))!;
  assert.deepEqual([ten.booked, ten.capacity, ten.full], [2, 2, true]);

  const doctorName = (await doctorsRepo.getRow(doc))!.name;
  const message = fullMessage(doctorName, 2);
  assert.match(message, /This hour is full/);
  assert.match(message, /up to 2 patients per hour/);

  // Reception, the patient app, a reschedule and the video route all refuse with the identical text.
  const viaStaff = await staffBook(doc, date, "10:00");
  const viaStaff2 = await staffBook(doc, date, "10:30");
  const viaPortal = await portalBook(doc, date, "10:00");
  assert.equal(viaStaff.status, 409);
  assert.equal(viaStaff.error?.message, message);
  assert.equal(viaStaff2.error?.message, message);
  assert.equal(viaPortal.status, 409);
  assert.equal(viaPortal.error?.message, message);
  const other = await staffBook(doc, date, "16:00"); // a free hour (afternoon session)
  assert.equal(other.status, 201);
  const move = await admin("POST", `/api/appointments/${other.data.id}/reschedule`, { date, time: "10:00" });
  assert.equal(move.status, 409);
  assert.equal(move.error?.message, message);
});

test("one patient per hour: the singular wording, and a 60-minute slot", async () => {
  const doc = nextDoctor();
  const date = freshDate(4);
  await setDoctor(doc, { perHour: 1 });
  assert.equal((await staffBook(doc, date, "11:00")).status, 201);
  const second = await staffBook(doc, date, "11:00");
  assert.equal(second.status, 409);
  assert.match(second.error!.message, /sees 1 patient per hour and all 1 place in it are booked/);
  assert.equal((await slotsOf(doc, date)).slots.find((s) => s.value === "11:00")!.status, "booked");
});

test("walk-ins and off-grid appointments count towards the hour; cancelling frees a place", async () => {
  const doc = nextDoctor();
  const date = freshDate(5);
  await setDoctor(doc, { perHour: 2 });
  const walk = await admin("POST", "/api/appointments", { patientId: nextPatient(), patientName: "Walk In", doctorId: doc, date, time: "10:10 AM", type: "Walk-in", reason: "walk-in", status: "Upcoming" });
  assert.equal(walk.status, 201, "walk-ins are never turned away");
  let s = await slotsOf(doc, date);
  assert.equal(statusAt(s, "10:00"), "booked", "the walk-in sits inside the 10:00 slot");
  assert.equal(statusAt(s, "10:30"), "open");
  const ten = () => s.hours.find((h) => h.label.startsWith("10:00 AM"))!;
  assert.equal(ten().booked, 1);

  const booked = await staffBook(doc, date, "10:30");
  assert.equal(booked.status, 201);
  s = await slotsOf(doc, date);
  assert.equal(ten().full, true);

  assert.equal((await admin("PATCH", `/api/appointments/${booked.data.id}`, { status: "Cancelled" })).status, 200);
  s = await slotsOf(doc, date);
  assert.equal(statusAt(s, "10:30"), "open", "a cancelled appointment gives its place back");
  assert.equal((await staffBook(doc, date, "10:30")).status, 201);
});

test("simultaneous bookings for the last places: exactly as many succeed as there are places", async () => {
  const doc = nextDoctor();
  const date = freshDate(1);
  await setDoctor(doc, { perHour: 2 });
  const sameSlot = await Promise.all(Array.from({ length: 6 }, (_, i) => portalBook(doc, date, "09:00", ((i + 3) % 10) + 1)));
  assert.equal(sameSlot.filter((r) => r.status === 201).length, 1, "one slot, one patient");
  assert.equal(sameSlot.filter((r) => r.status === 409).length, 5);

  const doc2 = nextDoctor();
  await setDoctor(doc2, { perHour: 3 });
  const hour = await Promise.all(["10:00", "10:20", "10:40", "10:00", "10:20", "10:40", "10:00"].map((t, i) => portalBook(doc2, date, t, ((i + 5) % 10) + 1)));
  assert.equal(hour.filter((r) => r.status === 201).length, 3, "3 per hour, never more");
  const rows = (await appointmentsRepo.listRows({ filters: [{ column: "doctor_id", op: "eq", value: doc2 }, { column: "appointment_date", op: "eq", value: date }], unpaged: true })).rows;
  assert.equal(rows.length, 3);
});

test("off-grid times, past times, doctors on leave and closed days are refused with a reason", async () => {
  const doc = nextDoctor();
  await setDoctor(doc, { perHour: 2 });
  const date = freshDate(3);
  assert.equal((await staffBook(doc, date, "10:15")).status, 400, "10:15 isn't one of the 30-minute slots");
  assert.match((await staffBook(doc, date, "10:15")).error!.message, /isn't one of .* slots/);
  assert.equal((await staffBook(doc, date, "03:00")).status, 400, "outside working hours");
  assert.equal((await staffBook(doc, freshDate(0), "10:00")).status, 400, "hospital closed on Sunday");
  const sunday = await slotsOf(doc, freshDate(0));
  assert.equal(sunday.slots.length, 0);
  assert.match(sunday.closedReason ?? "", /no in-person hours on Sunday/);
  await setDoctor(doc, { perHour: 2, status: "On Leave" });
  assert.match((await staffBook(doc, date, "10:00")).error!.message, /on leave/);
  assert.match((await slotsOf(doc, date)).closedReason ?? "", /on leave/);
  await setDoctor(doc, { perHour: 2 });
  assert.equal((await admin("POST", "/api/appointments", { patientId: 1, patientName: "P", doctorId: doc, date: istDate(-2), time: "10:00 AM", type: "Booked", reason: "xx" })).status, 422, "past dates are refused by validation");
});

// ── Video hours vs in-person hours ───────────────────────────────────────────

test("a doctor's video hours are not offered — or accepted — for in-person visits, and the rest of the day isn't offered for video", async () => {
  await hospitalVideo(true);
  await connectGoogle();
  const doc = nextDoctor();
  const wed = freshDate(3);
  const thu = freshDate(4);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Wednesday", start: "10:00", end: "12:00" }] });

  const inPerson = await slotsOf(doc, wed);
  for (const t of ["10:00", "10:30", "11:00", "11:30"]) assert.equal(statusAt(inPerson, t), "absent", `${t} is a video time, so not offered in person`);
  for (const t of ["09:00", "09:30", "12:00", "12:30", "16:00"]) assert.equal(statusAt(inPerson, t), "open", `${t} is in-person`);
  const video = await slotsOf(doc, wed, "video");
  assert.deepEqual(video.slots.map((s) => s.value), ["10:00", "10:30", "11:00", "11:30"], "video offers only the doctor's video window");
  assert.equal((await slotsOf(doc, thu)).slots.length, 16, "other days stay fully in-person");
  assert.equal((await slotsOf(doc, thu, "video")).slots.length, 0);
  assert.match((await slotsOf(doc, thu, "video")).closedReason ?? "", /no video consultation hours on Thursday/);

  // Refused if someone insists, from every door.
  const staff = await staffBook(doc, wed, "10:30");
  assert.equal(staff.status, 400);
  assert.match(staff.error!.message, /takes video consultations only at that time/);
  assert.match((await portalBook(doc, wed, "11:00")).error!.message, /takes video consultations only at that time/);
  const ip = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: wed, time: "12:30", reason: "video at an in-person time", paymentMode: "cash" });
  assert.equal(ip.status, 400);
  assert.match(ip.error!.message, /sees in-person patients at that time/);
  const ok = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: wed, time: "10:30", reason: "video", paymentMode: "cash" });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));

  // The booked video time now shows as booked in the video list, and the in-person list is unchanged.
  assert.equal(statusAt(await slotsOf(doc, wed, "video"), "10:30"), "booked");
  assert.equal(statusAt(await slotsOf(doc, wed), "09:00"), "open");
});

test("video and in-person share the doctor's hourly quota", async () => {
  await hospitalVideo(true);
  const doc = nextDoctor();
  const fri = freshDate(5);
  // Video window 10:30–11:30 straddles two clock hours; quota is 2 per clock hour.
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Friday", start: "10:30", end: "11:30" }] });
  assert.equal((await staffBook(doc, fri, "10:00")).status, 201, "in-person 10:00");
  const v = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: fri, time: "10:30", reason: "video", paymentMode: "cash" });
  assert.equal(v.status, 201, JSON.stringify(v.error));
  // Hour 10 now has 2 (one in-person, one video): full for everyone.
  const s = await slotsOf(doc, fri, "video");
  assert.equal(statusAt(s, "10:30"), "booked");
  const second = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: fri, time: "11:00", reason: "video2", paymentMode: "cash" });
  assert.equal(second.status, 201, "11:00 is in the next clock hour");
});

test("a doctor turning video off hands the hours back to in-person; existing video appointments stay", async () => {
  await hospitalVideo(true);
  await connectGoogle();
  const doc = nextDoctor();
  const mon = freshDate(1);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Monday", start: "09:00", end: "11:00" }] });
  const v = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: mon, time: "09:30", reason: "video", paymentMode: "cash" });
  assert.equal(v.status, 201);
  assert.equal(statusAt(await slotsOf(doc, mon), "09:00"), "absent");

  await setDoctor(doc, { perHour: 2, video: false, windows: [{ day: "Monday", start: "09:00", end: "11:00" }] });
  assert.equal(statusAt(await slotsOf(doc, mon), "09:00"), "open", "9:00 is an in-person time again");
  assert.equal((await slotsOf(doc, mon, "video")).slots.length, 0);
  assert.match((await slotsOf(doc, mon, "video")).closedReason ?? "", /isn't taking video consultations/);
  assert.equal((await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: mon, time: "10:00", reason: "video", paymentMode: "cash" })).status, 400);
  const still = (await appointmentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: v.data.id }], unpaged: true })).rows;
  assert.equal(still.length, 1, "the already-booked consultation is untouched");
  assert.equal(still[0].status, "Upcoming");
});

test("the hospital's video switch overrides the doctor's: off means nobody takes video and the windows are in-person", async () => {
  const doc = nextDoctor();
  const tue = freshDate(2);
  await hospitalVideo(false);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Tuesday", start: "09:00", end: "11:00" }] });
  assert.equal(statusAt(await slotsOf(doc, tue), "09:00"), "open");
  assert.equal((await slotsOf(doc, tue, "video")).slots.length, 0);
  const list = await portal("GET", "/api/portal/teleconsult/doctors?patientId=1");
  assert.equal(list.status, 200);
  assert.deepEqual(list.data, []);
  await hospitalVideo(true);
  const list2 = await portal("GET", "/api/portal/teleconsult/doctors?patientId=1");
  assert.ok(list2.data.some((d: { id: number }) => d.id === doc));
});

// ── The doctor's own settings ────────────────────────────────────────────────

test("doctors set their own schedule; others can't; bad input is refused; warnings explain what's affected", async () => {
  await hospitalVideo(true);
  // Doctor 2 (Sophia) is the logged-in doctor.
  const own = await doctor2("PUT", "/api/doctors/2/schedule", { patientsPerHour: 4, videoEnabled: true, videoHours: [{ day: "Monday", start: "09:00", end: "10:00" }, { day: "Monday", start: "11:00", end: "12:00" }] });
  assert.equal(own.status, 200, JSON.stringify(own.error));
  assert.equal(own.data.patientsPerHour, 4);
  assert.equal(own.data.slotMinutes, 15);
  assert.equal(own.data.videoActive, true);
  assert.equal(own.data.videoHours.length, 2);
  assert.equal((await doctor2("GET", "/api/doctors/2/schedule")).data.patientsPerHour, 4);

  assert.equal((await doctor2("PUT", "/api/doctors/3/schedule", { patientsPerHour: 3 })).status, 403, "a doctor can't change a colleague's schedule");
  assert.equal((await receptionOnly("PUT", "/api/doctors/2/schedule", { patientsPerHour: 3 })).status, 403, "reception can't either");
  assert.equal((await admin("PUT", "/api/doctors/3/schedule", { patientsPerHour: 3 })).status, 200, "an administrator can");

  assert.equal((await doctor2("PUT", "/api/doctors/2/schedule", { patientsPerHour: 7 })).status, 400, "7 doesn't divide 60");
  assert.equal((await doctor2("PUT", "/api/doctors/2/schedule", { videoHours: [{ day: "Funday", start: "09:00", end: "10:00" }] })).status, 400);
  assert.equal((await doctor2("PUT", "/api/doctors/2/schedule", { videoHours: [{ day: "Monday", start: "10:00", end: "09:00" }] })).status, 400, "end before start");
  assert.equal((await doctor2("PUT", "/api/doctors/2/schedule", { videoHours: [{ day: "Monday", start: "09:00", end: "10:30" }, { day: "Monday", start: "10:00", end: "11:00" }] })).status, 400, "overlap");

  // Can't turn video on while the hospital has it off.
  await hospitalVideo(false);
  const blocked = await doctor2("PUT", "/api/doctors/2/schedule", { videoEnabled: true });
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /switched off for this hospital/);
  assert.equal((await doctor2("PUT", "/api/doctors/2/schedule", { videoEnabled: false })).status, 200, "switching off is always allowed");
  await hospitalVideo(true);

  // Warnings: narrowing the hours under an existing booking.
  const doc = nextDoctor();
  const wed = freshDate(3);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Wednesday", start: "09:00", end: "11:00" }] });
  await connectGoogle();
  assert.equal((await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: wed, time: "09:00", reason: "video", paymentMode: "cash" })).status, 201);
  assert.equal((await staffBook(doc, wed, "12:00")).status, 201);
  const narrowed = await admin("PUT", `/api/doctors/${doc}/schedule`, { videoHours: [{ day: "Wednesday", start: "10:00", end: "11:00" }] });
  assert.equal(narrowed.status, 200);
  assert.ok(narrowed.data.warnings.some((w: string) => /upcoming video consultations? falls? outside/.test(w)), JSON.stringify(narrowed.data.warnings));
  const empty = await admin("PUT", `/api/doctors/${doc}/schedule`, { videoHours: [] });
  assert.ok(empty.data.warnings.some((w: string) => /haven't set any video hours/.test(w)));

  // The doctor list carries the settings.
  const list = await admin("GET", "/api/doctors?all=true");
  const row = list.data.find((d: { id: number }) => d.id === doc);
  assert.equal(row.videoEnabled, true);
  assert.equal(row.patientsPerHour, 2);
});

// ── Rescheduling ─────────────────────────────────────────────────────────────

test("staff reschedule: to an open slot works, and the rules refuse the rest", async () => {
  const doc = nextDoctor();
  const date = freshDate(2);
  const date2 = freshDate(2);
  await setDoctor(doc, { perHour: 2 });
  const a = await staffBook(doc, date, "09:00");
  assert.equal(a.status, 201);
  const url = `/api/appointments/${a.data.id}/reschedule`;

  const ok = await admin("POST", url, { date: date2, time: "11:30" });
  assert.equal(ok.status, 200, JSON.stringify(ok.error));
  assert.equal(ok.data.date, date2);
  assert.equal(ok.data.time, "11:30 AM");
  assert.equal(ok.data.rescheduleCount, 1);
  assert.equal(statusAt(await slotsOf(doc, date), "09:00"), "open", "the old place is free again");
  assert.equal(statusAt(await slotsOf(doc, date2), "11:30"), "booked");

  assert.equal((await admin("POST", url, { date: date2, time: "11:30" })).status, 400, "same time");
  assert.equal((await admin("POST", url, { date: date2, time: "11:15" })).status, 400, "not a slot");
  assert.equal((await admin("POST", url, { date: istDate(-1), time: "10:00" })).status, 400, "past");
  assert.equal((await admin("POST", url, { date: freshDate(0), time: "10:00" })).status, 400, "closed Sunday");
  assert.equal((await admin("POST", url, {})).status, 400);
  assert.equal((await admin("POST", `/api/appointments/999999/reschedule`, { date: date2, time: "10:00" })).status, 404);

  await admin("PATCH", `/api/appointments/${a.data.id}`, { status: "Cancelled" });
  assert.equal((await admin("POST", url, { date: date2, time: "12:00" })).status, 409, "a cancelled appointment can't be moved");
});

test("who may reschedule: admin, the appointment's own doctor, and the tele-caller for video only", async () => {
  await hospitalVideo(true);
  await connectGoogle();
  const date = freshDate(4);
  const date2 = freshDate(4);
  await setDoctor(2, { perHour: 2, video: true, windows: [{ day: "Thursday", start: "09:00", end: "10:00" }] });
  await setDoctor(3, { perHour: 2 });
  const mine = await staffBook(2, date, "11:00");   // Sophia's in-person
  const colleague = await staffBook(3, date, "11:00");
  assert.equal(mine.status, 201);
  assert.equal(colleague.status, 201);

  assert.equal((await doctor2("POST", `/api/appointments/${mine.data.id}/reschedule`, { date: date2, time: "11:30" })).status, 200, "a doctor moves their own");
  assert.equal((await doctor2("POST", `/api/appointments/${colleague.data.id}/reschedule`, { date: date2, time: "11:30" })).status, 403, "but not a colleague's");
  assert.equal((await receptionOnly("POST", `/api/appointments/${colleague.data.id}/reschedule`, { date: date2, time: "11:30" })).status, 403, "reception can view but not move appointments");
  assert.equal((await admin("POST", `/api/appointments/${colleague.data.id}/reschedule`, { date: date2, time: "11:30" })).status, 200);

  // A tele-caller: create the user, then try an in-person and a video appointment.
  const created = await admin("POST", "/api/admin/users", { name: "Tara Caller", email: "tara.caller@samvaadhospital.in", password: "Samvaad@123", role: "Tele Caller" });
  assert.ok(created.status === 201 || created.status === 409, JSON.stringify(created.error)); // 409 = already created by an earlier pass
  const tele = (m: string, p: string, b?: unknown) => as("tara.caller@samvaadhospital.in", m, p, b);
  const video = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: 2, date, time: "09:00", reason: "video", paymentMode: "cash" });
  assert.equal(video.status, 201, JSON.stringify(video.error));
  const vAppt = (await appointmentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: video.data.id }], unpaged: true })).rows[0];
  assert.equal((await tele("POST", `/api/appointments/${vAppt.id}/reschedule`, { date: date2, time: "09:30" })).status, 200, "tele-caller moves a video consultation");
  assert.equal((await tele("POST", `/api/appointments/${colleague.data.id}/reschedule`, { date: freshDate(4), time: "12:00" })).status, 403, "but not an in-person one");
});

test("a rescheduled video consultation keeps its link and booking, moves its calendar entry, and must land in video hours", async () => {
  await hospitalVideo(true);
  await connectGoogle();
  const doc = nextDoctor();
  const wed = freshDate(3);
  const wed2 = freshDate(3);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Wednesday", start: "09:00", end: "11:00" }] });
  const v = await admin("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: doc, date: wed, time: "09:00", reason: "video", paymentMode: "cash" });
  assert.equal(v.status, 201, JSON.stringify(v.error));
  const appt = (await appointmentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: v.data.id }], unpaged: true })).rows[0];
  assert.ok(appt.video_url, "link created");
  assert.ok(appt.meet_event_id, "event id remembered");
  const link = appt.video_url;

  const url = `/api/appointments/${appt.id}/reschedule`;
  assert.equal((await admin("POST", url, { date: wed2, time: "14:00" })).status, 400, "an in-person time is refused for a video consultation");
  g.patches.length = 0;
  const moved = await admin("POST", url, { date: wed2, time: "10:30" });
  assert.equal(moved.status, 200, JSON.stringify(moved.error));
  assert.equal(moved.data.videoUrl, link, "same link");
  assert.equal(moved.data.meetWarning, null);
  const after = (await appointmentsRepo.getRow(appt.id))!;
  assert.equal(after.appointment_date, wed2);
  assert.equal(after.appointment_time, "10:30 AM");
  const booking = (await teleconsultBookingsRepo.getRow(v.data.id))!;
  assert.equal(booking.appointment_date, wed2);
  assert.equal(booking.appointment_time, "10:30 AM");
  assert.equal(g.patches.length, 1, "the calendar event moved");
  assert.equal(g.patches[0].id, appt.meet_event_id);
  assert.ok(g.patches[0].start.startsWith(wed2) || new Date(g.patches[0].start).getTime() > Date.now());

  // The calendar being down doesn't undo the move; staff are told.
  g.patchFails = true;
  const again = await admin("POST", url, { date: wed2, time: "10:00" });
  g.patchFails = false;
  assert.equal(again.status, 200);
  assert.match(again.data.meetWarning ?? "", /calendar invite wasn't updated/);
  assert.equal(again.data.time, "10:00 AM");
});

test("patients reschedule their own appointments — with a cutoff, a limit, and the same slot rules", async () => {
  const doc = nextDoctor();
  const d1 = freshDate(2);
  await setDoctor(doc, { perHour: 2 });
  const patientId = nextPatient();
  const booked = await portalBook(doc, d1, "10:00", patientId);
  assert.equal(booked.status, 201);
  const id = booked.data.appointmentId as number;
  assert.equal(booked.data.canReschedule, true);
  const url = `/api/portal/appointments/${id}/reschedule`;

  const dates = [freshDate(2), freshDate(2), freshDate(2), freshDate(2)];
  const m1 = await portal("POST", url, { patientId, date: dates[0], time: "11:00" });
  assert.equal(m1.status, 200, JSON.stringify(m1.error));
  assert.equal(m1.data.date, dates[0]);
  assert.equal(m1.data.rescheduleCount, 1);
  assert.equal((await portal("POST", url, { patientId, date: dates[1], time: "11:00" })).status, 200);
  assert.equal((await portal("POST", url, { patientId, date: dates[2], time: "11:00" })).status, 200);
  const fourth = await portal("POST", url, { patientId, date: dates[3], time: "11:00" });
  assert.equal(fourth.status, 409);
  assert.match(fourth.error!.message, /already been moved 3 times — please call the hospital/);
  const view = await portal("GET", `/api/portal/appointments/${id}?patientId=${patientId}`);
  assert.equal(view.data.canReschedule, false);
  assert.match(view.data.rescheduleBlockedReason, /moved 3 times/);

  // Someone else's appointment.
  assert.equal((await portal("POST", url, { patientId: patientId === 1 ? 2 : 1, date: dates[3], time: "12:00" })).status, 404);
  assert.equal((await portal("GET", `/api/portal/appointments/${id}?patientId=${patientId === 1 ? 2 : 1}`)).status, 404);

  // Into a full hour: the same message as everyone else.
  const doc2 = nextDoctor();
  await setDoctor(doc2, { perHour: 1 });
  const dd = freshDate(2);
  assert.equal((await staffBook(doc2, dd, "12:00")).status, 201);
  const p2 = nextPatient();
  const mine = await portalBook(doc2, freshDate(2), "09:00", p2);
  const tryFull = await portal("POST", `/api/portal/appointments/${mine.data.appointmentId}/reschedule`, { patientId: p2, date: dd, time: "12:00" });
  assert.equal(tryFull.status, 409);
  assert.match(tryFull.error!.message, /This hour is full/);

  // Later today is more than an hour away, so a patient may still move it.
  const nowHHmm = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  if (nowHHmm < "22:30") {
    const later = await appointmentsRepo.create({
      hospital_id: 1, patient_id: p2, patient_name: "P", patient_age: 30, doctor_id: doc2, doctor: "Dr",
      appointment_date: istDate(0), appointment_time: "11:59 PM", type: "Booked", reason: "late", status: "Upcoming",
    });
    const okLater = await portal("POST", `/api/portal/appointments/${later.id}/reschedule`, { patientId: p2, date: freshDate(2), time: "12:00" });
    assert.equal(okLater.status, 200, JSON.stringify(okLater.error));
  }
});

test("patients can't move a completed, cancelled or checked-in appointment, or one that starts within the hour", async () => {
  const doc = nextDoctor();
  await setDoctor(doc, { perHour: 2 });
  const date = freshDate(3);
  const p = nextPatient();
  const mk = async (time: string) => (await portalBook(doc, date, time, p)).data.appointmentId as number;
  const a = await mk("09:00");
  const b = await mk("09:30");
  const c = await mk("10:00");
  await appointmentsRepo.update(a, { status: "Completed" });
  await appointmentsRepo.update(b, { status: "Cancelled" });
  await opdRepo.create({ hospital_id: 1, token_number: "T-900", appointment_id: c, patient_id: p, patient_name: "P", patient_age: 30, doctor_id: doc, doctor: "Dr", reason: "x", priority: "Normal", vitals_recorded: false, status: "Waiting", check_in_time: "9:00 AM" });
  const target = freshDate(3);
  for (const id of [a, b, c]) {
    const r = await portal("POST", `/api/portal/appointments/${id}/reschedule`, { patientId: p, date: target, time: "12:00" });
    assert.equal(r.status, 409, `appointment ${id}`);
  }
  assert.equal((await portal("GET", `/api/portal/appointments/${a}?patientId=${p}`)).data.canReschedule, false);
  // Soon: an appointment whose start is 20 minutes away.
  const now = new Date();
  const soonMin = (parseInt(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }), 10) * 60 + parseInt(now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", minute: "2-digit" }), 10) + 20) % 1440;
  if (soonMin > 20) {
    const t = `${Math.floor(soonMin / 60) % 12 || 12}:${String(soonMin % 60).padStart(2, "0")} ${soonMin >= 720 ? "PM" : "AM"}`;
    const soon = await appointmentsRepo.create({ hospital_id: 1, patient_id: p, patient_name: "P", patient_age: 30, doctor_id: doc, doctor: "Dr", appointment_date: istDate(0), appointment_time: t, type: "Booked", reason: "soon", status: "Upcoming" });
    const r = await portal("POST", `/api/portal/appointments/${soon.id}/reschedule`, { patientId: p, date: target, time: "13:00" });
    assert.equal(r.status, 409);
    assert.match(r.error!.message, /starts soon — please call the hospital/);
  }
});

test("a patient moving a video consultation: same doctor's video hours only, link kept, appears in the consultations list", async () => {
  await hospitalVideo(true);
  await connectGoogle();
  const doc = nextDoctor();
  const th = freshDate(4);
  const th2 = freshDate(4);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Thursday", start: "16:00", end: "18:00" }] });
  const patientId = nextPatient();
  const v = await admin("POST", "/api/teleconsult/bookings", { patientId, doctorId: doc, date: th, time: "16:00", reason: "video", paymentMode: "cash" });
  assert.equal(v.status, 201, JSON.stringify(v.error));
  const appt = (await appointmentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: v.data.id }], unpaged: true })).rows[0];

  const list = await portal("GET", `/api/portal/teleconsult/consultations?patientId=${patientId}`);
  const item = list.data.upcoming.find((c: { appointmentId: number }) => c.appointmentId === appt.id);
  assert.equal(item.canReschedule, true);
  assert.equal(item.rescheduleCount, 0);

  const url = `/api/portal/appointments/${appt.id}/reschedule`;
  assert.equal((await portal("POST", url, { patientId, date: th2, time: "10:00" })).status, 400, "an in-person time is refused");
  const ok = await portal("POST", url, { patientId, date: th2, time: "17:00" });
  assert.equal(ok.status, 200, JSON.stringify(ok.error));
  assert.equal(ok.data.mode, "video");
  assert.equal(ok.data.videoUrl, appt.video_url);
  assert.equal(ok.data.time, "5:00 PM");
  const again = (await portal("GET", `/api/portal/teleconsult/consultations?patientId=${patientId}`)).data.upcoming.find((c: { appointmentId: number }) => c.appointmentId === appt.id);
  assert.equal(again.time, "5:00 PM");
  assert.equal(again.rescheduleCount, 1);
});

test("in-person booking through the patient app only offers and accepts in-person times; doctors list shows who takes video", async () => {
  await hospitalVideo(true);
  const doc = nextDoctor();
  const mon = freshDate(1);
  await setDoctor(doc, { perHour: 2, video: true, windows: [{ day: "Monday", start: "09:00", end: "11:00" }] });
  const inPerson = (await portal("GET", `/api/portal/appointments/slots?doctorId=${doc}&date=${mon}&mode=in_person`)).data;
  assert.ok(!inPerson.slots.some((s: { value: string }) => ["09:00", "09:30", "10:00", "10:30"].includes(s.value)));
  assert.equal((await portalBook(doc, mon, "09:30")).status, 400);
  const video = (await portal("GET", `/api/portal/appointments/slots?doctorId=${doc}&date=${mon}&mode=video`)).data;
  assert.deepEqual(video.slots.map((s: { value: string }) => s.value), ["09:00", "09:30", "10:00", "10:30"]);
  const docs = await portal("GET", "/api/portal/teleconsult/doctors?patientId=1");
  const me = docs.data.find((d: { id: number }) => d.id === doc);
  assert.deepEqual([me.patientsPerHour, me.slotMinutes], [2, 30]);
  // The public booking page lists only doctors who take video.
  await setDoctor(doc, { perHour: 2, video: false });
  const link = await admin("POST", "/api/teleconsult/links", { patientId: 1 });
  const session = await request("GET", `/api/public/teleconsult/session?token=${link.data.token}`);
  assert.ok(!session.data.doctors.some((d: { id: number }) => d.id === doc), "a doctor who turned video off disappears from the booking page");
});

// ── Run ──────────────────────────────────────────────────────────────────────

const passes = Math.max(1, Number(process.argv[2]) || 1);
let failed = 0;
for (let pass = 1; pass <= passes; pass++) {
  if (passes > 1) console.log(`\n── pass ${pass}/${passes} ──`);
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL  ${t.name}`);
      console.log("        " + String((err as Error).stack ?? err).split("\n").slice(0, 7).join("\n        "));
    }
  }
}
console.log(`\n${tests.length * passes - failed}/${tests.length * passes} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
