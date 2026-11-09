/**
 * Tests for the Finance combined bill: bills grouped by type with subtotals, the date range, refunds left out, paid and due, and who may see it.
 *
 *   npm run test:combined-bill
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo, billsRepo } = await import("@/repositories");
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
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_HOSPITAL = "admin@sunrisehospital.in";

const hospitalId = (await patientsRepo.getRow(1))!.hospital_id;
let seq = 0;
async function mkPatient(name: string) {
  seq++;
  return patientsRepo.create({ hospital_id: hospitalId, patient_code: `CB-${String(seq).padStart(4, "0")}`, name, age: 41, gender: "Female", phone: `91000${String(seq).padStart(5, "0")}`, reason: "", doctor_id: null, doctor: "", status: "Completed", visit_date: "2026-01-01", visit_time: "10:00 AM", address: "A-22 Society", city: "Surat" }) as Promise<{ id: number; name: string }>;
}
/** A bill with lines, then moved to the given date and status (bills are dated today when created). */
async function bill(p: { id: number; name: string }, type: string, items: { description: string; quantity: number; unitPrice: number; gstRate?: number }[], opts: { date?: string; status?: string } = {}) {
  const r = await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type, status: opts.status ?? "Paid", items: items.map((i) => ({ gstRate: 0, ...i })) });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  if (opts.date) await billsRepo.update(r.data.id, { bill_date: opts.date });
  return r.data;
}
const get = (q: string, who = ADMIN) => as(who, "GET", `/api/finance/combined-bill?${q}`);

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("every bill on one statement, grouped by type in a fixed order, each with its lines and subtotal", async () => {
  const p = await mkPatient("CB Grouped");
  await bill(p, "Pharmacy", [{ description: "Injection", quantity: 4, unitPrice: 60 }]);
  await bill(p, "IPD", [{ description: "General ward", quantity: 5, unitPrice: 1700 }, { description: "Visit", quantity: 5, unitPrice: 1000 }]);
  await bill(p, "Lab", [{ description: "CBC", quantity: 1, unitPrice: 300 }]);
  const r = await get(`patientId=${p.id}`);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual(r.data.sections.map((s: any) => s.type), ["IPD", "Pharmacy", "Lab"]);
  const ipd = r.data.sections[0];
  assert.equal(ipd.lines.length, 2);
  assert.deepEqual(ipd.lines.map((l: any) => [l.name, l.quantity, l.rate, l.amount]), [["General ward", 5, 1700, 8500], ["Visit", 5, 1000, 5000]]);
  assert.equal(ipd.subtotal, 13500);
  assert.equal(r.data.sections[1].subtotal, 240);
  assert.equal(r.data.billCount, 3);
  assert.equal(r.data.patient.name, "CB Grouped");
  assert.equal(r.data.patient.address, "A-22 Society, Surat");
});

test("the totals add up: charges, GST, net payable, what is paid and what is still due", async () => {
  const p = await mkPatient("CB Totals");
  await bill(p, "IPD", [{ description: "Ward", quantity: 2, unitPrice: 1000 }], { status: "Paid" });
  await bill(p, "Pharmacy", [{ description: "Tablets", quantity: 1, unitPrice: 500, gstRate: 12 }], { status: "Pending" });
  const t = (await get(`patientId=${p.id}`)).data.totals;
  assert.equal(t.gross, 2500);
  assert.equal(t.gst, 60);
  assert.equal(t.total, 2560);
  assert.equal(t.paid, 2000);
  assert.equal(t.due, 560);
});

test("a refunded bill is left out and counted; the date range keeps only bills inside it", async () => {
  const p = await mkPatient("CB Range");
  await bill(p, "Lab", [{ description: "Old test", quantity: 1, unitPrice: 100 }], { date: "2026-01-10" });
  await bill(p, "Lab", [{ description: "New test", quantity: 1, unitPrice: 200 }], { date: "2026-03-10" });
  await bill(p, "Lab", [{ description: "Refunded test", quantity: 1, unitPrice: 999 }], { date: "2026-03-11", status: "Refunded" });
  const all = (await get(`patientId=${p.id}`)).data;
  assert.equal(all.billCount, 2);
  assert.equal(all.refundedCount, 1);
  assert.equal(all.totals.gross, 300);
  assert.ok(!all.sections.some((s: any) => s.lines.some((l: any) => l.name === "Refunded test")));
  const march = (await get(`patientId=${p.id}&from=2026-03-01&to=2026-03-31`)).data;
  assert.deepEqual(march.sections[0].lines.map((l: any) => l.name), ["New test"]);
  const none = (await get(`patientId=${p.id}&from=2027-01-01`)).data;
  assert.equal(none.sections.length, 0);
  assert.equal(none.totals.total, 0);
});

test("one patient's statement never includes another patient's bills", async () => {
  const a = await mkPatient("CB Alone"), b = await mkPatient("CB Other");
  await bill(b, "IPD", [{ description: "Someone else's ward", quantity: 1, unitPrice: 5000 }]);
  const r = (await get(`patientId=${a.id}`)).data;
  assert.equal(r.sections.length, 0);
  assert.equal(r.billCount, 0);
});

test("a patient and valid dates are required", async () => {
  assert.equal((await get("")).status, 422);
  assert.equal((await get("patientId=abc")).status, 422);
  const p = await mkPatient("CB Dates");
  assert.equal((await get(`patientId=${p.id}&from=yesterday`)).status, 422);
  assert.equal((await get(`patientId=${p.id}&from=2026-05-01&to=2026-04-01`)).status, 422);
});

test("only people who can see Finance, and only for their own hospital's patients", async () => {
  const p = await mkPatient("CB Private");
  assert.equal((await get(`patientId=${p.id}`, PHARMACIST)).status, 403);
  const other = await get(`patientId=${p.id}`, OTHER_HOSPITAL);
  assert.ok([403, 404].includes(other.status), `other hospital got ${other.status}`);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
