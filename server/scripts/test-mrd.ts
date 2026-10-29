/**
 * Tests for the medical records department: file tracking (locations, files, checkout / return / archive, requests,
 * the movement trail, two people reaching for one file), document retention and folders, consent signatures sent to a
 * patient's phone, discharge coding with deficiencies, and the birth / death registers. In-process, in-memory database.
 *
 *   npm run test:mrd
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
const { rackFor, defaultLocationPlan } = await import("@/services/mrd-defaults");
const { withKeyLocks } = await import("@/lib/key-lock");
const { documentsRepo, auditRepo } = await import("@/repositories");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; form?: FormData } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | FormData | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string; fields?: unknown } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown, form?: FormData) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, form, headers: { cookie: cookies.get(email)! } });
}
const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const today = () => localDate();
let seq = 0;
const mobile = () => `98${String(20000000 + ++seq * 7)}`;
const files = async () => (await as(ADMIN, "GET", "/api/mrd/files?all=true")).data as any[];
const locations = async () => (await as(ADMIN, "GET", "/api/mrd/locations")).data as any[];
const requests = async () => (await as(ADMIN, "GET", "/api/mrd/requests?all=true")).data as any[];
/** A file on the shelf that no open request is waiting on. */
const availableFile = async () => {
  const busy = new Set((await requests()).filter((r) => r.status === "Pending" || r.status === "Dispatched").map((r) => r.fileId));
  return (await files()).find((f) => f.status === "Available" && !busy.has(f.id))!;
};
const nurseStation = async () => (await locations()).find((l) => l.kind === "Nurse station");
const archiveRoom = async () => (await locations()).find((l) => l.kind === "Archive room");
const newPatient = async (name = `MRD Patient ${++seq}`) => (await as(ADMIN, "POST", "/api/patients", { name, gender: "Female", phone: mobile() })).data;

// ── Pure helpers ─────────────────────────────────────────────────────────────

test("the default locations are racks by UHID range, archive rooms, the OT counter, a nurse station per department and a cabin per doctor", async () => {
  const plan = defaultLocationPlan(["General Medicine", "Emergency & Casualty"], ["Dr. Ava Johnson", "Dr. Noah Carter"]);
  assert.deepEqual(plan.map((p) => p.kind), ["MRD rack", "MRD rack", "MRD rack", "Archive room", "Archive room", "Operation theatre", "Nurse station", "Nurse station", "Doctor cabin", "Doctor cabin"]);
  assert.equal(new Set(plan.map((p) => p.code)).size, plan.length, "codes are unique");
  assert.equal(plan.find((p) => p.name === "Dr. Ava Johnson - Cabin")?.code, "CAB-AJ");
  const racks = plan.filter((p) => p.kind === "MRD rack");
  assert.equal(rackFor("HMS-0007", racks)?.code, "RACK-A");
  assert.equal(rackFor("HMS-2001", racks)?.code, "RACK-B");
  assert.equal(rackFor("HMS-4001", racks)?.code, "RACK-C");
  assert.equal(rackFor("no-number", racks)?.code, "RACK-A", "a code with no number goes to the first rack");
  assert.equal(addDays("2026-02-27", 3), "2026-03-02");
});

test("two callers for one key run one after the other; different keys don't wait", async () => {
  const log: string[] = [];
  const slow = withKeyLocks(["a"], async () => { log.push("a1 start"); await new Promise((r) => setTimeout(r, 30)); log.push("a1 end"); });
  const second = withKeyLocks(["a"], async () => { log.push("a2"); });
  const other = withKeyLocks(["b"], async () => { log.push("b"); });
  await Promise.all([slow, second, other]);
  assert.ok(log.indexOf("b") < log.indexOf("a1 end"), "an unrelated key is not held up");
  assert.deepEqual(log.filter((l) => l.startsWith("a")), ["a1 start", "a1 end", "a2"]);
});

// ── Locations & files ────────────────────────────────────────────────────────

test("the seeded hospital has locations, and one file per patient in every state", async () => {
  const locs = await locations();
  for (const kind of ["MRD rack", "Archive room", "Operation theatre", "Nurse station", "Doctor cabin"]) assert.ok(locs.some((l) => l.kind === kind), kind);
  const patients = (await as(ADMIN, "GET", "/api/patients?all=true")).data as any[];
  const list = await files();
  assert.equal(list.length, patients.length, "one file per patient");
  assert.equal(new Set(list.map((f) => f.patientId)).size, list.length);
  assert.match(list[0].fileNo, /^F\/\d{2}\/\d{5}$/);
  for (const s of ["Available", "Checked out", "In transit", "Archived"]) assert.ok(list.some((f) => f.status === s), s);
  assert.ok(list.some((f) => f.overdue), "some are past their due date");
  assert.ok(list.every((f) => f.status === "Checked out" || f.status === "In transit" || !f.overdue), "only a file that is out can be overdue");
  const sum = (await as(ADMIN, "GET", "/api/mrd/files/summary")).data;
  const n = (s: string) => list.filter((f) => f.status === s).length;
  assert.deepEqual(
    [sum.available, sum.checkedOut, sum.inTransit, sum.archived, sum.overdue],
    [n("Available"), n("Checked out"), n("In transit"), n("Archived"), list.filter((f) => f.overdue).length],
  );
  const reqs = await requests();
  assert.equal(sum.pendingRequests, reqs.filter((r) => r.status === "Pending").length);
  for (const r of reqs) if (r.status === "Dispatched") assert.equal(list.find((f) => f.id === r.fileId)?.status, "In transit", "a dispatched request's file is in transit");
});

