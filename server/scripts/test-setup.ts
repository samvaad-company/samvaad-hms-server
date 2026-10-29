/**
 * Tests for Setup: the default catalogue, masters with unique codes and links to each other, delete protection, rate-plan
 * prices and history, contracts with copay rules, package content, service CSV import, the configuration blobs, ID-format
 * masks, department details and permissions. In-process, in-memory.
 *
 *   npm run test:setup
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { formatIdPreview, maskProblem, luhnDigit } = await import("@shared/types/setup");
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
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
let seq = 0;
const list = async (kind: string) => (await as(ADMIN, "GET", `/api/setup/${kind}`)).data as any[];
const create = (kind: string, body: Record<string, unknown>) => as(ADMIN, "POST", `/api/setup/${kind}`, body);

// ── Pure helpers ─────────────────────────────────────────────────────────────

test("id formats: tokens render, the financial year follows its start month, masks need a counter", async () => {
  const now = new Date("2026-10-29T10:00:00Z");
  assert.equal(formatIdPreview("{FY}-{SEQ:6}", { now }), "2026-000123");
  assert.equal(formatIdPreview("{PREFIX}/{FYP2}/{SEQ:5}", { now, prefix: "INV" }), "INV/26-27/00123");
  assert.equal(formatIdPreview("V/{FY2}/{SEQ:5}", { now: new Date("2027-02-10T00:00:00Z") }), "V/26/00123", "February is still FY 2026");
  assert.equal(formatIdPreview("{YYYY}{MM}-{SEQ:3}", { now }), "202610-123");
  assert.equal(formatIdPreview("{YYYY}-{SEQ:3}", { now, fyStartMonth: 1 }), "2026-123");
  assert.equal(luhnDigit("7992739871"), "3");
  assert.match(formatIdPreview("{FY}-{SEQ:6}{CHECK}", { now }), /^2026-000123\d$/);
  assert.equal(maskProblem("ABC"), "The mask needs a {SEQ:n} counter, or every number would be the same");
  assert.match(maskProblem("{SEQ:5}-{NOPE}")!, /Unknown token/);
  assert.equal(maskProblem("RX-{FY}-{SEQ:6}"), null);
});

// ── Defaults and generic CRUD ────────────────────────────────────────────────

test("defaults: a hospital starts with 48 services in 7 groups, two rate plans, payers, sponsors and a primary branch", async () => {
  assert.equal((await list("service")).length, 48);
  assert.equal((await list("service_group")).length, 7);
  assert.equal((await list("rate_plan")).length, 2);
  assert.equal((await list("payer_class")).length, 3);
  assert.equal((await list("sponsor")).length, 20);
  assert.equal((await list("payment_mode")).length, 12);
  assert.equal((await list("bank_account")).length, 2);
  assert.ok((await list("id_format")).length >= 25);
  const branches = await list("branch");
  assert.equal(branches.length, 1);
  assert.equal(branches[0].data.isPrimary, true);
  const inj = (await list("service")).find((s) => s.code === "PROC-INJ");
  assert.deepEqual([inj.data.gstApplies, inj.data.gstRate], [true, 18]);
  const contracts = await list("contract");
  assert.equal(contracts[0].code, "CON-0001");
  assert.equal(contracts[1].code, "CON-0002");
});

test("masters: codes are unique (case-insensitively) within a kind and are stored upper-case", async () => {
  const a = await create("visit_purpose", { code: "tst1", name: "Test purpose" });
  assert.equal(a.status, 201, JSON.stringify(a.error));
  assert.equal(a.data.code, "TST1");
  const dup = await create("visit_purpose", { code: "Tst1", name: "Another" });
  assert.equal(dup.status, 409);
  assert.match(dup.error!.message, /already used by Test purpose/);
  assert.equal((await create("arrival_status", { code: "TST1", name: "Same code, other master" })).status, 201, "codes are per master");
  assert.equal((await create("visit_purpose", { name: "No code" })).status, 422);
  assert.equal((await create("visit_purpose", { code: "BAD CODE!", name: "x" })).status, 422);
});

test("masters: required fields, enums, numbers and dates are validated; unknown fields are ignored", async () => {
  assert.equal((await create("income_group", { code: "X1", name: "Bad", minIncome: -5 })).status, 422);
  assert.equal((await create("income_group", { code: "X2", name: "Backwards", minIncome: 500, maxIncome: 100 })).status, 422);
  assert.equal((await create("facility_area", { code: "X3", name: "Area", type: "Spaceport" })).status, 422);
  assert.equal((await create("rate_plan", { name: "Dated", effectiveFrom: "next week" })).status, 422);
  const ok = await create("income_group", { code: "X4", name: "Open ended", minIncome: 1000, maxIncome: "", hacker: "ignored" });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal(ok.data.data.maxIncome, null);
  assert.equal(ok.data.data.hacker, undefined);
});

test("masters: update changes only what is sent; a link to something that doesn't exist is refused; names are unique where they identify", async () => {
  const room = (await create("consulting_room", { name: `Room ${++seq}` })).data;
  assert.equal(room.code, "");
  const area = (await list("facility_area"))[0];
  const set = await as(ADMIN, "PATCH", `/api/setup/consulting_room/${room.id}`, { facilityAreaId: area.id });
  assert.equal(set.status, 200);
  assert.equal(set.data.data.facilityAreaId, area.id);
  assert.equal(set.data.name, room.name, "name untouched");
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/consulting_room/${room.id}`, { facilityAreaId: 999999 })).status, 422);
  assert.equal((await create("consulting_room", { name: room.name.toUpperCase() })).status, 409, "same name");
  const off = await as(ADMIN, "PATCH", `/api/setup/consulting_room/${room.id}`, { active: false });
  assert.equal(off.data.active, false);
  assert.equal((await as(ADMIN, "GET", "/api/setup/consulting_room?active=1")).data.some((r: any) => r.id === room.id), false);
  assert.equal((await as(ADMIN, "GET", `/api/setup/ward_class/${room.id}`)).status, 404, "a record is only reachable as its own kind");
  assert.equal((await as(ADMIN, "GET", "/api/setup/not_a_master")).status, 404);
});

test("delete protection: something in use can't be deleted until the things using it are changed", async () => {
  const groups = await list("service_group");
  const cons = groups.find((g) => g.code === "CONS");
  const blocked = await as(ADMIN, "DELETE", `/api/setup/service_group/${cons.id}`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /used by \d+ services/);
  const g = (await create("service_group", { code: "TMPG", name: "Temp group" })).data;
  const s = (await create("service", { code: "TMP-SVC", name: "Temp service", groupId: g.id, price: 10 })).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/service_group/${g.id}`)).status, 409);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/service/${s.id}`)).status, 204);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/service_group/${g.id}`)).status, 204);
  const primary = (await list("branch"))[0];
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/branch/${primary.id}`)).status, 409, "primary branch");
});

// ── Services, tax, rate plans ────────────────────────────────────────────────

test("services: create with the Add-service form fields, map GST, and the Tax page sees it", async () => {
  const group = (await list("service_group")).find((g) => g.code === "LAB");
  const r = await create("service", { name: "Vitamin D", shortName: "VitD", code: "lab-vitd", groupId: group.id, price: "850", unit: "per test", gstApplies: false, hsnSac: "9993" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.code, "LAB-VITD");
  assert.equal(r.data.data.price, 850);
  const gst = await as(ADMIN, "PATCH", `/api/setup/service/${r.data.id}`, { gstApplies: true, gstRate: 5, taxFrom: "2026-04-01" });
  assert.deepEqual([gst.data.data.gstApplies, gst.data.data.gstRate, gst.data.data.taxFrom], [true, 5, "2026-04-01"]);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/service/${r.data.id}`, { gstRate: 140 })).status, 422);
  assert.equal((await create("service", { name: "Negative", code: "NEG", price: -1 })).status, 422);
});

test("rate plans: one default at a time; a plan can't be based on itself; the default can't be deleted", async () => {
  const plans = await list("rate_plan");
  const standard = plans.find((p) => p.data.isDefault);
  const tpa = plans.find((p) => !p.data.isDefault);
  assert.ok(standard && tpa);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/rate_plan/${tpa.id}`, { basePlanId: tpa.id })).status, 422);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/rate_plan/${standard.id}`)).status, 409);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/rate_plan/${standard.id}`)).error!.message.includes("default"), true);
  await as(ADMIN, "PATCH", `/api/setup/rate_plan/${tpa.id}`, { isDefault: true });
  const after = await list("rate_plan");
  assert.deepEqual(after.filter((p) => p.data.isDefault).map((p) => p.id), [tpa.id], "exactly one default");
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/rate_plan/${tpa.id}`)).status, 409, "a plan that others build on can't go either");
  await as(ADMIN, "PATCH", `/api/setup/rate_plan/${standard.id}`, { isDefault: true });
  const bad = await create("rate_plan", { name: "Ends first", effectiveFrom: "2026-05-01", effectiveTo: "2026-04-01" });
  assert.equal(bad.status, 422);
});

test("rate-plan prices: set, clear and read back; every change lands in the history; bad input is refused", async () => {
  const plan = (await list("rate_plan"))[0];
  const svc = (await list("service")).find((s) => s.code === "CONS-GEN");
  const set = await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: 550 }] });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal(set.data.data.prices.general[String(svc.id)], 550);
  assert.equal(set.data.data.history[0].from, null);
  assert.equal(set.data.data.history[0].to, 550);
  const again = await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: 550 }] });
  assert.equal(again.data.data.history.length, 1, "an unchanged price isn't a change");
  const cleared = await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: null }] });
  assert.equal(cleared.data.data.prices.general[String(svc.id)], undefined);
  assert.equal(cleared.data.data.history.length, 2);
  assert.equal(cleared.data.data.history[0].from, 550);
  assert.equal((await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "weird", changes: [{ serviceId: svc.id, price: 1 }] })).status, 422);
  assert.equal((await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: 999999, price: 1 }] })).status, 422);
  assert.equal((await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [{ serviceId: svc.id, price: -3 }] })).status, 422);
  assert.equal((await as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "general", changes: [] })).status, 422);
});

test("rate-plan prices: two people editing the same plan at once don't lose each other's prices", async () => {
  const plan = (await list("rate_plan"))[0];
  const svcs = (await list("service")).slice(0, 6);
  await Promise.all(svcs.map((s, i) => as(ADMIN, "PUT", `/api/setup/rate_plan/${plan.id}/prices`, { scope: "tpa", changes: [{ serviceId: s.id, price: 100 + i }] })));
  const after = (await as(ADMIN, "GET", `/api/setup/rate_plan/${plan.id}`)).data;
  assert.equal(Object.keys(after.data.prices.tpa).length, 6);
});

test("service import: creates and updates by code, reports bad rows and still imports the rest", async () => {
  const r = await as(ADMIN, "POST", "/api/setup/service/import", { rows: [
    { name: "Import A", code: "imp-a", group: "Laboratory", price: "120" },
    { name: "Import B", code: "IMP-B", group: "No such group", price: 1 },
    { name: "Import C", code: "IMP-C", price: "x" },
    { name: "General Consultation (new price)", code: "CONS-GEN", price: 550 },
  ] });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.created, r.data.updated, r.data.failed.length], [1, 1, 2]);
  assert.deepEqual(r.data.failed.map((f: any) => f.row), [2, 3]);
  const gen = (await list("service")).find((s) => s.code === "CONS-GEN");
  assert.equal(gen.data.price, 550);
  assert.equal(gen.name, "General Consultation (new price)");
  assert.equal((await as(ADMIN, "POST", "/api/setup/service/import", { rows: [] })).status, 422);
});

// ── Packages, contracts, sponsors ────────────────────────────────────────────

test("packages: content saves as a whole; blank names are dropped; quantities default to 1", async () => {
  const pkg = (await list("package"))[0];
  const svc = (await list("service")).find((s) => s.code === "LAB-CBC");
  const r = await as(ADMIN, "PUT", `/api/setup/package/${pkg.id}/content`, {
    inclusions: [{ kind: "service", refId: svc.id, name: "Complete Blood Count", qty: "", rate: 100 }, { kind: "service", name: "   " }],
    exclusions: [{ kind: "category", name: "Dental" }],
    orderingRules: [{ minAge: 18, maxAge: 60, gender: "Female" }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.data.inclusions.length, 1);
  assert.deepEqual([r.data.data.inclusions[0].qty, r.data.data.inclusions[0].rate], [1, 100]);
  assert.equal(r.data.data.orderingRules[0].gender, "Female");
  assert.equal((await as(ADMIN, "PUT", `/api/setup/package/${pkg.id}/content`, { inclusions: "nope" })).status, 422);
  const made = await create("package", { code: "PKG-T1", name: "Test package", type: "Surgical", price: 100 });
  assert.equal(made.status, 201);
  assert.deepEqual(made.data.data.inclusions, []);
});

test("contracts: codes are minted in sequence; copay, exclusion, limit and DRG rules can be added and removed", async () => {
  const sponsor = (await list("sponsor"))[0];
  const c1 = (await create("contract", { sponsorId: sponsor.id, name: "Test contract one", validFrom: "2026-01-01", discountPercent: -5, creditDays: 30 })).data;
  const c2 = (await create("contract", { sponsorId: sponsor.id, name: "Test contract two" })).data;
  const n1 = Number(c1.code.slice(4)), n2 = Number(c2.code.slice(4));
  assert.equal(n2, n1 + 1);
  assert.match(c1.code, /^CON-\d{4}$/);
  assert.equal((await create("contract", { name: "No sponsor" })).status, 422);
  assert.equal((await create("contract", { sponsorId: sponsor.id, name: "Ends first", validFrom: "2026-05-01", validTo: "2026-04-01" })).status, 422);
  const add = await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "copay", rule: { appliesTo: "Whole contract (default rule)", copayPercent: 10, copayMin: 500, copayMax: 100 } });
  assert.equal(add.status, 422, "max below min");
  const ok = await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "copay", rule: { appliesTo: "Consultations (group)", copayPercent: "10", deductible: 500, annualLimit: 100000 } });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal(ok.data.data.copay.length, 1);
  assert.equal(ok.data.data.copay[0].copayPercent, 10);
  await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "exclusion", rule: { target: "Cosmetic surgery", reason: "Not covered" } });
  await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "limit", rule: { target: "Room rent", limitAmount: 5000, per: "day" } });
  const drg = await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "drg", rule: { diagnosis: "Appendicitis", packageAmount: 40000, maxDays: 3 } });
  assert.deepEqual([drg.data.data.copay.length, drg.data.data.exclusions.length, drg.data.data.limits.length, drg.data.data.drg.length], [1, 1, 1, 1]);
  assert.equal((await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "exclusion", rule: {} })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/setup/contract/${c1.id}/rules`, { kind: "mystery", rule: {} })).status, 422);
  const ruleId = drg.data.data.copay[0].id;
  const del = await as(ADMIN, "DELETE", `/api/setup/contract/${c1.id}/rules?kind=copay&ruleId=${ruleId}`);
  assert.equal(del.status, 200);
  assert.equal(del.data.data.copay.length, 0);
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/contract/${c1.id}/rules?kind=copay&ruleId=nope`)).status, 404);
  // Two rules added at the same moment both land.
  const both = await Promise.all([1, 2, 3].map((i) => as(ADMIN, "POST", `/api/setup/contract/${c2.id}/rules`, { kind: "exclusion", rule: { target: `Item ${i}` } })));
  assert.ok(both.every((b) => b.status === 201));
  assert.equal((await as(ADMIN, "GET", `/api/setup/contract/${c2.id}`)).data.data.exclusions.length, 3);
});

test("sponsors and dual-sponsor rules: a sponsor with contracts, or a contract in a rule, can't be deleted; a rule needs two different contracts", async () => {
  const sponsor = (await list("sponsor"))[0];
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/sponsor/${sponsor.id}`)).status, 409);
  const contracts = await list("contract");
  const a = contracts[0], b = contracts[1];
  assert.equal((await create("dual_sponsor_rule", { name: "Same", primaryContractId: a.id, secondaryContractId: a.id, rule: "Primary first" })).status, 422);
  const ok = await create("dual_sponsor_rule", { name: "A then B", primaryContractId: a.id, secondaryContractId: b.id, rule: "Proportional split", primarySharePercent: 60 });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/contract/${a.id}`)).status, 409);
  assert.equal((await create("sponsor", { name: sponsor.name, type: "Insurer" })).status, 409, "sponsor names are unique");
});

// ── Payments, payouts, ID formats, branches ──────────────────────────────────

test("payments: one default bank account; card terminals link to a bank account that then can't be deleted; settlements need a terminal", async () => {
  const banks = await list("bank_account");
  const other = banks.find((b) => !b.data.isDefault);
  await as(ADMIN, "PATCH", `/api/setup/bank_account/${other.id}`, { isDefault: true });
  assert.deepEqual((await list("bank_account")).filter((b) => b.data.isDefault).map((b) => b.id), [other.id]);
  assert.equal((await create("bank_account", { name: "Bad", accountLast4: "12" })).status, 422);
  const terminals = await list("edc_terminal");
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/bank_account/${terminals[0].data.bankAccountId}`)).status, 409);
  assert.equal((await create("edc_settlement", { name: "x", date: "2026-10-01", amount: 5000 })).status, 422, "no terminal");
  const s = await create("edc_settlement", { name: "Batch 1", terminalId: terminals[0].id, date: "2026-10-01", amount: 5000, batchNo: "B-1" });
  assert.equal(s.status, 201, JSON.stringify(s.error));
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/edc_terminal/${terminals[0].id}`)).status, 409);
  assert.equal((await create("edc_settlement", { name: "x", terminalId: terminals[0].id, date: "2026-10-01", amount: 0 })).status, 422);
});

test("payout rules: a percentage can't pass 100; a single-service rule needs the service", async () => {
  assert.equal((await create("payout_rule", { name: "Dr X", role: "Consulting", scope: "All services", valueKind: "percent", value: 140, effectiveFrom: "2026-04-01" })).status, 422);
  assert.equal((await create("payout_rule", { name: "Dr X", role: "Consulting", scope: "A single service", valueKind: "percent", value: 20, effectiveFrom: "2026-04-01" })).status, 422);
  const svc = (await list("service"))[0];
  const ok = await create("payout_rule", { name: "Dr X", role: "Consulting", scope: "A single service", serviceId: svc.id, valueKind: "fixed", value: 200, effectiveFrom: "2026-04-01" });
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/service/${svc.id}`)).status, 409, "a service named in a payout rule is protected");
});

test("id formats: editing a mask marks it custom, the original is remembered, a bad mask is refused", async () => {
  const f = (await list("id_format")).find((x) => x.code === "UHID" || x.code === "uhid");
  assert.equal(f.data.custom, false);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/id_format/${f.id}`, { mask: "NOCOUNTER" })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/id_format/${f.id}`, { mask: "{PREFIX}-{SEQ:7}", prefix: "PH" })).status, 200);
  const after = (await as(ADMIN, "GET", `/api/setup/id_format/${f.id}`)).data;
  assert.deepEqual([after.data.custom, after.data.defaultMask, after.data.mask], [true, "HMS-{SEQ:4}", "{PREFIX}-{SEQ:7}"]);
  await as(ADMIN, "PATCH", `/api/setup/id_format/${f.id}`, { mask: "HMS-{SEQ:4}", prefix: "" });
});

test("branches: one primary at a time; times and GSTIN are checked", async () => {
  const main = (await list("branch"))[0];
  const b = await create("branch", { code: "NORTH", name: "North Clinic", city: "Vadodara", opens: "08:00", closes: "20:00", isPrimary: true });
  assert.equal(b.status, 201, JSON.stringify(b.error));
  assert.deepEqual((await list("branch")).filter((x) => x.data.isPrimary).map((x) => x.code), ["NORTH"]);
  assert.equal((await create("branch", { code: "BAD", name: "Bad", opens: "25:00" })).status, 422);
  assert.equal((await create("branch", { code: "BAD2", name: "Bad", gstin: "123" })).status, 422);
  await as(ADMIN, "PATCH", `/api/setup/branch/${main.id}`, { isPrimary: true });
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/branch/${b.data.id}`)).status, 204);
  const cc = (await list("collection_center"))[0];
  assert.equal((await as(ADMIN, "DELETE", `/api/setup/branch/${cc.data.branchId}`)).status, 409, "a branch with collection centres is protected");
});

test("clinical forms and protocols: the designer's fields and a protocol's steps are validated and saved", async () => {
  const form = (await create("clinical_form", { name: "Test form", specialty: "Cardiology", fields: [{ label: "BP", type: "Short text" }, { label: "Smoker?", type: "Yes / No", required: true }, { label: "Severity", type: "Choice", options: ["Mild", "Severe"] }] })).data;
  assert.equal(form.data.fields.length, 3);
  assert.equal(form.data.fields[1].required, true);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { fields: [{ label: "", type: "Number" }] })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { fields: [{ label: "Pick", type: "Choice", options: ["Only one"] }] })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { fields: "x" })).status, 422);
  const dept = (await as(ADMIN, "GET", "/api/departments")).data[0];
  const assigned = await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { assignedDepartments: [dept.id, "junk"] });
  assert.deepEqual(assigned.data.data.assignedDepartments, [dept.id]);
  assert.equal(assigned.data.data.fields.length, 3, "fields untouched by an assignment");
  const proto = await create("protocol", { name: "Test protocol", category: "ER", steps: ["Triage", " ", "Treat"] });
  assert.deepEqual(proto.data.data.steps, ["Triage", "Treat"]);
});

test("clinical forms: publishing bumps the version", async () => {
  const form = (await list("clinical_form"))[0];
  assert.equal(form.data.version, 0);
  const pub = await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { status: "Published" });
  assert.equal(pub.data.data.version, 1);
  const again = await as(ADMIN, "PATCH", `/api/setup/clinical_form/${form.id}`, { status: "Published" });
  assert.equal(again.data.data.version, 1, "already published");
});

// ── Configuration and departments ────────────────────────────────────────────

test("config: hospital setup starts from the hospital's own details, merges edits and refuses unknown or malformed values", async () => {
  const before = (await as(ADMIN, "GET", "/api/setup/config/hospital")).data;
  assert.ok(before.name.length > 1);
  assert.equal(before.fyStartMonth, 4);
  const set = await as(ADMIN, "PUT", "/api/setup/config/hospital", { shortName: "SH", fyStartMonth: 4, gstin: "24aabcs1429b1za", gstOnBills: false, bedCount: 25 });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.deepEqual([set.data.shortName, set.data.gstin, set.data.gstOnBills, set.data.bedCount], ["SH", "24AABCS1429B1ZA", false, 25]);
  assert.equal(set.data.name, before.name, "untouched fields remain");
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/hospital", { fyStartMonth: 13 })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/hospital", { gstin: "123" })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/hospital", { gstOnBills: "yes" })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/hospital", { nonsense: 1 })).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/setup/config/unknown")).status, 404);
  const billing = await as(ADMIN, "PUT", "/api/setup/config/billing", { manualPaymentModes: ["Cash", "Upi"], roleDiscountLimits: { Receptionist: 5, Doctor: "", "Billing staff": 10 }, userDiscountLimits: { "1": 50 } });
  assert.equal(billing.status, 200, JSON.stringify(billing.error));
  assert.deepEqual(billing.data.manualPaymentModes, ["Cash", "Upi"]);
  assert.deepEqual([billing.data.roleDiscountLimits.Receptionist, billing.data.roleDiscountLimits.Doctor], [5, null]);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/security", { sessionTimeoutMinutes: "soon" })).status, 422);
  assert.equal((await as(ADMIN, "PUT", "/api/setup/config/security", { sessionTimeoutMinutes: 30 })).data.sessionTimeoutMinutes, 30);
});

test("departments: the Masters fields (code, specialty, clinical, active) save alongside the existing ones", async () => {
  const made = await as(ADMIN, "POST", "/api/departments", { name: "Dialysis Unit", code: "dia", specialty: "Nephrology", clinical: true });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.deepEqual([made.data.code, made.data.specialty, made.data.clinical, made.data.active], ["DIA", "Nephrology", true, true]);
  const upd = await as(ADMIN, "PATCH", `/api/departments/${made.data.id}`, { active: false, clinical: false });
  assert.equal(upd.status, 200, JSON.stringify(upd.error));
  assert.deepEqual([upd.data.active, upd.data.clinical, upd.data.code], [false, false, "DIA"]);
  const old = (await as(ADMIN, "GET", "/api/departments")).data.find((d: any) => d.name !== "Dialysis Unit");
  assert.equal(old.active, true, "existing departments count as active");
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: lists other screens pick from are readable by anyone signed in; the rest, and every change, need admin", async () => {
  for (const kind of ["service", "ward_class", "patient_category", "payer_class"]) assert.equal((await as(RECEPTION, "GET", `/api/setup/${kind}`)).status, 200, kind);
  for (const kind of ["sponsor", "contract", "bank_account", "payout_rule", "rate_plan", "id_format", "branch"]) {
    assert.equal((await as(RECEPTION, "GET", `/api/setup/${kind}`)).status, 403, kind);
    assert.equal((await as(DOCTOR, "GET", `/api/setup/${kind}`)).status, 403, kind);
  }
  assert.equal((await as(RECEPTION, "POST", "/api/setup/visit_purpose", { code: "NOPE", name: "Nope" })).status, 403);
  assert.equal((await as(DOCTOR, "PATCH", "/api/setup/service/1", { price: 1 })).status, 403);
  assert.equal((await as(RECEPTION, "GET", "/api/setup/config/hospital")).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/setup/service/import", { rows: [{ name: "x", code: "x" }] })).status, 403);
  assert.equal((await request("GET", "/api/setup/service")).status, 401);
});

// ── Run ──────────────────────────────────────────────────────────────────────

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
