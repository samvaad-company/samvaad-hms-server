/**
 * Tests for medicines taken from the pharmacy to a patient's bed by a nurse or doctor: the stock comes out, the pharmacy raises its own
 * bill tied to the stay (Pending by default, Paid when payment is taken at the bed), the amount counts toward what the patient owes,
 * discharge is held back until it is settled, and the full bill is issued at discharge.
 *
 *   npm run test:bedside
 */
import assert from "node:assert/strict";
import { prepareIpd } from "./lib/ipd-fixtures";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { localDate } = await import("@/lib/clock");
const { addDays } = await import("@/services/mrd-files-service");
const { pharmacyBatchesRepo, pharmacyRepo, ipdRepo, billsRepo, billItemsRepo } = await import("@/repositories");
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
async function as(email: string, method: string, path: string, body?: unknown) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}
const ADMIN = "kevin.carter@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in"; // Head Nurse
const DOCTOR = "sophia.adams@samvaadhospital.in"; // doctor id 2
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const today = () => localDate();
let seq = 0;

async function stocked(qty: number, price: number) {
  const made = await as(ADMIN, "POST", "/api/pharmacy", { name: `Bedmol ${++seq} 500mg (Bedgen)`, category: "Analgesic", stock: qty, minStock: 1, unitPrice: price, expiryDate: addDays(today(), 800), supplier: "Test" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  await pharmacyRepo.update(made.data.id, { unit_price: price } as never);
  await pharmacyBatchesRepo.create({ hospital_id: 1, item_id: made.data.id, batch_no: `B${seq}`, expiry_date: addDays(today(), 500), quantity: qty } as never);
  return made.data as { id: number; name: string };
}
const stockOf = async (id: number) => Number((await pharmacyRepo.getRow(id))!.stock);
async function admit(patientId: number | null, doctorId: number | null, bed: string) {
  return (await ipdRepo.create({
    hospital_id: 1, patient_id: patientId, patient_name: `Bed Test ${bed}`, patient_age: 50, patient_code: `P-${bed}`, admission_date: today(), ward_id: null, ward: "ICU", bed_id: null, bed,
    doctor_id: doctorId, doctor: "Dr Test", diagnosis: "Test", credit_limit: 0, status: "Admitted", admission_no: `ADM/2026/8${String(++seq).padStart(4, "0")}`,
  } as never)) as { id: number; admission_no: string };
}
const deliver = (who: string, admission: number, body: Record<string, unknown>) => as(who, "POST", `/api/ipd/${admission}/bedside`, body);

test("a nurse takes medicines to the bed: stock comes out, a Pending pharmacy bill is raised on the stay, nothing is collected", async () => {
  const item = await stocked(20, 40);
  const adm = await admit(1, 2, "N-1");
  const r = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 3 }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.bedside, true);
  assert.equal(r.data.bed, "N-1");
  assert.equal(r.data.deliveredByRole, "Head Nurse");
  assert.equal(r.data.billStatus, "Pending");
  assert.match(r.data.billLabel, /Bedside · ICU N-1 · payment pending/);
  assert.equal(await stockOf(item.id), 17);
  const bill = (await billsRepo.getRow((await as(ADMIN, "GET", `/api/pharmacy/dispense/${r.data.id}`)).data ? (await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: r.data.billNumber }] })).rows[0].id : 0)) as any;
  assert.equal(bill.type, "Pharmacy");
  assert.equal(bill.status, "Pending");
  assert.equal(bill.admission_id, adm.id);
  assert.match(bill.remarks, /Payment not taken at the bed/);
  const items = (await billItemsRepo.listRows({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: bill.id }] })).rows as any[];
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 3);
  assert.equal(Number(items[0].unit_price), 40);
});

test("the delivery is listed on the stay and each trip gets its own bill", async () => {
  const item = await stocked(20, 10);
  const adm = await admit(1, 2, "N-2");
  const a = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 1 }] });
  const b = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 2 }] });
  assert.notEqual(a.data.billNumber, b.data.billNumber);
  const list = await as(NURSE, "GET", `/api/ipd/${adm.id}/bedside`);
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.map((d: any) => d.id), [b.data.id, a.data.id]);
});

test("pay later is the default; pay now needs a payment mode and records the bill as Paid", async () => {
  const item = await stocked(20, 25);
  const adm = await admit(1, 2, "N-3");
  const noMode = await deliver(NURSE, adm.id, { payNow: true, lines: [{ itemId: item.id, quantity: 1 }] });
  assert.equal(noMode.status, 422);
  assert.equal(await stockOf(item.id), 20, "a refused delivery takes nothing from stock");
  const paid = await deliver(NURSE, adm.id, { payNow: true, paymentMode: "Cash", lines: [{ itemId: item.id, quantity: 2 }] });
  assert.equal(paid.status, 201, JSON.stringify(paid.error));
  assert.equal(paid.data.billStatus, "Paid");
  assert.match(paid.data.billLabel, /· paid ·|· paid \(/);
  const bill = (await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: paid.data.billNumber }] })).rows[0] as any;
  assert.equal(bill.status, "Paid");
  assert.equal(bill.payment_mode, "Cash");
  assert.match(bill.remarks, /Paid at the bed/);
});

