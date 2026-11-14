/**
 * The H1 register: a medicine marked H1 in the inventory — or ticked H1 by the pharmacist — is flagged on the dispense or sale line,
 * and every flagged line given to a patient shows in the register, filterable by dates, patient and search. In-process, in-memory.
 *
 *   npm run test:h1
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
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { message: string } } | null;
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
const bad = (s: number) => s >= 400 && s < 500;
const today = localDate();
const addDays = (iso: string, n: number) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const register = async (qs = "") => (await as(ADMIN, "GET", `/api/pharmacy/h1-register${qs}`)).data as { entries: any[]; summary: { entries: number; patients: number; units: number } };
const newItem = async (name: string, extra: Record<string, unknown> = {}) => {
  const r = await as(ADMIN, "POST", "/api/pharmacy", { name, category: "Tablet", stock: 200, minStock: 5, expiryDate: "2031-01-01", ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data;
};
const dispense = (body: Record<string, unknown>) => as(ADMIN, "POST", "/api/pharmacy/dispense", { billing: "none", ...body });

let h1Item: any, plainItem: any, patA: any, patB: any;

test("a dispense line is flagged H1 when the medicine is H1 in the inventory, or when the pharmacist ticks it — and an H1 medicine can't be unticked", async () => {
  const patients = (await as(ADMIN, "GET", "/api/patients?pageSize=20")).data;
  const list = patients.items ?? patients;
  [patA, patB] = [list[0], list[1]];
  h1Item = await newItem("Alprazolam 0.5 Tab H1", { isH1: true, hsn: "30049099" });
  plainItem = await newItem("Plain Cough Syrup");
  const d = (await dispense({ patientId: patA.id, lines: [{ itemId: h1Item.id, quantity: 3 }, { itemId: plainItem.id, quantity: 2 }] })).data;
  assert.equal(d.lines.find((l: any) => l.itemId === h1Item.id).isH1, true, "H1 in the inventory");
  assert.equal(d.lines.find((l: any) => l.itemId === plainItem.id).isH1, false, "not H1 unless ticked");
  const ticked = (await dispense({ patientId: patA.id, lines: [{ itemId: plainItem.id, quantity: 1, isH1: true }] })).data;
  assert.equal(ticked.lines[0].isH1, true, "ticked by the pharmacist");
  const unticked = (await dispense({ patientId: patA.id, lines: [{ itemId: h1Item.id, quantity: 1, isH1: false }] })).data;
  assert.equal(unticked.lines[0].isH1, true, "an H1 medicine stays H1");
  const stock = (await as(ADMIN, "GET", "/api/pharmacy/dispense/stock?q=Alprazolam")).data;
  assert.equal(stock.find((s: any) => s.itemId === h1Item.id).isH1, true, "the stock search says which are H1");
});

test("the register lists the H1 lines with the patient's details, and leaves the others out", async () => {
  const r = await register();
  const mine = r.entries.filter((e) => e.patientId === patA.id);
  assert.ok(mine.some((e) => e.medicineName === "Alprazolam 0.5 Tab H1" && e.quantity === 3 && e.source === "Dispense"));
  assert.ok(mine.some((e) => e.medicineName === "Plain Cough Syrup" && e.quantity === 1), "the ticked line is there");
  assert.ok(!mine.some((e) => e.medicineName === "Plain Cough Syrup" && e.quantity === 2), "the untick line (qty 2) is not");
  const e = mine[0];
  assert.equal(e.patientName, patA.name);
  assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(e.time, /^\d\d:\d\d$/);
  assert.match(e.reference, /^DSP\//);
  assert.equal(e.date, today);
});

test("a walk-in and a counter sale are in the register too", async () => {
  const walk = await dispense({ walkInNote: "Walk-in, Mr Rao", lines: [{ itemId: h1Item.id, quantity: 2 }] });
  assert.equal(walk.status, 201, JSON.stringify(walk.error));
  const sale = await as(ADMIN, "POST", "/api/pharmacy/sales", { patientId: patB.id, paymentMode: "Cash", items: [{ pharmacyItemId: h1Item.id, medicineName: h1Item.name, quantity: 4, unitPrice: 10 }, { pharmacyItemId: plainItem.id, medicineName: plainItem.name, quantity: 1, unitPrice: 5, isH1: true }, { pharmacyItemId: plainItem.id, medicineName: plainItem.name, quantity: 7, unitPrice: 5 }] });
  assert.equal(sale.status, 201, JSON.stringify(sale.error));
  assert.deepEqual(sale.data.items.map((i: any) => i.isH1), [true, true, false], "sale lines carry the flag");
  const r = await register();
  const s = r.entries.filter((e) => e.source === "Sale" && e.patientId === patB.id);
  assert.equal(s.length, 2, "two H1 lines of the sale");
  assert.ok(s.every((e) => /^SALE-/.test(e.reference)));
  assert.ok(r.entries.some((e) => e.source === "Dispense" && e.patientId === null && e.quantity === 2), "the walk-in");
});

test("the prescriber comes from the prescription", async () => {
  const docs = (await as(ADMIN, "GET", "/api/doctors?pageSize=5")).data;
  const doctor = (docs.items ?? docs)[0];
  const rx = await as(ADMIN, "POST", "/api/prescriptions", { patientId: patB.id, patientName: patB.name, doctorId: doctor.id, diagnosis: "Anxiety", status: "Pending", items: [{ medicineName: "Alprazolam 0.5 Tab H1", dosage: "0.5 mg", frequency: "BD", duration: "5 days" }] });
  assert.equal(rx.status, 201, JSON.stringify(rx.error));
  const d = await dispense({ patientId: patB.id, prescriptionId: rx.data.id, lines: [{ itemId: h1Item.id, quantity: 5 }] });
  assert.equal(d.status, 201, JSON.stringify(d.error));
  const e = (await register()).entries.find((x) => x.reference === d.data.dispenseNo);
  assert.equal(e.prescriber, doctor.name);
  assert.equal(e.rxNumber, rx.data.rxNumber);
});

test("filter by dates, by patient and by search; the summary counts patients and units", async () => {
  const all = await register();
  assert.ok(all.summary.entries >= 6 && all.summary.patients >= 3);
  const todayOnly = await register(`?from=${today}&to=${today}`);
  assert.equal(todayOnly.entries.length, all.entries.length, "everything above was today");
  assert.equal((await register(`?from=${addDays(today, 1)}`)).entries.length, 0, "nothing from tomorrow");
  assert.equal((await register(`?to=${addDays(today, -1)}`)).entries.length, 0, "nothing up to yesterday");
  const forA = await register(`?patientId=${patA.id}`);
  assert.ok(forA.entries.length > 0 && forA.entries.every((e) => e.patientId === patA.id));
  assert.equal(forA.summary.patients, 1);
  assert.equal(forA.summary.units, forA.entries.reduce((n, e) => n + e.quantity - e.returnedQty, 0));
  const found = await register(`?search=${encodeURIComponent("cough")}`);
  assert.ok(found.entries.length > 0 && found.entries.every((e) => /cough/i.test(e.medicineName)));
  const byRef = await register(`?search=${encodeURIComponent(all.entries[0].reference)}`);
  assert.ok(byRef.entries.every((e) => e.reference === all.entries[0].reference));
});

test("a returned unit shows against the entry and comes off the units", async () => {
  const before = await register(`?patientId=${patA.id}`);
  const line = before.entries.find((e) => e.medicineName === "Alprazolam 0.5 Tab H1" && e.quantity === 3);
  const lineId = Number(line.key.split(":")[1]);
  const dispenseId = (await as(ADMIN, "GET", "/api/pharmacy/dispense")).data.find((d: any) => d.dispenseNo === line.reference).id;
  const ret = await as(ADMIN, "POST", `/api/pharmacy/dispense/${dispenseId}/return`, { lines: [{ lineId, quantity: 1, condition: "Usable" }] });
  assert.equal(ret.status, 200, JSON.stringify(ret.error));
  const after = await register(`?patientId=${patA.id}`);
  const again = after.entries.find((e) => e.key === line.key);
  assert.equal(again.returnedQty, 1);
  assert.equal(after.summary.units, before.summary.units - 1);
});

test("bad dates are refused; only people who can read the pharmacy can open the register", async () => {
  assert.ok(bad((await as(ADMIN, "GET", "/api/pharmacy/h1-register?from=14-11-2026")).status));
  assert.ok(bad((await as(ADMIN, "GET", "/api/pharmacy/h1-register?to=soon")).status));
  assert.ok(bad((await as(ADMIN, "GET", `/api/pharmacy/h1-register?from=${addDays(today, 3)}&to=${today}`)).status), "from after to");
  assert.equal((await as(RECEPTION, "GET", "/api/pharmacy/h1-register")).status, 403);
});

test("a medicine billed on a Billing-screen bill is an H1 line when the inventory says so (automatic) or it is ticked, and shows in the register", async () => {
  const line = (description: string, extra: Record<string, unknown> = {}) => ({ description, quantity: 2, unitPrice: 30, gstRate: 0, ...extra });
  const r = await as(ADMIN, "POST", "/api/billing", { patientId: patA.id, patientName: patA.name, type: "Pharmacy", items: [line("Alprazolam 0.5 Tab H1"), line("Plain Cough Syrup", { isH1: true, givenBy: "Nurse Asha" }), line("Plain Cough Syrup"), line("Consumables kit")] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const flags = r.data.items.map((i: any) => !!i.isH1);
  assert.deepEqual(flags, [true, true, false, false], "the H1 medicine is automatic; the ticked one too; the rest are not");
  assert.equal(r.data.items[0].hsnSac, "30049099", "the HSN comes from the inventory");
  const mine = (await register(`?patientId=${patA.id}`)).entries.filter((e) => e.source === "Bill" && e.reference === r.data.billNumber);
  assert.equal(mine.length, 2);
  assert.ok(mine.every((e) => e.quantity === 2 && e.billNumber === r.data.billNumber));
  const byName = Object.fromEntries(mine.map((e) => [e.medicineName, e]));
  assert.equal(byName["Alprazolam 0.5 Tab H1"].givenBy, "Dr. Kevin Carter", "defaults to the biller's name");
  assert.equal(byName["Plain Cough Syrup"].givenBy, "Nurse Asha", "the biller can name someone else");
  assert.ok(Number(byName["Alprazolam 0.5 Tab H1"].givenById) > 0 && byName["Plain Cough Syrup"].givenById === byName["Alprazolam 0.5 Tab H1"].givenById, "the user id is saved either way");
  // a refunded bill's H1 lines show as returned
  await as(ADMIN, "PATCH", `/api/billing/${r.data.id}`, { status: "Paid" });
  await as(ADMIN, "PATCH", `/api/billing/${r.data.id}`, { status: "Refunded" });
  const refunded = (await register(`?patientId=${patA.id}`)).entries.filter((e) => e.source === "Bill" && e.reference === r.data.billNumber);
  assert.ok(refunded.every((e) => e.returnedQty === 2), "a refunded bill is returned");
});

test("a billed or sold medicine takes the earliest-expiring batch by default, or the batch that was chosen; a sale takes its units from it", async () => {
  const { pharmacyRepo, pharmacyBatchesRepo } = await import("@/repositories");
  const it = await newItem("Batchy Tab", { stock: 10, expiryDate: "2031-06-01" });
  const first = (await as(ADMIN, "GET", `/api/pharmacy/${it.id}/batches`)).data;
  assert.equal(first.length, 1, "the stock is one opening batch");
  await pharmacyBatchesRepo.create({ hospital_id: (await pharmacyRepo.getRow(it.id))!.hospital_id, item_id: it.id, batch_no: "B-EARLY", expiry_date: "2030-01-01", quantity: 5 } as never);
  await pharmacyRepo.update(it.id, { stock: 15 } as never);
  const batches = (await as(ADMIN, "GET", `/api/pharmacy/${it.id}/batches`)).data;
  assert.deepEqual(batches.map((b: any) => b.batchNo), ["B-EARLY", first[0].batchNo], "earliest expiry first");
  const line = (extra: Record<string, unknown> = {}) => ({ description: "Batchy Tab", quantity: 2, unitPrice: 5, gstRate: 0, ...extra });
  const bill = await as(ADMIN, "POST", "/api/billing", { patientId: patA.id, patientName: patA.name, type: "Pharmacy", items: [line(), line({ batchNo: first[0].batchNo }), line({ isH1: true })] });
  assert.equal(bill.status, 201, JSON.stringify(bill.error));
  assert.deepEqual(bill.data.items.map((i: any) => i.batchNo), ["B-EARLY", first[0].batchNo, "B-EARLY"]);
  const bad1 = await as(ADMIN, "POST", "/api/billing", { patientId: patA.id, patientName: patA.name, type: "Pharmacy", items: [line({ batchNo: "NOPE" })] });
  assert.ok(bad(bad1.status), "a batch that isn't in stock is refused");
  const sale = await as(ADMIN, "POST", "/api/pharmacy/sales", { patientId: patA.id, paymentMode: "Cash", items: [{ medicineName: "Batchy Tab", pharmacyItemId: it.id, quantity: 7, unitPrice: 5, isH1: true }] });
  assert.equal(sale.status, 201, JSON.stringify(sale.error));
  const after = (await as(ADMIN, "GET", `/api/pharmacy/${it.id}/batches`)).data;
  assert.deepEqual(after.map((b: any) => [b.batchNo, b.quantity]), [[first[0].batchNo, 8]], "B-EARLY (5) is used up first, then 2 from the next");
  const reg = (await register(`?patientId=${patA.id}`)).entries.filter((e) => e.medicineName === "Batchy Tab");
  assert.deepEqual(reg.map((e) => e.batchNo).sort(), ["B-EARLY", `B-EARLY, ${first[0].batchNo}`].sort(), "the register shows the batch (a bill line and a sale line)");
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
