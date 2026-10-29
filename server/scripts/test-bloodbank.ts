/**
 * Tests for the blood bank: donors (ID proofs kept as type + last 4), unit collection, the five-test serology gate,
 * component processing, discards, cross-match reservation (including two requests at once), issue, returns,
 * reactions, the statutory registers, and permissions. In-process, in-memory database.
 *
 *   npm run test:bloodbank
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { abCompatible, withUnitLocks } = await import("@/services/bloodbank-rules");
const { bloodUnitsRepo, bloodTransfusionsRepo } = await import("@/repositories");
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
const LAB = "sunita.rao@samvaadhospital.in"; // Lab Technician
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const CLEAR = { hiv: "Negative", hbsag: "Negative", hcv: "Negative", malaria: "Negative", syphilis: "Negative" };
const iso = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
let seq = 0;

const newDonor = async (over: Record<string, unknown> = {}) =>
  (await as(ADMIN, "POST", "/api/blood-bank/donors", {
    name: `Test Donor ${++seq}`, gender: "Male", bloodGroup: "O+", dob: iso(-11000), phone: `98${String(10000000 + seq)}`, idProofType: "pan", idProofLast4: "7539", ...over,
  }));
const collect = async (over: Record<string, unknown> = {}) => {
  const donor = (await newDonor({ bloodGroup: (over.bloodGroup as string) ?? "O+" })).data;
  return as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", donorId: donor.id, bloodGroup: donor.bloodGroup, component: "Whole blood", ...over });
};
/** A cleared, available unit of the given group and component. */
const available = async (bloodGroup = "O+", component = "Whole blood") => {
  const u = (await collect({ bloodGroup, component })).data;
  const r = await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/serology`, CLEAR);
  assert.equal(r.data.status, "Available", JSON.stringify(r.error));
  return r.data;
};
const patient = async (bloodGroup: string | null) => {
  const p = (await as(ADMIN, "GET", "/api/patients?all=true")).data[0];
  await as(ADMIN, "PATCH", `/api/patients/${p.id}`, { bloodGroup: bloodGroup ?? undefined });
  return p;
};

// ── Pure rules ───────────────────────────────────────────────────────────────

test("ABO / Rh compatibility: red cells, plasma, platelets and a patient whose group isn't known", async () => {
  const red = (p: string, u: string) => abCompatible(p, u, "PRBC").ok;
  assert.ok(red("A+", "O-") && red("A+", "A+") && red("AB+", "B-") && red("O+", "O+"));
  assert.ok(!red("A+", "B+") && !red("O+", "A+") && !red("A-", "A+"), "wrong ABO, or Rh-positive red cells to an Rh-negative patient");
  assert.match(abCompatible("B+", "A+", "Whole blood").reason, /ABO/);
  const plasma = (p: string, u: string) => abCompatible(p, u, "Plasma").ok;
  assert.ok(plasma("A+", "AB+") && plasma("O+", "O-") && plasma("O+", "A+") && !plasma("A+", "B+"), "plasma is matched the other way round");
  assert.ok(abCompatible("A+", "B+", "Platelets").ok, "platelets aren't strictly matched");
  assert.ok(abCompatible(null, "B+", "PRBC").ok && abCompatible("", "B+", "PRBC").ok, "no recorded group → can't be checked");
});

test("the per-unit lock runs requests for one unit one after the other", async () => {
  const order: string[] = [];
  await Promise.all([
    withUnitLocks([901], async () => { order.push("a-start"); await new Promise((r) => setTimeout(r, 30)); order.push("a-end"); }),
    withUnitLocks([901], async () => { order.push("b-start"); order.push("b-end"); }),
    withUnitLocks([902], async () => { order.push("c"); }),
  ]);
  assert.ok(order.indexOf("a-end") < order.indexOf("b-start"), "b waited for a");
  assert.ok(order.indexOf("c") < order.indexOf("a-end"), "a different unit isn't held up");
});

// ── Seed ─────────────────────────────────────────────────────────────────────

test("the seeded blood bank has stock in every state and a stock summary per group", async () => {
  const s = (await as(ADMIN, "GET", "/api/blood-bank/stock")).data;
  assert.deepEqual(s.groups.map((g: any) => g.bloodGroup), ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  assert.ok(s.groups.reduce((n: number, g: any) => n + g.available, 0) > 10);
  assert.ok(s.groups.some((g: any) => g.expiringSoon > 0), "something expires within a week");
  assert.ok(s.quarantined > 0 && s.expiredInStock > 0);
  const units = (await as(ADMIN, "GET", "/api/blood-bank/units?all=true")).data;
  for (const status of ["Quarantined", "Available", "Cross-matched", "Issued", "Processed", "Discarded"]) assert.ok(units.some((u: any) => u.status === status), status);
  assert.match(units[0].unitNo, /^BU\/\d{2}\/\d{5}$/);
  assert.ok(units[0].id > units[units.length - 1].id, "newest first");
});

// ── Donors ───────────────────────────────────────────────────────────────────

test("a donor is registered with a donor number, and only the ID type and last 4 are kept", async () => {
  const r = await newDonor({ aadhaarNumber: "123456789012", idProofType: "aadhaar", idProofLast4: "9012" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.match(r.data.donorNo, /^BD\/\d{2}\/\d{5}$/);
  assert.deepEqual([r.data.idProofType, r.data.idProofLast4, r.data.status, r.data.totalDonations, r.data.age], ["aadhaar", "9012", "Eligible", 0, 30]);
  assert.ok(!JSON.stringify(r.data).includes("123456789012"), "the full number is nowhere in the response");
  const next = await newDonor();
  assert.equal(Number(next.data.donorNo.slice(-5)), Number(r.data.donorNo.slice(-5)) + 1);
  // The list maps every row; a mapper that takes extra arguments must not be handed the array index.
  const list = await as(ADMIN, "GET", "/api/blood-bank/donors?all=true");
  assert.equal(list.status, 200, JSON.stringify(list.error));
  assert.ok(list.data.length >= 2 && list.data.every((d: { age: number }) => Number.isFinite(d.age)));
});

test("a donor must be 18–65, and an ID proof is the type and exactly 4 characters, both or neither", async () => {
  for (const bad of [{ dob: iso(-365 * 16) }, { dob: iso(-365 * 70) }, { dob: "last year" }, { idProofLast4: "123456789012" }, { idProofLast4: "12" }, { idProofType: undefined }, { idProofLast4: undefined }, { gender: "Robot" }, { bloodGroup: "C+" }, { name: "x" }]) {
    const r = await newDonor(bad);
    assert.equal(r.status, 422, JSON.stringify(bad));
  }
  assert.equal((await newDonor({ idProofType: undefined, idProofLast4: undefined })).status, 201, "an ID proof is optional");
});

test("a donor can be deferred with a reason, and the deferral lifted; one with units can't be deleted", async () => {
  const d = (await newDonor()).data;
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/donors/${d.id}/defer`, { reason: "x" })).status, 422);
  const deferred = (await as(ADMIN, "POST", `/api/blood-bank/donors/${d.id}/defer`, { reason: "Low haemoglobin" })).data;
  assert.deepEqual([deferred.status, deferred.deferralReason], ["Deferred", "Low haemoglobin"]);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/donors/${d.id}/lift`)).data.status, "Eligible");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/donors/${d.id}/defer`, { reason: "Travel", until: iso(-1) })).status, 422, "an end date must be in the future");
  const withUnit = (await collect()).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/blood-bank/donors/${withUnit.donorId}`)).status, 409, "traceability");
  assert.equal((await as(ADMIN, "DELETE", `/api/blood-bank/donors/${d.id}`)).status, 204);
});

test("a deferral with an end date lapses by itself", async () => {
  const d = (await newDonor()).data;
  await as(ADMIN, "POST", `/api/blood-bank/donors/${d.id}/defer`, { reason: "Fever", until: iso(2) });
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/donors/${d.id}`)).data.status, "Deferred");
  const { bloodDonorsRepo } = await import("@/repositories");
  await bloodDonorsRepo.update(d.id, { deferred_until: iso(-1) });
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/donors/${d.id}`)).data.status, "Eligible");
});

// ── Collection ───────────────────────────────────────────────────────────────

test("collecting a unit mints its number, starts it in quarantine with the right shelf life, and updates the donor", async () => {
  const donor = (await newDonor({ bloodGroup: "B+" })).data;
  const r = await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", donorId: donor.id, bloodGroup: "B+", component: "Whole blood", volumeMl: 350, bagNo: `BAG-T-${++seq}` });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const u = r.data;
  assert.match(u.unitNo, /^BU\/\d{2}\/\d{5}$/);
  assert.deepEqual([u.status, u.component, u.volumeMl, u.collectedOn, u.expiryOn, u.donorNo, u.serologyDone], ["Quarantined", "Whole blood", 350, iso(0), iso(35), donor.donorNo, false]);
  assert.deepEqual(u.serology, { hiv: "", hbsag: "", hcv: "", malaria: "", syphilis: "" });
  const after = (await as(ADMIN, "GET", `/api/blood-bank/donors/${donor.id}`)).data;
  assert.deepEqual([after.totalDonations, after.lastDonationDate], [1, iso(0)]);
  const platelets = (await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Purchased", supplier: "City Blood Centre", bloodGroup: "A+", component: "Platelets" })).data;
  assert.deepEqual([platelets.expiryOn, platelets.volumeMl, platelets.supplier], [iso(5), 60, "City Blood Centre"], "platelets keep 5 days");
});

test("collection rules: deferred donors, the gap between donations, group matching, purchased needs a supplier, bag numbers are unique", async () => {
  const deferred = (await newDonor()).data;
  await as(ADMIN, "POST", `/api/blood-bank/donors/${deferred.id}/defer`, { reason: "Anaemia" });
  const blocked = await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", donorId: deferred.id, bloodGroup: "O+" });
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /deferred/);
  const first = (await collect()).data;
  const again = await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", donorId: first.donorId, bloodGroup: "O+" });
  assert.equal(again.status, 409);
  assert.match(again.error!.message, /next eligible/);
  const donor = (await newDonor({ bloodGroup: "A-" })).data;
  assert.equal((await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", donorId: donor.id, bloodGroup: "B+" })).status, 422, "the unit's group must be the donor's");
  assert.equal((await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Donation", bloodGroup: "O+" })).status, 422, "a donation needs a donor");
  assert.equal((await as(ADMIN, "POST", "/api/blood-bank/units", { source: "Purchased", bloodGroup: "O+" })).status, 422, "a purchase needs a supplier");
  const bag = `BAG-DUP-${++seq}`;
  assert.equal((await collect({ bagNo: bag })).status, 201);
  assert.equal((await collect({ bagNo: bag })).status, 409);
});

// ── Serology ─────────────────────────────────────────────────────────────────

test("all five tests negative clear a unit for use; the result is recorded with who and when", async () => {
  const u = (await collect()).data;
  const r = await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/serology`, CLEAR);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.serologyDone, r.data.serology.hiv], ["Available", true, "Negative"]);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/serology`, CLEAR)).status, 409, "only a unit in quarantine");
});

test("serology needs all five results, each Negative or Reactive", async () => {
  const u = (await collect()).data;
  for (const bad of [{}, { ...CLEAR, hiv: undefined }, { ...CLEAR, hiv: "Maybe" }, { ...CLEAR, malaria: "" }]) {
    assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/serology`, bad)).status, 422, JSON.stringify(bad));
  }
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${u.id}`)).data.status, "Quarantined", "nothing changed");
});

test("any reactive result discards the unit, with the reason, and every unit from the same donation", async () => {
  const wb = (await collect()).data;
  const kids = (await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, { components: ["PRBC", "Plasma"] })).data;
  assert.equal(kids.length, 2);
  assert.ok(kids.every((k: any) => k.status === "Quarantined" && k.rootUnitId === wb.rootUnitId), "components of a quarantined unit wait too");
  const r = await as(ADMIN, "POST", `/api/blood-bank/units/${kids[0].id}/serology`, { ...CLEAR, hiv: "Reactive", hcv: "Reactive" });
  assert.deepEqual([r.data.status, r.data.discardReason], ["Discarded", "Reactive serology: HIV, HCV"]);
  const sibling = (await as(ADMIN, "GET", `/api/blood-bank/units/${kids[1].id}`)).data;
  assert.deepEqual([sibling.status, sibling.discardReason], ["Discarded", "Reactive serology: HIV, HCV"]);
});

test("a clear result on one component clears its siblings from the same donation", async () => {
  const wb = (await collect()).data;
  const kids = (await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, {})).data;
  assert.equal(kids.length, 3);
  await as(ADMIN, "POST", `/api/blood-bank/units/${kids[2].id}/serology`, CLEAR);
  for (const k of kids) assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${k.id}`)).data.status, "Available", k.component);
});

