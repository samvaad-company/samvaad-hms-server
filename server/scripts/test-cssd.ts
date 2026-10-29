/**
 * Tests for CSSD (central sterile services): instrument sets going dirty → packed → in a cycle → sterile → issued → back,
 * the one-cycle-per-chamber and one-live-issue-per-set rules (including two requests at once), shelf lives by method and
 * packaging, recalling (quarantining) a cycle, the usage charge reaching the bill, and permissions. In-process, in-memory.
 *
 *   npm run test:cssd
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
const { parseInstruments } = await import("@/services/cssd-service");
const { DEFAULT_SHELF_LIFE, STERILIZATION_METHODS, PACKAGING } = await import("@shared/types/cssd");
const { cssdSetsRepo, cssdIssuesRepo, billsRepo } = await import("@/repositories");
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
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const today = () => localDate();
let seq = 0;

const sets = async () => (await as(ADMIN, "GET", "/api/cssd/sets")).data as any[];
const sterilizers = async () => (await as(ADMIN, "GET", "/api/cssd/sterilizers")).data as any[];
const summary = async () => (await as(ADMIN, "GET", "/api/cssd/summary")).data;
const newSet = async (over: Record<string, unknown> = {}) => (await as(ADMIN, "POST", "/api/cssd/sets", { name: `Test set ${++seq}`, type: "Surgical", usageCharge: 500, ...over }));
const packed = async (packaging = "Pouched", over: Record<string, unknown> = {}) => {
  const s = (await newSet(over)).data;
  const r = await as(ADMIN, "POST", `/api/cssd/sets/${s.id}/pack`, { packaging });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  return r.data;
};
/** A chamber with nothing running in it. */
const freeChamber = async (method?: string) => (await sterilizers()).find((s) => s.active && !s.running && (!method || s.method === method))!;
const startCycle = (sterilizerId: number, setIds: number[], over: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/cssd/cycles", { sterilizerId, setIds, ...over });
/** A set that has been through a passed cycle and is sterile. */
const sterile = async (packaging = "Pouched", method = "Autoclave (vacuum)", over: Record<string, unknown> = {}) => {
  const s = await packed(packaging, over);
  const c = await startCycle((await freeChamber(method)).id, [s.id]);
  assert.equal(c.status, 201, JSON.stringify(c.error));
  const r = await as(ADMIN, "POST", `/api/cssd/cycles/${c.data.id}/result`, { indicator: "pass" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  return { set: (await sets()).find((x) => x.id === s.id)!, cycle: r.data };
};
const request1 = (setId: number, over: Record<string, unknown> = {}) => as(ADMIN, "POST", "/api/cssd/issues", { setId, ...over });

// ── Seed and board ───────────────────────────────────────────────────────────

test("the seeded hospital has the six chambers and sets in every state, and the board counts match the sets", async () => {
  const chambers = await sterilizers();
  assert.deepEqual(chambers.map((c) => c.name), ["Autoclave 1 (Vacuum)", "Autoclave 2 (Vacuum)", "Autoclave 3 (Gravity)", "ETO Sterilizer", "Hot Air Oven", "Plasma Sterilizer (H2O2)"]);
  assert.ok(chambers.every((c) => STERILIZATION_METHODS.includes(c.method) && c.active));
  const all = await sets();
  for (const st of ["Dirty", "Packed", "In cycle", "Sterile", "Issued", "Expired sterility"]) assert.ok(all.some((s) => s.status === st), st);
  assert.match(all[0].setNo, /^CS-\d{5}$/);
  const sum = await summary();
  const n = (st: string) => all.filter((s) => s.status === st).length;
  assert.deepEqual([sum.sterile, sum.inCycle, sum.packed, sum.dirty, sum.issuedOut, sum.expired], [n("Sterile"), n("In cycle"), n("Packed"), n("Dirty"), n("Issued"), n("Expired sterility")]);
  assert.equal(sum.expiring7d, all.filter((s) => s.status === "Sterile" && s.daysLeft <= 7).length);
  const issues = (await as(ADMIN, "GET", "/api/cssd/issues")).data as any[];
  assert.equal(sum.requests, issues.filter((i) => i.status === "Requested").length);
  assert.deepEqual([...sum.overdueSets].sort(), issues.filter((i) => i.overdue).map((i) => i.setNo).sort());
  assert.ok(sum.overdueSets.length >= 1, "some issued sets are past their return time");
  assert.ok(all.filter((s) => s.status === "Expired sterility").every((s) => s.daysLeft < 0));
  assert.ok(issues.some((i) => i.status === "Returned" && i.investigate), "a return with something to investigate");
  const cycles = (await as(ADMIN, "GET", "/api/cssd/cycles")).data as any[];
  for (const st of ["Running", "Passed", "Failed", "Quarantined"]) assert.ok(cycles.some((c) => c.status === st), st);
  assert.equal(cycles[0].status, "Running", "a running cycle is listed first");
  assert.match(cycles[0].cycleNo, /^CC\/\d{2}\/\d{5}$/);
});

test("instruments are read one per line: 'Forceps x 4' is four forceps, a bare name is one", async () => {
  assert.deepEqual(parseInstruments("Artery forceps x 6\nNeedle holder x 2\n\nScissors"), [{ name: "Artery forceps", qty: 6 }, { name: "Needle holder", qty: 2 }, { name: "Scissors", qty: 1 }]);
  assert.deepEqual(parseInstruments("Kocher ×3"), [{ name: "Kocher", qty: 3 }]);
  assert.deepEqual(parseInstruments(""), []);
  const about = (re: RegExp) => (e: unknown) => re.test(JSON.stringify((e as { details?: unknown }).details ?? ""));
  assert.throws(() => parseInstruments("x 4"), about(/instrument name/));
  assert.throws(() => parseInstruments("Forceps x 0"), about(/count of at least 1/));
});

// ── Sets ─────────────────────────────────────────────────────────────────────

test("a registered set gets the next lifetime number and starts dirty", async () => {
  const before = (await sets()).map((s) => Number(s.setNo.slice(3)));
  const depts = (await as(ADMIN, "GET", "/api/departments?all=true")).data as any[];
  const r = await as(ADMIN, "POST", "/api/cssd/sets", { name: "Major laparotomy set", type: "Surgical", departmentId: depts[0].id, instruments: "Artery forceps x 6\nNeedle holder x 2", usageCharge: 1200 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(Number(r.data.setNo.slice(3)), Math.max(...before) + 1);
  assert.deepEqual([r.data.status, r.data.packaging, r.data.sterileUntil, r.data.departmentName, r.data.usageCharge, r.data.instruments.length], ["Dirty", null, null, depts[0].name, 1200, 2]);
  for (const bad of [{ name: "x" }, { type: "Mystery" }, { usageCharge: -5 }, { departmentId: 99999 }, { instruments: "Forceps x 0" }]) {
    const res = await newSet(bad);
    assert.ok([404, 422].includes(res.status), JSON.stringify(bad));
  }
});

test("only a dirty set is packed, in one of three packagings", async () => {
  const s = (await newSet()).data;
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${s.id}/pack`, { packaging: "Sack" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${s.id}/pack`, {})).status, 422);
  const p = await as(ADMIN, "POST", `/api/cssd/sets/${s.id}/pack`, { packaging: "Rigid container" });
  assert.deepEqual([p.status, p.data.status, p.data.packaging], [200, "Packed", "Rigid container"]);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${s.id}/pack`, { packaging: "Pouched" })).status, 409, "already packed");
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/99999/pack`, { packaging: "Pouched" })).status, 404);
});