test("a patient registered later gets a file in the rack their UHID belongs to", async () => {
  const p = await newPatient();
  const mine = (await files()).filter((f) => f.patientId === p.id);
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].status, mine[0].fileType], ["Available", "OPD"]);
  assert.match(mine[0].locationName, /^MRD Rack/);
  assert.equal(mine[0].homeLocationId, mine[0].locationId);
  // asking again doesn't open a second file
  const again = (await as(ADMIN, "POST", "/api/mrd/files", { patientId: p.id })).data;
  assert.equal(again.id, mine[0].id);
  assert.equal((await files()).filter((f) => f.patientId === p.id).length, 1);
  const search = (await as(ADMIN, "GET", `/api/mrd/files?all=true&search=${encodeURIComponent(p.name)}`)).data as any[];
  assert.equal(search[0]?.patientId, p.id, "search by patient name");
  const byNo = (await as(ADMIN, "GET", `/api/mrd/files?all=true&search=${encodeURIComponent(mine[0].fileNo)}`)).data as any[];
  assert.equal(byNo[0]?.id, mine[0].id, "search by file number");
});

test("checking a file out records who has it, where and until when; returning it puts it back on its home rack", async () => {
  const f = await availableFile();
  const ns = await nurseStation();
  const due = addDays(today(), 3);
  const out = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { holder: "Dr. Harsh Sheth", locationId: ns.id, dueOn: due, note: "Ward round" });
  assert.equal(out.status, 200, JSON.stringify(out.error));
  assert.deepEqual([out.data.status, out.data.holderName, out.data.locationName, out.data.dueOn, out.data.overdue], ["Checked out", "Dr. Harsh Sheth", ns.name, due, false]);
  const back = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/return`, {});
  assert.equal(back.status, 200, JSON.stringify(back.error));
  assert.deepEqual([back.data.status, back.data.holderName, back.data.dueOn, back.data.locationId], ["Available", null, null, f.homeLocationId]);
  const trail = (await as(ADMIN, "GET", `/api/mrd/files/${f.id}/history`)).data as any[];
  assert.deepEqual(trail.slice(0, 2).map((t) => t.action), ["Returned", "Checked out"], "newest first");
  assert.equal(trail.at(-1).action, "Created");
  assert.equal(trail[1].holderName, "Dr. Harsh Sheth");
  assert.equal(trail[1].note, "Ward round");
});

test("a checkout needs a holder, a real active place and a due date that isn't past; only an available file can go out", async () => {
  const f = await availableFile();
  const ns = await nurseStation();
  const ok = { holder: "Dr. X", locationId: ns.id, dueOn: addDays(today(), 2) };
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { ...ok, holder: "" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { ...ok, dueOn: addDays(today(), -1) })).status, 422, "due in the past");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { ...ok, dueOn: "soon" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { ...ok, locationId: 99999 })).status, 404);
  const arch = await archiveRoom();
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { ...ok, locationId: arch.id })).status, 422, "an archive room is for archiving");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/99999/checkout`, ok)).status, 404);
  assert.equal((await as(ADMIN, "GET", `/api/mrd/files/${f.id}`)).data.status, "Available", "nothing changed");

  const out = (await files()).find((x) => x.status === "Checked out")!;
  const clash = await as(ADMIN, "POST", `/api/mrd/files/${out.id}/checkout`, ok);
  assert.equal(clash.status, 409);
  assert.match(clash.error!.message, new RegExp(out.holderName), "names who has it");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/return`, {})).status, 409, "an available file can't be returned");
  const archived = (await files()).find((x) => x.status === "Archived")!;
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${archived.id}/checkout`, ok)).status, 409, "an archived file has to be retrieved first");
});

test("two people checking out the same file at once: exactly one gets it", async () => {
  const f = await availableFile();
  const ns = await nurseStation();
  const due = addDays(today(), 2);
  const wentOut = async () => ((await as(ADMIN, "GET", `/api/mrd/files/${f.id}/history`)).data as any[]).filter((t) => t.action === "Checked out").length;
  const before = await wentOut();
  const rs = await Promise.all([
    as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { holder: "First Person", locationId: ns.id, dueOn: due }),
    as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { holder: "Second Person", locationId: ns.id, dueOn: due }),
    as(ADMIN, "POST", `/api/mrd/files/${f.id}/checkout`, { holder: "Third Person", locationId: ns.id, dueOn: due }),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
  const winner = rs.find((r) => r.status === 200)!.data.holderName;
  assert.equal((await as(ADMIN, "GET", `/api/mrd/files/${f.id}`)).data.holderName, winner);
  assert.equal((await wentOut()) - before, 1, "one new line in the trail");
  await as(ADMIN, "POST", `/api/mrd/files/${f.id}/return`, {});
});

