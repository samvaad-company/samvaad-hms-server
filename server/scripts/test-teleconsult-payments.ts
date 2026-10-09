/**
 * End-to-end tests for tele-consult payments, run in-process against the real
 * app, routes and services with an in-memory database and a fake Razorpay and
 * Google. Nothing leaves the machine and no real data is touched.
 *
 *   npm run test:payments            # one pass
 *   npm run test:payments -- 5       # five passes in a row (state carries over, which is the point)
 *
 * Against a real MongoDB (to exercise the unique indexes under real concurrency) use a THROW-AWAY database —
 * the script drops it afterwards, and only if its name starts with "samvaad_test_":
 *   MONGODB_DB=samvaad_test_$(date +%s) DATABASE_DRIVER=mongo npx tsx --env-file=.env scripts/test-teleconsult-payments.ts 2
 *
 * What it proves, in order of how much it matters in production: a payment is
 * never lost (webhook-only, verify-only, neither, both at once, late, out of
 * order, duplicated), never double-books, never double-refunds, and nothing a
 * client sends can change the amount or whose booking it is.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const KEY_SECRET = "test_key_secret_0123456789";
const WEBHOOK_SECRET = "whsec_test_0123456789abcdef0123456789abcdef";
const PORTAL_KEY = "test-portal-key-0123456789";
Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: PORTAL_KEY,
  RAZORPAY_KEY_ID: "rzp_test_fake",
  RAZORPAY_KEY_SECRET: KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
  TELECONSULT_MEET_RETRY_AFTER_MS: "0",
  TELECONSULT_VERIFY_BUDGET_MS: "300",
});

const { createApp } = await import("@/app");
const { appointmentsRepo, teleconsultBookingsRepo, teleconsultPaymentsRepo, googleConnectionsRepo, hospitalsRepo } = await import("@/repositories");
const { encryptToken } = await import("@/services/google-meet");
const { reconcile } = await import("@/services/teleconsult-payments");
const { verifyPaymentSignature } = await import("@/services/payment-gateway");
const { doctorsRepo } = await import("@/repositories");

// ── Fake Razorpay + Google ───────────────────────────────────────────────────

interface FakeOrder { id: string; amount: number; currency: string; receipt: string; notes: Record<string, string> }
interface FakePayment {
  id: string; order_id: string; amount: number; currency: string; status: string; method: string;
  email: string; contact: string; captured: boolean; notes: Record<string, string>;
  error_code?: string; error_description?: string;
}
const rz = {
  n: 0,
  orders: new Map<string, FakeOrder>(),
  payments: new Map<string, FakePayment>(),
  down: false,
  /** Milliseconds every fake gateway call stalls (to exercise timeouts). */
  delayMs: 0,
  refundFailures: 0,
  refunds: [] as { paymentId: string; amount: number }[],
  captures: [] as string[],
  log: [] as string[],
};
const CAL = "https://www.googleapis.com/auth/calendar.events";
const MEET = "https://www.googleapis.com/auth/meetings.space.created";
/** Meet codes are letters only (abc-defg-hij). */
const letters = (n: number) => String(n).split("").map((d) => "abcdefghij"[Number(d)]).join("");
const g = {
  mode: "ok" as "ok" | "fail" | "lost-response",
  events: new Map<string, { id: string; hangoutLink?: string; location?: string; attendees: string[]; extendedProperties?: { private?: Record<string, string> } }>(),
  created: 0,
  /** Meet API (spaces) behaviour and what it was asked for. */
  spaceMode: "ok" as "ok" | "fail",
  spaces: [] as { accessType: string; uri: string }[],
  /** Scopes Google reports on the code exchange and on a refresh (undefined = field omitted). */
  codeScope: `openid email ${CAL} ${MEET}` as string | undefined,
  refreshScope: undefined as string | undefined,
  refreshError: null as string | null,
  tokenCalls: 0,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const rzError = (status: number, description: string) => json({ error: { code: "BAD_REQUEST_ERROR", description } }, status);

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = (init?.method ?? "GET").toUpperCase();

  if (url.startsWith("https://api.razorpay.com/v1")) {
    if (rz.down) throw new TypeError("fetch failed");
    if (rz.delayMs) await new Promise((r) => setTimeout(r, rz.delayMs));
    const path = url.slice("https://api.razorpay.com/v1".length);
    rz.log.push(`${method} ${path}`);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    let m: RegExpMatchArray | null;
    if (method === "POST" && path === "/orders") {
      const id = `order_${++rz.n}`;
      const order: FakeOrder = { id, amount: Number(body.amount), currency: String(body.currency), receipt: String(body.receipt), notes: (body.notes ?? {}) as Record<string, string> };
      rz.orders.set(id, order);
      return json(order);
    }
    if (method === "GET" && (m = path.match(/^\/payments\/([^/]+)$/))) {
      const p = rz.payments.get(decodeURIComponent(m[1]));
      return p ? json(p) : rzError(400, "The id provided does not exist");
    }
    if (method === "GET" && (m = path.match(/^\/orders\/([^/]+)\/payments$/))) {
      const id = decodeURIComponent(m[1]);
      return json({ items: [...rz.payments.values()].filter((p) => p.order_id === id) });
    }
    if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/capture$/))) {
      const p = rz.payments.get(decodeURIComponent(m[1]));
      if (!p) return rzError(400, "The id provided does not exist");
      if (p.status === "captured") return rzError(400, "This payment has already been captured");
      if (p.status !== "authorized") return rzError(400, "This payment cannot be captured");
      p.status = "captured";
      p.captured = true;
      rz.captures.push(p.id);
      return json(p);
    }
    if (method === "POST" && (m = path.match(/^\/payments\/([^/]+)\/refund$/))) {
      const p = rz.payments.get(decodeURIComponent(m[1]));
      if (!p) return rzError(400, "The id provided does not exist");
      if (rz.refundFailures > 0) { rz.refundFailures--; return json({ error: { description: "Internal error" } }, 500); }
      if (p.status === "refunded") return rzError(400, "The payment has been fully refunded already");
      p.status = "refunded";
      rz.refunds.push({ paymentId: p.id, amount: Number(body.amount) });
      return json({ id: `rfnd_${++rz.n}` });
    }
    return rzError(404, `fake razorpay: no route for ${method} ${path}`);
  }

  if (url.includes("oauth2.googleapis.com/token")) {
    g.tokenCalls++;
    const form = new URLSearchParams(String(init?.body ?? ""));
    if (form.get("grant_type") === "authorization_code") {
      const idToken = `x.${Buffer.from(JSON.stringify({ email: "hospital@example.com" })).toString("base64url")}.y`;
      return json({ access_token: "fake-access-token", refresh_token: "fake-refresh", id_token: idToken, scope: g.codeScope });
    }
    if (g.refreshError) return json({ error: g.refreshError, error_description: "Token has been expired or revoked." }, 400);
    return json({ access_token: "fake-access-token", ...(g.refreshScope !== undefined ? { scope: g.refreshScope } : {}) });
  }

  if (url.startsWith("https://meet.googleapis.com/v2/spaces")) {
    if (g.spaceMode === "fail") return json({ error: { message: "Google Meet REST API has not been used in project 123 before or it is disabled." } }, 403);
    const body = JSON.parse(String(init?.body)) as { config?: { accessType?: string } };
    const code = `${letters(100 + g.spaces.length)}-abcd-efg`;
    const space = { accessType: body.config?.accessType ?? "?", uri: `https://meet.google.com/${code}` };
    g.spaces.push(space);
    return json({ name: `spaces/${code}`, meetingUri: space.uri, meetingCode: code, config: { accessType: space.accessType } });
  }

  if (url.includes("www.googleapis.com/calendar/v3/calendars/primary/events")) {
    if (method === "POST") {
      if (g.mode === "fail") return json({ error: { message: "Backend Error" } }, 500);
      const body = JSON.parse(String(init?.body)) as {
        id: string; location?: string; attendees?: { email: string }[]; conferenceData?: unknown; extendedProperties?: { private?: Record<string, string> };
      };
      // The real API only accepts base32hex ids (0-9, a-v), 5-1024 characters.
      if (!/^[0-9a-v]{5,1024}$/.test(body.id)) return json({ error: { message: "Invalid resource id value." } }, 400);
      if (g.events.has(body.id)) return json({ error: { message: "The requested identifier already exists." } }, 409);
      g.events.set(body.id, {
        id: body.id,
        ...(body.conferenceData ? { hangoutLink: `https://meet.google.com/${letters(Number(body.id.replace(/\D/g, "") || 0))}-calx-def` } : {}),
        ...(body.location ? { location: body.location } : {}),
        attendees: (body.attendees ?? []).map((a) => a.email),
        extendedProperties: body.extendedProperties,
      });
      g.created++;
      if (g.mode === "lost-response") throw new TypeError("fetch failed"); // Google made it, we never heard back
      return json(g.events.get(body.id));
    }
    const id = decodeURIComponent(url.split("/events/")[1]?.split("?")[0] ?? "");
    const ev = g.events.get(id);
    return ev ? json(ev) : json({ error: { message: "Not Found" } }, 404);
  }
  return realFetch(input, init);
}) as typeof fetch;