// ── Cycles ───────────────────────────────────────────────────────────────────

test("a cycle loads packed sets only, one cycle runs in a chamber at a time, and two starts at once give one winner", async () => {
  const a = await packed("Wrapped");
  const dirty = (await newSet()).data;
  const chamber = await freeChamber("Autoclave (gravity)");
  assert.equal((await startCycle(chamber.id, [])).status, 422, "nothing loaded");
  assert.equal((await startCycle(chamber.id, [dirty.id])).status, 409, "a dirty set can't be loaded");
  assert.equal((await startCycle(99999, [a.id])).status, 404);
  assert.equal((await startCycle(chamber.id, [a.id], { tempC: 900 })).status, 422);

  const c = await startCycle(chamber.id, [a.id], { tempC: 121, pressurePsi: 15, exposureMin: 30 });
  assert.equal(c.status, 201, JSON.stringify(c.error));
  assert.deepEqual([c.data.status, c.data.indicator, c.data.method, c.data.load, c.data.setNos, c.data.tempC, c.data.exposureMin], ["Running", "pending", chamber.method, 1, [a.setNo], 121, 30]);
  assert.equal((await sets()).find((s) => s.id === a.id).status, "In cycle");
  assert.equal((await sterilizers()).find((s) => s.id === chamber.id).running, true);
  const b = await packed("Pouched");
  const busy = await startCycle(chamber.id, [b.id]);
  assert.equal(busy.status, 409);
  assert.match(busy.error!.message, new RegExp(c.data.cycleNo));
  assert.equal((await startCycle((await freeChamber()).id, [a.id])).status, 409, "a set already in a cycle can't be loaded again");
  await as(ADMIN, "POST", `/api/cssd/cycles/${c.data.id}/result`, { indicator: "pass" });

  const x = await packed(), y = await packed();
  const free = await freeChamber();
  const rs = await Promise.all([startCycle(free.id, [x.id]), startCycle(free.id, [y.id]), startCycle(free.id, [x.id, y.id])]);
  assert.equal(rs.filter((r) => r.status === 201).length, 1, "exactly one cycle started in the chamber");
  assert.ok(rs.filter((r) => r.status !== 201).every((r) => r.status === 409));
  const winner = rs.find((r) => r.status === 201)!;
  await as(ADMIN, "POST", `/api/cssd/cycles/${winner.data.id}/result`, { indicator: "fail" });
});