// ── Processing ───────────────────────────────────────────────────────────────

test("processing whole blood makes components with their own numbers and shelf lives, and closes the parent", async () => {
  const wb = await available("A+");
  const kids = (await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, { components: ["PRBC", "Platelets", "Plasma"] })).data;
  assert.deepEqual(kids.map((k: any) => k.component), ["PRBC", "Platelets", "Plasma"]);
  assert.deepEqual(kids.map((k: any) => k.expiryOn), [iso(42), iso(5), iso(365)], "from the collection date");
  assert.ok(kids.every((k: any) => k.status === "Available" && k.parentUnitId === wb.id && k.bloodGroup === "A+" && k.serologyDone));
  assert.equal(new Set(kids.map((k: any) => k.unitNo)).size, 3);
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${wb.id}`)).data.status, "Processed");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, {})).status, 409, "already processed");
});

test("only whole blood in date can be processed, and only into the separable components", async () => {
  const prbc = await available("O+", "PRBC");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${prbc.id}/process`, {})).status, 409);
  const wb = await available("O+");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, { components: ["Cryoprecipitate"] })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, { components: [] })).status, 422);
  await bloodUnitsRepo.update(wb.id, { expiry_on: iso(-1) });
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${wb.id}/process`, {})).status, 409, "expired");
});

// ── Discard ──────────────────────────────────────────────────────────────────

test("a unit is discarded for a recorded reason; 'Other' needs a note; a finished unit can't be discarded again", async () => {
  const u = await available();
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/discard`, { reason: "Whim" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/discard`, { reason: "Other" })).status, 422);
  const r = await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/discard`, { reason: "Bag leak or damage", note: "Seam split" });
  assert.deepEqual([r.data.status, r.data.discardReason], ["Discarded", "Bag leak or damage: Seam split"]);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${u.id}/discard`, { reason: "Expired" })).status, 409);
});

// ── Cross-match ──────────────────────────────────────────────────────────────

test("requesting a cross-match holds the unit; a second request for it is told who holds it", async () => {
  const p = await patient("O+");
  const u = await available("O+");
  const xm = await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: u.id });
  assert.equal(xm.status, 201, JSON.stringify(xm.error));
  assert.match(xm.data.xmNo, /^XM\/\d{2}\/\d{5}$/);
  assert.deepEqual([xm.data.status, xm.data.result, xm.data.unitNo, xm.data.patientName, xm.data.requestedBy], ["requested", "pending", u.unitNo, p.name, "Dr. Kevin Carter"]);
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${u.id}`)).data.status, "Cross-matched");
  const second = await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: u.id });
  assert.equal(second.status, 409);
  assert.ok(second.error!.message.includes(xm.data.xmNo) && second.error!.message.includes(p.name), second.error!.message);
});