test("an available file can be archived into an archive room and retrieved; it can be moved between racks", async () => {
  const f = await availableFile();
  const arch = await archiveRoom();
  const racks = (await locations()).filter((l) => l.kind === "MRD rack");
  const other = racks.find((r) => r.id !== f.locationId)!;
  const moved = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: other.id });
  assert.deepEqual([moved.status, moved.data.locationId], [200, other.id], JSON.stringify(moved.error));
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: other.id })).status, 409, "already there");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: arch.id })).status, 422);

  const a = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/archive`, { locationId: arch.id });
  assert.equal(a.status, 200, JSON.stringify(a.error));
  assert.deepEqual([a.data.status, a.data.locationName], ["Archived", arch.name]);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/archive`, {})).status, 409, "already archived");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: other.id })).status, 409, "an archived file can't be moved");
  const r = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/retrieve`, {});
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.locationId], ["Available", f.homeLocationId], "back on its home rack");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/retrieve`, {})).status, 409);
  const rack = racks[0];
  assert.equal((await as(ADMIN, "POST", `/api/mrd/files/${f.id}/archive`, { locationId: rack.id })).status, 422, "archive needs an archive room");
  assert.deepEqual((await as(ADMIN, "GET", `/api/mrd/files/${f.id}/history`)).data.slice(0, 3).map((t: any) => t.action), ["Retrieved", "Archived", "Moved"]);
});

// ── Requests ─────────────────────────────────────────────────────────────────

test("a request is dispatched (file goes in transit to the requester) and marked returned (file is back on its rack)", async () => {
  const f = await availableFile();
  const ns = await nurseStation();
  const made = await as(ADMIN, "POST", "/api/mrd/requests", { fileId: f.id, urgency: "Urgent", requestedFor: "Dr. Kinjal Parmar", destinationId: ns.id });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.deepEqual([made.data.status, made.data.urgency, made.data.fileNo, made.data.requestedOn], ["Pending", "Urgent", f.fileNo, today()]);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/requests", { fileId: f.id })).status, 409, "one open request per file");

  const sent = await as(ADMIN, "POST", `/api/mrd/requests/${made.data.id}/dispatch`, {});
  assert.equal(sent.status, 200, JSON.stringify(sent.error));
  assert.equal(sent.data.status, "Dispatched");
  const after = (await as(ADMIN, "GET", `/api/mrd/files/${f.id}`)).data;
  assert.deepEqual([after.status, after.holderName, after.locationName, after.dueOn], ["In transit", "Dr. Kinjal Parmar", ns.name, addDays(today(), 2)], "urgent = due in two days");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/requests/${made.data.id}/dispatch`, {})).status, 409, "already dispatched");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/requests/${made.data.id}/cancel`)).status, 409, "a dispatched request can't be cancelled");

  const back = await as(ADMIN, "POST", `/api/mrd/requests/${made.data.id}/return`);
  assert.equal(back.status, 200, JSON.stringify(back.error));
  assert.equal(back.data.status, "Returned");
  const home = (await as(ADMIN, "GET", `/api/mrd/files/${f.id}`)).data;
  assert.deepEqual([home.status, home.holderName, home.locationId], ["Available", null, f.homeLocationId]);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/requests/${made.data.id}/return`)).status, 409);
  // with the request closed, the file can be requested again
  const again = await as(ADMIN, "POST", "/api/mrd/requests", { fileId: f.id });
  assert.equal(again.status, 201);
  assert.deepEqual([again.data.urgency, again.data.requestedFor], ["Routine", "Dr. Kevin Carter"], "defaults: routine, for the person asking");
  const cancelled = await as(ADMIN, "POST", `/api/mrd/requests/${again.data.id}/cancel`);
  assert.equal(cancelled.data.status, "Cancelled");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/requests/${again.data.id}/dispatch`, {})).status, 409, "a cancelled request can't be dispatched");
});

test("a return closes the dispatched request for that file", async () => {
  const f = await availableFile();
  const made = (await as(ADMIN, "POST", "/api/mrd/requests", { fileId: f.id })).data;
  await as(ADMIN, "POST", `/api/mrd/requests/${made.id}/dispatch`, {});
  const r = await as(ADMIN, "POST", `/api/mrd/files/${f.id}/return`, {});
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal((await requests()).find((x) => x.id === made.id).status, "Returned");
});