test("a chamber switched off can't be used, and one running a cycle can't be switched off or changed", async () => {
  const created = await as(ADMIN, "POST", "/api/cssd/sterilizers", { name: "Spare autoclave", method: "Autoclave (gravity)", location: "Annexe" });
  assert.equal(created.status, 201, JSON.stringify(created.error));
  assert.equal((await as(ADMIN, "POST", "/api/cssd/sterilizers", { name: "spare AUTOCLAVE", method: "Dry heat" })).status, 409, "names are unique");
  assert.equal((await as(ADMIN, "POST", "/api/cssd/sterilizers", { name: "Bad one", method: "Magic" })).status, 422);
  const s = await packed();
  await as(ADMIN, "PATCH", `/api/cssd/sterilizers/${created.data.id}`, { active: false });
  assert.equal((await startCycle(created.data.id, [s.id])).status, 409, "switched off");
  await as(ADMIN, "PATCH", `/api/cssd/sterilizers/${created.data.id}`, { active: true, location: "Annexe 2" });
  const c = await startCycle(created.data.id, [s.id]);
  assert.equal(c.status, 201);
  assert.equal((await as(ADMIN, "PATCH", `/api/cssd/sterilizers/${created.data.id}`, { active: false })).status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/cssd/sterilizers/${created.data.id}`, { method: "Dry heat" })).status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/cssd/sterilizers/${created.data.id}`, { location: "Annexe 3" })).status, 200, "a rename of the place is fine");
  await as(ADMIN, "POST", `/api/cssd/cycles/${c.data.id}/result`, { indicator: "pass" });
});