// ── App + helpers ────────────────────────────────────────────────────────────

const { app } = await createApp();

// On MongoDB, indexes and sample data are created in the background on first connect; wait for that.
if (process.env.DATABASE_DRIVER === "mongo") {
  const { getDb } = await import("@/db");
  const mongo = (await getDb()) as unknown as { database(): Promise<import("mongodb").Db> };
  const meta = (await mongo.database()).collection("_meta");
  for (let i = 0; i < 240 && !(await meta.findOne({ _id: "schema" } as never)); i++) await new Promise((r) => setTimeout(r, 500));
}
const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

async function request(method: string, path: string, opts: { body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined = opts.raw;
  if (body === undefined && opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string }; ok?: boolean; outcome?: string } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, body: parsed, headers: res.headers };
}
const portal = (method: string, path: string, body?: unknown) => request(method, path, { body, headers: { "x-portal-key": PORTAL_KEY } });

let staffCookie = "";
async function staff(method: string, path: string, body?: unknown) {
  if (!staffCookie) {
    const login = await request("POST", "/api/auth/login", { body: { email: "kevin.carter@samvaadhospital.in", password: "Samvaad@123" } });
    assert.equal(login.status, 200, "staff login");
    staffCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  }
  return request(method, path, { body, headers: { cookie: staffCookie } });
}

async function webhook(event: string, entity: Record<string, unknown> | FakePayment, opts: { eventId?: string; sig?: "good" | "bad" | "none"; raw?: string; extra?: Record<string, unknown> } = {}) {
  const raw = opts.raw ?? JSON.stringify({ event, payload: { payment: { entity }, ...(opts.extra ?? {}) } });
  const headers: Record<string, string> = {};
  if (opts.sig !== "none") headers["x-razorpay-signature"] = opts.sig === "bad" ? "ab".repeat(32) : hmac(WEBHOOK_SECRET, raw);
  if (opts.eventId) headers["x-razorpay-event-id"] = opts.eventId;
  return request("POST", "/api/razorpay/webhook", { raw, headers });
}

/** The customer pays at the (fake) gateway. */
function pay(orderId: string, status = "captured", extra: Partial<FakePayment> = {}): FakePayment {
  const o = rz.orders.get(orderId)!;
  const p: FakePayment = {
    id: `pay_${++rz.n}`, order_id: orderId, amount: o.amount, currency: o.currency, status, method: "upi",
    email: "patient@example.com", contact: "+919999999999", captured: status === "captured", notes: o.notes, ...extra,
  };
  rz.payments.set(p.id, p);
  return p;
}
const checkoutSig = (orderId: string, paymentId: string) => hmac(KEY_SECRET, `${orderId}|${paymentId}`);
const verifyBody = (patientId: number, p: FakePayment) => ({
  patientId, razorpay_order_id: p.order_id, razorpay_payment_id: p.id, razorpay_signature: checkoutSig(p.order_id, p.id),
});

// Unique (doctor, date, time) slots so tests never collide with each other.
const istDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const weekdays: string[] = [];
for (let i = 1; weekdays.length < 80; i++) {
  const d = istDate(i);
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  if (dow >= 1 && dow <= 5) weekdays.push(d);
}
const TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
const DOCTORS = [1, 2, 3, 4, 5, 6, 9, 10];
let slotCounter = 0;
function nextSlot() {
  const i = slotCounter++;
  return {
    time: TIMES[i % TIMES.length],
    doctorId: DOCTORS[Math.floor(i / TIMES.length) % DOCTORS.length],
    date: weekdays[Math.floor(i / (TIMES.length * DOCTORS.length)) % weekdays.length],
  };
}
let patientCounter = 0;
const nextPatient = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10][patientCounter++ % 10];

async function start(opts: { patientId?: number; slot?: ReturnType<typeof nextSlot> } = {}) {
  const slot = opts.slot ?? nextSlot();
  const patientId = opts.patientId ?? nextPatient();
  const r = await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "test visit" });
  assert.equal(r.status, 201, `start booking: ${JSON.stringify(r.error)}`);
  return { slot, patientId, booking: r.data.booking as { id: number }, payment: r.data.payment as { orderId: string; amountPaise: number; keyId: string } };
}
const apptsOf = async (bookingId: number) => (await appointmentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: bookingId }], unpaged: true })).rows;
const ledgerOf = async (paymentId: string) => teleconsultPaymentsRepo.findRow([{ column: "payment_id", op: "eq", value: paymentId }]);
const bookingOf = async (id: number) => (await teleconsultBookingsRepo.getRow(id))!;
const backdate = (id: number, minutes: number) => teleconsultBookingsRepo.update(id, { created_at: new Date(Date.now() - minutes * 60_000).toISOString() });

async function setPrice(price: number | null) {
  await hospitalsRepo.update(1, { teleconsult_enabled: true, teleconsult_price: price });
}
async function connectGoogle(on: boolean) {
  const existing = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: 1 }]);
  if (on && !existing) await googleConnectionsRepo.create({ hospital_id: 1, account_email: "hospital@example.com", refresh_token_enc: await encryptToken("refresh"), connected_by: 1, scopes: `${CAL} ${MEET}`, needs_reconnect: false, last_error: null });
  if (on && existing) await googleConnectionsRepo.update(existing.id, { needs_reconnect: false, last_error: null, scopes: `${CAL} ${MEET}` });
  if (!on && existing) await googleConnectionsRepo.remove(existing.id);
}

// ── Test runner ──────────────────────────────────────────────────────────────

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

/** Every test doctor takes video consultations Monday–Saturday 9:00–13:00, two patients an hour (the 30-minute slots these tests were written for). */
async function configureDoctors() {
  const { rows } = await doctorsRepo.listRows({ unpaged: true });
  const video_hours = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({ day, start: "09:00", end: "13:00" }));
  for (const d of rows) await doctorsRepo.update(d.id, { patients_per_hour: 2, video_enabled: true, video_hours, status: "Active" });
}

async function resetBetweenTests() {
  rz.down = false; rz.delayMs = 0; rz.refundFailures = 0; g.mode = "ok";
  g.codeScope = `openid email ${CAL} ${MEET}`; g.refreshScope = undefined; g.refreshError = null; g.spaceMode = "ok";
  const { rows } = await teleconsultBookingsRepo.listRows({ filters: [{ column: "status", op: "eq", value: "pending_payment" }], unpaged: true });
  for (const b of rows) await teleconsultBookingsRepo.update(b.id, { status: "cancelled" });
  await setPrice(500);
  await configureDoctors();
  await hospitalsRepo.update(1, { teleconsult_meet_access: "OPEN" });
  await connectGoogle(true);
}

// ── Happy paths ──────────────────────────────────────────────────────────────

test("verify path: payment confirms, links payment ids ↔ appointment ↔ patient ↔ doctor, and creates the Meet link", async () => {
  const { booking, payment, patientId, slot } = await start();
  assert.equal(payment.amountPaise, 50000, "amount comes from the hospital price");
  assert.equal(payment.keyId, "rzp_test_fake");
  assert.equal(rz.orders.get(payment.orderId)!.notes.booking_id, String(booking.id), "order notes carry the booking id");

  const p = pay(payment.orderId);
  const r = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.status, "confirmed");
  assert.ok(r.data.videoUrl?.startsWith("https://meet.google.com/"), "Meet link created");

  const appts = await apptsOf(booking.id);
  assert.equal(appts.length, 1);
  const a = appts[0];
  assert.equal(a.payment_id, p.id);
  assert.equal(a.order_id, payment.orderId);
  assert.equal(a.type, "Tele-consult");
  assert.equal(a.doctor_id, slot.doctorId);
  assert.equal(a.patient_id, patientId);

  const led = (await ledgerOf(p.id))!;
  assert.equal(led.status, "captured");
  assert.equal(led.recorded_via, "verify");
  assert.equal(led.signature_verified, true);
  assert.equal(led.method, "upi");
  assert.equal(led.appointment_id, a.id);
  assert.equal(led.booking_id, booking.id);
  assert.equal(led.patient_id, patientId);
  assert.equal(led.doctor_id, slot.doctorId);
  assert.equal(led.amount, 500);

  const b = await bookingOf(booking.id);
  assert.equal(b.gateway_payment_id, p.id);
  assert.equal(b.appointment_id, a.id);
});

