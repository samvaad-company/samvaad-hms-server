/**
 * Pharmacy purchasing: cash / credit bills, manufacturers and suppliers in Setup → Masters (add, rename, delete, change a medicine's
 * manufacturer), HSN and Schedule H1 on medicines and bill lines, and the supplier credit ledger — stock returned to a supplier earns
 * credit that the next bill for the same supplier and manufacturer uses, with a history of every movement.
 * In-process, in-memory.
 *
 *   npm run test:purchase
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; meta?: any; error?: { message: string; details?: any } } | null;
  return { status: res.status, data: parsed?.data, meta: parsed?.meta, error: parsed?.error, headers: res.headers };
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

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const master = async (kind: string, body: Record<string, unknown>) => {
  const r = await as(ADMIN, "POST", `/api/setup/${kind}`, body);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data;
};
const stockOf = async (id: number) => (await as(ADMIN, "GET", `/api/pharmacy/${id}`)).data.stock as number;
const newItem = async (name: string, stock = 100, extra: Record<string, unknown> = {}) => {
  const r = await as(ADMIN, "POST", "/api/pharmacy", { name, category: "Tablet", stock, minStock: 5, expiryDate: "2030-01-01", ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data;
};
const po = (body: Record<string, unknown>) => as(ADMIN, "POST", "/api/pharmacy/purchase-orders", body);
const balances = async (supplier?: string) => (await as(ADMIN, "GET", `/api/pharmacy/supplier-credits/balances${supplier ? `?supplier=${encodeURIComponent(supplier)}` : ""}`)).data as { supplier: string; manufacturer: string; balance: number }[];

let cipla: any, sunPharma: any, medPlus: any, healthCo: any;
let itemA: any, itemB: any;

test("manufacturers and suppliers are Setup masters: anyone signed in can read them, only an admin can change them, names are unique", async () => {
  cipla = await master("manufacturer", { name: "Cipla Ltd", contactPerson: "R. Shah", phone: "9800000001" });
  sunPharma = await master("manufacturer", { name: "Sun Pharma" });
  medPlus = await master("supplier", { name: "MedPlus Distributors", gstin: "24AAACM1234A1Z5", drugLicenceNo: "GJ-DL-1001", creditDays: 30 });
  healthCo = await master("supplier", { name: "HealthCo Wholesale" });
  assert.equal(cipla.data.contactPerson, "R. Shah");
  assert.equal(medPlus.data.creditDays, 30);
  assert.equal((await as(RECEPTION, "GET", "/api/setup/manufacturer")).status, 200, "readable by any signed-in user");
  assert.equal((await as(RECEPTION, "POST", "/api/setup/manufacturer", { name: "Nope" })).status, 403, "only an admin changes masters");
  assert.ok(bad((await as(ADMIN, "POST", "/api/setup/manufacturer", { name: "cipla ltd" })).status), "a name can't be repeated");
  assert.ok(bad((await as(ADMIN, "POST", "/api/setup/supplier", { name: "X", creditDays: 9999 })).status), "credit days are limited");
});

test("a medicine carries its manufacturer, supplier, HSN code and H1 flag — HSN must look like one", async () => {
  itemA = await newItem("Azithral 500 Tab", 100, { manufacturer: "Cipla Ltd", supplier: "MedPlus Distributors", hsn: "30049099", isH1: true });
  assert.equal(itemA.manufacturer, "Cipla Ltd");
  assert.equal(itemA.supplier, "MedPlus Distributors");
  assert.equal(itemA.hsn, "30049099");
  assert.equal(itemA.isH1, true);
  itemB = await newItem("Crocin 650 Tab", 100, { manufacturer: "Sun Pharma", supplier: "MedPlus Distributors" });
  assert.equal(itemB.isH1, false, "not H1 unless ticked");
  assert.equal(itemB.hsn, "");
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy", { name: "Bad HSN", category: "Tablet", stock: 1, hsn: "12" })).status), "HSN is 4 to 8 digits");
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy", { name: "Bad HSN 2", category: "Tablet", stock: 1, hsn: "ABCD" })).status));
  const edited = (await as(ADMIN, "PATCH", `/api/pharmacy/${itemB.id}`, { hsn: "3004", isH1: true })).data;
  assert.equal(edited.hsn, "3004");
  assert.equal(edited.isH1, true);
  const cleared = (await as(ADMIN, "PATCH", `/api/pharmacy/${itemB.id}`, { hsn: "", isH1: false })).data;
  assert.equal(cleared.hsn, "", "the HSN can be cleared");
  assert.equal(cleared.isH1, false);
});

test("a cash bill is paid at once; a credit bill is unpaid until it is marked paid; lines keep manufacturer, HSN and H1", async () => {
  const cash = await po({ supplier: "MedPlus Distributors", paymentType: "Cash", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 10, unitCost: 50, manufacturer: "Cipla Ltd", hsn: "30049099", isH1: true }] });
  assert.equal(cash.status, 201, JSON.stringify(cash.error));
  assert.equal(cash.data.paymentType, "Cash");
  assert.equal(cash.data.paymentStatus, "Paid");
  assert.equal(cash.data.total, 500);
  assert.equal(cash.data.netPayable, 500);
  assert.equal(cash.data.creditApplied, 0);
  assert.deepEqual([cash.data.items[0].manufacturer, cash.data.items[0].hsn, cash.data.items[0].isH1], ["Cipla Ltd", "30049099", true]);
  const credit = await po({ supplier: "MedPlus Distributors", paymentType: "Credit", items: [{ medicineName: "Crocin 650 Tab", pharmacyItemId: itemB.id, quantity: 20, unitCost: 10 }] });
  assert.equal(credit.data.paymentType, "Credit");
  assert.equal(credit.data.paymentStatus, "Unpaid");
  assert.equal(credit.data.items[0].manufacturer, "Sun Pharma", "a line without a manufacturer takes the medicine's own");
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/purchase-orders/${credit.data.id}/pay`)).data.paymentStatus, "Paid");
  assert.equal((await as(ADMIN, "POST", `/api/pharmacy/purchase-orders/${credit.data.id}/pay`)).status, 409, "can't pay twice");
  assert.equal((await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "Azithral 500 Tab", quantity: 1, unitCost: 5 }] })).data.paymentType, "Cash", "cash unless said otherwise");
  assert.ok(bad((await po({ supplier: "MedPlus Distributors", paymentType: "Barter", items: [{ medicineName: "X", quantity: 1 }] })).status), "only Cash or Credit");
});

test("bad lines are refused: no lines, a fraction of a unit, a negative cost, an HSN that isn't one", async () => {
  assert.ok(bad((await po({ supplier: "MedPlus Distributors", items: [] })).status));
  assert.ok(bad((await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "A", quantity: 1.5, unitCost: 5 }] })).status));
  assert.ok(bad((await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "A", quantity: 1, unitCost: -5 }] })).status));
  assert.ok(bad((await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "A", quantity: 1, unitCost: 5, hsn: "12" }] })).status));
  assert.ok(bad((await po({ items: [{ medicineName: "A", quantity: 1 }] })).status), "a supplier is needed");
});

test("receiving a bill adds the stock and records the manufacturer, HSN and H1 on the medicine", async () => {
  const plain = await newItem("Dolo 500 Tab", 10);
  const bill = (await po({ supplier: "HealthCo Wholesale", paymentType: "Cash", items: [{ medicineName: "Dolo 500 Tab", pharmacyItemId: plain.id, quantity: 40, unitCost: 2, manufacturer: "Sun Pharma", hsn: "3004", isH1: true }] })).data;
  const got = (await as(ADMIN, "POST", `/api/pharmacy/purchase-orders/${bill.id}/receive`)).data;
  assert.equal(got.status, "Received");
  const after = (await as(ADMIN, "GET", `/api/pharmacy/${plain.id}`)).data;
  assert.equal(after.stock, 50);
  assert.equal(after.manufacturer, "Sun Pharma");
  assert.equal(after.hsn, "3004");
  assert.equal(after.isH1, true);
  assert.equal(after.supplier, "HealthCo Wholesale", "a medicine with no supplier takes the bill's");
});

test("returning stock to a supplier: it leaves the shelf, earns the same amount as credit, and shows in the history", async () => {
  const before = await stockOf(itemA.id);
  const r = await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: 4, unitCost: 50, reason: "Near expiry" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.entry.entryType, "Return");
  assert.equal(r.data.entry.amount, 200, "4 x 50");
  assert.equal(r.data.entry.supplier, "MedPlus Distributors", "the medicine's supplier is used");
  assert.equal(r.data.entry.manufacturer, "Cipla Ltd");
  assert.match(r.data.entry.reference, /^RET-\d{4}$/);
  assert.equal(r.data.balance, 200);
  assert.equal(await stockOf(itemA.id), before - 4, "stock went down");
  const hist = (await as(ADMIN, "GET", "/api/pharmacy/supplier-credits")).data;
  assert.ok(hist.some((h: any) => h.entryType === "Return" && h.medicineName === "Azithral 500 Tab" && h.quantity === 4 && h.reason === "Near expiry"));
  const bal = (await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd");
  assert.equal(bal?.balance, 200);
});

test("returns are checked: more than is in stock, no cost to work from, an unknown item, no permission", async () => {
  const stock = await stockOf(itemA.id);
  assert.equal((await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: stock + 1, unitCost: 50 })).status, 409, "can't return more than is there");
  assert.equal(await stockOf(itemA.id), stock, "nothing moved");
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: 0, unitCost: 5 })).status));
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: 1.5, unitCost: 5 })).status));
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: 999999, quantity: 1, unitCost: 5 })).status));
  const fresh = await newItem("No Cost Tab", 10, { supplier: "HealthCo Wholesale" });
  const r = await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: fresh.id, quantity: 1 });
  assert.ok(bad(r.status), "never bought, so no cost to take the credit from");
  const noSupplier = await newItem("No Supplier Tab", 10);
  assert.ok(bad((await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: noSupplier.id, quantity: 1, unitCost: 5 })).status), "a supplier is needed");
  assert.equal((await as(RECEPTION, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: 1, unitCost: 50 })).status, 403, "reception can't return stock");
  assert.equal((await as(RECEPTION, "GET", "/api/pharmacy/supplier-credits")).status, 403);
});

test("the cost of the last purchase is used when none is given", async () => {
  const x = await newItem("Costed Tab", 30, { supplier: "HealthCo Wholesale", manufacturer: "Sun Pharma" });
  await po({ supplier: "HealthCo Wholesale", items: [{ medicineName: "Costed Tab", pharmacyItemId: x.id, quantity: 5, unitCost: 8 }] });
  const r = await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: x.id, quantity: 5 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.entry.amount, 40);
  assert.equal(r.data.entry.unitCost, 8);
});

test("the next bill for the same supplier and manufacturer uses the credit; another manufacturer or supplier does not", async () => {
  // MedPlus owes 200 credit for Cipla goods (from the return above).
  const other = await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "Crocin 650 Tab", pharmacyItemId: itemB.id, quantity: 10, unitCost: 100, manufacturer: "Sun Pharma" }] });
  assert.equal(other.data.creditApplied, 0, "Sun Pharma goods don't use Cipla credit");
  const otherSupplier = await po({ supplier: "HealthCo Wholesale", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 10, unitCost: 100, manufacturer: "Cipla Ltd" }] });
  assert.equal(otherSupplier.data.creditApplied, 0, "another supplier doesn't use it");
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, 200, "still there");

  const same = await po({ supplier: "MedPlus Distributors", paymentType: "Credit", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 10, unitCost: 50, manufacturer: "Cipla Ltd" }] });
  assert.equal(same.data.total, 500);
  assert.equal(same.data.creditApplied, 200, "the whole credit is used");
  assert.equal(same.data.netPayable, 300);
  assert.equal(same.data.paymentStatus, "Unpaid", "300 is still to pay on a credit bill");
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd"), undefined, "the credit is used up");
  const hist = (await as(ADMIN, "GET", "/api/pharmacy/supplier-credits")).data;
  const applied = hist.find((h: any) => h.entryType === "Applied" && h.purchaseOrderId === same.data.id);
  assert.equal(applied.amount, -200);
  assert.equal(applied.reference, same.data.poNumber);
});

test("credit never exceeds the bill: a small bill uses part of it and the rest stays; a bill fully covered is paid", async () => {
  await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemA.id, quantity: 6, unitCost: 50 }); // +300
  const small = await po({ supplier: "MedPlus Distributors", paymentType: "Credit", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 2, unitCost: 50, manufacturer: "Cipla Ltd" }] });
  assert.equal(small.data.creditApplied, 100);
  assert.equal(small.data.netPayable, 0);
  assert.equal(small.data.paymentStatus, "Paid", "covered entirely by credit");
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, 200, "the rest stays");
});

test("a bill can choose not to use the credit; credit is split across manufacturers on one bill", async () => {
  const skip = await po({ supplier: "MedPlus Distributors", useCredit: false, items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 1, unitCost: 50, manufacturer: "Cipla Ltd" }] });
  assert.equal(skip.data.creditApplied, 0);
  assert.equal(skip.data.netPayable, 50);
  await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: itemB.id, quantity: 3, unitCost: 10 }); // +30 for Sun Pharma
  const both = await po({ supplier: "MedPlus Distributors", items: [
    { medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 1, unitCost: 50, manufacturer: "Cipla Ltd" },
    { medicineName: "Crocin 650 Tab", pharmacyItemId: itemB.id, quantity: 10, unitCost: 10, manufacturer: "Sun Pharma" },
  ] });
  assert.equal(both.data.total, 150);
  assert.equal(both.data.creditApplied, 50 + 30, "Cipla credit capped at its 50, Sun Pharma credit 30 of its 100");
  assert.equal(both.data.netPayable, 70);
  const bal = await balances("MedPlus Distributors");
  assert.equal(bal.find((b) => b.manufacturer === "Cipla Ltd")?.balance, 150);
  assert.equal(bal.find((b) => b.manufacturer === "Sun Pharma"), undefined);
});

test("cancelling or deleting a bill gives its credit back, once; editing a bill works the credit out again", async () => {
  const start = (await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")!.balance; // 150
  const bill = (await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 2, unitCost: 50, manufacturer: "Cipla Ltd" }] })).data;
  assert.equal(bill.creditApplied, 100);
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, start - 100);
  // edit: a bigger bill uses the rest of the credit
  const edited = (await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${bill.id}`, { items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 10, unitCost: 50, manufacturer: "Cipla Ltd" }] })).data;
  assert.equal(edited.total, 500);
  assert.equal(edited.creditApplied, start, "all that was available");
  assert.equal(edited.netPayable, 500 - start);
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd"), undefined);
  // edit it down: credit comes back
  const down = (await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${bill.id}`, { items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 1, unitCost: 50, manufacturer: "Cipla Ltd" }] })).data;
  assert.equal(down.creditApplied, 50);
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, start - 50);
  // cancel: everything it used comes back; cancelling again changes nothing
  const cancelled = (await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${bill.id}`, { status: "Cancelled" })).data;
  assert.equal(cancelled.status, "Cancelled");
  assert.equal(cancelled.creditApplied, 0);
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, start);
  await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${bill.id}`, { status: "Cancelled" });
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, start, "no double refund");
  // delete a bill that used credit
  const second = (await po({ supplier: "MedPlus Distributors", items: [{ medicineName: "Azithral 500 Tab", pharmacyItemId: itemA.id, quantity: 1, unitCost: 50, manufacturer: "Cipla Ltd" }] })).data;
  assert.equal(second.creditApplied, 50);
  assert.equal((await as(ADMIN, "DELETE", `/api/pharmacy/purchase-orders/${second.id}`)).status, 204);
  assert.equal((await balances("MedPlus Distributors")).find((b) => b.manufacturer === "Cipla Ltd")?.balance, start, "deleting gives it back");
  const hist = (await as(ADMIN, "GET", "/api/pharmacy/supplier-credits?pageSize=200")).data;
  assert.ok(hist.some((h: any) => h.entryType === "Reversal" && h.amount > 0), "the history shows the credit given back");
  // a received bill can't be edited or cancelled
  const done = (await po({ supplier: "HealthCo Wholesale", items: [{ medicineName: "Dolo 500 Tab", quantity: 1, unitCost: 2 }] })).data;
  await as(ADMIN, "POST", `/api/pharmacy/purchase-orders/${done.id}/receive`);
  assert.equal((await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${done.id}`, { items: [{ medicineName: "Dolo 500 Tab", quantity: 5, unitCost: 2 }] })).status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/pharmacy/purchase-orders/${done.id}`, { status: "Cancelled" })).status, 409, "stock is already in");
});

test("two bills at the same moment can't spend the same credit twice", async () => {
  const s = await master("supplier", { name: "Race Supplier" });
  const m = await master("manufacturer", { name: "Race Pharma" });
  const it = await newItem("Race Tab", 100, { supplier: s.name, manufacturer: m.name });
  const ret = await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: it.id, quantity: 10, unitCost: 10 }); // 100 credit
  assert.equal(ret.status, 201);
  const bill = () => po({ supplier: s.name, items: [{ medicineName: it.name, pharmacyItemId: it.id, quantity: 10, unitCost: 10, manufacturer: m.name }] });
  const [a, b] = await Promise.all([bill(), bill()]);
  assert.equal(a.data.creditApplied + b.data.creditApplied, 100, "100 of credit, used once in total");
  assert.equal((await balances(s.name)).find((x) => x.manufacturer === m.name), undefined);
});

test("renaming a manufacturer or supplier in Masters updates the medicines, bills and credit history; one in use can't be deleted", async () => {
  const s = await master("supplier", { name: "Old Supplier" });
  const m = await master("manufacturer", { name: "Old Maker" });
  const it = await newItem("Rename Tab", 50, { supplier: "Old Supplier", manufacturer: "Old Maker" });
  const bill = (await po({ supplier: "Old Supplier", items: [{ medicineName: "Rename Tab", pharmacyItemId: it.id, quantity: 5, unitCost: 4, manufacturer: "Old Maker" }] })).data;
  await as(ADMIN, "POST", "/api/pharmacy/supplier-returns", { pharmacyItemId: it.id, quantity: 2, unitCost: 4 });
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/supplier/${s.id}`)).status, 409, "in use");
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/manufacturer/${m.id}`)).status, 409, "in use");
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/supplier/${s.id}`, { name: "New Supplier" })).status, 200);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/manufacturer/${m.id}`, { name: "New Maker" })).status, 200);
  const item = (await as(ADMIN, "GET", `/api/pharmacy/${it.id}`)).data;
  assert.equal(item.supplier, "New Supplier");
  assert.equal(item.manufacturer, "New Maker");
  const gotBill = (await as(ADMIN, "GET", `/api/pharmacy/purchase-orders/${bill.id}`)).data;
  assert.equal(gotBill.supplier, "New Supplier");
  assert.equal(gotBill.items[0].manufacturer, "New Maker");
  const bal = (await balances("New Supplier")).find((b) => b.manufacturer === "New Maker");
  assert.equal(bal?.balance, 8, "the credit follows the new names");
  assert.equal((await balances("Old Supplier")).length, 0);
  // an unused one can be deleted
  const spare = await master("manufacturer", { name: "Spare Maker" });
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/manufacturer/${spare.id}`)).status, 204);
});

test("Masters → Manufacturers: list a manufacturer's medicines and move one to another manufacturer", async () => {
  const mk = await master("manufacturer", { name: "Mapping Maker" });
  const other = await master("manufacturer", { name: "Mapping Other" });
  const it = await newItem("Mapped Tab", 20, { manufacturer: "Mapping Maker" });
  const list = (await as(ADMIN, "GET", `/api/pharmacy/manufacturers/${mk.id}/medicines`)).data;
  assert.ok(list.some((x: any) => x.id === it.id && x.name === "Mapped Tab"));
  assert.equal((await as(RECEPTION, "PATCH", `/api/pharmacy/${it.id}/manufacturer`, { manufacturerId: other.id })).status, 403, "only an admin");
  const moved = await as(ADMIN, "PATCH", `/api/pharmacy/${it.id}/manufacturer`, { manufacturerId: other.id });
  assert.equal(moved.status, 200, JSON.stringify(moved.error));
  assert.equal(moved.data.manufacturer, "Mapping Other");
  assert.equal((await as(ADMIN, "GET", `/api/pharmacy/${it.id}`)).data.manufacturer, "Mapping Other");
  assert.ok(!(await as(ADMIN, "GET", `/api/pharmacy/manufacturers/${mk.id}/medicines`)).data.some((x: any) => x.id === it.id), "no longer under the old one");
  assert.ok(bad((await as(ADMIN, "PATCH", `/api/pharmacy/${it.id}/manufacturer`, { manufacturerId: 999999 })).status), "an unknown manufacturer");
  const none = await as(ADMIN, "PATCH", `/api/pharmacy/${it.id}/manufacturer`, { manufacturerId: null });
  assert.equal(none.data.manufacturer, "", "or none");
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/manufacturer/${mk.id}`)).status, 204, "now unused, so it can be deleted");
});

test("the credit history can be filtered by supplier, manufacturer and kind, and searched", async () => {
  const byKind = (await as(ADMIN, "GET", "/api/pharmacy/supplier-credits?entry_type=Return&pageSize=200")).data;
  assert.ok(byKind.length >= 3 && byKind.every((h: any) => h.entryType === "Return"));
  const bySupplier = (await as(ADMIN, "GET", `/api/pharmacy/supplier-credits?supplier=${encodeURIComponent("MedPlus Distributors")}&pageSize=200`)).data;
  assert.ok(bySupplier.length > 0 && bySupplier.every((h: any) => h.supplier === "MedPlus Distributors"));
  const found = (await as(ADMIN, "GET", "/api/pharmacy/supplier-credits?search=Azithral&pageSize=200")).data;
  assert.ok(found.length > 0 && found.every((h: any) => /Azithral|RET-|PO-/.test(`${h.medicineName}${h.reference}`) || h.manufacturer));
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