test("what is to pay counts pending bedside bills and leaves out paid ones", async () => {
  const item = await stocked(30, 100);
  const adm = await admit(1, 2, "N-4");
  const owed = async () => (await as(NURSE, "GET", `/api/ipd/${adm.id}/overview`)).data.readiness.balanceDue as number;
  const before = await owed();
  const pending = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 2 }] });
  assert.equal(Math.round(((await owed()) - before) * 100) / 100, Number(pending.data.billTotal), "a pending bill adds to what the patient owes");
  const afterPending = await owed();
  await deliver(NURSE, adm.id, { payNow: true, paymentMode: "Cash", lines: [{ itemId: item.id, quantity: 1 }] });
  assert.equal(await owed(), afterPending, "a bill paid at the bed adds nothing");
  const stay = await as(NURSE, "GET", `/api/ipd/${adm.id}/bills`);
  assert.equal(stay.status, 200, JSON.stringify(stay.error));
  const mine = stay.data.bills.filter((b: any) => b.bedside);
  assert.equal(mine.length, 2);
  assert.deepEqual(mine.map((b: any) => b.status).sort(), ["Paid", "Pending"]);
  const sum = (list: any[]) => Math.round(list.reduce((n, b) => n + b.total, 0) * 100) / 100;
  assert.equal(stay.data.toPay, sum(stay.data.bills.filter((b: any) => b.status === "Pending" || b.status === "Partial")));
  assert.equal(stay.data.paid, sum(stay.data.bills.filter((b: any) => b.status === "Paid")));
});

test("discharge is held back by a pending bedside bill, then goes through once it is paid and issues the full bill", async () => {
  const item = await stocked(30, 60);
  const adm = await admit(2, 2, "N-5");
  const d = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 2 }] });
  assert.equal(d.status, 201, JSON.stringify(d.error));
  await prepareIpd("POST", `/api/ipd/${adm.id}/discharge`);
  const refused = await as(NURSE, "POST", `/api/ipd/${adm.id}/discharge`, {});
  assert.equal(refused.status, 409, JSON.stringify(refused.data));
  assert.match(refused.error!.message, /unpaid/);
  assert.equal((await ipdRepo.getRow(adm.id))!.status, "Admitted");
  // The billing desk collects the payment.
  const bill = (await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: d.data.billNumber }] })).rows[0] as any;
  const paid = await as(ADMIN, "PATCH", `/api/billing/${bill.id}`, { status: "Paid", paymentMode: "Cash" });
  assert.equal(paid.status, 200, JSON.stringify(paid.error));
  const ok = await as(NURSE, "POST", `/api/ipd/${adm.id}/discharge`, {});
  assert.equal(ok.status, 200, JSON.stringify(ok.error));
  assert.match(ok.data.combinedBillNo, /^CB-\d{8}$/);
  const history = await as(ADMIN, "GET", "/api/finance/combined-bill/history");
  assert.ok(history.data.some((h: any) => h.invoiceNo === ok.data.combinedBillNo && h.patientId === 2), "the full bill is in the history");
  const full = await as(ADMIN, "GET", `/api/finance/combined-bill/${history.data.find((h: any) => h.invoiceNo === ok.data.combinedBillNo).id}`);
  assert.ok(full.data.sections.find((s: any) => s.type === "Pharmacy").lines.some((l: any) => /Bedmol/.test(l.name)), "the medicines taken to the bed are on the full bill");
});

test("a doctor can deliver for their own patient but not another doctor's", async () => {
  const item = await stocked(20, 15);
  const own = await admit(1, 2, "N-6");
  const theirs = await admit(1, 5, "N-7");
  assert.equal((await deliver(DOCTOR, own.id, { lines: [{ itemId: item.id, quantity: 1 }] })).status, 201);
  const other = await deliver(DOCTOR, theirs.id, { lines: [{ itemId: item.id, quantity: 1 }] });
  assert.equal(other.status, 409);
  assert.match(other.error!.message, /not your patient/);
});

test("a medicine with no price is refused, since nothing could be billed for it", async () => {
  const item = await stocked(5, 0);
  const adm = await admit(1, 2, "N-13");
  const r = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 1 }] });
  assert.equal(r.status, 422);
  assert.match(JSON.stringify(r.error), /no price yet/);
  assert.equal(await stockOf(item.id), 5);
});

test("a discharged stay, an unregistered patient and an unknown medicine are refused", async () => {
  const item = await stocked(5, 15);
  const gone = await admit(1, 2, "N-8");
  await ipdRepo.update(gone.id, { status: "Discharged" } as never);
  assert.equal((await deliver(NURSE, gone.id, { lines: [{ itemId: item.id, quantity: 1 }] })).status, 409);
  const walkIn = await admit(null, 2, "N-9");
  assert.equal((await deliver(NURSE, walkIn.id, { lines: [{ itemId: item.id, quantity: 1 }] })).status, 409);
  const live = await admit(1, 2, "N-10");
  assert.equal((await deliver(NURSE, live.id, { lines: [{ itemId: 999999, quantity: 1 }] })).status, 422);
  assert.equal((await deliver(NURSE, live.id, { lines: [{ itemId: item.id, quantity: 50 }] })).status, 409, "more than the shelf holds");
  assert.equal(await stockOf(item.id), 5);
});

test("the pharmacist sees it in the dispense history, labelled as a bedside delivery with its payment state", async () => {
  const item = await stocked(10, 20);
  const adm = await admit(1, 2, "N-11");
  const d = await deliver(NURSE, adm.id, { lines: [{ itemId: item.id, quantity: 1 }] });
  const list = await as(PHARMACIST, "GET", "/api/pharmacy/dispense?limit=50");
  assert.equal(list.status, 200, JSON.stringify(list.error));
  const mine = list.data.find((x: any) => x.id === d.data.id);
  assert.ok(mine, "listed");
  assert.match(mine.billLabel, /Bedside · ICU N-11 · payment pending/);
});

test("people without inpatient access cannot take medicines to a bed", async () => {
  const item = await stocked(5, 15);
  const adm = await admit(1, 2, "N-12");
  assert.equal((await deliver(RECEPTION, adm.id, { lines: [{ itemId: item.id, quantity: 1 }] })).status, 403);
  assert.equal(await stockOf(item.id), 5);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