test("patient app finds the transaction by order id, payment id and booking id and gets the appointment details", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));

  for (const q of [`orderId=${payment.orderId}`, `paymentId=${p.id}`, `bookingId=${booking.id}`]) {
    const r = await portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId}&${q}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.found, true, q);
    assert.equal(r.data.payment.paymentId, p.id);
    assert.equal(r.data.payment.orderId, payment.orderId);
    assert.equal(r.data.payment.status, "captured");
    assert.equal(r.data.consultation.status, "Upcoming");
    assert.equal(r.data.consultation.linkStatus, "ready");
    assert.ok(r.data.consultation.videoUrl);
    assert.equal(r.data.consultation.paymentStatus, "Paid");
  }
  const other = await portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId === 1 ? 2 : 1}&orderId=${payment.orderId}`);
  assert.equal(other.data.found, false, "another patient can't see it");
  const none = await portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId}&orderId=order_nope`);
  assert.equal(none.data.found, false);
  const bad = await portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId}`);
  assert.equal(bad.status, 400);
});

test("webhook alone confirms (patient never calls verify), then a late verify is a harmless repeat", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  const w = await webhook("payment.captured", p, { eventId: "evt_a1" });
  assert.equal(w.status, 200);
  assert.equal(w.body?.outcome, "confirmed");
  assert.equal((await bookingOf(booking.id)).status, "confirmed");
  const led = (await ledgerOf(p.id))!;
  assert.equal(led.recorded_via, "webhook");
  assert.equal(led.signature_verified, true);

  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.status, 200);
  assert.equal(v.data.status, "confirmed");
  assert.equal((await apptsOf(booking.id)).length, 1, "still one appointment");
});

test("order.paid webhook confirms too", async () => {
  const { booking, payment } = await start();
  const p = pay(payment.orderId);
  const w = await webhook("order.paid", p, { eventId: "evt_op", extra: { order: { entity: { id: payment.orderId, notes: p.notes } } } });
  assert.equal(w.body?.outcome, "confirmed");
  assert.equal((await apptsOf(booking.id)).length, 1);
});

test("webhook + verify + duplicate webhook + lookup all at once → exactly one appointment and one ledger row (x15)", async () => {
  for (let i = 0; i < 15; i++) {
    const { booking, payment, patientId } = await start();
    const p = pay(payment.orderId);
    const results = await Promise.all([
      portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p)),
      webhook("payment.captured", p, { eventId: `evt_c${i}_1` }),
      webhook("payment.captured", p, { eventId: `evt_c${i}_2` }),
      portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId}&orderId=${payment.orderId}`),
      portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p)),
    ]);
    for (const r of results) assert.ok(r.status === 200, `iteration ${i}: ${r.status} ${JSON.stringify(r.error)}`);
    assert.equal((await apptsOf(booking.id)).length, 1, `iteration ${i}: one appointment`);
    const rows = (await teleconsultPaymentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: booking.id }], unpaged: true })).rows;
    assert.equal(rows.length, 1, `iteration ${i}: one ledger row`);
    assert.equal((await bookingOf(booking.id)).status, "confirmed");
  }
});

test("MongoDB itself refuses a second appointment for one booking and a second ledger row for one payment", async () => {
  if (process.env.DATABASE_DRIVER !== "mongo") return; // only a real database enforces indexes
  const { isDuplicateKeyError } = await import("@/services/teleconsult-ledger");
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  const [appt] = await apptsOf(booking.id);
  const { id: _id, ...copy } = appt;
  await assert.rejects(() => appointmentsRepo.create(copy), (e) => isDuplicateKeyError(e));
  const led = (await ledgerOf(p.id))!;
  const { id: _lid, ...ledgerCopy } = led;
  await assert.rejects(() => teleconsultPaymentsRepo.create(ledgerCopy), (e) => isDuplicateKeyError(e));
  // Ordinary appointments (no booking id) are unaffected by the partial index.
  for (let i = 0; i < 2; i++) {
    await appointmentsRepo.create({ hospital_id: 1, patient_id: 1, patient_name: "x", patient_age: 1, doctor_id: 1, doctor: "d", appointment_date: weekdays[0], appointment_time: "8:00 PM", type: "Booked", reason: "x", status: "Upcoming" });
  }
});

// ── Webhook authentication & noise ───────────────────────────────────────────

test("webhook rejects missing, wrong and tampered signatures and malformed bodies", async () => {
  const { booking, payment } = await start();
  const p = pay(payment.orderId);
  assert.equal((await webhook("payment.captured", p, { sig: "none" })).status, 401);
  assert.equal((await webhook("payment.captured", p, { sig: "bad" })).status, 401);
  // Signed correctly, then the body altered in transit.
  const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: p } } });
  const sig = hmac(WEBHOOK_SECRET, raw);
  const tampered = await request("POST", "/api/razorpay/webhook", { raw: raw.replace(String(p.amount), "1"), headers: { "x-razorpay-signature": sig } });
  assert.equal(tampered.status, 401);
  // Signed correctly but not JSON.
  const junk = "not json at all";
  assert.equal((await request("POST", "/api/razorpay/webhook", { raw: junk, headers: { "x-razorpay-signature": hmac(WEBHOOK_SECRET, junk) } })).status, 400);
  assert.equal((await bookingOf(booking.id)).status, "pending_payment", "nothing was confirmed by any of those");
  // And the webhook route needs no staff session.
  assert.equal((await webhook("payment.captured", p)).status, 200);
});

test("webhooks for other products or unknown orders are acknowledged and ignored", async () => {
  const before = (await appointmentsRepo.listRows({ unpaged: true })).total;
  const foreign: FakePayment = { id: "pay_foreign", order_id: "order_foreign", amount: 12300, currency: "INR", status: "captured", method: "card", email: "", contact: "", captured: true, notes: {} };
  const r = await webhook("payment.captured", foreign);
  assert.equal(r.status, 200);
  assert.equal(r.body?.outcome, "unknown-order");
  // An order with another app's marker in its notes is also not ours.
  const marked: FakePayment = { ...foreign, id: "pay_foreign2", notes: { app: "someone-else", booking_id: "1" } };
  assert.equal((await webhook("payment.captured", marked)).body?.outcome, "unknown-order");
  assert.equal((await appointmentsRepo.listRows({ unpaged: true })).total, before);
  assert.equal((await ledgerOf("pay_foreign")), null);
  for (const ev of ["payment.dispute.created", "subscription.charged"]) {
    assert.equal((await webhook(ev, foreign)).body?.outcome, "ignored-event");
  }
});

test("webhook finds the booking by the booking id in the order notes when the order id isn't linked", async () => {
  const { booking, payment } = await start();
  await teleconsultBookingsRepo.update(booking.id, { gateway_order_id: null });
  const p = pay(payment.orderId);
  const w = await webhook("payment.captured", p);
  assert.equal(w.body?.outcome, "confirmed");
  assert.equal((await bookingOf(booking.id)).gateway_order_id, payment.orderId, "order id was back-filled");
});

test("duplicate webhook event id is recognised", async () => {
  const { payment } = await start();
  const p = pay(payment.orderId);
  assert.equal((await webhook("payment.captured", p, { eventId: "evt_dup" })).body?.outcome, "confirmed");
  assert.equal((await webhook("payment.captured", p, { eventId: "evt_dup" })).body?.outcome, "duplicate-event");
  assert.equal((await webhook("payment.captured", p, { eventId: "evt_dup2" })).body?.outcome, "already-confirmed");
});

// ── Money edge cases ─────────────────────────────────────────────────────────

test("amount mismatch is never confirmed and is flagged for staff", async () => {
  const { booking, payment } = await start();
  const p = pay(payment.orderId, "captured", { amount: 100 });
  const w = await webhook("payment.captured", p);
  assert.equal(w.body?.outcome, "amount-mismatch");
  assert.equal((await bookingOf(booking.id)).status, "pending_payment");
  assert.equal((await apptsOf(booking.id)).length, 0);
  assert.match((await ledgerOf(p.id))!.note ?? "", /Amount mismatch/);
});