test("a passed cycle makes the sets sterile until today plus the shelf life for its method and packaging; a failed one sends them back to dirty", async () => {
  for (const [method, packaging] of [["Autoclave (vacuum)", "Pouched"], ["Autoclave (gravity)", "Wrapped"], ["Dry heat", "Rigid container"], ["Ethylene oxide", "Pouched"]] as const) {
    const { set } = await sterile(packaging, method);
    assert.deepEqual([set.status, set.sterileUntil, set.daysLeft, set.timesProcessed], ["Sterile", addDays(today(), DEFAULT_SHELF_LIFE[method][packaging]), DEFAULT_SHELF_LIFE[method][packaging], 1], `${method} · ${packaging}`);
  }
  const s = await packed();
  const c = (await startCycle((await freeChamber()).id, [s.id])).data;
  assert.equal((await as(ADMIN, "POST", `/api/cssd/cycles/${c.id}/result`, { indicator: "maybe" })).status, 422);
  const failed = await as(ADMIN, "POST", `/api/cssd/cycles/${c.id}/result`, { indicator: "fail", note: "Indicator stayed yellow" });
  assert.deepEqual([failed.data.status, failed.data.indicator, failed.data.resultBy, failed.data.note], ["Failed", "fail", "Dr. Kevin Carter", "Indicator stayed yellow"]);
  const back = (await sets()).find((x) => x.id === s.id);
  assert.deepEqual([back.status, back.packaging, back.sterileUntil], ["Dirty", null, null], "it has to be cleaned and packed again");
  assert.equal((await as(ADMIN, "POST", `/api/cssd/cycles/${c.id}/result`, { indicator: "pass" })).status, 409, "a result is entered once");
});

test("shelf lives can be changed per method and packaging, and put back to the default", async () => {
  const before = (await as(ADMIN, "GET", "/api/cssd/settings")).data;
  assert.equal(before.days["Dry heat"].Wrapped, DEFAULT_SHELF_LIFE["Dry heat"].Wrapped);
  assert.equal(before.overridden["Dry heat"].Wrapped, false);
  for (const m of STERILIZATION_METHODS) for (const p of PACKAGING) assert.equal(typeof before.days[m][p], "number", `${m} ${p}`);
  assert.equal((await as(ADMIN, "PATCH", "/api/cssd/settings", { method: "Dry heat", packaging: "Wrapped", days: 0 })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", "/api/cssd/settings", { method: "Dry heat", packaging: "Wrapped", days: "soon" })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", "/api/cssd/settings", { method: "Steam", packaging: "Wrapped", days: 5 })).status, 422);
  const set = await as(ADMIN, "PATCH", "/api/cssd/settings", { method: "Dry heat", packaging: "Wrapped", days: 10 });
  assert.deepEqual([set.data.days["Dry heat"].Wrapped, set.data.overridden["Dry heat"].Wrapped, set.data.days["Dry heat"].Pouched], [10, true, DEFAULT_SHELF_LIFE["Dry heat"].Pouched]);
  const { set: s } = await sterile("Wrapped", "Dry heat");
  assert.equal(s.sterileUntil, addDays(today(), 10), "the new cycle uses the hospital's own number");
  const reset = await as(ADMIN, "PATCH", "/api/cssd/settings", { method: "Dry heat", packaging: "Wrapped", days: null });
  assert.deepEqual([reset.data.days["Dry heat"].Wrapped, reset.data.overridden["Dry heat"].Wrapped], [DEFAULT_SHELF_LIFE["Dry heat"].Wrapped, false]);
  assert.equal((await sets()).find((x) => x.id === s.id).sterileUntil, addDays(today(), 10), "a set already sterile keeps its date");
});

test("quarantining a passed cycle sends its shelf sets back to dirty and flags any already out", async () => {
  const a = await packed(), b = await packed(), c3 = await packed();
  const cyc = (await startCycle((await freeChamber()).id, [a.id, b.id, c3.id])).data;
  assert.equal((await as(ADMIN, "POST", `/api/cssd/cycles/${cyc.id}/quarantine`, { reason: "Too early" })).status, 409, "only a passed cycle");
  await as(ADMIN, "POST", `/api/cssd/cycles/${cyc.id}/result`, { indicator: "pass" });
  // one of the load goes out to a patient
  const rq = (await request1(a.id)).data;
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/issue`, {})).status, 200);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/cycles/${cyc.id}/quarantine`, {})).status, 422, "a reason is needed");
  const q = await as(ADMIN, "POST", `/api/cssd/cycles/${cyc.id}/quarantine`, { reason: "Biological indicator read late" });
  assert.deepEqual([q.status, q.data.status, q.data.note], [200, "Quarantined", "Biological indicator read late"]);
  const now = await sets();
  assert.equal(now.find((s) => s.id === b.id).status, "Dirty");
  assert.equal(now.find((s) => s.id === c3.id).status, "Dirty");
  assert.equal(now.find((s) => s.id === a.id).status, "Issued", "the set that is out stays out");
  const issue = ((await as(ADMIN, "GET", "/api/cssd/issues")).data as any[]).find((i) => i.id === rq.id);
  assert.equal(issue.investigate, true);
  assert.match(issue.returnNote, /quarantined/);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/cycles/${cyc.id}/quarantine`, { reason: "again please" })).status, 409);
  const back = await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/return`, {});
  assert.equal(back.data.investigate, true, "still flagged when it comes back");
});