test("a request can't be dispatched while the file is out, in the archive, or by two people at once", async () => {
  const out = (await files()).find((x) => x.status === "Checked out")!;
  const mine = await as(ADMIN, "POST", "/api/mrd/requests", { fileId: out.id });
  assert.equal(mine.status, 201);
  const d = await as(ADMIN, "POST", `/api/mrd/requests/${mine.data.id}/dispatch`, {});
  assert.equal(d.status, 409);
  assert.match(d.error!.message, /checked out/);
  await as(ADMIN, "POST", `/api/mrd/requests/${mine.data.id}/cancel`);

  const archived = (await files()).find((x) => x.status === "Archived")!;
  const ar = await as(ADMIN, "POST", "/api/mrd/requests", { fileId: archived.id });
  const ad = await as(ADMIN, "POST", `/api/mrd/requests/${ar.data.id}/dispatch`, {});
  assert.equal(ad.status, 409);
  assert.match(ad.error!.message, /archive/);
  await as(ADMIN, "POST", `/api/mrd/requests/${ar.data.id}/cancel`);

  const f = await availableFile();
  const req = (await as(ADMIN, "POST", "/api/mrd/requests", { fileId: f.id })).data;
  const dispatches = async () => ((await as(ADMIN, "GET", `/api/mrd/files/${f.id}/history`)).data as any[]).filter((t) => t.action === "Dispatched").length;
  const before = await dispatches();
  const rs = await Promise.all([1, 2, 3].map(() => as(ADMIN, "POST", `/api/mrd/requests/${req.id}/dispatch`, {})));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
  assert.equal((await dispatches()) - before, 1, "one dispatch line for this request");
  await as(ADMIN, "POST", `/api/mrd/files/${f.id}/return`, {});
});

test("locations: names are unique, a rename follows the files in them, a switched-off place can't receive files", async () => {
  const made = await as(ADMIN, "POST", "/api/mrd/locations", { name: "Records Annexe", kind: "Other", code: "ANNEX" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(ADMIN, "POST", "/api/mrd/locations", { name: "records annexe" })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/locations", { name: "X" })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/locations", { name: "Bad kind", kind: "Garage" })).status, 422);

  const f = await availableFile();
  await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: made.data.id });
  assert.equal((await locations()).find((l) => l.id === made.data.id).fileCount, 1);
  const renamed = await as(ADMIN, "PATCH", `/api/mrd/locations/${made.data.id}`, { name: "Records Annexe (2nd floor)" });
  assert.equal(renamed.status, 200);
  assert.equal((await as(ADMIN, "GET", `/api/mrd/files/${f.id}`)).data.locationName, "Records Annexe (2nd floor)");
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/locations/${made.data.id}`, { name: (await nurseStation()).name })).status, 409);

  await as(ADMIN, "PATCH", `/api/mrd/locations/${made.data.id}`, { active: false });
  const g = await availableFile();
  const ns = await as(ADMIN, "POST", `/api/mrd/files/${g.id}/move`, { locationId: made.data.id });
  assert.equal(ns.status, 409);
  assert.match(ns.error!.message, /switched off/);
  await as(ADMIN, "POST", `/api/mrd/files/${f.id}/move`, { locationId: f.homeLocationId });
});

// ── Documents: retention and folders ─────────────────────────────────────────

const oldDoc = async (over: Record<string, unknown> = {}) => {
  const p = (await as(ADMIN, "GET", "/api/patients?all=true")).data[0];
  return documentsRepo.create({
    hospital_id: 1, owner_type: "patient", owner_id: p.id, category: "Report", file_name: `old-${++seq}.pdf`, mime_type: "application/pdf", size_bytes: 10,
    storage_key: `k-${seq}`, uploaded_by: "Test", created_at: `${Number(today().slice(0, 4)) - 15}-03-01T10:00:00.000Z`, ...over,
  });
};

test("the four default retention policies exist and can be edited", async () => {
  const pol = (await as(ADMIN, "GET", "/api/mrd/policies")).data as any[];
  assert.deepEqual(pol.map((p) => p.class), ["Clinical", "Financial", "KYC", "Statutory"]);
  assert.ok(pol.every((p) => p.retentionYears >= 1 && p.active));
  const edit = await as(ADMIN, "PATCH", `/api/mrd/policies/${pol[1].id}`, { retentionYears: 9, categories: ["Invoice", " Insurance ", "invoice"] });
  assert.equal(edit.status, 200, JSON.stringify(edit.error));
  assert.deepEqual([edit.data.retentionYears, edit.data.categories], [9, ["invoice", "insurance"]], "categories are lower-cased and de-duplicated");
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/policies/${pol[1].id}`, { retentionYears: 0 })).status, 422);
  const mk = await as(ADMIN, "POST", "/api/mrd/policies", { name: "Research consent", class: "Clinical", retentionYears: 15, categories: "Consent Form, Research" });
  assert.equal(mk.status, 201, JSON.stringify(mk.error));
  assert.deepEqual(mk.data.categories, ["consent form", "research"]);
  await as(ADMIN, "PATCH", `/api/mrd/policies/${mk.data.id}`, { active: false });
});

