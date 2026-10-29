/**
 * Tests for the dispensing counter: stock drawn from batches earliest-expiry first, expired batches skipped, all-or-nothing
 * dispensing, the three billing choices (including an admitted patient's stay), loading a prescription, returns (usable stock back
 * into its exact batch, damaged and expired written off, credit notes only for billed sales) and permissions. In-process, in-memory.
 *
 *   npm run test:dispense
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
const { pharmacyBatchesRepo, pharmacyRepo, ipdRepo, billsRepo } = await import("@/repositories");
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
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const today = () => localDate();
let seq = 0;

/** A fresh medicine with the given batches (their quantities add up to its stock). */
async function stocked(batches: { no: string; qty: number; expiry: string }[], over: Record<string, unknown> = {}) {
  const total = batches.reduce((n, b) => n + b.qty, 0);
  const made = await as(ADMIN, "POST", "/api/pharmacy", { name: `Testomol ${++seq} 500mg (Testogen)`, category: "Analgesic", stock: total, minStock: 5, expiryDate: addDays(today(), 800), supplier: "Test", ...over });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  for (const b of batches) await pharmacyBatchesRepo.create({ hospital_id: 1, item_id: made.data.id, batch_no: b.no, expiry_date: b.expiry, quantity: b.qty } as never);
  return made.data as { id: number; name: string };
}
const dispense = (body: Record<string, unknown>) => as(ADMIN, "POST", "/api/pharmacy/dispense", { billing: "none", ...body });
const stockOf = async (id: number) => Number((await pharmacyRepo.getRow(id))!.stock);
const batchesOf = async (id: number) => ((await pharmacyBatchesRepo.listRows({ unpaged: true, filters: [{ column: "item_id", op: "eq", value: id }] })).rows as any[]).sort((a, b) => a.id - b.id);

test("stock search: finds in-date medicines by name, starts-with first, never expired or empty ones", async () => {
  const a = await stocked([{ no: "S1", qty: 20, expiry: addDays(today(), 400) }], { name: "Zyxovir 200 (Acyclovir)" });
  await stocked([{ no: "S2", qty: 0, expiry: addDays(today(), 400) }], { name: "Zyxoempty 10", stock: 0 });
  await as(ADMIN, "POST", "/api/pharmacy", { name: "Zyxold 5", stock: 9, expiryDate: addDays(today(), -30) });
  const r = await as(ADMIN, "GET", "/api/pharmacy/dispense/stock?q=zyx");
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual(r.data.map((x: any) => x.name), ["Zyxovir 200 (Acyclovir)"]);
  assert.equal(r.data[0].itemId, a.id);
  assert.equal(r.data[0].available, 20);
  assert.ok((await as(ADMIN, "GET", "/api/pharmacy/dispense/stock")).data.length > 0, "an empty search lists the first few");
});