test("two simultaneous requests for the same unit resolve to exactly one winner", async () => {
  const p = await patient("O+");
  const u = await available("O+");
  const results = await Promise.all([1, 2, 3, 4].map(() => as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: u.id })));
  assert.equal(results.filter((r) => r.status === 201).length, 1, results.map((r) => r.status).join());
  assert.equal(results.filter((r) => r.status === 409).length, 3);
  const open = (await as(ADMIN, "GET", `/api/blood-bank/crossmatches?all=true&search=${u.unitNo}`)).data.filter((x: any) => x.status === "requested");
  assert.equal(open.length, 1, "one open cross-match for the unit");
});

test("only an available, in-date, fully cleared and ABO / Rh compatible unit can be cross-matched", async () => {
  const p = await patient("A-");
  const quarantined = (await collect()).data;
  const q = await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: quarantined.id });
  assert.equal(q.status, 409);
  assert.match(q.error!.message, /quarantined/);
  const expired = await available("A-");
  await bloodUnitsRepo.update(expired.id, { expiry_on: iso(-1) });
  assert.match((await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: expired.id })).error!.message, /expired/);
  const wrong = await available("B+", "PRBC");
  const w = await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: wrong.id });
  assert.equal(w.status, 409);
  assert.match(w.error!.message, /ABO/);
  const rhPositive = await available("A+", "PRBC");
  assert.match((await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: rhPositive.id })).error!.message, /Rh-negative/);
  assert.equal((await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: 99999, unitId: wrong.id })).status, 404);
});