test("authorized-only payment is captured automatically (webhook and verify paths)", async () => {
  const a = await start();
  const pa = pay(a.payment.orderId, "authorized", { captured: false });
  const w = await webhook("payment.authorized", pa);
  assert.equal(w.body?.outcome, "confirmed");
  assert.ok(rz.captures.includes(pa.id), "capture API was called");
  assert.equal(rz.payments.get(pa.id)!.status, "captured");

  const b = await start();
  const pb = pay(b.payment.orderId, "authorized", { captured: false });
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${b.booking.id}/verify`, verifyBody(b.patientId, pb));
  assert.equal(v.status, 200);
  assert.equal(v.data.status, "confirmed");
  assert.ok(rz.captures.includes(pb.id));
});

test("failed attempt, then a successful retry on the same order, confirms with the successful payment", async () => {
  const { booking, payment } = await start();
  const failed = pay(payment.orderId, "failed", { error_code: "BAD_REQUEST_ERROR", error_description: "Payment failed: card declined" });
  const f = await webhook("payment.failed", failed);
  assert.equal(f.body?.outcome, "failure-recorded");
  let b = await bookingOf(booking.id);
  assert.equal(b.status, "pending_payment");
  assert.match(b.failure_reason ?? "", /card declined/);
  assert.equal((await ledgerOf(failed.id))!.status, "failed");

  const ok = pay(payment.orderId, "captured");
  assert.equal((await webhook("payment.captured", ok)).body?.outcome, "confirmed");
  b = await bookingOf(booking.id);
  assert.equal(b.status, "confirmed");
  assert.equal(b.failure_reason, null, "stale failure message cleared");
  assert.equal((await apptsOf(booking.id))[0].payment_id, ok.id);
  // A late repeat of the old failure must not downgrade the successful payment.
  await webhook("payment.failed", failed, { eventId: "evt_late_fail" });
  assert.equal((await ledgerOf(ok.id))!.status, "captured");
});

// ── Verify endpoint security ─────────────────────────────────────────────────

test("verify rejects bad signature, wrong order, other patient, mock signature and unknown payment", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  const url = `/api/portal/teleconsult/bookings/${booking.id}/verify`;
  const good = verifyBody(patientId, p);

  assert.equal((await portal("POST", url, { ...good, razorpay_signature: "0".repeat(64) })).status, 400, "bad signature");
  assert.equal((await portal("POST", url, { ...good, razorpay_signature: "mock" })).status, 400, "mock signature never works with real keys");
  assert.equal((await portal("POST", url, { ...good, razorpay_order_id: "order_other", razorpay_signature: checkoutSig("order_other", p.id) })).status, 400, "wrong order");
  assert.equal((await portal("POST", url, { ...good, patientId: patientId === 1 ? 2 : 1 })).status, 404, "another patient");
  const ghostId = "pay_ghost";
  assert.equal((await portal("POST", url, { ...good, razorpay_payment_id: ghostId, razorpay_signature: checkoutSig(payment.orderId, ghostId) })).status, 400, "gateway has no such payment");
  assert.equal((await portal("POST", url, { patientId })).status, 400, "empty confirmation");
  assert.equal((await bookingOf(booking.id)).status, "pending_payment");
  assert.equal((await apptsOf(booking.id)).length, 0);
  assert.equal(verifyPaymentSignature("mock_order_1", "pay_1", "mock"), false);

  assert.equal((await portal("POST", url, good)).status, 200, "the genuine one still works afterwards");
});

test("verify refuses a payment the gateway reports as failed, wrong-amount or already refunded", async () => {
  const f = await start();
  const failed = pay(f.payment.orderId, "failed");
  assert.equal((await portal("POST", `/api/portal/teleconsult/bookings/${f.booking.id}/verify`, verifyBody(f.patientId, failed))).status, 409);

  const m = await start();
  const wrong = pay(m.payment.orderId, "captured", { amount: 100 });
  assert.equal((await portal("POST", `/api/portal/teleconsult/bookings/${m.booking.id}/verify`, verifyBody(m.patientId, wrong))).status, 409);
  assert.equal((await bookingOf(m.booking.id)).status, "pending_payment");

  const r = await start();
  const refunded = pay(r.payment.orderId, "refunded");
  assert.equal((await portal("POST", `/api/portal/teleconsult/bookings/${r.booking.id}/verify`, verifyBody(r.patientId, refunded))).status, 409);
});

test("gateway unreachable during verify: the checkout signature is enough, and details are noted for later", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  rz.down = true;
  const r = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  rz.down = false;
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.status, "confirmed");
  assert.match((await ledgerOf(p.id))!.note ?? "", /gateway lookup was unavailable/);
});

// ── Missed notifications: lazy lookup and the sweep ──────────────────────────

test("neither webhook nor verify arrives: asking for the booking or the transaction finds the payment at the gateway", async () => {
  const a = await start();
  pay(a.payment.orderId);
  const r = await portal("GET", `/api/portal/teleconsult/bookings/${a.booking.id}?patientId=${a.patientId}`);
  assert.equal(r.data.status, "confirmed", "status poll confirmed it");
  assert.equal((await apptsOf(a.booking.id)).length, 1);

  const b = await start();
  const pb = pay(b.payment.orderId);
  const l = await portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${b.patientId}&orderId=${b.payment.orderId}`);
  assert.equal(l.data.found, true);
  assert.equal(l.data.consultation.status, "Upcoming");
  assert.equal(l.data.payment.paymentId, pb.id);
  assert.equal((await ledgerOf(pb.id))!.recorded_via, "verify");
});

test("sweep confirms an old unpaid-looking booking whose payment actually succeeded", async () => {
  const { booking, payment } = await start();
  pay(payment.orderId);
  await backdate(booking.id, 3);
  const stats = await reconcile();
  assert.ok(stats.confirmed >= 1);
  assert.equal((await bookingOf(booking.id)).status, "confirmed");
  assert.equal((await apptsOf(booking.id)).length, 1);
});

test("sweep expires abandoned bookings; a payment that lands after expiry still confirms", async () => {
  const { booking, payment } = await start();
  await backdate(booking.id, 45);
  const stats = await reconcile();
  assert.ok(stats.expired >= 1);
  assert.equal((await bookingOf(booking.id)).status, "expired");

  const p = pay(payment.orderId);
  assert.equal((await webhook("payment.captured", p)).body?.outcome, "confirmed");
  assert.equal((await bookingOf(booking.id)).status, "confirmed");
});

test("a late payment for an expired booking whose slot was taken meanwhile is refunded, not lost", async () => {
  const { booking, payment, slot } = await start();
  await backdate(booking.id, 45);
  await reconcile();
  assert.equal((await bookingOf(booking.id)).status, "expired");
  await appointmentsRepo.create({
    hospital_id: 1, patient_id: 1, patient_name: "Walk-in", patient_age: 30, doctor_id: slot.doctorId, doctor: "Dr",
    appointment_date: slot.date, appointment_time: `${Number(slot.time.slice(0, 2)) % 12 || 12}:${slot.time.slice(3)} ${Number(slot.time.slice(0, 2)) >= 12 ? "PM" : "AM"}`,
    type: "Booked", reason: "x", status: "Upcoming",
  });
  const p = pay(payment.orderId);
  const w = await webhook("payment.captured", p);
  assert.equal(w.body?.outcome, "slot_conflict");
  const b = await bookingOf(booking.id);
  assert.equal(b.status, "slot_conflict");
  assert.ok(b.refunded_at, "refunded");
  assert.deepEqual(rz.refunds.filter((x) => x.paymentId === p.id), [{ paymentId: p.id, amount: 50000 }]);
});

// ── Slot conflict & refunds ──────────────────────────────────────────────────

test("slot taken between booking and payment: paid in full, refunded once, patient told", async () => {
  const { booking, payment, patientId, slot } = await start();
  await appointmentsRepo.create({
    hospital_id: 1, patient_id: 1, patient_name: "Walk-in", patient_age: 30, doctor_id: slot.doctorId, doctor: "Dr",
    appointment_date: slot.date, appointment_time: `${Number(slot.time.slice(0, 2)) % 12 || 12}:${slot.time.slice(3)} ${Number(slot.time.slice(0, 2)) >= 12 ? "PM" : "AM"}`,
    type: "Booked", reason: "x", status: "Upcoming",
  });
  const p = pay(payment.orderId);
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.status, 200);
  assert.equal(v.data.status, "slot_conflict");
  assert.match(v.data.failureReason, /refunded/);
  assert.equal((await apptsOf(booking.id)).length, 0);
  assert.equal((await ledgerOf(p.id))!.status, "refunded");
  // Everything that repeats the notification must not refund again.
  await webhook("payment.captured", p, { eventId: "evt_sc1" });
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  await reconcile();
  assert.equal(rz.refunds.filter((x) => x.paymentId === p.id).length, 1, "exactly one refund");
});

test("refund that fails at the gateway is retried by the sweep until it goes through", async () => {
  const { booking, payment, patientId, slot } = await start();
  await appointmentsRepo.create({
    hospital_id: 1, patient_id: 1, patient_name: "Walk-in", patient_age: 30, doctor_id: slot.doctorId, doctor: "Dr",
    appointment_date: slot.date, appointment_time: `${Number(slot.time.slice(0, 2)) % 12 || 12}:${slot.time.slice(3)} ${Number(slot.time.slice(0, 2)) >= 12 ? "PM" : "AM"}`,
    type: "Booked", reason: "x", status: "Upcoming",
  });
  const p = pay(payment.orderId);
  rz.refundFailures = 1;
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.data.status, "slot_conflict");
  assert.match(v.data.failureReason, /automatically/);
  assert.equal((await bookingOf(booking.id)).refunded_at ?? null, null);

  const stats = await reconcile();
  assert.ok(stats.refundsRetried >= 1);
  const b = await bookingOf(booking.id);
  assert.ok(b.refunded_at);
  assert.match(b.failure_reason ?? "", /has been refunded/);
});