test("the sweep flags documents past their retention period; extending keeps one, disposing deletes it and is audited", async () => {
  const before = (await as(ADMIN, "GET", "/api/mrd/retention")).data;
  const clinical = await oldDoc({ category: "Report" });
  const financial = await oldDoc({ category: "Insurance", owner_type: "patient" });
  const kyc = await oldDoc({ category: "ID Proof", owner_type: "donor", owner_id: 1 });
  const fresh = await oldDoc({ category: "Report", created_at: new Date().toISOString() });
  const q = (await as(ADMIN, "GET", "/api/mrd/retention")).data;
  assert.deepEqual([q.clinicalDue - before.clinicalDue, q.financialDue - before.financialDue, q.kycDue - before.kycDue], [1, 1, 1]);
  const ids = q.items.map((i: any) => i.id);
  assert.ok(ids.includes(clinical.id) && ids.includes(financial.id) && ids.includes(kyc.id));
  assert.ok(!ids.includes(fresh.id), "a recent document isn't due");
  const item = q.items.find((i: any) => i.id === clinical.id);
  assert.deepEqual([item.class, item.policyName, item.dueOn <= today()], ["Clinical", "Clinical records", true]);

  assert.equal((await as(ADMIN, "POST", `/api/mrd/retention/${fresh.id}/dispose`, { note: "no" })).status, 409, "only a due document can be reviewed");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/retention/${clinical.id}/extend`, { until: addDays(today(), -1), note: "past date" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/retention/${clinical.id}/extend`, { until: addDays(today(), 30) })).status, 422, "a reason is needed");
  const ext = await as(ADMIN, "POST", `/api/mrd/retention/${clinical.id}/extend`, { until: addDays(today(), 30), note: "Medico-legal case open" });
  assert.equal(ext.status, 200, JSON.stringify(ext.error));
  const q2 = (await as(ADMIN, "GET", "/api/mrd/retention")).data;
  assert.ok(!q2.items.some((i: any) => i.id === clinical.id), "an extended document leaves the queue");
  assert.equal(((await documentsRepo.getRow(clinical.id)) as any).retain_until, addDays(today(), 30));

  const gone = await as(ADMIN, "POST", `/api/mrd/retention/${financial.id}/dispose`, { note: "Past 8 years, approved by finance" });
  assert.equal(gone.status, 204, JSON.stringify(gone.error));
  assert.equal(await documentsRepo.getRow(financial.id), null);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/retention/${financial.id}/dispose`, { note: "again" })).status, 404);
  const { rows: audit } = await auditRepo.listRows({ unpaged: true, filters: [{ column: "action", op: "eq", value: "retention-dispose" }] });
  const line = audit.find((a) => a.entity_id === String(financial.id));
  assert.ok(line, "the audit log keeps what was destroyed");
  assert.deepEqual([(line!.meta as any).fileName, (line!.meta as any).note], [financial.file_name, "Past 8 years, approved by finance"]);
});

test("folders: names are unique, files go in by upload, and a folder with documents can't be deleted", async () => {
  const folders0 = (await as(ADMIN, "GET", "/api/mrd/folders")).data as any[];
  assert.deepEqual(folders0.slice(0, 1).map((f) => f.documentCount), [0]);
  const made = await as(ADMIN, "POST", "/api/mrd/folders", { name: "Discharge summaries 2026", class: "Clinical", description: "By month" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(ADMIN, "POST", "/api/mrd/folders", { name: "discharge summaries 2026" })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/folders", { name: "Odd", class: "Secret" })).status, 422);

  const p = await newPatient();
  const form = new FormData();
  form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "summary.png", { type: "image/png" }));
  form.set("patientId", String(p.id));
  form.set("category", "Discharge summary");
  const up = await as(ADMIN, "POST", `/api/mrd/folders/${made.data.id}/upload`, undefined, form);
  assert.equal(up.status, 201, JSON.stringify(up.error));
  const docs = (await as(ADMIN, "GET", `/api/mrd/folders/${made.data.id}/documents`)).data as any[];
  assert.deepEqual([docs.length, docs[0].fileName, docs[0].patientName, docs[0].retentionState], [1, "summary.png", p.name, "Active"]);
  assert.equal(((await as(ADMIN, "GET", "/api/mrd/folders")).data as any[]).find((f) => f.id === made.data.id).documentCount, 1);
  assert.equal((await as(ADMIN, "DELETE", `/api/mrd/folders/${made.data.id}`)).status, 409);
  const bad = new FormData(); bad.set("file", new File(["x"], "a.png", { type: "image/png" })); bad.set("patientId", String(p.id));
  assert.equal((await as(ADMIN, "POST", "/api/mrd/folders/99999/upload", undefined, bad)).status, 404);

  const unfile = await as(ADMIN, "POST", `/api/mrd/documents/${up.data.id}/file`, { folderId: null });
  assert.equal(unfile.status, 204);
  assert.equal(((await as(ADMIN, "GET", `/api/mrd/folders/${made.data.id}/documents`)).data as any[]).length, 0);
  assert.equal((await as(ADMIN, "DELETE", `/api/mrd/folders/${made.data.id}`)).status, 204);
});

// ── Coding ───────────────────────────────────────────────────────────────────

const cases = async () => (await as(ADMIN, "GET", "/api/mrd/coding?all=true")).data as any[];

test("discharged admissions are in the coding queue; discharging one adds it", async () => {
  const q = await cases();
  assert.ok(q.length >= 2, "the seeded discharges are queued");
  assert.ok(q.every((c) => /^ADM\//.test(c.admissionNo)));
  assert.ok(q.some((c) => c.status === "Signed off") && q.some((c) => c.status === "Pending"));
  const admitted = ((await as(ADMIN, "GET", "/api/ipd?all=true")).data as any[]).find((a) => a.status !== "Discharged");
  assert.ok(admitted);
  assert.ok(!q.some((c) => c.admissionId === admitted.id));
  const d = await as(ADMIN, "POST", `/api/ipd/${admitted.id}/discharge`);
  assert.equal(d.status, 200, JSON.stringify(d.error));
  const after = await cases();
  const mine = after.find((c) => c.admissionId === admitted.id);
  assert.ok(mine, "joined the queue at discharge");
  assert.deepEqual([mine.status, mine.principalDxCode, mine.principalDxText.length > 0, mine.openDeficiencies], ["Pending", "", true, 0]);
  assert.equal(after.length, q.length + 1);
  const again = await cases();
  assert.equal(again.length, after.length, "reading the queue again doesn't duplicate it");
  const byStatus = (await as(ADMIN, "GET", "/api/mrd/coding?all=true&status=Pending")).data as any[];
  assert.ok(byStatus.every((c) => c.status === "Pending"));
  const bySearch = (await as(ADMIN, "GET", `/api/mrd/coding?all=true&search=${encodeURIComponent(mine.admissionNo)}`)).data as any[];
  assert.equal(bySearch[0].id, mine.id);
});

test("coding: codes are checked, a chart goes pending → in review → coded → signed off, and a signed-off chart is locked", async () => {
  const c = (await cases()).find((x) => x.status === "Pending")!;
  const bad = await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "banana" });
  assert.equal(bad.status, 422);
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "E03.9", secondaryDx: [{ code: "E03.9", text: "dup" }] })).status, 422, "the principal isn't also a secondary");
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "E03.9", secondaryDx: [{ code: "I10" }, { code: "I10" }] })).status, 422, "no duplicates");
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "E03.9", procedures: [{ code: "x" }] })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/coded`)).status, 409, "needs a principal diagnosis");

  const saved = await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "e03.9", principalDxText: "Hypothyroidism, unspecified", secondaryDx: [{ code: "i10", text: "Hypertension" }], procedures: [{ code: "0QSG04Z", text: "ORIF tibia" }] });
  assert.equal(saved.status, 200, JSON.stringify(saved.error));
  assert.deepEqual([saved.data.status, saved.data.principalDxCode, saved.data.secondaryDx[0].code, saved.data.coderName], ["In review", "E03.9", "I10", "Dr. Kevin Carter"], "upper-cased, and the first save starts the review");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/start`)).status, 409, "already in review");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/sign-off`)).status, 409, "only a coded chart is signed off");

  const coded = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/coded`);
  assert.equal(coded.status, 200, JSON.stringify(coded.error));
  assert.deepEqual([coded.data.status, coded.data.codedAt !== null], ["Coded", true]);
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "E11.9" })).status, 409, "a coded chart is locked");
  const signed = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/sign-off`);
  assert.deepEqual([signed.status, signed.data.status, signed.data.signedOffBy], [200, "Signed off", "Dr. Kevin Carter"]);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/sign-off`)).status, 409);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/deficiencies`, { kind: "Consent form missing" })).status, 409, "reopen before raising one");

  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/reopen`, {})).status, 422, "a reason is needed");
  const reopened = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/reopen`, { reason: "Principal diagnosis was wrong" });
  assert.deepEqual([reopened.status, reopened.data.status, reopened.data.signedOffBy, reopened.data.codedAt], [200, "In review", null, null]);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/reopen`, { reason: "again please" })).status, 409, "only a coded or signed-off chart can be reopened");
});

test("a deficiency stops a chart being coded until it is resolved", async () => {
  const c = (await cases()).find((x) => x.status === "Pending")!;
  await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "J18.9" });
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/deficiencies`, { kind: "Made up" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/deficiencies`, { kind: "Other" })).status, 422, "'Other' needs a note");
  const d1 = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/deficiencies`, { kind: "Discharge summary missing", note: "Not in the file" });
  const d2 = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/deficiencies`, { kind: "Consent form missing" });
  assert.deepEqual([d1.status, d1.data.status, d1.data.raisedBy], [201, "Open", "Dr. Kevin Carter"]);
  const row = (await as(ADMIN, "GET", `/api/mrd/coding/${c.id}`)).data;
  assert.deepEqual([row.status, row.openDeficiencies], ["Deficient", 2]);
  const blocked = await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/coded`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /2 open deficiencies/);
  assert.equal((await as(ADMIN, "PATCH", `/api/mrd/coding/${c.id}`, { principalDxCode: "J18.0" })).data.status, "Deficient", "coding can continue while deficient");

  const sum = (await as(ADMIN, "GET", "/api/mrd/coding/summary")).data;
  assert.ok(sum.deficient >= 1 && sum.openDeficiencies >= 2);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/deficiencies/${d1.data.id}/resolve`)).data.status, "Resolved");
  assert.equal((await as(ADMIN, "GET", `/api/mrd/coding/${c.id}`)).data.status, "Deficient", "one is still open");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/deficiencies/${d1.data.id}/resolve`)).status, 409);
  await as(ADMIN, "POST", `/api/mrd/deficiencies/${d2.data.id}/resolve`);
  assert.equal((await as(ADMIN, "GET", `/api/mrd/coding/${c.id}`)).data.status, "In review", "the last one resolved puts it back in review");
  const list = (await as(ADMIN, "GET", `/api/mrd/coding/${c.id}/deficiencies`)).data as any[];
  assert.deepEqual(list.map((d) => d.status), ["Resolved", "Resolved"]);
  assert.equal((await as(ADMIN, "POST", `/api/mrd/coding/${c.id}/coded`)).data.status, "Coded");
});