test("a compatible result lets the unit be issued; an incompatible one frees it at once", async () => {
  const p = await patient("O+");
  const good = await available("O+");
  const xm = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: good.id })).data;
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/issue`)).status, 409, "no result yet");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/result`, { result: "maybe" })).status, 422);
  const resulted = (await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/result`, { result: "compatible" })).data;
  assert.deepEqual([resulted.status, resulted.result, resulted.resultBy], ["resulted", "compatible", "Dr. Kevin Carter"]);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/result`, { result: "incompatible" })).status, 409, "result already entered");

  const bad = await available("O+");
  const xm2 = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: bad.id })).data;
  const inc = (await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm2.id}/result`, { result: "incompatible" })).data;
  assert.deepEqual([inc.status, inc.result], ["resulted", "incompatible"]);
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${bad.id}`)).data.status, "Available", "released");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm2.id}/issue`)).status, 409, "an incompatible unit is never issued");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm2.id}/cancel`)).data.status, "cancelled");
});

test("cancelling a cross-match releases the unit; discarding a held unit cancels its cross-match", async () => {
  const p = await patient("O+");
  const a = await available("O+");
  const xa = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: a.id })).data;
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xa.id}/cancel`)).data.status, "cancelled");
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${a.id}`)).data.status, "Available");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xa.id}/cancel`)).status, 409);
  const b = await available("O+");
  const xb = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: b.id })).data;
  await as(ADMIN, "POST", `/api/blood-bank/units/${b.id}/discard`, { reason: "Cold chain break" });
  const list = (await as(ADMIN, "GET", "/api/blood-bank/crossmatches?all=true")).data;
  assert.equal(list.find((x: any) => x.id === xb.id).status, "cancelled");
});

// ── Issue and transfusion ────────────────────────────────────────────────────

const issued = async (group = "O+") => {
  const p = await patient(group);
  const u = await available(group);
  const xm = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: u.id })).data;
  await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/result`, { result: "compatible" });
  const r = await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/issue`);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return { issue: r.data, unit: u, xm, patient: p };
};

test("issuing a compatible cross-match opens a transfusion record and moves the unit out of stock", async () => {
  const { issue, unit, xm, patient: p } = await issued();
  assert.match(issue.issueNo, /^BI\/\d{2}\/\d{5}$/);
  assert.deepEqual([issue.unitNo, issue.patientName, issue.crossmatchId, issue.transfusedAt, issue.disposition, issue.reactions], [unit.unitNo, p.name, xm.id, null, "", []]);
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${unit.id}`)).data.status, "Issued");
  assert.equal((await as(ADMIN, "GET", "/api/blood-bank/crossmatches?all=true")).data.find((x: any) => x.id === xm.id).status, "issued");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/issue`)).status, 409, "not twice");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/units/${unit.id}/discard`, { reason: "Expired" })).status, 409, "an issued unit can't be discarded");
  assert.equal((await as(ADMIN, "POST", "/api/blood-bank/issues", {})).status, 405, "issues are only made from cross-matches, never directly");
});