test("refund already done at Razorpay counts as done (no error, no second refund)", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  rz.payments.get(p.id)!.status = "refunded"; // refunded from the dashboard earlier
  const appt = (await apptsOf(booking.id))[0];
  const c = await staff("POST", `/api/teleconsult/${appt.id}/cancel`, {});
  assert.equal(c.status, 200, JSON.stringify(c.error));
  assert.equal(c.data.refund.done, true);
  assert.ok((await bookingOf(booking.id)).refunded_at);
});

test("refund made in the Razorpay dashboard is mirrored by the refund.processed webhook", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  const raw = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash", payment_id: p.id, amount: 50000, status: "processed" } } } });
  const w = await request("POST", "/api/razorpay/webhook", { raw, headers: { "x-razorpay-signature": hmac(WEBHOOK_SECRET, raw), "x-razorpay-event-id": "evt_rf" } });
  assert.equal(w.body?.outcome, "refund-recorded");
  const b = await bookingOf(booking.id);
  assert.equal(b.refund_reference, "rfnd_dash");
  assert.ok(b.refunded_at);
  assert.equal((await apptsOf(booking.id))[0].payment_status, "Refunded");
  assert.equal((await ledgerOf(p.id))!.status, "refunded");
});

// ── Staff flows ──────────────────────────────────────────────────────────────

test("staff booking (cash) is ledgered with an id, and cancelling returns the fee on record", async () => {
  const slot = nextSlot();
  const r = await staff("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "front desk", paymentMode: "cash", reference: "RCPT-77" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const appt = (await apptsOf(r.data.id))[0];
  assert.equal(appt.payment_id, "RCPT-77");
  const led = (await ledgerOf("RCPT-77"))!;
  assert.equal(led.mode, "cash");
  assert.equal(led.recorded_via, "staff");
  assert.equal(led.appointment_id, appt.id);

  const c = await staff("POST", `/api/teleconsult/${appt.id}/cancel`, {});
  assert.equal(c.status, 200);
  assert.equal(c.data.refund.manual, true);
  assert.match(c.data.refund.reference, /Return ₹500/);
  assert.equal((await ledgerOf("RCPT-77"))!.status, "refunded");
  assert.equal((await staff("POST", `/api/teleconsult/${appt.id}/cancel`, {})).status, 409, "can't cancel twice");

  // Waived and reference-less bookings still get a findable id.
  const s2 = nextSlot();
  const w = await staff("POST", "/api/teleconsult/bookings", { patientId: nextPatient(), doctorId: s2.doctorId, date: s2.date, time: s2.time, reason: "waived", paymentMode: "waived" });
  assert.equal(w.status, 201);
  assert.ok((await apptsOf(w.data.id))[0].payment_id?.startsWith("WAIVED-"));
});

test("staff cancel of an online payment refunds through the gateway; if that fails nothing is cancelled and a retry works", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  const appt = (await apptsOf(booking.id))[0];

  rz.refundFailures = 1;
  const failed = await staff("POST", `/api/teleconsult/${appt.id}/cancel`, {});
  assert.equal(failed.status, 502);
  assert.equal((await appointmentsRepo.getRow(appt.id))!.status, "Upcoming", "still booked");
  assert.equal((await bookingOf(booking.id)).refunded_at ?? null, null);

  const ok = await staff("POST", `/api/teleconsult/${appt.id}/cancel`, {});
  assert.equal(ok.status, 200);
  assert.equal((await appointmentsRepo.getRow(appt.id))!.status, "Cancelled");
  assert.equal((await ledgerOf(p.id))!.status, "refunded");
  assert.equal(rz.refunds.filter((x) => x.paymentId === p.id).length, 1);
});

test("payments list shows payment id, order id, method, who recorded it and the appointment", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await webhook("payment.captured", p);
  const r = await staff("GET", "/api/teleconsult/payments");
  assert.equal(r.status, 200);
  const item = r.data.items.find((i: { id: number }) => i.id === booking.id);
  assert.equal(item.paymentId, p.id);
  assert.equal(item.orderId, payment.orderId);
  assert.equal(item.method, "upi");
  assert.equal(item.recordedVia, "webhook");
  assert.equal(item.status, "Paid");
  assert.equal(item.patientId, patientId);
  assert.ok(item.appointmentId);
  assert.ok(r.data.totals.collected >= 500);
});

test("staff can re-check a stuck payment from the Payments tab", async () => {
  const { booking, payment } = await start();
  pay(payment.orderId);
  const r = await staff("POST", `/api/teleconsult/payments/${booking.id}/sync`);
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "confirmed");
  assert.equal(r.data.changed, true);
});

test("free consultation confirms immediately with its own ledger id", async () => {
  await setPrice(0);
  const slot = nextSlot();
  const patientId = nextPatient();
  const r = await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "free visit" });
  assert.equal(r.status, 201);
  assert.equal(r.data.payment, null);
  assert.equal(r.data.booking.status, "confirmed");
  const appt = (await apptsOf(r.data.booking.id))[0];
  assert.equal(appt.payment_status, "Free");
  assert.ok(appt.payment_id?.startsWith("FREE-"));
});

// ── Booking-time guarantees ──────────────────────────────────────────────────

test("price tampering, past times, closed days and double booking are all refused", async () => {
  const slot = nextSlot();
  const patientId = nextPatient();
  const r = await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "tamper", amount: 1, price: 1, hospitalId: 2 });
  assert.equal(r.status, 201);
  assert.equal(r.data.payment.amountPaise, 50000, "client amount ignored");
  assert.equal(rz.orders.get(r.data.payment.orderId)!.amount, 50000);

  const yesterday = istDate(-1);
  assert.equal((await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: 2, date: yesterday, time: "10:00", reason: "past" })).status, 400);
  const sunday = (() => { for (let i = 1; i < 10; i++) { const d = istDate(i); if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) return d; } throw new Error("no sunday"); })();
  assert.equal((await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: 2, date: sunday, time: "10:00", reason: "closed" })).status, 400);
  assert.equal((await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: 2, date: slot.date, time: "03:00", reason: "night" })).status, 400);

  // Someone else wants the slot while it's held for the first patient.
  const other = await portal("POST", "/api/portal/teleconsult/bookings", { patientId: patientId === 1 ? 2 : 1, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "same slot" });
  assert.equal(other.status, 409);
  // The same patient asking again gets the same open order back.
  const again = await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "retry" });
  assert.equal(again.status, 201);
  assert.equal(again.data.payment.orderId, r.data.payment.orderId);
  assert.equal(again.data.booking.id, r.data.booking.id);
});

test("one patient can't pile up unpaid bookings", async () => {
  const patientId = nextPatient();
  for (let i = 0; i < 3; i++) await start({ patientId });
  const slot = nextSlot();
  const r = await portal("POST", "/api/portal/teleconsult/bookings", { patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "one too many" });
  assert.equal(r.status, 409);
});

test("portal routes need the portal key; public link routes need a genuine token", async () => {
  const noKey = await request("GET", "/api/portal/teleconsult/config?patientId=1");
  assert.equal(noKey.status, 401);
  const wrongKey = await request("GET", "/api/portal/teleconsult/consultations?patientId=1", { headers: { "x-portal-key": "wrong" } });
  assert.equal(wrongKey.status, 401);
  assert.equal((await request("GET", "/api/portal/teleconsult/payments/lookup?patientId=1&orderId=x")).status, 401);
  assert.equal((await request("GET", "/api/public/teleconsult/session?token=junk.junk")).status, 400);

  const patientId = nextPatient();
  const link = await staff("POST", "/api/teleconsult/links", { patientId });
  assert.equal(link.status, 201);
  const token = link.data.token as string;
  const session = await request("GET", `/api/public/teleconsult/session?token=${token}`);
  assert.equal(session.status, 200);
  assert.equal(session.data.price, 500);
  assert.ok(!JSON.stringify(session.data).includes("phone"), "no personal details beyond the first name");

  const slot = nextSlot();
  const b = await request("POST", "/api/public/teleconsult/bookings", { body: { token, patientId: 999, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "via link", amount: 1 } });
  assert.equal(b.status, 201, JSON.stringify(b.error));
  assert.equal(b.data.booking.patientId, patientId, "token decides the patient, not the body");
  const p = pay(b.data.payment.orderId);
  const v = await request("POST", `/api/public/teleconsult/bookings/${b.data.booking.id}/verify`, { body: { token, ...verifyBody(0, p) } });
  assert.equal(v.status, 200);
  assert.equal(v.data.status, "confirmed");

  // A token for a different patient can't touch this booking.
  const otherLink = await staff("POST", "/api/teleconsult/links", { patientId: patientId === 1 ? 2 : 1 });
  const peek = await request("GET", `/api/public/teleconsult/bookings/${b.data.booking.id}?token=${otherLink.data.token}`);
  assert.equal(peek.status, 404);
  const [head, tail] = token.split(".");
  assert.equal((await request("GET", `/api/public/teleconsult/session?token=${head}.${tail.slice(0, -2)}xx`)).status, 400, "tampered token");
});