test("dispensing draws from the earliest-expiring batch first, then the next; stock and batches agree afterwards", async () => {
  const item = await stocked([{ no: "LATE", qty: 6, expiry: addDays(today(), 600) }, { no: "SOON", qty: 4, expiry: addDays(today(), 60) }]);
  const r = await dispense({ lines: [{ itemId: item.id, quantity: 7, unitPrice: 12.5 }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(r.data.lines.map((l: any) => [l.batchNo, l.quantity]), [["SOON", 4], ["LATE", 3]]);
  assert.equal(r.data.subtotal, 87.5);
  assert.match(r.data.dispenseNo, /^DSP\/\d{2}\/\d{5}$/);
  assert.equal(r.data.billLabel, "Not billed");
  assert.equal(r.data.patientName, "Walk-in");
  assert.equal(await stockOf(item.id), 3);
  assert.deepEqual((await batchesOf(item.id)).map((b) => [b.batch_no, b.quantity]), [["LATE", 3], ["SOON", 0]]);
});

test("an expired batch is never used, and is not counted when checking whether there is enough", async () => {
  const item = await stocked([{ no: "OLD", qty: 50, expiry: addDays(today(), -10) }, { no: "OK", qty: 5, expiry: addDays(today(), 90) }]);
  const short = await dispense({ lines: [{ itemId: item.id, quantity: 8 }] });
  assert.equal(short.status, 409);
  assert.match(short.error!.message, /Only 5 units of .* in date/);
  assert.equal(await stockOf(item.id), 55, "nothing was taken");
  const ok = await dispense({ lines: [{ itemId: item.id, quantity: 5 }] });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.data.lines.map((l: any) => l.batchNo), ["OK"]);
});

test("dispensing is all-or-nothing: if one medicine can't be filled none of the others move", async () => {
  const a = await stocked([{ no: "A1", qty: 10, expiry: addDays(today(), 200) }]);
  const b = await stocked([{ no: "B1", qty: 2, expiry: addDays(today(), 200) }]);
  const r = await dispense({ lines: [{ itemId: a.id, quantity: 4 }, { itemId: b.id, quantity: 3 }] });
  assert.equal(r.status, 409);
  assert.equal(await stockOf(a.id), 10);
  assert.equal(await stockOf(b.id), 2);
  assert.equal((await as(ADMIN, "GET", "/api/pharmacy/dispense?limit=100")).data.some((d: any) => d.lines.some((l: any) => l.itemId === a.id)), false);
});

test("two people dispensing the last units at once: one succeeds, one is told there isn't enough", async () => {
  const item = await stocked([{ no: "LAST", qty: 5, expiry: addDays(today(), 200) }]);
  const results = await Promise.all([1, 2, 3].map(() => dispense({ lines: [{ itemId: item.id, quantity: 3 }] })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  assert.equal(await stockOf(item.id), 2);
  assert.ok((await batchesOf(item.id)).every((b) => b.quantity >= 0));
});

test("stock added elsewhere (a purchase, a counter sale) is picked up as its own batch, not lost or double counted", async () => {
  const item = await stocked([{ no: "B1", qty: 10, expiry: addDays(today(), 100) }]);
  await as(ADMIN, "POST", `/api/pharmacy/${item.id}/restock`, { quantity: 15 });
  assert.equal(await stockOf(item.id), 25);
  const r = await dispense({ lines: [{ itemId: item.id, quantity: 12 }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(r.data.lines.map((l: any) => [l.batchNo, l.quantity]), [["B1", 10], ["ADJ-2", 2]]);
  assert.equal(await stockOf(item.id), 13);
  const sum = (await batchesOf(item.id)).reduce((n, b) => n + b.quantity, 0);
  assert.equal(sum, 13);
});

test("input checks: nothing to dispense, odd quantities, an unknown medicine and a bad price are refused", async () => {
  const item = await stocked([{ no: "V1", qty: 10, expiry: addDays(today(), 100) }]);
  assert.equal((await dispense({ lines: [] })).status, 422);
  assert.equal((await dispense({ lines: [{ itemId: item.id, quantity: 0 }] })).status, 422);
  assert.equal((await dispense({ lines: [{ itemId: item.id, quantity: 1.5 }] })).status, 422);
  assert.equal((await dispense({ lines: [{ itemId: item.id, quantity: 1, unitPrice: -2 }] })).status, 422);
  assert.equal((await dispense({ lines: [{ itemId: 999999, quantity: 1 }] })).status, 422);
  assert.equal((await dispense({ billing: "weekly", lines: [{ itemId: item.id, quantity: 1 }] })).status, 422);
  assert.equal(await stockOf(item.id), 10);
});

test("the same medicine twice on one dispense is merged into one request; the first price entered is remembered on the item", async () => {
  const item = await stocked([{ no: "M1", qty: 10, expiry: addDays(today(), 100) }]);
  const r = await dispense({ lines: [{ itemId: item.id, quantity: 2, unitPrice: 9 }, { itemId: item.id, quantity: 3 }] });
  assert.equal(r.status, 201);
  assert.deepEqual(r.data.lines.map((l: any) => [l.quantity, l.unitPrice]), [[5, 9]]);
  assert.equal(Number((await pharmacyRepo.getRow(item.id))!.unit_price), 9);
  const again = await dispense({ lines: [{ itemId: item.id, quantity: 1 }] });
  assert.equal(again.data.lines[0].unitPrice, 9, "the remembered price is used when none is given");
});

// ── Billing ──────────────────────────────────────────────────────────────────

test("billing: a separate or patient bill needs a patient; with no bill nothing is raised", async () => {
  const item = await stocked([{ no: "P1", qty: 10, expiry: addDays(today(), 100) }]);
  const line = [{ itemId: item.id, quantity: 1, unitPrice: 10 }];
  assert.equal((await dispense({ billing: "separate", lines: line })).status, 422);
  assert.equal((await dispense({ billing: "patient", lines: line })).status, 422);
  const before = (await billsRepo.listRows({ unpaged: true })).total;
  assert.equal((await dispense({ billing: "none", patientId: 1, lines: line })).data.billLabel, "Not billed");
  assert.equal((await billsRepo.listRows({ unpaged: true })).total, before);
});

test("billing: a separate bill is a Pending pharmacy bill for the patient", async () => {
  const item = await stocked([{ no: "P2", qty: 10, expiry: addDays(today(), 100) }]);
  const r = await dispense({ billing: "separate", patientId: 1, lines: [{ itemId: item.id, quantity: 4, unitPrice: 25 }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.match(r.data.billLabel, /^Billed INV-/);
  const bill = (await billsRepo.getRow((await as(ADMIN, "GET", `/api/pharmacy/dispense/${r.data.id}`)).data.id ? ((await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: r.data.billNumber }] })).rows[0] as any).id : 0)) as any;
  assert.deepEqual([bill.type, bill.status, bill.patient_id, Number(bill.amount)], ["Pharmacy", "Pending", 1, 100]);
});

test("billing: adding to the patient's bill grows their open bill; for an admitted patient it goes on the stay", async () => {
  const item = await stocked([{ no: "P3", qty: 30, expiry: addDays(today(), 100) }]);
  const first = await dispense({ billing: "patient", patientId: 2, lines: [{ itemId: item.id, quantity: 2, unitPrice: 50 }] });
  assert.equal(first.status, 201, JSON.stringify(first.error));
  assert.match(first.data.billLabel, /^Added to bill INV-/);
  const second = await dispense({ billing: "patient", patientId: 2, lines: [{ itemId: item.id, quantity: 1, unitPrice: 50 }] });
  assert.equal(second.data.billNumber, first.data.billNumber, "the same open bill");
  const bill = (await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: first.data.billNumber }] })).rows[0] as any;
  assert.equal(Number(bill.amount), 150);
  // Admit patient 3, then bill to them.
  const adm = await ipdRepo.create({ hospital_id: 1, patient_id: 3, patient_name: "Admitted Test", patient_age: 40, patient_code: "P-3", admission_date: today(), ward_id: null, ward: "General", bed_id: null, bed: "G-1", doctor_id: null, doctor: "Dr Test", diagnosis: "Test", credit_limit: 0, status: "Admitted", admission_no: "ADM/2026/09999" } as never);
  const stay = await dispense({ billing: "patient", patientId: 3, lines: [{ itemId: item.id, quantity: 1, unitPrice: 50 }] });
  assert.equal(stay.data.billLabel, "On stay ADM/2026/09999");
  assert.equal(stay.data.admissionNo, "ADM/2026/09999");
  const b = (await billsRepo.listRows({ unpaged: true, filters: [{ column: "bill_number", op: "eq", value: stay.data.billNumber }] })).rows[0] as any;
  assert.equal(b.type, "IPD");
  void adm;
});

// ── Prescriptions ────────────────────────────────────────────────────────────

test("loading a prescription: medicines are matched to stock with a quantity from frequency × duration; dispensing it marks it Dispensed", async () => {
  const item = await stocked([{ no: "RX1", qty: 40, expiry: addDays(today(), 300) }], { name: "Rxmatch 250mg (Rxgen)" });
  const rx = await as(DOCTOR, "POST", "/api/prescriptions", {
    patientId: 4, patientName: "Rx Patient", doctorId: 2, diagnosis: "Test", status: "Pending",
    items: [{ medicineName: "Rxmatch 250mg", dosage: "250mg", frequency: "1-0-1", duration: "5 days", instructions: "" }, { medicineName: "Unstocked Medicine 10mg", dosage: "10mg", frequency: "Once daily", duration: "3 days", instructions: "" }],
  });
  assert.equal(rx.status, 201, JSON.stringify(rx.error));
  const list = await as(ADMIN, "GET", "/api/pharmacy/dispense/rx?patientId=4");
  assert.equal(list.status, 200, JSON.stringify(list.error));
  const found = list.data.find((x: any) => x.prescriptionId === rx.data.id);
  assert.ok(found);
  assert.deepEqual([found.lines[0].quantity, found.lines[0].itemId, found.lines[0].available], [10, item.id, 40]);
  assert.deepEqual([found.lines[1].itemId, found.lines[1].quantity], [null, 3]);
  assert.equal((await dispense({ patientId: 5, prescriptionId: rx.data.id, lines: [{ itemId: item.id, quantity: 1 }] })).status, 422, "another patient's prescription");
  const d = await dispense({ patientId: 4, prescriptionId: rx.data.id, lines: [{ itemId: item.id, quantity: 10 }] });
  assert.equal(d.status, 201, JSON.stringify(d.error));
  assert.equal(d.data.rxNumber, rx.data.rxNumber);
  assert.equal((await as(ADMIN, "GET", `/api/prescriptions/${rx.data.id}`)).data.status, "Dispensed");
  assert.equal((await as(ADMIN, "GET", "/api/pharmacy/dispense/rx?patientId=4")).data.some((x: any) => x.prescriptionId === rx.data.id), false, "no longer offered");
  assert.equal((await dispense({ patientId: 4, prescriptionId: rx.data.id, lines: [{ itemId: item.id, quantity: 1 }] })).status, 409, "can't dispense it twice");
});

// ── Returns ──────────────────────────────────────────────────────────────────

test("returns: usable units go back into the exact batch; damaged and expired ones are written off; limits are enforced", async () => {
  const item = await stocked([{ no: "SOON", qty: 3, expiry: addDays(today(), 30) }, { no: "LATE", qty: 10, expiry: addDays(today(), 300) }]);
  const d = (await dispense({ lines: [{ itemId: item.id, quantity: 6, unitPrice: 10 }] })).data;
  assert.deepEqual(d.lines.map((l: any) => [l.batchNo, l.quantity]), [["SOON", 3], ["LATE", 3]]);
  assert.equal(await stockOf(item.id), 7);
  const [soon, late] = d.lines;
  const r1 = await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: soon.id, quantity: 2, condition: "Usable" }, { lineId: late.id, quantity: 1, condition: "Damaged" }] });
  assert.equal(r1.status, 200, JSON.stringify(r1.error));
  assert.equal(r1.data.status, "Part returned");
  assert.equal(await stockOf(item.id), 9, "only the 2 usable units came back");
  assert.deepEqual((await batchesOf(item.id)).map((b) => [b.batch_no, b.quantity]), [["SOON", 2], ["LATE", 7]]);
  assert.deepEqual(r1.data.lines.map((l: any) => l.returnable), [1, 2]);
  assert.equal(r1.data.returns.length, 2);
  assert.equal(r1.data.returns.every((x: any) => x.creditNoteNo === ""), true, "an unbilled sale has no credit note");
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: soon.id, quantity: 2, condition: "Usable" }] })).status, 409, "more than is left");
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: soon.id, quantity: 1, condition: "Spoiled" }] })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [] })).status, 422);
  const r2 = await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: soon.id, quantity: 1, condition: "Expired" }, { lineId: late.id, quantity: 2, condition: "Usable" }] });
  assert.equal(r2.data.status, "Returned");
  assert.equal(await stockOf(item.id), 11);
  assert.deepEqual(r2.data.lines.map((l: any) => l.returnable), [0, 0]);
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: late.id, quantity: 1, condition: "Usable" }] })).status, 409, "already returned in full");
});

