/**
 * Tests for insurance and payouts on invoices: the copay / deductible / limit / exclusion engine, a patient's payer linked to a
 * sponsor contract, an invoice split between payer and patient, and payout rules earning doctors, referrers and outside labs.
 * In-process, in-memory.
 *
 *   npm run test:coverage
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { splitCoverage, readTerms } = await import("@shared/types/coverage");
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
const master = async (kind: string) => (await as(ADMIN, "GET", `/api/setup/${kind}`)).data as any[];
let seq = 0;

// ── The engine ───────────────────────────────────────────────────────────────

const none = { annualPaid: 0, items: [] };
const ctx = { today: "2026-10-29", contractFrom: "2026-01-01" };
const line = (name: string, total: number, over: Record<string, unknown> = {}) => ({ name, code: "", groupIds: [], groupNames: [], quantity: 1, total, ...over });
const terms = (copay: any[], extra: Record<string, unknown[]> = {}) => readTerms({ copay: copay.map((c) => ({ groupId: null, ...c })), ...extra });

test("engine: no rule means the payer pays all; the deductible is the patient's first, then copay % of the rest", async () => {
  assert.deepEqual(splitCoverage(terms([]), [line("A", 1000)], none, ctx).payer, 1000);
  const r = splitCoverage(terms([{ copayPercent: 20, deductible: 500 }]), [line("A", 2500)], none, ctx);
  assert.deepEqual([r.patient, r.payer], [900, 1600], "500 + 20% of 2000");
});

test("engine: copay is held between the minimum and maximum, and never passes the bill", async () => {
  const t = terms([{ copayPercent: 10, copayMin: 1000, copayMax: 3000 }]);
  assert.equal(splitCoverage(t, [line("A", 500)], none, ctx).patient, 500, "min 1000 but the bill is 500");
  assert.equal(splitCoverage(t, [line("A", 5000)], none, ctx).patient, 1000);
  assert.equal(splitCoverage(t, [line("A", 100000)], none, ctx).patient, 3000);
});

test("engine: a group's rule beats the default, and a parent group's rule covers its children", async () => {
  const t = terms([{ copayPercent: 0 }, { groupId: 7, copayPercent: 50 }]);
  const r = splitCoverage(t, [line("In group", 100, { groupIds: [9, 7] }), line("Elsewhere", 100, { groupIds: [3] })], none, ctx);
  assert.deepEqual(r.lines.map((l) => l.payer), [50, 100]);
});

test("engine: exclusions are the patient's in full, matched on a name, a code or a group", async () => {
  const t = terms([{}], { exclusions: [{ target: "cosmetic" }, { target: "LAB-X", reason: "Not on the schedule" }, { target: "Wellness" }] });
  const r = splitCoverage(t, [line("Cosmetic surgery", 900), line("Test", 100, { code: "LAB-X" }), line("Gym", 50, { groupNames: ["Wellness Programmes"] }), line("Consult", 200)], none, ctx);
  assert.deepEqual(r.lines.map((l) => l.payer), [0, 0, 0, 200]);
  assert.match(r.lines[1].note, /Not on the schedule/);
});

test("engine: the per-encounter limit caps what the payer pays on a rule's lines; the rest is the patient's", async () => {
  const r = splitCoverage(terms([{ copayPercent: 20, encounterLimit: 40000 }]), [line("Surgery", 60000)], none, ctx);
  assert.deepEqual([r.payer, r.patient], [40000, 20000]);
});

test("engine: the annual limit counts what the payer already paid this year", async () => {
  const t = terms([{ annualLimit: 750000 }]);
  assert.equal(splitCoverage(t, [line("A", 100000)], { annualPaid: 700000, items: [] }, ctx).payer, 50000);
  assert.equal(splitCoverage(t, [line("A", 100000)], { annualPaid: 750000, items: [] }, ctx).payer, 0);
  assert.equal(splitCoverage(t, [line("A", 100000)], none, ctx).payer, 100000);
});

test("engine: limit rules cap one kind of charge — per day, per visit, and by times allowed over a year", async () => {
  const room = terms([{}], { limits: [{ target: "Room rent", limitAmount: 3000, per: "day" }] });
  const r = splitCoverage(room, [line("Room rent (private)", 15000, { quantity: 3 }), line("Medicines", 500)], none, ctx);
  assert.deepEqual(r.lines.map((l) => l.payer), [9000, 500], "3000 a day for 3 days");
  const visits = terms([{}], { limits: [{ target: "Physiotherapy", limitCount: 5, per: "year" }] });
  const past = { annualPaid: 0, items: [{ name: "Physiotherapy", code: "", groupNames: [], quantity: 4, payer: 2000, date: "2026-06-01" }, { name: "Physiotherapy", code: "", groupNames: [], quantity: 9, payer: 4500, date: "2024-01-01" }] };
  const two = splitCoverage(visits, [line("Physiotherapy", 1000, { quantity: 2 })], past, ctx);
  assert.equal(two.payer, 500, "4 used this year (an old year doesn't count), 1 of 2 left");
  const amt = terms([{}], { limits: [{ target: "Physiotherapy", limitAmount: 3000, per: "contract" }] });
  assert.equal(splitCoverage(amt, [line("Physiotherapy", 2000)], past, ctx).payer, 1000, "2000 already paid under the contract");
});

test("engine: the parts always add up to the bill", async () => {
  const t = terms([{ copayPercent: 12.5, deductible: 33.33, copayMin: 7 }, { groupId: 1, copayPercent: 33 }], { limits: [{ target: "x", limitAmount: 10, per: "visit" }] });
  const lines = [line("x one", 123.45, { groupIds: [1] }), line("two", 77.77), line("three", 1000.01, { groupIds: [1] })];
  const r = splitCoverage(t, lines, none, ctx);
  assert.equal(Math.round((r.payer + r.patient) * 100) / 100, 1201.23);
  assert.equal(Math.round(r.lines.reduce((n, l) => n + l.payer + l.patient, 0) * 100) / 100, 1201.23);
});

// ── On the counter ───────────────────────────────────────────────────────────

const svc = async (code: string) => (await master("service")).find((s) => s.code === code);
const premium = async () => (await master("contract")).find((c) => /Premium 2026/.test(c.name));
const covered = async (over: Record<string, unknown> = {}) => {
  const c = await premium();
  const r = await as(ADMIN, "POST", "/api/patients", { name: `Insured ${++seq}`, age: 40, gender: "Female", phone: `96${String(30000000 + seq).slice(-8)}`, payers: [{ type: "Insurance", name: "Star Health", policyNumber: `POL${seq}`, contractId: c.id }], ...over });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return { patient: r.data, contract: c };
};
const raise = (body: Record<string, unknown>) => as(BILLING, "POST", "/api/billing", { type: "OPD", ...body });

test("a patient's payer can be tied to an active sponsor contract; one that doesn't exist or is switched off is refused", async () => {
  const { patient, contract } = await covered();
  const got = (await as(ADMIN, "GET", `/api/patients/${patient.id}`)).data;
  assert.equal(got.payers[0].contractId, contract.id);
  const off = (await master("contract")).find((c) => !c.active);
  assert.ok(off);
  for (const id of [999999, off.id]) {
    const r = await as(ADMIN, "POST", "/api/patients", { name: "Bad Cover", age: 30, gender: "Male", phone: "9622222222", payers: [{ type: "Insurance", name: "X", contractId: id }] });
    assert.equal(r.status, 422, String(id));
  }
});

test("the counter offers the contracts a patient is covered under, with the rules; a self-pay patient has none", async () => {
  const { patient, contract } = await covered();
  const cat = (await as(BILLING, "GET", `/api/billing/catalog?patientId=${patient.id}`)).data;
  assert.deepEqual(cat.contracts.map((c: any) => c.id), [contract.id]);
  assert.equal(cat.contracts[0].terms.copay.length, 4);
  assert.ok(cat.doctors.length > 0);
  const self = (await as(ADMIN, "POST", "/api/patients", { name: "Self Pay", age: 30, gender: "Male", phone: "9633333333" })).data;
  assert.deepEqual((await as(BILLING, "GET", `/api/billing/catalog?patientId=${self.id}`)).data.contracts, []);
  const cons = cat.services.find((s: any) => s.code === "CONS-GEN");
  assert.ok(cons.groupNames.includes("Consultations") && cons.groupIds.length >= 1);
});

test("an invoice under the contract is split by its rules and saved: consultation copay floors at 1,000, procedures 20%, the rest paid in full", async () => {
  const { patient, contract } = await covered();
  const items = [{ serviceId: (await svc("CONS-GEN")).id }, { serviceId: (await svc("PROC-SUT")).id }, { serviceId: (await svc("LAB-CBC")).id }];
  const r = await raise({ patientId: patient.id, patientName: patient.name, contractId: contract.id, items });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.total, r.data.payerShare, r.data.patientShare], [2050, 1310, 740]);
  assert.deepEqual(r.data.items.map((i: any) => i.payerAmount ?? 0), [0, 960, 350]);
  assert.equal(r.data.contractName, contract.name);
  const again = (await as(BILLING, "GET", `/api/billing/${r.data.id}`)).data;
  assert.deepEqual([again.payerShare, again.patientShare], [1310, 740]);
});

test("self-pay and under-a-contract are the cashier's choice; a contract the patient isn't under is refused", async () => {
  const { patient } = await covered();
  const plain = await raise({ patientId: patient.id, patientName: patient.name, items: [{ serviceId: (await svc("CONS-GEN")).id }] });
  assert.equal(plain.data.contractId, undefined);
  assert.equal(plain.data.payerShare, undefined);
  const other = (await master("contract")).find((c) => c.active && !/Premium 2026/.test(c.name)) ?? (await master("contract"))[0];
  const bad = await raise({ patientId: patient.id, patientName: patient.name, contractId: other.id, items: [{ serviceId: (await svc("CONS-GEN")).id }] });
  assert.equal(bad.status, 422);
  assert.match(JSON.stringify(bad.error), /contractId/);
  assert.equal((await raise({ patientName: "No patient", contractId: other.id, items: [{ serviceId: (await svc("CONS-GEN")).id }] })).status, 422);
});

test("an exclusion added in Setup takes effect on the next invoice; a contract's rate plan prices the bill", async () => {
  const { patient, contract } = await covered();
  await as(ADMIN, "POST", `/api/setup/contract/${contract.id}/rules`, { kind: "exclusion", rule: { target: "Nebulization", reason: "Not covered" } });
  const r = await raise({ patientId: patient.id, patientName: patient.name, contractId: contract.id, items: [{ serviceId: (await svc("PROC-NEB")).id }] });
  assert.deepEqual([r.data.payerShare, r.data.patientShare], [0, 250]);
  // Price the contract from the TPA plan, where consultation is 650.
  const tpa = (await master("rate_plan")).find((p) => /TPA/.test(p.name));
  const cons = await svc("CONS-GEN");
  await as(ADMIN, "PUT", `/api/setup/rate_plan/${tpa.id}/prices`, { scope: "general", changes: [{ serviceId: cons.id, price: 650 }] });
  await as(ADMIN, "PATCH", `/api/setup/contract/${contract.id}`, { ratePlanId: tpa.id });
  const cat = (await as(BILLING, "GET", `/api/billing/catalog?patientId=${patient.id}&contractId=${contract.id}`)).data;
  assert.equal(cat.services.find((s: any) => s.code === "CONS-GEN").price, 650);
  const priced = await raise({ patientId: patient.id, patientName: patient.name, contractId: contract.id, items: [{ serviceId: cons.id }] });
  assert.equal(priced.data.total, 650);
  await as(ADMIN, "PATCH", `/api/setup/contract/${contract.id}`, { ratePlanId: null });
});

test("the payer's earlier payments count towards the annual limit on the next invoice", async () => {
  const { patient, contract } = await covered();
  const c = (await master("contract")).find((x) => x.id === contract.id);
  const defaultRule = c.data.copay.find((r: any) => r.groupId === null);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/contract/${contract.id}/rules?kind=copay&ruleId=${defaultRule.id}`)).status, 200);
  const add = await as(ADMIN, "POST", `/api/setup/contract/${contract.id}/rules`, { kind: "copay", rule: { copayPercent: 0, annualLimit: 1000, appliesTo: "Whole contract (default rule)" } });
  assert.equal(add.status, 201, JSON.stringify(add.error));
  const lab = { serviceId: (await svc("LAB-LFT")).id }; // 700
  const first = await raise({ patientId: patient.id, patientName: patient.name, contractId: contract.id, items: [lab] });
  assert.deepEqual([first.data.payerShare, first.data.patientShare], [700, 0]);
  const second = await raise({ patientId: patient.id, patientName: patient.name, contractId: contract.id, items: [lab] });
  assert.deepEqual([second.data.payerShare, second.data.patientShare], [300, 400], "only 300 of the 1000 a year is left");
  const cat = (await as(BILLING, "GET", `/api/billing/catalog?patientId=${patient.id}&contractId=${contract.id}`)).data;
  assert.equal(cat.contracts[0].past.annualPaid, 1000);
  await as(ADMIN, "PATCH", `/api/setup/contract/${contract.id}`, { copay: c.data.copay });
});

// ── Payouts ──────────────────────────────────────────────────────────────────

const payouts = async (q = "") => (await as(BILLING, "GET", `/api/billing/payouts${q}`)).data;
const doctor = async () => (await as(BILLING, "GET", "/api/billing/catalog")).data.doctors[0];

test("a bill in a doctor's name earns the consulting rule on what was billed after the discount; an IPD bill earns the surgeon rule instead", async () => {
  const dr = await doctor();
  const p = (await as(ADMIN, "POST", "/api/patients", { name: `Payout ${++seq}`, age: 30, gender: "Male", phone: `95${String(40000000 + seq).slice(-8)}` })).data;
  const opd = await raise({ patientId: p.id, patientName: p.name, doctorId: dr.id, discount: 100, items: [{ serviceId: (await svc("CONS-SPL")).id }] }); // 800 - 100
  assert.equal(opd.status, 201, JSON.stringify(opd.error));
  assert.equal(opd.data.doctorName, dr.name);
  const mine = (await payouts(`?payee=${encodeURIComponent(dr.name)}`)).rows.filter((x: any) => x.billId === opd.data.id);
  assert.deepEqual(mine.map((x: any) => [x.role, x.basis, x.amount, x.status]), [["Consulting", 700, 210, "Pending"]]);
  const ipd = await raise({ patientId: p.id, patientName: p.name, type: "IPD", doctorId: dr.id, items: [{ serviceId: (await svc("IPD-GEN")).id, quantity: 2 }] }); // 2200
  const rows = (await payouts()).rows.filter((x: any) => x.billId === ipd.data.id && x.payeeType === "doctor");
  assert.deepEqual(rows.map((x: any) => [x.role, x.amount]), [["Surgeon", 880]], "40% of 2,200 — and not the consulting rule as well");
});

test("no doctor, no doctor payout; a single-service rule beats the general one on its own line", async () => {
  const p = (await as(ADMIN, "POST", "/api/patients", { name: `Nodoc ${++seq}`, age: 30, gender: "Male", phone: `95${String(50000000 + seq).slice(-8)}` })).data;
  const none = await raise({ patientId: p.id, patientName: p.name, items: [{ serviceId: (await svc("CONS-GEN")).id }] });
  assert.equal((await payouts()).rows.filter((x: any) => x.billId === none.data.id).length, 0);
  const dr = await doctor();
  const ecg = await svc("DIAG-ECG");
  const rule = await as(ADMIN, "POST", "/api/setup/payout_rule", { name: "ECG reading", role: "Consulting", scope: "A single service", serviceId: ecg.id, valueKind: "fixed", value: 75, effectiveFrom: "2026-01-01" });
  assert.equal(rule.status, 201, JSON.stringify(rule.error));
  const b = await raise({ patientId: p.id, patientName: p.name, doctorId: dr.id, items: [{ serviceId: ecg.id }, { serviceId: (await svc("CONS-GEN")).id }] });
  const rows = (await payouts()).rows.filter((x: any) => x.billId === b.data.id).map((x: any) => [x.rule, x.amount]).sort();
  assert.deepEqual(rows, [["Consulting doctors (default)", 150], ["ECG reading", 75]], "ECG pays 75 fixed; the other line 30% of 500");
  await as(ADMIN, "PATCH", `/api/setup/payout_rule/${rule.data.id}`, { active: false });
});

test("a referring doctor earns the referral rule; an outside lab earns the outhouse rule on the work sent to it", async () => {
  const src = (await master("referral_source")).find((r) => r.data.type === "Referring doctor");
  const p = (await as(ADMIN, "POST", "/api/patients", { name: `Referred ${++seq}`, age: 30, gender: "Male", phone: `95${String(60000000 + seq).slice(-8)}`, referralSource: src.name })).data;
  const ext = (await master("collection_center")).find((c) => c.data.external);
  const lipid = await svc("LAB-LIP");
  await as(ADMIN, "PATCH", `/api/setup/service/${lipid.id}`, { collectionCenterId: ext.id });
  const b = await raise({ patientId: p.id, patientName: p.name, type: "Lab", items: [{ serviceId: lipid.id }, { serviceId: (await svc("LAB-CBC")).id }] });
  const rows = (await payouts()).rows.filter((x: any) => x.billId === b.data.id).map((x: any) => [x.role, x.payee, x.amount]).sort();
  assert.deepEqual(rows, [["Outhouse", ext.name, 60], ["Referred", src.name, 10]], "10% of the 600 lipid test; the referrer's own value");
  await as(ADMIN, "PATCH", `/api/setup/service/${lipid.id}`, { collectionCenterId: null });
});

test("payouts are listed by payee with what is owed, filtered, and marked paid once", async () => {
  const all = await payouts();
  assert.ok(all.rows.length >= 4);
  assert.equal(Math.round((all.totals.pending + all.totals.paid) * 100), Math.round(all.rows.filter((r: any) => r.status !== "Void").reduce((n: number, r: any) => n + r.amount, 0) * 100));
  const who = all.payees.find((x: any) => x.payeeType === "doctor");
  const mine = (await payouts(`?payee=${encodeURIComponent(who.payee)}&status=Pending`)).rows;
  assert.ok(mine.length > 0 && mine.every((r: any) => r.payee === who.payee));
  const pay = await as(BILLING, "POST", "/api/billing/payouts/pay", { ids: mine.map((r: any) => r.id) });
  assert.equal(pay.status, 200, JSON.stringify(pay.error));
  assert.equal(pay.data.paid, mine.length);
  assert.equal((await as(BILLING, "POST", "/api/billing/payouts/pay", { ids: [mine[0].id] })).status, 409, "no paying twice");
  assert.equal((await as(BILLING, "POST", "/api/billing/payouts/pay", { ids: [] })).status, 422);
  assert.ok((await payouts(`?status=Paid`)).rows.every((r: any) => r.paidOn));
});

test("a refunded bill voids what hasn't been paid out; a bill with a paid payout can't be deleted", async () => {
  const dr = await doctor();
  const p = (await as(ADMIN, "POST", "/api/patients", { name: `Refund ${++seq}`, age: 30, gender: "Male", phone: `95${String(70000000 + seq).slice(-8)}` })).data;
  const b = await raise({ patientId: p.id, patientName: p.name, doctorId: dr.id, items: [{ serviceId: (await svc("CONS-SPL")).id }] });
  await as(BILLING, "PATCH", `/api/billing/${b.data.id}`, { status: "Refunded" });
  assert.deepEqual((await payouts()).rows.filter((x: any) => x.billId === b.data.id).map((x: any) => x.status), ["Void"]);
  const b2 = await raise({ patientId: p.id, patientName: p.name, doctorId: dr.id, items: [{ serviceId: (await svc("CONS-SPL")).id }] });
  const row = (await payouts()).rows.find((x: any) => x.billId === b2.data.id);
  await as(BILLING, "POST", "/api/billing/payouts/pay", { ids: [row.id] });
  assert.equal((await as(ADMIN, "DELETE", `/api/billing/${b2.data.id}`)).status, 409);
  const b3 = await raise({ patientId: p.id, patientName: p.name, doctorId: dr.id, items: [{ serviceId: (await svc("CONS-SPL")).id }] });
  assert.ok([200, 204].includes((await as(ADMIN, "DELETE", `/api/billing/${b3.data.id}`)).status));
  assert.equal((await payouts()).rows.filter((x: any) => x.billId === b3.data.id).length, 0);
});

test("registration can list contract names to pick from, but not their terms", async () => {
  const r = await as(RECEPTION, "GET", "/api/payer-contracts");
  assert.equal(r.status, 200);
  assert.ok(r.data.length > 0);
  assert.deepEqual(Object.keys(r.data[0]).sort(), ["id", "name"]);
  assert.ok(r.data.every((c: any) => c.name), "active contracts only");
  assert.equal((await as(RECEPTION, "GET", "/api/setup/contract")).status, 403);
  assert.equal((await request("GET", "/api/payer-contracts")).status, 401);
});

test("permissions: payouts are a billing view; reception can't see or pay them", async () => {
  assert.equal((await as(RECEPTION, "GET", "/api/billing/payouts")).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/billing/payouts/pay", { ids: [1] })).status, 403);
  assert.equal((await request("GET", "/api/billing/payouts")).status, 401);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