// ── Meet links ───────────────────────────────────────────────────────────────

test("Meet failure leaves a confirmed appointment with the reason; the sweep creates the link later, once", async () => {
  g.mode = "fail";
  g.spaceMode = "fail"; // both the Meet API and the calendar fallback are down
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.data.status, "confirmed");
  assert.equal(v.data.videoUrl, null);
  const appt = (await apptsOf(booking.id))[0];
  assert.match(appt.meet_error ?? "", /Backend Error/);
  const view = await portal("GET", `/api/portal/teleconsult/consultations/${appt.id}?patientId=${patientId}`);
  assert.equal(view.data.linkStatus, "pending");
  assert.equal(view.data.videoUrl, null);

  g.mode = "ok";
  const stats = await reconcile();
  assert.ok(stats.meetLinksCreated >= 1);
  const after = (await appointmentsRepo.getRow(appt.id))!;
  assert.ok(after.video_url);
  assert.equal(after.meet_error, null);
  const view2 = await portal("GET", `/api/portal/teleconsult/consultations/${appt.id}?patientId=${patientId}`);
  assert.equal(view2.data.linkStatus, "ready");
});

test("Google answering after we gave up doesn't create a second calendar event", async () => {
  g.mode = "lost-response";
  const before = g.created;
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  const appt = (await apptsOf(booking.id))[0];
  assert.equal(g.created - before, 1, "event created once");
  assert.equal((await appointmentsRepo.getRow(appt.id))!.video_url ?? null, null, "we never saw the link");

  await reconcile();
  assert.equal(g.created - before, 1, "retry reused the existing event instead of making another");
  assert.ok((await appointmentsRepo.getRow(appt.id))!.video_url, "link recovered");
});

test("Google not connected: booking still confirms; manual link works", async () => {
  await connectGoogle(false);
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.data.status, "confirmed");
  assert.equal(v.data.videoUrl, null);
  const appt = (await apptsOf(booking.id))[0];
  const put = await staff("PUT", `/api/teleconsult/${appt.id}/link`, { videoUrl: "https://meet.google.com/manual-abc" });
  assert.equal(put.status, 200);
  const view = await portal("GET", `/api/portal/teleconsult/consultations/${appt.id}?patientId=${patientId}`);
  assert.equal(view.data.videoUrl, "https://meet.google.com/manual-abc");
  assert.equal(view.data.videoProvider, "manual");
});

test("Google connected WITHOUT the calendar permission is refused, with a clear reason", async () => {
  const { buildConnectUrl, completeConnect, googleStatus, GoogleReconnectError } = await import("@/services/google-meet");
  const state = new URL(await buildConnectUrl(1, 1, "http://localhost:3005")).searchParams.get("state")!;
  g.codeScope = "openid email"; // the admin unticked Calendar on Google's screen
  await assert.rejects(() => completeConnect("code", state, "http://localhost:3005"), (e) => e instanceof GoogleReconnectError && /calendar/i.test(e.message));
  g.codeScope = `openid email ${CAL}`;
  const ok = await completeConnect("code", state, "http://localhost:3005");
  assert.equal(ok.email, "hospital@example.com");
  const st = await googleStatus(1);
  assert.equal(st.connected, true);
  assert.equal(st.needsReconnect, false);
  // The callback route turns the refusal into a message the Settings page shows.
  const cb = await staff("GET", `/api/teleconsult/google/callback?code=c&state=${state}`);
  assert.ok([307, 302].includes(cb.status));
  assert.match(cb.headers.get("location") ?? "", /google=(connected|error)/);
});

test("a connection that turns out to lack Calendar (or was revoked) is flagged once, not retried forever, and clears on reconnect", async () => {
  const { googleStatus, buildConnectUrl, completeConnect } = await import("@/services/google-meet");
  g.refreshScope = "openid email"; // an older connection made before scopes were checked
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.data.status, "confirmed", "the booking itself is unaffected");
  assert.equal(v.data.videoUrl, null);
  const appt = (await apptsOf(booking.id))[0];
  assert.match(appt.meet_error ?? "", /calendar access/i);
  let st = await googleStatus(1);
  assert.equal(st.needsReconnect, true);
  assert.equal(st.connected, false);
  const cfg = await staff("GET", "/api/teleconsult/config");
  assert.equal(cfg.data.google.needsReconnect, true);

  const before = g.tokenCalls;
  await reconcile();
  assert.equal(g.tokenCalls, before, "the sweep doesn't keep calling Google for a connection known to be unusable");

  const state = new URL(await buildConnectUrl(1, 1, "http://localhost:3005")).searchParams.get("state")!;
  await completeConnect("code", state, "http://localhost:3005");
  g.refreshScope = undefined;
  st = await googleStatus(1);
  assert.equal(st.needsReconnect, false);
  await reconcile();
  assert.ok((await appointmentsRepo.getRow(appt.id))!.video_url, "after reconnecting, the sweep creates the missing link");

  // Revoked / expired refresh token (Google expires them after 7 days while the OAuth app is in Testing).
  g.refreshError = "invalid_grant";
  const b2 = await start();
  await portal("POST", `/api/portal/teleconsult/bookings/${b2.booking.id}/verify`, verifyBody(b2.patientId, pay(b2.payment.orderId)));
  assert.equal((await googleStatus(1)).needsReconnect, true);
  assert.match((await googleStatus(1)).lastError ?? "", /reconnect/i);
});

test("Razorpay retrying a webhook after our own failure still confirms (a failed delivery is not 'seen')", async () => {
  const { booking, payment } = await start();
  const p = pay(payment.orderId);
  const realCreate = appointmentsRepo.create;
  let failures = 1;
  appointmentsRepo.create = (async (...args: Parameters<typeof realCreate>) => {
    if (failures-- > 0) throw new Error("database hiccup");
    return realCreate(...args);
  }) as typeof realCreate;
  try {
    const first = await webhook("payment.captured", p, { eventId: "evt_retry" });
    assert.equal(first.status, 500, "we tell Razorpay to try again");
    assert.equal((await bookingOf(booking.id)).status, "pending_payment");
    const second = await webhook("payment.captured", p, { eventId: "evt_retry" });
    assert.equal(second.status, 200);
    assert.equal(second.body?.outcome, "confirmed", "the retry is processed, not skipped as a duplicate");
  } finally {
    appointmentsRepo.create = realCreate;
  }
  assert.equal((await apptsOf(booking.id)).length, 1);
  assert.equal((await ledgerOf(p.id))!.status, "captured");
});

test("an appointment another server already created for this booking is adopted, not treated as a slot clash", async () => {
  const { booking, payment, patientId, slot } = await start();
  const b = await bookingOf(booking.id);
  await appointmentsRepo.create({
    hospital_id: 1, patient_id: patientId, patient_name: b.patient_name, patient_age: 30, doctor_id: slot.doctorId, doctor: b.doctor_name,
    appointment_date: b.appointment_date, appointment_time: b.appointment_time, type: "Tele-consult", reason: "r", status: "Upcoming",
    booking_id: booking.id, consult_amount: 500, payment_status: "Paid",
  }); // …but its booking row still says pending (the other server died before saving it)
  const p = pay(payment.orderId);
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  assert.equal(v.data.status, "confirmed");
  assert.equal((await apptsOf(booking.id)).length, 1);
  assert.equal(rz.refunds.filter((x) => x.paymentId === p.id).length, 0, "no refund");
  assert.equal((await bookingOf(booking.id)).refunded_at ?? null, null);
});

test("a payment that lands on a closed booking is returned automatically; if that fails it is flagged for staff", async () => {
  const a = await start();
  await teleconsultBookingsRepo.update(a.booking.id, { status: "cancelled" });
  const pa = pay(a.payment.orderId);
  assert.equal((await webhook("payment.captured", pa)).body?.outcome, "refunded-closed-booking");
  assert.equal(rz.refunds.filter((x) => x.paymentId === pa.id).length, 1);
  assert.equal((await ledgerOf(pa.id))!.status, "refunded");

  const b = await start();
  await teleconsultBookingsRepo.update(b.booking.id, { status: "cancelled" });
  const pb = pay(b.payment.orderId);
  rz.refundFailures = 1;
  assert.equal((await webhook("payment.captured", pb)).body?.outcome, "refund-pending");
  assert.match((await ledgerOf(pb.id))!.note ?? "", /NEEDS REFUND/);
});

test("a slow gateway can't hold the patient's confirmation hostage", async () => {
  const { booking, payment, patientId } = await start();
  const p = pay(payment.orderId);
  rz.delayMs = 2000; // longer than the 300 ms budget the tests configure
  const t0 = Date.now();
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p));
  rz.delayMs = 0;
  assert.equal(v.data.status, "confirmed");
  assert.ok(Date.now() - t0 < 1800, `answered in ${Date.now() - t0} ms`);
});

