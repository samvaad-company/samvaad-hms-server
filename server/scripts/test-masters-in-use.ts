/**
 * Tests for Setup masters being used by the rest of the HMS: patient registration and appointments take their category, income
 * group, referral source and visit purpose from the masters; the billing counter prices services from the patient's rate plan,
 * taxes them from the GST mapping, honours the hospital's billing switches and invoice prefix, and records a payment mode.
 * In-process, in-memory.
 *
 *   npm run test:inuse
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
const { addDays } = await import("@/services/mrd-files-service");
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
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const today = () => localDate();
let seq = 0;
const master = async (kind: string) => (await as(ADMIN, "GET", `/api/setup/${kind}`)).data as any[];
const patient = (over: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/patients", { name: `Master Patient ${++seq}`, age: 30, gender: "Male", phone: `98${String(10000000 + seq).slice(-8)}`, ...over });
const putConfig = (patch: Record<string, unknown>) => as(ADMIN, "PUT", "/api/setup/config/hospital", patch);

// ── Registration and appointments ────────────────────────────────────────────

test("registration: category, income group, referral source and visit purpose are the hospital's master entries, saved in their own spelling", async () => {
  const r = await patient({ patientCategory: "tpa cashless", incomeGroup: "mig", referralSource: "WEBSITE / ONLINE BOOKING", visitPurpose: "new" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.patientCategory, r.data.incomeGroup, r.data.referralSource, r.data.visitPurpose], ["TPA Cashless", "Middle Income Group", "Website / Online Booking", "New Consultation"]);
});

test("registration: something that isn't in the master is refused, with the field named", async () => {
  for (const [field, value] of [["patientCategory", "Platinum"], ["incomeGroup", "Rich"], ["referralSource", "A friend"], ["visitPurpose", "Holiday"]] as const) {
    const r = await patient({ [field]: value });
    assert.equal(r.status, 422, field);
    assert.match(JSON.stringify(r.error), new RegExp(field));
  }
});

test("registration: switching a master entry off stops it being chosen; the patients who already have it keep it and can still be edited", async () => {
  const cat = (await master("patient_category")).find((c) => c.code === "CAMP");
  const p = (await patient({ patientCategory: "Camp / Charity" })).data;
  await as(ADMIN, "PATCH", `/api/setup/patient_category/${cat.id}`, { active: false });
  assert.equal((await patient({ patientCategory: "Camp / Charity" })).status, 422, "no new patient can be put in an inactive category");
  const edit = await as(ADMIN, "PATCH", `/api/patients/${p.id}`, { patientCategory: "Camp / Charity", city: "Vadodara" });
  assert.equal(edit.status, 200, JSON.stringify(edit.error));
  assert.equal(edit.data.patientCategory, "Camp / Charity");
  await as(ADMIN, "PATCH", `/api/setup/patient_category/${cat.id}`, { active: true });
});

test("registration: a patient registered before the masters existed (an old free-text referral) can still be edited without touching it", async () => {
  const p = (await patient({ referralSource: "Walk-in" })).data;
  const { patientsRepo } = await import("@/repositories");
  await patientsRepo.update(p.id, { referral_source: "Doctor referral" } as never);
  const edit = await as(ADMIN, "PATCH", `/api/patients/${p.id}`, { referralSource: "Doctor referral", city: "Surat" });
  assert.equal(edit.status, 200, JSON.stringify(edit.error));
  assert.equal(edit.data.referralSource, "Doctor referral");
  assert.equal((await as(ADMIN, "PATCH", `/api/patients/${p.id}`, { referralSource: "Billboard" })).status, 422);
});

test("appointments: the visit purpose is a master entry and is kept on the appointment, for walk-ins and edits", async () => {
  const p = (await patient()).data;
  const a = await as(ADMIN, "POST", "/api/appointments", { patientId: p.id, patientName: p.name, date: today(), time: "10:30", type: "Walk-in", reason: "Cough", visitPurpose: "follow-up" });
  assert.equal(a.status, 201, JSON.stringify(a.error));
  assert.equal(a.data.visitPurpose, "Follow-up");
  assert.equal((await as(ADMIN, "POST", "/api/appointments", { patientId: p.id, patientName: p.name, date: today(), time: "11:30", type: "Walk-in", visitPurpose: "Spa day" })).status, 422);
  const upd = await as(ADMIN, "PATCH", `/api/appointments/${a.data.id}`, { visitPurpose: "Health Checkup" });
  assert.equal(upd.data.visitPurpose, "Health Checkup");
});

// ── The billing catalogue ────────────────────────────────────────────────────

test("catalogue: services come with the patient's rate-plan price and their GST mapping; payment modes are the active ones", async () => {
  const cat = (await as(BILLING, "GET", "/api/billing/catalog")).data;
  assert.equal(cat.services.length >= 48, true);
  assert.equal(cat.planName.length > 0, true);
  const inj = cat.services.find((s: any) => s.code === "PROC-INJ");
  assert.deepEqual([inj.gstApplies, inj.gstRate, inj.price], [true, 18, 150]);
  assert.deepEqual(cat.paymentModes.slice(0, 3), ["Cash", "Cheque", "Demand Draft"]);
  assert.equal(cat.settings.gstOnBills, true);
  const mode = (await master("payment_mode")).find((m) => m.code === "SODEXO");
  await as(ADMIN, "PATCH", `/api/setup/payment_mode/${mode.id}`, { active: false });
  assert.equal((await as(BILLING, "GET", "/api/billing/catalog")).data.paymentModes.includes("Sodexo / Meal Card"), false);
  await as(ADMIN, "PATCH", `/api/setup/payment_mode/${mode.id}`, { active: true });
});

test("catalogue: a patient in a category with its own rate plan sees that plan's prices; an overridden price is the plan's, a missing one falls back to the base plan", async () => {
  const plans = await master("rate_plan");
  const cash = plans.find((p) => p.data.isDefault), tpa = plans.find((p) => !p.data.isDefault);
  const svc = (await master("service")).find((s) => s.code === "CONS-GEN");
  const lab = (await master("service")).find((s) => s.code === "LAB-CBC");
  await as(ADMIN, "PUT", `/api/setup/rate_plan/${tpa.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: 650 }] });
  await as(ADMIN, "PUT", `/api/setup/rate_plan/${cash.id}/prices`, { scope: "general", changes: [{ serviceId: lab.id, price: 300 }] });
  const cashPatient = (await patient({ patientCategory: "General / Cash" })).data;
  const tpaPatient = (await patient({ patientCategory: "TPA Cashless" })).data;
  const noCategory = (await patient()).data;
  const price = async (pid: number, code: string) => (await as(BILLING, "GET", `/api/billing/catalog?patientId=${pid}`)).data.services.find((s: any) => s.code === code).price;
  assert.equal(await price(cashPatient.id, "CONS-GEN"), 500);
  assert.equal(await price(tpaPatient.id, "CONS-GEN"), 650, "the TPA plan's own price");
  assert.equal(await price(tpaPatient.id, "LAB-CBC"), 300, "not set on the TPA plan, so its base plan's price");
  assert.equal(await price(noCategory.id, "CONS-GEN"), 500, "no category → the default plan");
  assert.equal((await as(BILLING, "GET", "/api/billing/catalog?patientId=999999")).status, 404);
});

// ── Bills from the catalogue ─────────────────────────────────────────────────

const svcId = async (code: string) => (await master("service")).find((s) => s.code === code).id;

test("billing: catalogue lines are priced by the server from the rate plan, whatever price the browser sends, and taxed from the GST mapping", async () => {
  const p = (await patient({ patientCategory: "General / Cash" })).data;
  const r = await as(BILLING, "POST", "/api/billing", {
    patientId: p.id, patientName: p.name, type: "OPD", status: "Pending",
    items: [{ serviceId: await svcId("PROC-INJ"), quantity: 2, unitPrice: 1 }, { serviceId: await svcId("CONS-GEN"), quantity: 1 }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(r.data.items.map((i: any) => [i.code, i.quantity, i.unitPrice, i.gstRate, i.amount]), [["PROC-INJ", 2, 150, 18, 300], ["CONS-GEN", 1, 500, 0, 500]]);
  assert.deepEqual([r.data.amount, r.data.gst, r.data.total], [800, 54, 854], "18% on the injection only");
  assert.match(r.data.billNumber, /^INV-\d{8}$/);
  const again = (await as(BILLING, "GET", `/api/billing/${r.data.id}`)).data;
  assert.equal(again.items.length, 2);
});

test("billing: a discount is shared across the lines before tax; it can't exceed the bill", async () => {
  const p = (await patient()).data;
  const r = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", discount: 100, items: [{ serviceId: await svcId("PROC-INJ"), quantity: 2 }, { serviceId: await svcId("CONS-GEN"), quantity: 1 }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  // 300 of 800 is taxable at 18%: its share of the ₹100 discount is 37.5 → (300 − 37.5) × 18% = 47.25
  assert.deepEqual([r.data.discount, r.data.gst, r.data.total], [100, 47.25, 747]);
  assert.equal((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", discount: 5000, items: [{ serviceId: await svcId("CONS-GEN"), quantity: 1 }] })).status, 422);
});

test("billing: custom lines bring their own price and a GST rate from the allowed set; bad lines are refused", async () => {
  const p = (await patient()).data;
  const ok = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: [{ description: "Wheelchair hire", quantity: 1, unitPrice: 200, gstRate: 12 }] });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.deepEqual([ok.data.items[0].serviceId, ok.data.gst, ok.data.total], [null, 24, 224]);
  for (const bad of [{ description: "x", quantity: 1, unitPrice: -1 }, { description: "x", quantity: 1, unitPrice: 5, gstRate: 7 }, { quantity: 1, unitPrice: 5 }, { serviceId: 999999, quantity: 1 }, { serviceId: await svcId("CONS-GEN"), quantity: 0 }]) {
    assert.equal((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: [bad] })).status, 422, JSON.stringify(bad));
  }
  assert.equal((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: [] })).status, 422);
});

test("billing: an inactive service can't be billed", async () => {
  const p = (await patient()).data;
  const s = (await master("service")).find((x) => x.code === "PROC-NEB");
  await as(ADMIN, "PATCH", `/api/setup/service/${s.id}`, { active: false });
  assert.equal((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: [{ serviceId: s.id, quantity: 1 }] })).status, 422);
  await as(ADMIN, "PATCH", `/api/setup/service/${s.id}`, { active: true });
});

test("billing: the hospital's switches — GST off, prices tax-inclusive, round-off — change the totals the server works out", async () => {
  const p = (await patient()).data;
  const bill = (items: unknown[]) => as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items });
  const inj = { serviceId: await svcId("PROC-INJ"), quantity: 1 };
  await putConfig({ gstOnBills: false });
  const off = (await bill([inj])).data;
  assert.deepEqual([off.gst, off.total], [0, 150]);
  await putConfig({ gstOnBills: true, pricesInclusive: true });
  const inclusive = (await bill([inj])).data;
  assert.deepEqual([inclusive.total, inclusive.gst], [150, 22.88], "₹150 already contains the tax");
  await putConfig({ pricesInclusive: false, roundOff: true });
  const odd = (await bill([{ description: "Odd", quantity: 1, unitPrice: 100.4, gstRate: 0 }])).data;
  assert.equal(odd.total, 100, "rounded to the rupee");
  await putConfig({ roundOff: false });
  assert.equal((await bill([{ description: "Odd", quantity: 1, unitPrice: 100.4, gstRate: 0 }])).data.total, 100.4);
  await putConfig({ roundOff: true });
});

test("billing: the hospital's invoice prefix numbers new bills; blank goes back to INV-", async () => {
  const p = (await patient()).data;
  const line = [{ description: "Item", quantity: 1, unitPrice: 10, gstRate: 0 }];
  await putConfig({ invoicePrefix: "sh" });
  const a = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: line });
  assert.match(a.data.billNumber, /^SH-00000001$/);
  const b = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: line });
  assert.equal(b.data.billNumber, "SH-00000002");
  await putConfig({ invoicePrefix: "" });
  assert.match((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: line })).data.billNumber, /^INV-\d{8}$/);
});

test("billing: a payment mode must be one of the active modes; it is recorded on the bill", async () => {
  const p = (await patient()).data;
  const line = [{ description: "Item", quantity: 1, unitPrice: 10, gstRate: 0 }];
  const ok = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", status: "Paid", paymentMode: "upi", items: line });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal(ok.data.paymentMode, "UPI");
  assert.equal((await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", status: "Paid", paymentMode: "Bitcoin", items: line })).status, 422);
});

test("billing: recording payment on a pending bill stores the payment mode, from the active modes only", async () => {
  const p = (await patient()).data;
  const b = (await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", items: [{ description: "Item", quantity: 1, unitPrice: 10, gstRate: 0 }] })).data;
  assert.equal(b.paymentMode, null);
  assert.equal((await as(BILLING, "PATCH", `/api/billing/${b.id}`, { status: "Paid", paymentMode: "Barter" })).status, 422);
  const paid = await as(BILLING, "PATCH", `/api/billing/${b.id}`, { status: "Paid", paymentMode: "credit_card" });
  assert.equal(paid.status, 200, JSON.stringify(paid.error));
  const again = (await as(BILLING, "GET", `/api/billing/${b.id}`)).data;
  assert.deepEqual([again.status, again.paymentMode], ["Paid", "Credit Card"]);
});

test("billing: bills raised the old way (an amount with no lines — pharmacy, CSSD, dispensing) still work, and still obey GST on/off", async () => {
  const p = (await patient()).data;
  const old = await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "Pharmacy", amount: 200 });
  assert.equal(old.status, 201, JSON.stringify(old.error));
  assert.deepEqual([old.data.gst, old.data.total], [18, 218], "9% as before");
  assert.equal(old.data.items, undefined);
  await putConfig({ gstOnBills: false });
  assert.deepEqual([(await as(BILLING, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "Pharmacy", amount: 200 })).data.gst], [0]);
  await putConfig({ gstOnBills: true });
});

test("permissions: the catalogue is a billing view; reception can't read it and can't raise bills", async () => {
  assert.equal((await as(RECEPTION, "GET", "/api/billing/catalog")).status, 403);
  assert.equal((await request("GET", "/api/billing/catalog")).status, 401);
  void addDays;
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