// ── Requests, issues and returns ─────────────────────────────────────────────

test("a set is requested, issued when sterile with an issue number and a return time, and the usage charge goes on a pending bill", async () => {
  const { set } = await sterile("Pouched", "Autoclave (vacuum)", { usageCharge: 960 });
  const patient = (await as(ADMIN, "GET", "/api/patients?all=true")).data[0];
  const rq = await request1(set.id, { patientId: patient.id });
  assert.equal(rq.status, 201, JSON.stringify(rq.error));
  assert.deepEqual([rq.data.status, rq.data.issueNo, rq.data.patientName, rq.data.charge, rq.data.setNo], ["Requested", null, patient.name, 960, set.setNo]);
  assert.equal((await request1(set.id)).status, 409, "one live request per set");
  assert.equal((await request1(99999)).status, 404);
  assert.equal((await request1(set.id + 100000, { patientId: patient.id })).status, 404);

  const bills0 = (await billsRepo.listRows({ unpaged: true })).rows.length;
  const iss = await as(ADMIN, "POST", `/api/cssd/issues/${rq.data.id}/issue`, { hours: 12 });
  assert.equal(iss.status, 200, JSON.stringify(iss.error));
  assert.match(iss.data.issueNo, /^CI\/\d{2}\/\d{5}$/);
  assert.deepEqual([iss.data.status, iss.data.overdue, iss.data.charge], ["Issued", false, 960]);
  assert.equal(Math.round((new Date(iss.data.expectedBack).getTime() - new Date(iss.data.issuedAt).getTime()) / 3_600_000), 12);
  assert.ok(iss.data.billNumber, "the usage fee is on a bill");
  const bill = (await billsRepo.listRows({ unpaged: true })).rows.find((b) => b.bill_number === iss.data.billNumber)!;
  assert.deepEqual([bill.patient_id, bill.amount, bill.status, ["OPD", "IPD"].includes(bill.type)], [patient.id, 960, "Pending", true]);
  assert.equal((await billsRepo.listRows({ unpaged: true })).rows.length, bills0 + 1);
  assert.equal((await sets()).find((s) => s.id === set.id).status, "Issued");
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.data.id}/issue`, {})).status, 409, "already issued");
  assert.equal((await request1(set.id)).status, 409, "an issued set can't be requested again");
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.data.id}/cancel`)).status, 409, "an issued set can't be cancelled");
});

test("only a sterile, in-date set can be issued; an expired one is reprocessed first", async () => {
  const p = await packed();
  const rq = (await request1(p.id)).data;
  const early = await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/issue`, {});
  assert.equal(early.status, 409);
  assert.match(early.error!.message, /packed/);
  assert.equal(((await as(ADMIN, "GET", "/api/cssd/issues")).data as any[]).find((i) => i.id === rq.id).status, "Requested", "still waiting");
  await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/cancel`);

  const { set } = await sterile();
  await cssdSetsRepo.update(set.id, { sterile_until: addDays(today(), -2) });
  const expired = (await sets()).find((s) => s.id === set.id);
  assert.deepEqual([expired.status, expired.daysLeft], ["Expired sterility", -2]);
  const rq2 = (await request1(set.id)).data;
  const late = await as(ADMIN, "POST", `/api/cssd/issues/${rq2.id}/issue`, {});
  assert.equal(late.status, 409);
  assert.match(late.error!.message, /reprocess/);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${set.id}/reprocess`)).data.status, "Packed", "an expired set goes back to packed");
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${set.id}/reprocess`)).status, 409, "only an expired set is reprocessed");
  const fresh = await sterile();
  assert.equal((await as(ADMIN, "POST", `/api/cssd/sets/${fresh.set.id}/reprocess`)).status, 409, "a set in date isn't reprocessed");
});