test("a unit that expired while cross-matched can't be issued", async () => {
  const p = await patient("O+");
  const u = await available("O+");
  const xm = (await as(ADMIN, "POST", "/api/blood-bank/crossmatches", { patientId: p.id, unitId: u.id })).data;
  await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/result`, { result: "compatible" });
  await bloodUnitsRepo.update(u.id, { expiry_on: iso(-1) });
  const r = await as(ADMIN, "POST", `/api/blood-bank/crossmatches/${xm.id}/issue`);
  assert.equal(r.status, 409);
  assert.match(r.error!.message, /expired/);
});

test("a transfusion is marked done once; a returned unit can't also be transfused", async () => {
  const { issue } = await issued();
  const done = await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/transfused`);
  assert.equal(done.status, 200);
  assert.ok(done.data.transfusedAt && done.data.transfusedBy);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/transfused`)).status, 409);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/return`, { restock: true })).status, 409, "already transfused");
});

test("a unit returned within the cold-chain window can be restocked; later, or if not restocked, it is wasted", async () => {
  const fresh = await issued();
  const back = await as(ADMIN, "POST", `/api/blood-bank/issues/${fresh.issue.id}/return`, { restock: true });
  assert.equal(back.status, 200, JSON.stringify(back.error));
  assert.equal(back.data.disposition, "returned · restock");
  assert.equal((await as(ADMIN, "GET", `/api/blood-bank/units/${fresh.unit.id}`)).data.status, "Available", "back on the shelf");
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/issues/${fresh.issue.id}/return`, { restock: true })).status, 409, "once");

  const late = await issued();
  await bloodTransfusionsRepo.update(late.issue.id, { issued_at: new Date(Date.now() - 45 * 60_000).toISOString() });
  const refused = await as(ADMIN, "POST", `/api/blood-bank/issues/${late.issue.id}/return`, { restock: true });
  assert.equal(refused.status, 409);
  assert.match(refused.error!.message, /30-minute window/);
  const wasted = await as(ADMIN, "POST", `/api/blood-bank/issues/${late.issue.id}/return`, { restock: false });
  assert.equal(wasted.data.disposition, "returned · wasted");
  const unit = (await as(ADMIN, "GET", `/api/blood-bank/units/${late.unit.id}`)).data;
  assert.deepEqual([unit.status, unit.discardReason], ["Discarded", "Returned unused — outside window"]);
});

test("a transfusion reaction is recorded with its kind and severity and stays on the record", async () => {
  const { issue } = await issued();
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/reaction`, { kind: "Hiccups", severity: "Mild" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/reaction`, { kind: "Other", severity: "Mild" })).status, 422, "'Other' needs a description");
  const r = await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/reaction`, { kind: "Febrile non-haemolytic", severity: "Moderate", note: "Temp 38.4, settled" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual(r.data.reactions.map((x: any) => [x.kind, x.severity, x.note, x.by]), [["Febrile non-haemolytic", "Moderate", "Temp 38.4, settled", "Dr. Kevin Carter"]]);
  await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/transfused`);
  await as(ADMIN, "POST", `/api/blood-bank/issues/${issue.id}/reaction`, { kind: "Allergic / urticarial", severity: "Mild" });
  const listed = (await as(ADMIN, "GET", "/api/blood-bank/issues?all=true")).data.find((x: any) => x.id === issue.id);
  assert.equal(listed.reactions.length, 2, "reactions can be added after the transfusion too");
});

test("the issues list is newest first and searchable", async () => {
  const list = (await as(ADMIN, "GET", "/api/blood-bank/issues?all=true")).data;
  assert.ok(list.length >= 5);
  const times = list.map((x: any) => x.issuedAt);
  assert.deepEqual(times, [...times].sort().reverse());
  const one = list[0];
  assert.ok((await as(ADMIN, "GET", `/api/blood-bank/issues?all=true&search=${one.issueNo}`)).data.some((x: any) => x.id === one.id));
});

// ── Registers ────────────────────────────────────────────────────────────────

test("each statutory register is built from the records for a date, deterministically", async () => {
  const today = iso(0);
  const reg = async (kind: string, date = today) => (await as(ADMIN, "GET", `/api/blood-bank/registers/${kind}?date=${date}`)).data;
  const donor = await reg("donor");
  assert.deepEqual([donor.title, donor.date], ["Blood Donor Register", today]);
  assert.deepEqual(donor.columns, ["Donor", "Donor no", "Group", "Gender", "Mobile", "Donations"]);
  assert.ok(donor.rows.length >= 5, "donors registered today (by the tests above)");
  assert.deepEqual(await reg("donor"), donor, "the same data gives the same register");
  assert.equal((await reg("donor", iso(-400))).rows.length, 0, "none registered long ago");

  const issue = await reg("issue");
  assert.equal(issue.title, "Issue Register");
  assert.ok(issue.rows.length >= 5 && issue.rows.every((r: string[]) => /^BI\//.test(r[0])));

  const discard = await reg("discard");
  assert.equal(discard.title, "Discard / Wastage Register");
  assert.ok(discard.rows.some((r: string[]) => r[4].startsWith("Reactive serology")) && discard.rows.some((r: string[]) => r[4].startsWith("Bag leak")));

  const serology = await reg("serology");
  assert.deepEqual(serology.columns, ["Unit", "Group", "HIV", "HBsAg", "HCV", "Malaria", "Syphilis", "Outcome", "By"]);
  assert.ok(serology.rows.some((r: string[]) => r[7] === "Cleared") && serology.rows.some((r: string[]) => r[7] === "Discarded"));

  const stock = await reg("stock");
  assert.equal(stock.title, "Blood Stock Register");
  assert.ok(stock.rows.length > 10 && stock.rows.every((r: string[]) => r[7] !== "Issued" && r[7] !== "Discarded" && r[7] !== "Processed"), "only units still in stock");
  const longAgo = await reg("stock", iso(-400));
  assert.equal(longAgo.rows.length, 0, "nothing had been collected 400 days ago");
});

test("a register needs a valid kind and date", async () => {
  assert.equal((await as(ADMIN, "GET", "/api/blood-bank/registers/nonsense")).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/blood-bank/registers/donor?date=yesterday")).status, 422);
  assert.equal((await as(ADMIN, "GET", "/api/blood-bank/registers/donor")).status, 200, "defaults to today");
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: lab technicians run the blood bank; the front desk can look but not change; billing has no access", async () => {
  assert.equal((await as(LAB, "GET", "/api/blood-bank/stock")).status, 200);
  const donor = await as(LAB, "POST", "/api/blood-bank/donors", { name: "Lab Registered", gender: "Female", bloodGroup: "B-", dob: iso(-365 * 28), phone: "9811111111" });
  assert.equal(donor.status, 201, JSON.stringify(donor.error));
  assert.equal((await as(RECEPTION, "GET", "/api/blood-bank/units?all=true")).status, 200);
  assert.equal((await as(RECEPTION, "POST", "/api/blood-bank/donors", { name: "Not Allowed", gender: "Male", bloodGroup: "O+", dob: iso(-365 * 30), phone: "9822222222" })).status, 403);
  assert.equal((await as(RECEPTION, "POST", "/api/blood-bank/units/1/discard", { reason: "Expired" })).status, 403);
  for (const path of ["/api/blood-bank/stock", "/api/blood-bank/donors", "/api/blood-bank/crossmatches", "/api/blood-bank/registers/stock"]) assert.equal((await as(BILLING, "GET", path)).status, 403, path);
  assert.equal((await request("GET", "/api/blood-bank/stock")).status, 401);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
