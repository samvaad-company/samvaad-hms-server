/**
 * Tests for Reports → Analytics, the report catalogue and its runner, and the audit trail with its hash chain.
 * In-process, in-memory.
 *
 *   npm run test:reports
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

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const today = localDate();
const monthAgo = new Date(Date.now() - 60 * 86_400_000).toLocaleDateString("en-CA");

test("they need the reports permission (the audit trail, the admin one), and a login", async () => {
  for (const p of ["/api/analytics", "/api/reports/catalog", "/api/reports/run?id=collection", "/api/audit"]) assert.equal((await request("GET", p)).status, 401, p);
  for (const p of ["/api/analytics", "/api/reports/catalog", "/api/audit"]) assert.equal((await as(RECEPTION, "GET", p)).status, 403, p);
});

test("the catalogue lists every report under one of the seven categories, once each", async () => {
  const r = await as(ADMIN, "GET", "/api/reports/catalog");
  assert.equal(r.status, 200);
  assert.equal(r.data.categories.length, 7);
  const ids = r.data.reports.map((x: any) => x.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.ok(r.data.reports.length >= 80, `${r.data.reports.length} reports`);
  for (const rep of r.data.reports) { assert.ok(r.data.categories.includes(rep.category), rep.id); assert.ok(rep.title && rep.description, rep.id); }
  assert.ok(r.data.reports.some((x: any) => x.available) && r.data.reports.some((x: any) => !x.available));
});

test("every available report runs, with columns that its rows and totals use", async () => {
  const cat = (await as(ADMIN, "GET", "/api/reports/catalog")).data;
  let ran = 0;
  for (const rep of cat.reports) {
    const r = await as(ADMIN, "GET", `/api/reports/run?id=${rep.id}&from=${monthAgo}&to=${today}&q=a`);
    assert.equal(r.status, 200, `${rep.id}: ${JSON.stringify(r.error)}`);
    assert.equal(r.data.id, rep.id);
    if (!rep.available) { assert.ok(r.data.note, `${rep.id} explains why it can't run`); assert.equal(r.data.rows.length, 0); continue; }
    ran++;
    const keys = new Set(r.data.columns.map((c: any) => c.key));
    for (const row of r.data.rows) for (const k of Object.keys(row)) assert.ok(keys.has(k), `${rep.id}: row key ${k} has a column`);
    if (r.data.totals) for (const k of Object.keys(r.data.totals)) assert.ok(keys.has(k), `${rep.id}: totals key ${k} has a column`);
  }
  assert.ok(ran >= 60, `${ran} ran`);
});

test("an unknown report, a bad date or no id is refused", async () => {
  assert.equal((await as(ADMIN, "GET", "/api/reports/run?id=nope")).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/reports/run")).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/reports/run?id=collection&from=30-10-2026")).status, 422);
});

test("a day book lists the day's settled bills and subtotals them by payment mode", async () => {
  const patient = (await as(ADMIN, "POST", "/api/patients", { name: "Reports Patient", age: 40, gender: "Male", phone: "9410099001" })).data;
  const mk = async (type: string, amount: number, mode: string) => {
    const b = await as(ADMIN, "POST", "/api/billing", { patientId: patient.id, patientName: patient.name, type, amount, status: "Paid", paymentMode: mode });
    assert.equal(b.status, 201, JSON.stringify(b.error));
  };
  await mk("OPD", 500, "Cash"); await mk("OPD", 300, "UPI"); await mk("IPD", 9000, "Cash");
  const opd = (await as(ADMIN, "GET", `/api/reports/run?id=daybook_opd&from=${today}`)).data;
  assert.equal(opd.rows.filter((r: any) => r.patient === "Reports Patient").length, 2);
  assert.ok(opd.rows.every((r: any) => r.type === "OPD"));
  const cash = opd.summary.find((s: any) => s.label === "Cash");
  assert.ok(cash.value >= 500);
  const both = (await as(ADMIN, "GET", `/api/reports/run?id=daybook_combined&from=${today}`)).data;
  assert.ok(both.rows.some((r: any) => r.type === "IPD") && both.rows.some((r: any) => r.type === "OPD"));
  const total = both.rows.reduce((n: number, r: any) => n + r.amount, 0);
  assert.equal(Math.round(both.totals.amount * 100), Math.round(total * 100), "totals row adds the rows");
  const collection = (await as(ADMIN, "GET", `/api/reports/run?id=collection&from=${today}&to=${today}`)).data;
  assert.ok(collection.rows.find((r: any) => r.name === "UPI").amount >= 300);
});

test("outstanding lists the unpaid, and the patient ledger runs a balance for one patient", async () => {
  const p = (await as(ADMIN, "POST", "/api/patients", { name: "Ledger Person", age: 31, gender: "Female", phone: "9410099002" })).data;
  const owed = (await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 700, status: "Pending" })).data.total;
  await as(ADMIN, "POST", "/api/billing", { patientId: p.id, patientName: p.name, type: "OPD", amount: 200, status: "Paid", paymentMode: "Cash" });
  const dues = (await as(ADMIN, "GET", `/api/reports/run?id=outstanding&to=${today}`)).data;
  assert.ok(dues.rows.some((r: any) => r.patient === "Ledger Person" && r.due === owed));
  const ledger = (await as(ADMIN, "GET", `/api/reports/run?id=patient_ledger&q=${encodeURIComponent(p.code ?? p.patientCode ?? p.name)}`)).data;
  assert.equal(ledger.summary.find((s: any) => s.label === "Balance due").value, owed);
  assert.equal(ledger.rows.length, 3, "two debits and one credit");
  assert.ok((await as(ADMIN, "GET", "/api/reports/run?id=patient_ledger")).data.note, "asks for a patient first");
  const aging = (await as(ADMIN, "GET", "/api/reports/run?id=receivables_aging")).data;
  assert.equal(aging.rows.length, 4);
});

test("a report that needs data we don't record says so rather than showing zeros", async () => {
  const r = (await as(ADMIN, "GET", "/api/reports/run?id=tds_register")).data;
  assert.deepEqual(r.rows, []);
  assert.match(r.note, /TDS/);
});

test("analytics: the three ranges, the trend length and the comparison", async () => {
  for (const [range, n] of [["day", 14], ["week", 12], ["month", 12]] as const) {
    const a = (await as(ADMIN, "GET", `/api/analytics?range=${range}`)).data;
    assert.equal(a.range, range); assert.equal(a.series.length, n, range); assert.equal(a.stats.length, 5);
    assert.ok(a.rangeNote.includes(range === "day" ? "this day" : `this ${range}`));
  }
  assert.equal((await as(ADMIN, "GET", "/api/analytics?range=bogus")).data.range, "day");
  const a = (await as(ADMIN, "GET", "/api/analytics?range=month")).data;
  const collected = a.stats.find((s: any) => s.key === "collected");
  assert.ok(collected.value >= 9800, "this month's collections include the paid bills made above");
  assert.equal(a.revenue.collected >= 9800, true);
  assert.ok(a.ipd.beds >= a.ipd.occupied);
  assert.equal(a.series[a.series.length - 1].collected, collected.value, "the last point is the month so far");
  const none = a.stats.find((s: any) => s.key === "avgIpd");
  assert.ok(none.value === null || none.value > 0);
});

test("the audit trail lists the hospital's entries newest first, filters them, and pages", async () => {
  await as(ADMIN, "POST", "/api/enquiries", { name: "Audit Caller", phone: "9410099003", source: "Walk-in", message: "x" });
  const page = (await as(ADMIN, "GET", "/api/audit")).data;
  assert.ok(page.total >= 1 && page.rows.length >= 1);
  assert.ok(page.rows.every((r: any, i: number) => i === 0 || page.rows[i - 1].id > r.id), "newest first");
  assert.ok(page.rows[0].summary && page.rows[0].actor && page.rows[0].actionLabel);
  assert.ok(page.modules.includes("Enquiries"));
  const byModule = (await as(ADMIN, "GET", "/api/audit?module=Enquiries")).data;
  assert.ok(byModule.rows.length >= 1 && byModule.rows.every((r: any) => r.module === "Enquiries"));
  assert.equal((await as(ADMIN, "GET", "/api/audit?q=zzzz-nothing")).data.total, 0);
  assert.equal((await as(ADMIN, "GET", "/api/audit?pageSize=1")).data.rows.length, 1);
  assert.equal((await as(ADMIN, "GET", `/api/audit?from=${today}&to=${today}`)).data.total >= 1, true);
  assert.equal((await as(ADMIN, "GET", "/api/audit?from=2000-01-01&to=2000-01-02")).data.total, 0);
  assert.ok(page.rows.every((r: any) => r.details.every((d: any) => d.label !== "_chain")), "the chain isn't shown as detail");
});

test("the audit chain verifies, and an entry that is edited or removed breaks it", async () => {
  const ok = (await as(ADMIN, "GET", "/api/audit/verify")).data;
  assert.equal(ok.intact, true); assert.ok(ok.entries >= 1); assert.equal(ok.brokenAt, null);
  const { auditRepo } = await import("@/repositories");
  const rows = (await auditRepo.listRows({ unpaged: true, sort: [{ column: "id", direction: "asc" }] })).rows.filter((r: any) => r.meta?._chain);
  assert.ok(rows.length >= 3, "enough entries to tamper with");
  const victim = rows[1] as any;
  await auditRepo.update(victim.id, { action: "tampered" } as never);
  const edited = (await as(ADMIN, "GET", "/api/audit/verify")).data;
  assert.equal(edited.intact, false); assert.equal(edited.brokenAt, victim.id);
  await auditRepo.update(victim.id, { action: victim.action } as never);
  assert.equal((await as(ADMIN, "GET", "/api/audit/verify")).data.intact, true, "restored");
  await auditRepo.remove(victim.id);
  const removed = (await as(ADMIN, "GET", "/api/audit/verify")).data;
  assert.equal(removed.intact, false, "a missing entry shows as a break at the next one");
});

test("exporting the trail records the export on it", async () => {
  const before = (await as(ADMIN, "GET", "/api/audit?module=Audit")).data.total;
  assert.equal((await as(ADMIN, "POST", "/api/audit/export", { format: "pdf", count: 42 })).status, 200);
  const after = (await as(ADMIN, "GET", "/api/audit?module=Audit")).data;
  assert.equal(after.total, before + 1);
  assert.equal(after.rows[0].summary, "Exported 42 audit entries as PDF");
});

test("the AI monitor covers 7, 30 or 90 days of scribe, chat and WhatsApp use", async () => {
  assert.equal((await request("GET", "/api/analytics/ai")).status, 401);
  assert.equal((await as(RECEPTION, "GET", "/api/analytics/ai")).status, 403);
  for (const [q, n] of [["?days=7", 7], ["?days=90", 90], ["", 30], ["?days=11", 30]] as const) {
    const a = (await as(ADMIN, "GET", `/api/analytics/ai${q}`)).data;
    assert.equal(a.days, n, q); assert.equal(a.series.length, n); assert.equal(a.series[n - 1].date, today);
    assert.ok(a.scribe.notes >= 0 && Array.isArray(a.scribe.recent) && Array.isArray(a.whatsapp.recent) && !("recent" in a.chat));
  }
  const { scribeNotesRepo } = await import("@/repositories");
  const before = (await as(ADMIN, "GET", "/api/analytics/ai")).data.scribe;
  await scribeNotesRepo.create({ hospital_id: 1, appointment_id: null, patient_id: null, patient_name: "Monitor Patient", doctor_id: null, doctor_name: "Dr Monitor", transcript: "x", brief: "y", language: "Hindi", duration_sec: 120, status: "Draft" } as never);
  const after = (await as(ADMIN, "GET", "/api/analytics/ai")).data.scribe;
  assert.equal(after.notes, before.notes + 1); assert.equal(after.minutes, before.minutes + 2);
  assert.ok(after.byLanguage.some((l: any) => l.name === "Hindi") && after.recent[0].patient === "Monitor Patient");
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