test("the sweep doesn't create Meet links for consultations that are already over", async () => {
  const old = await appointmentsRepo.create({
    hospital_id: 1, patient_id: 1, patient_name: "Old", patient_age: 30, doctor_id: 1, doctor: "Dr",
    appointment_date: istDate(-3), appointment_time: "10:00 AM", type: "Tele-consult", reason: "past", status: "Upcoming",
  });
  await reconcile();
  assert.equal(g.events.has(`samvaadtc${old.id}`), false, "no calendar event for it");
  assert.equal((await appointmentsRepo.getRow(old.id))!.video_url ?? null, null);
});

test("chaos: 120 random interleavings of every confirmation route, with outages, uphold the invariants", async () => {
  // Deterministic, so a failure can be replayed: the seed is in the message.
  let seed = 20261007;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jitter = () => new Promise((r) => setTimeout(r, Math.floor(rand() * 15)));
  const to12 = (t: string) => `${Number(t.slice(0, 2)) % 12 || 12}:${t.slice(3)} ${Number(t.slice(0, 2)) >= 12 ? "PM" : "AM"}`;

  for (let i = 0; i < 120; i++) {
    const tag = `iteration ${i}`;
    const { booking, payment, patientId, slot } = await start();
    const stolen = rand() < 0.15;
    if (stolen) {
      await appointmentsRepo.create({ hospital_id: 1, patient_id: 1, patient_name: "Walk-in", patient_age: 30, doctor_id: slot.doctorId, doctor: "Dr",
        appointment_date: slot.date, appointment_time: to12(slot.time), type: "Booked", reason: "x", status: "Upcoming" });
    }
    const p = pay(payment.orderId, rand() < 0.2 ? "authorized" : "captured", rand() < 0.1 ? {} : {});
    const gatewayDown = rand() < 0.2;
    const sends: (() => Promise<unknown>)[] = [];
    const channels = { verify: rand() < 0.6, webhook: rand() < 0.6, lookup: rand() < 0.4, sweep: rand() < 0.3 };
    if (!channels.verify && !channels.webhook && !channels.lookup && !channels.sweep) channels.webhook = true;
    if (channels.verify) for (let k = 0; k < 1 + Math.floor(rand() * 2); k++) sends.push(() => portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, p)));
    if (channels.webhook) for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) sends.push(() => webhook(p.status === "authorized" ? "payment.authorized" : "payment.captured", p, { eventId: `evt_chaos_${i}_${k}` }));
    if (channels.lookup) sends.push(() => portal("GET", `/api/portal/teleconsult/payments/lookup?patientId=${patientId}&orderId=${payment.orderId}`));
    if (channels.sweep) sends.push(async () => { await backdate(booking.id, 3); return reconcile(); });
    if (gatewayDown) rz.down = true;
    await Promise.all(sends.map(async (send) => { await jitter(); try { await send(); } catch { /* a 5xx here is a retry for Razorpay — the invariants below must still hold */ } }));
    rz.down = false;

    // Whatever got missed, the safety net settles it.
    await backdate(booking.id, 3);
    await reconcile();
    await webhook(p.status === "authorized" ? "payment.authorized" : "payment.captured", p, { eventId: `evt_chaos_${i}_final` });

    const b = await bookingOf(booking.id);
    const appts = await apptsOf(booking.id);
    const refunds = rz.refunds.filter((x) => x.paymentId === p.id).length;
    const ledgerRows = (await teleconsultPaymentsRepo.listRows({ filters: [{ column: "booking_id", op: "eq", value: booking.id }], unpaged: true })).rows;
    const ctx = `${tag} (seed state ${seed}, stolen=${stolen}, down=${gatewayDown}, ${JSON.stringify(channels)})`;
    assert.ok(appts.length <= 1, `${ctx}: never more than one appointment (got ${appts.length})`);
    assert.ok(refunds <= 1, `${ctx}: never more than one refund (got ${refunds})`);
    assert.equal(ledgerRows.length, 1, `${ctx}: exactly one ledger row`);
    if (stolen) {
      assert.equal(b.status, "slot_conflict", `${ctx}: lost slot is closed`);
      assert.equal(appts.length, 0, `${ctx}: no appointment for a lost slot`);
      assert.equal(refunds, 1, `${ctx}: and the money is returned exactly once`);
      assert.ok(b.refunded_at, `${ctx}: refund recorded`);
    } else {
      assert.equal(b.status, "confirmed", `${ctx}: paid booking is confirmed`);
      assert.equal(appts.length, 1, `${ctx}: with its appointment`);
      assert.equal(refunds, 0, `${ctx}: and never refunded`);
      assert.equal(appts[0].payment_id, p.id, `${ctx}: appointment carries the payment id`);
      assert.equal(ledgerRows[0].appointment_id, appts[0].id, `${ctx}: ledger points at the appointment`);
      assert.equal(rz.payments.get(p.id)!.status, "captured", `${ctx}: payment ended up captured`);
    }
  }
});

test("the Meet room is created through the Meet API with the access type the hospital chose, so patients aren't shut out", async () => {
  const spacesBefore = g.spaces.length;
  const a = await start();
  const pa = pay(a.payment.orderId);
  await portal("POST", `/api/portal/teleconsult/bookings/${a.booking.id}/verify`, verifyBody(a.patientId, pa));
  const appt = (await apptsOf(a.booking.id))[0];
  assert.equal(g.spaces.length, spacesBefore + 1);
  assert.equal(g.spaces[g.spaces.length - 1].accessType, "OPEN", "open by default: anyone with the link can join");
  assert.equal(appt.video_url, g.spaces[g.spaces.length - 1].uri);
  assert.equal(appt.meet_access, "OPEN");
  assert.equal(appt.meet_warning ?? null, null);
  const ev = g.events.get(`samvaadtc${appt.id}`)!;
  assert.equal(ev.location, appt.video_url, "the calendar invite carries the same link");
  assert.equal(ev.hangoutLink, undefined, "no calendar-made (invitees-only) room");

  // The admin changes it to "ask to join": the next booking's room follows.
  const set = await staff("PATCH", "/api/admin/settings", { teleconsultMeetAccess: "TRUSTED" });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal(set.data.teleconsultMeetAccess, "TRUSTED");
  assert.equal((await staff("PATCH", "/api/admin/settings", { teleconsultMeetAccess: "EVERYONE" })).status, 422, "unknown value refused");
  const b = await start();
  await portal("POST", `/api/portal/teleconsult/bookings/${b.booking.id}/verify`, verifyBody(b.patientId, pay(b.payment.orderId)));
  assert.equal(g.spaces[g.spaces.length - 1].accessType, "TRUSTED");
  assert.equal((await apptsOf(b.booking.id))[0].meet_access, "TRUSTED");
});

test("without the Meet permission, or if the Meet API is down, the old calendar room is used and flagged — then 'Recreate link' fixes it", async () => {
  // 1. Connection made before call-access control existed.
  await googleConnectionsRepo.update((await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: 1 }]))!.id, { scopes: CAL });
  const { googleStatus } = await import("@/services/google-meet");
  assert.equal((await googleStatus(1)).meetAccessControl, false);
  const a = await start();
  await portal("POST", `/api/portal/teleconsult/bookings/${a.booking.id}/verify`, verifyBody(a.patientId, pay(a.payment.orderId)));
  let appt = (await apptsOf(a.booking.id))[0];
  assert.ok(appt.video_url, "a link still exists");
  assert.equal(appt.meet_access, "calendar-default");
  assert.match(appt.meet_warning ?? "", /reconnect Google/i);

  // 2. Permission present but the Meet API isn't enabled in the Google project.
  await connectGoogle(true);
  g.spaceMode = "fail";
  const b = await start();
  await portal("POST", `/api/portal/teleconsult/bookings/${b.booking.id}/verify`, verifyBody(b.patientId, pay(b.payment.orderId)));
  const apptB = (await apptsOf(b.booking.id))[0];
  assert.equal(apptB.meet_access, "calendar-default");
  assert.match(apptB.meet_warning ?? "", /Meet REST API/);

  // 3. Everything fixed → staff recreate the link: a new open room replaces the restricted one.
  g.spaceMode = "ok";
  const oldLink = apptB.video_url;
  const r = await staff("POST", `/api/teleconsult/${apptB.id}/meet`, { replace: true });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.notEqual(r.data.videoUrl, oldLink);
  assert.equal(r.data.meetAccess, "OPEN");
  assert.equal(r.data.meetWarning, null);
  appt = (await appointmentsRepo.getRow(apptB.id))!;
  assert.equal(appt.video_url, r.data.videoUrl);

  // A failed replacement never takes the working link away.
  g.spaceMode = "fail";
  g.mode = "fail";
  const keep = await staff("POST", `/api/teleconsult/${apptB.id}/meet`, { replace: true });
  assert.equal(keep.data.videoUrl, r.data.videoUrl);
  assert.match(keep.data.meetWarning ?? "", /Couldn't create a new link/);
});