test("the coding dashboard counts each state, open deficiencies and pending file requests", async () => {
  const list = await cases();
  const s = (await as(ADMIN, "GET", "/api/mrd/coding/summary")).data;
  const n = (st: string) => list.filter((c) => c.status === st).length;
  assert.deepEqual(
    [s.awaitingCoding, s.pending, s.deficient, s.coded, s.signedOff],
    [n("Pending") + n("In review"), n("Pending"), n("Deficient"), n("Coded"), n("Signed off")],
  );
  assert.equal(s.openDeficiencies, list.reduce((a, c) => a + c.openDeficiencies, 0));
  assert.equal(s.pendingFileRequests, (await requests()).filter((r) => r.status === "Pending").length);
});

// ── Registers ────────────────────────────────────────────────────────────────

const birth = (over: Record<string, unknown> = {}) => ({ motherName: "Sita Rao", babySex: "female", timeOfBirth: "06:15", deliveryType: "Normal vaginal", weightG: "3000", ...over });

test("a birth entry needs the mother, the baby's sex, time and delivery; numbers run in sequence", async () => {
  const reg0 = (await as(ADMIN, "GET", "/api/mrd/registers/birth")).data;
  assert.equal(reg0.title, "Birth register");
  assert.deepEqual(reg0.fields.filter((f: any) => f.required).map((f: any) => f.key), ["motherName", "babySex", "timeOfBirth", "deliveryType"]);
  const bad: [string, Record<string, unknown>][] = [
    ["no mother", { motherName: "" }], ["no sex", { babySex: "" }], ["sex not on the list", { babySex: "robot" }], ["no time", { timeOfBirth: "" }],
    ["time not a time", { timeOfBirth: "25:99" }], ["no delivery", { deliveryType: "" }], ["weight in kilos", { weightG: "3" }], ["weight not a number", { weightG: "heavy" }],
    ["future entry date", { entryDate: addDays(today(), 3) }],
  ];
  for (const [why, over] of bad) assert.equal((await as(ADMIN, "POST", "/api/mrd/registers/birth", birth(over))).status, 422, why);
  const a = await as(ADMIN, "POST", "/api/mrd/registers/birth", birth({ reportTo: "Municipal registrar" }));
  assert.equal(a.status, 201, JSON.stringify(a.error));
  assert.deepEqual([a.data.entryDate, a.data.reportTo, a.data.filedBy, a.data.supersededBy], [today(), "Municipal registrar", "Dr. Kevin Carter", null]);
  const b = await as(ADMIN, "POST", "/api/mrd/registers/birth", birth({ motherName: "Gita Rao" }));
  assert.equal(Number(b.data.entryNo.slice(-5)), Number(a.data.entryNo.slice(-5)) + 1);
  assert.match(a.data.entryNo, /^BR\/\d{2}\/\d{5}$/);
  const death = await as(ADMIN, "POST", "/api/mrd/registers/death", { deceasedName: "R. Mehta", sex: "male", age: "62", timeOfDeath: "02:20", causeOfDeath: "Cardiac arrest" });
  assert.match(death.data.entryNo, /^DR\/\d{2}\/\d{5}$/);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/registers/death", { deceasedName: "R. Mehta" })).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/mrd/registers/marriage")).status, 404);
  assert.equal((await as(ADMIN, "POST", "/api/mrd/registers/marriage", {})).status, 404);
  const after = (await as(ADMIN, "GET", "/api/mrd/registers/birth")).data;
  assert.equal(after.entries.length, reg0.entries.length + 2);
  assert.ok(after.entries.every((e: any) => e.register === "birth"), "births and deaths are kept apart");
});