test("two people issuing one request, or requesting one set, at once: exactly one wins", async () => {
  const { set } = await sterile();
  const rs = await Promise.all([request1(set.id), request1(set.id), request1(set.id)]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409, 409]);
  const rq = rs.find((r) => r.status === 201)!.data;
  const issued = await Promise.all([1, 2, 3].map(() => as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/issue`, {})));
  assert.deepEqual(issued.map((r) => r.status).sort(), [200, 409, 409]);
  const row = ((await cssdIssuesRepo.listRows({ unpaged: true })).rows).filter((i) => i.set_id === set.id && i.status === "Issued");
  assert.equal(row.length, 1);
  const numbers = ((await as(ADMIN, "GET", "/api/cssd/issues")).data as any[]).map((i) => i.issueNo).filter(Boolean);
  assert.equal(new Set(numbers).size, numbers.length, "issue numbers are never repeated");
});

test("a returned set is dirty again; one returned with a problem needs a note and stays flagged", async () => {
  const { set } = await sterile();
  const rq = (await request1(set.id)).data;
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/return`, {})).status, 409, "not issued yet");
  await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/issue`, {});
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/return`, { investigate: true })).status, 422, "say what to investigate");
  const r = await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/return`, { investigate: true, note: "Two scissors missing" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.investigate, r.data.returnNote, r.data.overdue], ["Returned", true, "Two scissors missing", false]);
  const back = (await sets()).find((s) => s.id === set.id);
  assert.deepEqual([back.status, back.packaging, back.sterileUntil], ["Dirty", null, null]);
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.id}/return`, {})).status, 409, "returned once");
  assert.equal((await request1(set.id)).status, 201, "and it can be requested again");

  const ok = await sterile();
  const rq2 = (await request1(ok.set.id)).data;
  await as(ADMIN, "POST", `/api/cssd/issues/${rq2.id}/issue`, {});
  assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq2.id}/return`, {})).data.investigate, false, "a clean return isn't flagged");
});

test("a request can be tied to a booked surgery, which supplies the patient; and cancelled", async () => {
  const cases = (await as(ADMIN, "GET", "/api/cssd/cases")).data as any[];
  assert.ok(Array.isArray(cases));
  const s = await packed();
  const c = cases[0];
  if (c) {
    const rq = await request1(s.id, { caseId: c.id });
    assert.equal(rq.status, 201, JSON.stringify(rq.error));
    assert.deepEqual([rq.data.patientName, rq.data.caseLabel.includes(c.scheduledDate)], [c.patientName, true]);
    assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.data.id}/cancel`)).data.status, "Cancelled");
    assert.equal((await as(ADMIN, "POST", `/api/cssd/issues/${rq.data.id}/cancel`)).status, 409);
    assert.equal((await request1(s.id)).status, 201, "a cancelled request frees the set");
  }
  assert.equal((await request1((await packed()).id, { caseId: 99999 })).status, 404);
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: doctors work the board; the front desk and billing have no access", async () => {
  for (const path of ["/api/cssd/summary", "/api/cssd/sets", "/api/cssd/cycles", "/api/cssd/issues", "/api/cssd/sterilizers", "/api/cssd/settings", "/api/cssd/cases"]) {
    assert.equal((await as(DOCTOR, "GET", path)).status, 200, `doctor ${path}`);
    assert.equal((await as(RECEPTION, "GET", path)).status, 403, `front desk ${path}`);
    assert.equal((await as(BILLING, "GET", path)).status, 403, `billing ${path}`);
  }
  assert.equal((await as(BILLING, "POST", "/api/cssd/sets", { name: "Nope set" })).status, 403);
  assert.equal((await as(RECEPTION, "PATCH", "/api/cssd/settings", { method: "Dry heat", packaging: "Wrapped", days: 5 })).status, 403);
  assert.equal((await request("GET", "/api/cssd/summary")).status, 401);
  assert.equal((await as(DOCTOR, "POST", "/api/cssd/sets", { name: "Doctor's set" })).status, 201);
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