test("if only the calendar entry fails after the room was made, the patient still gets the link (with a note)", async () => {
  g.mode = "fail"; // calendar down, Meet API fine
  const { booking, payment, patientId } = await start();
  const v = await portal("POST", `/api/portal/teleconsult/bookings/${booking.id}/verify`, verifyBody(patientId, pay(payment.orderId)));
  assert.equal(v.data.status, "confirmed");
  assert.ok(v.data.videoUrl, "link given");
  const appt = (await apptsOf(booking.id))[0];
  assert.equal(appt.meet_access, "OPEN");
  assert.match(appt.meet_warning ?? "", /calendar/i);
});

test("the patient's email reaches the Google invite: given at booking, at confirmation, from the payment window, or from their record", async () => {
  const invited = (apptId: number) => g.events.get(`samvaadtc${apptId}`)!.attendees;
  const body = (slot: ReturnType<typeof nextSlot>, patientId: number, email?: string) => ({ patientId, doctorId: slot.doctorId, date: slot.date, time: slot.time, reason: "email test", ...(email !== undefined ? { email } : {}) });

  // 1. with the booking (and tidied up: trimmed, lower-cased)
  const s1 = nextSlot(); const pid1 = nextPatient();
  const r1 = await portal("POST", "/api/portal/teleconsult/bookings", body(s1, pid1, "  Maya.Patient@Example.COM "));
  assert.equal(r1.status, 201);
  assert.equal(r1.data.payment.prefill.email, "maya.patient@example.com", "the payment window is prefilled with it");
  await portal("POST", `/api/portal/teleconsult/bookings/${r1.data.booking.id}/verify`, verifyBody(pid1, pay(r1.data.payment.orderId)));
  assert.ok(invited((await apptsOf(r1.data.booking.id))[0].id).includes("maya.patient@example.com"));

  // 2. only with the confirmation
  const s2 = nextSlot(); const pid2 = nextPatient();
  const r2 = await portal("POST", "/api/portal/teleconsult/bookings", body(s2, pid2));
  const v2 = await portal("POST", `/api/portal/teleconsult/bookings/${r2.data.booking.id}/verify`, { ...verifyBody(pid2, pay(r2.data.payment.orderId)), email: "later@example.com" });
  assert.equal(v2.status, 200);
  assert.ok(invited((await apptsOf(r2.data.booking.id))[0].id).includes("later@example.com"));
  assert.equal((await bookingOf(r2.data.booking.id)).patient_email, "later@example.com");

  // 3. neither — but the patient typed one into the payment window
  const s3 = nextSlot(); const pid3 = nextPatient();
  await patientsRepoClearEmail(pid3);
  const r3 = await portal("POST", "/api/portal/teleconsult/bookings", body(s3, pid3));
  await portal("POST", `/api/portal/teleconsult/bookings/${r3.data.booking.id}/verify`, verifyBody(pid3, pay(r3.data.payment.orderId, "captured", { email: "Typed.In.Checkout@Example.com" })));
  assert.ok(invited((await apptsOf(r3.data.booking.id))[0].id).includes("typed.in.checkout@example.com"));

  // 4. nothing anywhere: the email on the patient's record
  const s4 = nextSlot(); const pid4 = nextPatient();
  await patientsRepoSetEmail(pid4, "record@example.com");
  const r4 = await portal("POST", "/api/portal/teleconsult/bookings", body(s4, pid4));
  await portal("POST", `/api/portal/teleconsult/bookings/${r4.data.booking.id}/verify`, verifyBody(pid4, pay(r4.data.payment.orderId, "captured", { email: "" })));
  assert.ok(invited((await apptsOf(r4.data.booking.id))[0].id).includes("record@example.com"));

  // 5. asking again for the same open slot with a corrected email updates it
  const s5 = nextSlot(); const pid5 = nextPatient();
  const r5 = await portal("POST", "/api/portal/teleconsult/bookings", body(s5, pid5, "typo@example.com"));
  const again = await portal("POST", "/api/portal/teleconsult/bookings", body(s5, pid5, "fixed@example.com"));
  assert.equal(again.data.booking.id, r5.data.booking.id);
  assert.equal(again.data.payment.prefill.email, "fixed@example.com");
  await portal("POST", `/api/portal/teleconsult/bookings/${r5.data.booking.id}/verify`, verifyBody(pid5, pay(r5.data.payment.orderId)));
  const inv5 = invited((await apptsOf(r5.data.booking.id))[0].id);
  assert.ok(inv5.includes("fixed@example.com") && !inv5.includes("typo@example.com"));

  // 6. a malformed address is refused up front, and ignored (not fatal) at confirmation
  const s6 = nextSlot(); const pid6 = nextPatient();
  assert.equal((await portal("POST", "/api/portal/teleconsult/bookings", body(s6, pid6, "not-an-email"))).status, 422);
  const r6 = await portal("POST", "/api/portal/teleconsult/bookings", body(s6, pid6));
  const v6 = await portal("POST", `/api/portal/teleconsult/bookings/${r6.data.booking.id}/verify`, { ...verifyBody(pid6, pay(r6.data.payment.orderId)), email: "garbage" });
  assert.equal(v6.status, 200, "a bad email never blocks a payment that went through");
  assert.equal(v6.data.status, "confirmed");

  // 7. an email can't be slipped in with a forged confirmation
  const s7 = nextSlot(); const pid7 = nextPatient();
  const r7 = await portal("POST", "/api/portal/teleconsult/bookings", body(s7, pid7, "owner@example.com"));
  const forged = await portal("POST", `/api/portal/teleconsult/bookings/${r7.data.booking.id}/verify`, { ...verifyBody(pid7, pay(r7.data.payment.orderId)), razorpay_signature: "0".repeat(64), email: "attacker@example.com" });
  assert.equal(forged.status, 400);
  assert.equal((await bookingOf(r7.data.booking.id)).patient_email, "owner@example.com");

  // 8. the doctor and patient sharing an address are invited once
  const s8 = nextSlot(); const pid8 = nextPatient();
  const doctorEmailAddr = (await (await import("@/repositories")).usersRepo.findRow([{ column: "doctor_id", op: "eq", value: s8.doctorId }]))?.email;
  if (doctorEmailAddr) {
    const r8 = await portal("POST", "/api/portal/teleconsult/bookings", body(s8, pid8, doctorEmailAddr));
    await portal("POST", `/api/portal/teleconsult/bookings/${r8.data.booking.id}/verify`, verifyBody(pid8, pay(r8.data.payment.orderId)));
    const inv8 = invited((await apptsOf(r8.data.booking.id))[0].id);
    assert.equal(inv8.filter((e) => e === doctorEmailAddr.toLowerCase()).length, 1);
  }
});

async function patientsRepoClearEmail(id: number) { await (await import("@/repositories")).patientsRepo.update(id, { email: null }); }
async function patientsRepoSetEmail(id: number, email: string) { await (await import("@/repositories")).patientsRepo.update(id, { email }); }

// ── Portal consultation list ─────────────────────────────────────────────────

test("consultations list shows status, phase and link for the patient only", async () => {
  const { booking, payment, patientId } = await start();
  await webhook("payment.captured", pay(payment.orderId));
  const list = await portal("GET", `/api/portal/teleconsult/consultations?patientId=${patientId}`);
  assert.equal(list.status, 200);
  const mine = list.data.upcoming.find((c: { bookingId: number }) => c.bookingId === booking.id);
  assert.ok(mine);
  assert.equal(mine.phase, "scheduled");
  assert.equal(mine.paymentStatus, "Paid");
  assert.ok(mine.startsAt);
  const other = await portal("GET", `/api/portal/teleconsult/consultations/${mine.appointmentId}?patientId=${patientId === 1 ? 2 : 1}`);
  assert.equal(other.status, 404);
});

// ── Run ──────────────────────────────────────────────────────────────────────

const passes = Math.max(1, Number(process.argv[2]) || 1);
let failed = 0;
for (let pass = 1; pass <= passes; pass++) {
  if (passes > 1) console.log(`\n── pass ${pass}/${passes} ──`);
  for (const t of tests) {
    await resetBetweenTests();
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL  ${t.name}`);
      console.log("        " + String((err as Error).stack ?? err).split("\n").slice(0, 6).join("\n        "));
    }
  }
}
console.log(`\n${tests.length * passes - failed}/${tests.length * passes} passed${failed ? `, ${failed} FAILED` : ""}`);

// Against a real MongoDB the run uses a throw-away database (see the header); clean it up.
const dbName = process.env.MONGODB_DB ?? "";
if (process.env.DATABASE_DRIVER === "mongo" && dbName.startsWith("samvaad_test_") && process.env.MONGODB_URI) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  await client.db(dbName).dropDatabase();
  await client.close();
  console.log(`dropped scratch database ${dbName}`);
}
process.exit(failed ? 1 : 0);