test("two entries filed at once get different numbers", async () => {
  const rs = await Promise.all([1, 2, 3, 4].map((i) => as(ADMIN, "POST", "/api/mrd/registers/birth", birth({ motherName: `Parallel ${i}` }))));
  assert.ok(rs.every((r) => r.status === 201), JSON.stringify(rs.map((r) => r.error)));
  assert.equal(new Set(rs.map((r) => r.data.entryNo)).size, 4);
});

test("entries are permanent: a correction is a new entry that supersedes the old one, which stays readable", async () => {
  const a = (await as(ADMIN, "POST", "/api/mrd/registers/birth", birth({ motherName: "Mistyped Name", weightG: "3100" }))).data;
  assert.ok([404, 405].includes((await as(ADMIN, "PATCH", `/api/mrd/registers/birth/${a.id}`, birth())).status), "no editing in place");
  assert.ok([404, 405].includes((await as(ADMIN, "DELETE", `/api/mrd/registers/birth/${a.id}`)).status), "no deleting");
  assert.equal((await as(ADMIN, "POST", `/api/mrd/registers/birth/${a.id}/amend`, birth({ motherName: "Corrected Name" }))).status, 422, "a reason is required");
  const fix = await as(ADMIN, "POST", `/api/mrd/registers/birth/${a.id}/amend`, birth({ motherName: "Corrected Name", weightG: "3100", amendmentReason: "Spelling of mother's name" }));
  assert.equal(fix.status, 201, JSON.stringify(fix.error));
  assert.deepEqual([fix.data.amendsId, fix.data.data.motherName, fix.data.data.amendmentReason], [a.id, "Corrected Name", "Spelling of mother's name"]);
  const reg = (await as(ADMIN, "GET", "/api/mrd/registers/birth")).data;
  const old = reg.entries.find((e: any) => e.id === a.id);
  assert.deepEqual([old.supersededBy, old.data.motherName, old.entryNo], [fix.data.id, "Mistyped Name", a.entryNo], "the original is kept, unchanged");
  const second = await as(ADMIN, "POST", `/api/mrd/registers/birth/${a.id}/amend`, birth({ amendmentReason: "again" }));
  assert.equal(second.status, 409);
  assert.match(second.error!.message, new RegExp(a.entryNo));
  assert.equal((await as(ADMIN, "POST", `/api/mrd/registers/death/${a.id}/amend`, {})).status, 404, "an entry is only amended in its own register");
  assert.equal((await as(ADMIN, "POST", "/api/mrd/registers/birth/99999/amend", birth())).status, 404);
});