test("returns: a billed sale mints a numbered credit note and a Refunded pharmacy entry in Billing; the same line can't be returned twice at once", async () => {
  const item = await stocked([{ no: "C1", qty: 20, expiry: addDays(today(), 300) }]);
  const d = (await dispense({ billing: "separate", patientId: 6, lines: [{ itemId: item.id, quantity: 5, unitPrice: 40 }] })).data;
  const line = d.lines[0];
  const [a, b] = await Promise.all([
    as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: line.id, quantity: 4, condition: "Usable" }] }),
    as(ADMIN, "POST", `/api/pharmacy/dispense/${d.id}/return`, { lines: [{ lineId: line.id, quantity: 4, condition: "Usable" }] }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const done = (a.status === 200 ? a : b).data;
  assert.match(done.returns[0].creditNoteNo, /^CN\/\d{2}\/\d{5}$/);
  assert.equal(done.returns[0].creditValue, 160);
  assert.equal(await stockOf(item.id), 19);
  const refunds = (await billsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: 6 }, { column: "status", op: "eq", value: "Refunded" }] })).rows as any[];
  assert.equal(refunds.length, 1);
  assert.equal(Number(refunds[0].amount), 160);
});

// ── Recent list and permissions ──────────────────────────────────────────────

test("recent dispensing: newest first with a summary line, the billing label and each line's returnable count", async () => {
  const x = await stocked([{ no: "L1", qty: 9, expiry: addDays(today(), 100) }]);
  const y = await stocked([{ no: "L2", qty: 9, expiry: addDays(today(), 100) }]);
  await dispense({ walkInNote: "Mr Shah, ref Dr Patel", lines: [{ itemId: x.id, quantity: 1, unitPrice: 5 }, { itemId: y.id, quantity: 2, unitPrice: 5 }] });
  const list = (await as(ADMIN, "GET", "/api/pharmacy/dispense?limit=5")).data as any[];
  assert.ok(list.length <= 5 && list.length > 0);
  assert.equal(list[0].walkInNote, "Mr Shah, ref Dr Patel");
  assert.equal(list[0].summary, `${x.name} +1 more`);
  assert.ok(list.every((d, i) => i === 0 || list[i - 1].id > d.id), "newest first");
  assert.deepEqual(list[0].lines.map((l: any) => l.returnable), [1, 2]);
});

test("permissions: the pharmacy counter needs the pharmacy permission; nobody else can dispense or return", async () => {
  const item = await stocked([{ no: "PM1", qty: 5, expiry: addDays(today(), 100) }]);
  assert.equal((await request("GET", "/api/pharmacy/dispense")).status, 401);
  assert.equal((await as(RECEPTION, "GET", "/api/pharmacy/dispense")).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/pharmacy/dispense", { billing: "none", lines: [{ itemId: item.id, quantity: 1 }] })).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/pharmacy/dispense/1/return", { lines: [{ lineId: 1, quantity: 1 }] })).status, 403);
  assert.equal((await as(DOCTOR, "POST", "/api/pharmacy/dispense", { billing: "none", lines: [{ itemId: item.id, quantity: 1 }] })).status, 403, "doctors read the pharmacy, they don't dispense");
  assert.equal(await stockOf(item.id), 5);
});

let passed = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log(`  PASS  ${t.name}`);
  } catch (e) {
    console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`);
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
