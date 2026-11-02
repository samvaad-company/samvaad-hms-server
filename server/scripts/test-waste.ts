/**
 * Tests for Waste & infection control: bin collections, disposal against what is waiting, infection events, hand-hygiene audits,
 * the dashboard and the printable register. In-process, in-memory.
 *
 *   npm run test:waste
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
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
const { localDate } = await import("@/lib/clock");
const ADMIN = "kevin.carter@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const today = localDate();
const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
const tomorrow = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA");

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const wards = async () => (await as(ADMIN, "GET", "/api/beds?all=true")).data.reduce((m: Map<number, string>, b: any) => m.set(b.wardId, b.ward), new Map<number, string>());
const wardId = async () => [...(await wards()).keys()][0] as number;
const collect = async (extra: Record<string, unknown>) => as(ADMIN, "POST", "/api/waste/collections", { wardId: await wardId(), bags: 2, ...extra });
const pending = async (category: string) => (await as(ADMIN, "GET", "/api/waste/disposals")).data.pending.find((p: any) => p.category === category).kg;

test("it needs a login and the CSSD / infection-control permission", async () => {
  for (const p of ["/api/waste/collections", "/api/waste/disposals", "/api/waste/infection", "/api/waste/dashboard", "/api/waste/register"]) {
    assert.equal((await request("GET", p)).status, 401, p);
    assert.equal((await as(BILLING, "GET", p)).status, 403, p);
  }
  assert.equal((await as(BILLING, "POST", "/api/waste/collections", { wardId: 1, category: "red", quantityKg: 1 })).status, 403);
});

test("a collection records the ward, colour, weight and bags, with the time of day by default", async () => {
  const r = await collect({ category: "red", quantityKg: 6.39 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.categoryLabel, "Red (contaminated recyclable)"); assert.equal(r.data.quantityKg, 6.39); assert.equal(r.data.bags, 2);
  assert.equal(r.data.date, today); assert.match(r.data.time, /^\d\d:\d\d$/); assert.ok(r.data.ward);
  const set = await collect({ category: "white", quantityKg: 0.37, collectedOn: yesterday, collectedTime: "07:57", bags: 1 });
  assert.equal(set.data.date, yesterday); assert.equal(set.data.time, "07:57");
});

test("a collection needs a known ward and colour, a positive weight, whole bags, a real time and a date that has happened", async () => {
  const bad = async (extra: Record<string, unknown>, status = 422) => assert.equal((await collect({ category: "blue", quantityKg: 1, ...extra })).status, status, JSON.stringify(extra));
  await bad({ category: "green" }); await bad({ quantityKg: 0 }); await bad({ quantityKg: -2 }); await bad({ bags: 1.5 }); await bad({ collectedTime: "25:00" });
  await bad({ collectedOn: tomorrow }); await bad({ collectedOn: "30-10-2026" }); await bad({ wardId: 99999 }, 404);
  assert.equal((await as(ADMIN, "POST", "/api/waste/collections", { category: "blue", quantityKg: 1 })).status, 422, "a ward is needed");
});

test("the list is newest first and filters by colour, ward and dates", async () => {
  await collect({ category: "yellow", quantityKg: 2.65, collectedOn: "2026-01-05", collectedTime: "08:29" });
  const all = (await as(ADMIN, "GET", "/api/waste/collections")).data;
  assert.ok(all.rows.length >= 3);
  assert.ok(all.rows.every((r: any, i: number) => i === 0 || `${all.rows[i - 1].date} ${all.rows[i - 1].time}` >= `${r.date} ${r.time}`));
  assert.equal(all.kg, Math.round(all.rows.reduce((n: number, r: any) => n + r.quantityKg, 0) * 100) / 100);
  const yellow = (await as(ADMIN, "GET", "/api/waste/collections?category=yellow")).data;
  assert.ok(yellow.rows.length >= 1 && yellow.rows.every((r: any) => r.category === "yellow"));
  assert.equal((await as(ADMIN, "GET", "/api/waste/collections?from=2026-01-05&to=2026-01-05")).data.rows.length, 1);
  assert.equal((await as(ADMIN, "GET", `/api/waste/collections?wardId=99999`)).data.rows.length, 0);
});

test("a collection entry can be deleted, once", async () => {
  const r = (await collect({ category: "blue", quantityKg: 3 })).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/waste/collections/${r.id}`)).status, 200);
  assert.equal((await as(ADMIN, "DELETE", `/api/waste/collections/${r.id}`)).status, 404);
});

test("disposal can't be more than is waiting for that colour, and brings the waiting amount down", async () => {
  await collect({ category: "blue", quantityKg: 10 });
  const waiting = await pending("blue");
  assert.ok(waiting >= 10);
  const tooMuch = await as(ADMIN, "POST", "/api/waste/disposals", { category: "blue", quantityKg: waiting + 1, vendor: "SafeWaste Pvt Ltd" });
  assert.equal(tooMuch.status, 409); assert.match(tooMuch.error?.message ?? "", /waiting for disposal/);
  const ok = await as(ADMIN, "POST", "/api/waste/disposals", { category: "blue", quantityKg: 4, vendor: "SafeWaste Pvt Ltd", manifestNo: "MF-0091", vehicle: "GJ-06-AB-1234" });
  assert.equal(ok.status, 201, JSON.stringify(ok.error)); assert.equal(ok.data.manifestNo, "MF-0091");
  assert.equal(await pending("blue"), Math.round((waiting - 4) * 100) / 100);
  const list = (await as(ADMIN, "GET", "/api/waste/disposals")).data;
  assert.ok(list.vendors.includes("SafeWaste Pvt Ltd")); assert.equal(list.rows[0].vendor, "SafeWaste Pvt Ltd");
  assert.equal((await as(ADMIN, "POST", "/api/waste/disposals", { category: "blue", quantityKg: 1 })).status, 422, "a vendor is needed");
  assert.equal((await as(ADMIN, "POST", "/api/waste/disposals", { category: "blue", quantityKg: 1, vendor: "X Y", disposedOn: tomorrow })).status, 422);
  assert.equal((await as(ADMIN, "DELETE", `/api/waste/disposals/${ok.data.id}`)).status, 200);
  assert.equal(await pending("blue"), waiting, "deleting the load puts it back");
});

test("an infection event starts open, can be resolved once, and the ward and type are checked", async () => {
  const w = await wardId();
  const e = await as(ADMIN, "POST", "/api/waste/infection/events", { infectionType: "CAUTI", wardId: w, patientName: "Test Patient", organism: "E. coli", deviceProcedure: "Urinary catheter" });
  assert.equal(e.status, 201, JSON.stringify(e.error)); assert.equal(e.data.status, "Open");
  assert.equal((await as(ADMIN, "POST", "/api/waste/infection/events", { infectionType: "Flu" })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/waste/infection/events", { infectionType: "SSI", wardId: 99999 })).status, 404);
  let ic = (await as(ADMIN, "GET", "/api/waste/infection")).data;
  assert.equal(ic.events[0].id, e.data.id, "open cases first"); assert.ok(ic.open >= 1);
  const r = (await as(ADMIN, "POST", `/api/waste/infection/events/${e.data.id}/resolve`)).data;
  assert.equal(r.status, "Resolved"); assert.equal(r.resolvedOn, today);
  assert.equal((await as(ADMIN, "POST", `/api/waste/infection/events/${e.data.id}/resolve`)).status, 409);
  ic = (await as(ADMIN, "GET", "/api/waste/infection")).data;
  assert.equal(ic.events.find((x: any) => x.id === e.data.id).status, "Resolved");
});

test("a hand-hygiene audit works out compliance and can't have more compliant than observed", async () => {
  const w = await wardId();
  const a = (await as(ADMIN, "POST", "/api/waste/infection/hand-hygiene", { wardId: w, observed: 40, compliant: 34 })).data;
  assert.equal(a.pct, 85); assert.ok(a.auditor);
  assert.equal((await as(ADMIN, "POST", "/api/waste/infection/hand-hygiene", { wardId: w, observed: 10, compliant: 11 })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/waste/infection/hand-hygiene", { wardId: w, observed: 0, compliant: 0 })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/waste/infection/hand-hygiene", { wardId: w, observed: 10.5, compliant: 5 })).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/waste/infection")).data.audits[0].id, a.id);
});

test("the dashboard adds up the period's waste by colour, ward and day, and the infection and hygiene figures", async () => {
  for (const [q, n] of [["?days=7", 7], ["?days=90", 90], ["", 30], ["?days=11", 30]] as const) {
    const d = (await as(ADMIN, "GET", `/api/waste/dashboard${q}`)).data;
    assert.equal(d.days, n, q); assert.equal(d.waste.series.length, n); assert.equal(d.waste.series[n - 1].date, today);
  }
  const d = (await as(ADMIN, "GET", "/api/waste/dashboard?days=30")).data;
  const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
  assert.equal(sum(d.waste.byCategory.map((c: any) => c.kg)), d.waste.kg);
  assert.equal(sum(d.waste.series.map((s: any) => s.kg)), d.waste.kg);
  assert.equal(d.waste.byCategory.length, 4);
  assert.ok(d.waste.byCategory.every((c: any) => typeof c.pending === "number"));
  assert.ok(d.infection.events >= 1 && d.infection.byType.some((t: any) => t.type === "CAUTI"));
  assert.ok(d.handHygiene.audits >= 1 && d.handHygiene.pct >= 0 && d.handHygiene.pct <= 100);
});

test("the register lists the period's entries oldest first, with totals by colour", async () => {
  const r = (await as(ADMIN, "GET", `/api/waste/register?from=2026-01-01&to=${today}`)).data;
  assert.ok(r.hospital); assert.ok(r.collections.length >= 3);
  assert.ok(r.collections.every((c: any, i: number) => i === 0 || r.collections[i - 1].date <= c.date));
  const white = r.totals.find((t: any) => t.category === "white");
  assert.equal(white.collectedKg, Math.round(r.collections.filter((c: any) => c.category === "white").reduce((n: number, c: any) => n + c.quantityKg, 0) * 100) / 100);
  assert.equal((await as(ADMIN, "GET", "/api/waste/register?from=bad")).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/waste/register")).data.from, `${today.slice(0, 8)}01`);
});

test("entries are on the audit trail under Waste & IC", async () => {
  assert.ok((await as(ADMIN, "GET", "/api/audit")).data.modules.includes("Waste & IC"));
  assert.ok((await as(ADMIN, "GET", "/api/audit?module=Waste%20%26%20IC&q=kg")).data.rows.length >= 1);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