test("the printout window keeps only recent entries", async () => {
  const old = await as(ADMIN, "POST", "/api/mrd/registers/birth", birth({ motherName: "Long Ago", entryDate: "2020-01-15" }));
  assert.equal(old.status, 201);
  const all = (await as(ADMIN, "GET", "/api/mrd/registers/birth")).data.entries;
  const recent = (await as(ADMIN, "GET", "/api/mrd/registers/birth?months=12")).data.entries;
  assert.ok(all.some((e: any) => e.id === old.data.id));
  assert.ok(!recent.some((e: any) => e.id === old.data.id), "a 2020 entry is outside 12 months");
  assert.ok(recent.length > 0 && recent.length < all.length);
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: doctors can look but not change; the front desk and billing have no access", async () => {
  const f = await availableFile();
  const ns = await nurseStation();
  for (const path of ["/api/mrd/files", "/api/mrd/requests", "/api/mrd/locations", "/api/mrd/policies", "/api/mrd/folders", "/api/mrd/retention", "/api/mrd/coding", "/api/mrd/registers/birth", "/api/mrd/files/summary"]) {
    assert.equal((await as(DOCTOR, "GET", path)).status, 200, `doctor reads ${path}`);
    assert.equal((await as(RECEPTION, "GET", path)).status, 403, `front desk ${path}`);
    assert.equal((await as(BILLING, "GET", path)).status, 403, `billing ${path}`);
  }
  assert.equal((await as(DOCTOR, "POST", `/api/mrd/files/${f.id}/checkout`, { holder: "Dr. X", locationId: ns.id, dueOn: addDays(today(), 1) })).status, 403);
  assert.equal((await as(DOCTOR, "POST", "/api/mrd/requests", { fileId: f.id })).status, 403);
  assert.equal((await as(DOCTOR, "POST", "/api/mrd/registers/birth", birth())).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/mrd/folders", { name: "Nope" })).status, 403);
  assert.equal((await request("GET", "/api/mrd/files")).status, 401, "signed-in staff only");
});

// ── Run ──────────────────────────────────────────────────────────────────────

let passed = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log(`  PASS  ${t.name}`);
  } catch (e) {
    console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 6).join("\n        ")}`);
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
