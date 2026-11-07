/**
 * Tests for the patient loyalty programme: the programme's settings and their checks, the points each rule earns (and its cap), the
 * rank a patient holds at any score, inactive cards, the optional "referred by" / "family of" on appointments and who may set them,
 * the admin list, links and manual points, the prices a card gives on the bill, and that nothing crosses hospitals.
 * In-process, in-memory.
 *
 *   npm run test:loyalty
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
const { patientsRepo, appointmentsRepo, followupsRepo } = await import("@/repositories");
const { DEFAULT_PROGRAM } = await import("@shared/types/loyalty");
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
async function cookieFor(email: string) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
async function as(email: string, method: string, path: string, body?: unknown) {
  return request(method, path, { body, headers: { cookie: await cookieFor(email) } });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const IT_ADMIN = "rahul.saxena@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_HOSPITAL = "admin@sunrisehospital.in";

const today = localDate();
const daysAgo = (n: number): string => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); };
const hospitalId = (await patientsRepo.getRow(1))!.hospital_id;

let seq = 0;
async function mkPatient(name: string, opts: { createdAt?: string; hospital?: number } = {}) {
  seq++;
  return patientsRepo.create({
    hospital_id: opts.hospital ?? hospitalId, patient_code: `LT-${String(seq).padStart(4, "0")}`, name, age: 30, gender: "Male", phone: `90000${String(seq).padStart(5, "0")}`,
    reason: "", doctor_id: null, doctor: "", status: "Completed", visit_date: today, visit_time: "10:00 AM",
    ...(opts.createdAt ? { created_at: opts.createdAt } : {}),
  }) as Promise<{ id: number; name: string; patient_code: string; hospital_id: number }>;
}
async function visit(patientId: number, name: string, daysBack: number, extra: Record<string, unknown> = {}) {
  return appointmentsRepo.create({
    hospital_id: hospitalId, patient_id: patientId, patient_name: name, patient_age: 30, doctor_id: 2, doctor: "Dr. Sophia Adams",
    appointment_date: daysAgo(daysBack), appointment_time: "10:00 AM", type: "Booked", reason: "", status: "Completed", ...extra,
  });
}
async function followUp(patientId: number, name: string, status: string) {
  return followupsRepo.create({
    hospital_id: hospitalId, patient_id: patientId, patient_name: name, patient_code: "", doctor_id: 2, doctor: "Dr. Sophia Adams", reason: "check", due_on: daysAgo(3), status,
    created_by: "Test", created_by_role: "Doctor", resolved_by: status === "Pending" ? null : "Test", resolved_by_role: status === "Pending" ? null : "Doctor", resolved_on: status === "Pending" ? null : today, reschedules: 0, note: "",
  });
}
const member = async (id: number) => { const r = await as(ADMIN, "GET", `/api/loyalty/members/${id}`); assert.equal(r.status, 200, JSON.stringify(r.error)); return r.data; };
const adjust = (id: number, points: number, reason = "Test reason") => as(ADMIN, "POST", `/api/loyalty/members/${id}/adjust`, { points, reason });
const line = (m: any, key: string) => m.breakdown.find((l: any) => l.key === key);

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

// ── The programme ──────────────────────────────────────────────────────────────────────────────────────────────────────

test("the standard programme matches the price card: five cards, OPD and emergency fees falling, discounts rising", async () => {
  const r = await as(PHARMACIST, "GET", "/api/loyalty/program");
  assert.equal(r.status, 200);
  const ranks = r.data.ranks;
  assert.deepEqual(ranks.map((x: any) => x.name), ["Basic", "Silver", "Gold", "Platinum", "VIP"]);
  assert.deepEqual(ranks.map((x: any) => x.opdFee), [400, 300, 200, 100, 0]);
  assert.deepEqual(ranks.map((x: any) => x.erFee), [800, 700, 600, 500, 0]);
  assert.deepEqual(ranks.map((x: any) => x.discounts.lab), [10, 15, 20, 25, 30]);
  assert.deepEqual(ranks.map((x: any) => x.discounts.pharmacy), [10, 10, 15, 15, 20]);
  assert.deepEqual(ranks.map((x: any) => x.discounts.radiology), [10, 10, 15, 15, 20]);
  assert.deepEqual(ranks.map((x: any) => x.discounts.ipd), [10, 15, 20, 25, 30]);
  assert.equal(ranks[0].minPoints, 0);
  assert.ok(ranks.every((x: any, i: number) => i === 0 || x.minPoints > ranks[i - 1].minPoints), "cards need more points as they go up");
  assert.ok(ranks.every((x: any) => /^#[0-9a-f]{6}$/i.test(x.color)));
  assert.equal(r.data.scoring.perYear.points, 5);
  assert.equal(r.data.scoring.perYear.max, 50);
  assert.equal(r.data.scoring.inactiveMonths, 6);
});

test("only an administrator may change the programme", async () => {
  const body = (await as(ADMIN, "GET", "/api/loyalty/program")).data;
  assert.equal((await as(RECEPTION, "PUT", "/api/loyalty/program", body)).status, 403);
  assert.equal((await as(DOCTOR, "PUT", "/api/loyalty/program", body)).status, 403);
  assert.equal((await as(PHARMACIST, "PUT", "/api/loyalty/program", body)).status, 403);
  assert.equal((await as(ADMIN, "PUT", "/api/loyalty/program", body)).status, 200);
});

test("the programme's checks: order of points, colours, fees, discounts", async () => {
  const base = (await as(ADMIN, "GET", "/api/loyalty/program")).data;
  const bad = async (mutate: (p: any) => void, expected: RegExp) => {
    const p = structuredClone(base); mutate(p);
    const r = await as(ADMIN, "PUT", "/api/loyalty/program", p);
    assert.equal(r.status, 422, `expected a refusal for ${expected}`);
    assert.match(JSON.stringify(r.error), expected);
  };
  await bad((p) => { p.ranks[2].minPoints = 30; }, /must be more than/);              // Gold below Silver
  await bad((p) => { p.ranks[1].color = "gold"; }, /colour must look like/);
  await bad((p) => { p.ranks[1].color = "#12"; }, /colour must look like/);
  await bad((p) => { p.ranks[0].opdFee = -5; }, /must be a number from 0/);
  await bad((p) => { p.ranks[3].discounts.lab = 120; }, /must be a number from 0 to 100/);
  await bad((p) => { p.ranks[3].name = ""; }, /name of up to 30/);
  await bad((p) => { p.scoring.inactiveMonths = 0; }, /from 1 to 60/);
  await bad((p) => { p.scoring.perYear.points = -1; }, /from 0/);
  const ok = await as(ADMIN, "GET", "/api/loyalty/program");
  assert.deepEqual(ok.data.ranks.map((r: any) => r.minPoints), base.ranks.map((r: any) => r.minPoints), "a refused save changes nothing");
});

test("a saved change sticks, Basic always stays at 0 points, and a benefit not in the list is dropped", async () => {
  const p = structuredClone((await as(ADMIN, "GET", "/api/loyalty/program")).data);
  p.ranks[0].minPoints = 55;                                // ignored: Basic is where everyone starts
  p.ranks[1].opdFee = 333; p.ranks[1].color = "#112233"; p.ranks[1].name = "Silver Plus";
  p.ranks[1].benefits = ["Zero wait", "Not a real benefit"];
  const saved = await as(ADMIN, "PUT", "/api/loyalty/program", p);
  assert.equal(saved.status, 200, JSON.stringify(saved.error));
  const again = (await as(RECEPTION, "GET", "/api/loyalty/program")).data;
  assert.equal(again.ranks[0].minPoints, 0);
  assert.equal(again.ranks[1].opdFee, 333);
  assert.equal(again.ranks[1].color, "#112233");
  assert.equal(again.ranks[1].name, "Silver Plus");
  assert.deepEqual(again.ranks[1].benefits, ["Zero wait"]);
  await as(ADMIN, "PUT", "/api/loyalty/program", DEFAULT_PROGRAM);       // back to the standard for the rest
  assert.equal((await as(ADMIN, "GET", "/api/loyalty/program")).data.ranks[1].name, "Silver");
});

// ── Points ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("a new patient starts on Basic with no points and 40 to go for Silver", async () => {
  const p = await mkPatient("Loy Fresh");
  const m = await member(p.id);
  assert.equal(m.rankName, "Basic");
  assert.equal(m.points, 0);
  assert.equal(m.stars, 1);
  assert.equal(m.status, "Active");
  assert.deepEqual(m.next, { name: "Silver", pointsNeeded: 40 });
  assert.equal(m.progress, 0);
  assert.match(m.cardNo, /^LC-/);
});

test("years: 5 points a completed year since the first visit, at most 50", async () => {
  const six = await mkPatient("Loy Six Years"); await visit(six.id, six.name, 365 * 6 + 20);
  assert.equal(line(await member(six.id), "years").points, 30);
  const one = await mkPatient("Loy Under A Year"); await visit(one.id, one.name, 300);
  assert.equal(line(await member(one.id), "years").points, 0);
  const twelve = await mkPatient("Loy Twelve Years"); await visit(twelve.id, twelve.name, 365 * 12 + 40);
  assert.equal(line(await member(twelve.id), "years").points, 50, "capped at 10 years' worth");
});

test("a cancelled appointment is not a visit", async () => {
  const p = await mkPatient("Loy Cancelled Only"); await visit(p.id, p.name, 365 * 8, { status: "Cancelled" });
  const m = await member(p.id);
  assert.equal(line(m, "years").points, 0);
  assert.equal(line(m, "visits").points, 0);
});

test("visits: 2 points for each day in the last 12 months, at most 30, and a day counts once", async () => {
  const p = await mkPatient("Loy Ten Days");
  for (let d = 1; d <= 10; d++) await visit(p.id, p.name, d * 5);
  await visit(p.id, p.name, 5);                                       // a second appointment the same day
  assert.equal(line(await member(p.id), "visits").points, 20);
  const q = await mkPatient("Loy Twenty Days");
  for (let d = 1; d <= 20; d++) await visit(q.id, q.name, d * 5);
  assert.equal(line(await member(q.id), "visits").points, 30);
  const old = await mkPatient("Loy Old Visits");
  for (let d = 0; d < 5; d++) await visit(old.id, old.name, 400 + d);
  assert.equal(line(await member(old.id), "visits").points, 0, "visits before the last 12 months don't count");
});

test("follow-ups: 2 points for each one kept (Done), at most 20; missed and pending earn nothing", async () => {
  const p = await mkPatient("Loy Follow Up");
  for (let i = 0; i < 5; i++) await followUp(p.id, p.name, "Done");
  await followUp(p.id, p.name, "Missed"); await followUp(p.id, p.name, "Pending");
  assert.equal(line(await member(p.id), "followups").points, 10);
  for (let i = 0; i < 10; i++) await followUp(p.id, p.name, "Done");
  assert.equal(line(await member(p.id), "followups").points, 20);
});

// ── Referred by / family of ─────────────────────────────────────────────────────────────────────────────────────────────

const book = (who: string, patient: { id: number; name: string }, body: Record<string, unknown> = {}) =>
  as(who, "POST", "/api/appointments", { patientId: patient.id, patientName: patient.name, doctorId: 2, date: today, time: "10:00 AM", type: "Walk-in", ...body });

test("booking with referred-by and family-of stores them with the names, and both are optional", async () => {
  const referrer = await mkPatient("Loy Referrer"); const relative = await mkPatient("Loy Relative"); const patient = await mkPatient("Loy Booked");
  const plain = await book(RECEPTION, patient);
  assert.equal(plain.status, 201, JSON.stringify(plain.error));
  assert.equal(plain.data.referredByPatientId, null);
  assert.equal(plain.data.familyOfPatientId, null);
  const full = await book(RECEPTION, patient, { referredByPatientId: referrer.id, familyOfPatientId: relative.id, familyRelation: "Spouse" });
  assert.equal(full.status, 201, JSON.stringify(full.error));
  assert.equal(full.data.referredByName, "Loy Referrer");
  assert.equal(full.data.familyOfName, "Loy Relative");
  assert.equal(full.data.familyRelation, "Spouse");
  const onlyReferral = await book(RECEPTION, patient, { referredByPatientId: referrer.id });
  assert.equal(onlyReferral.data.familyOfPatientId, null);
});

test("a patient can't be linked to themselves, and a patient of another hospital can't be linked", async () => {
  const p = await mkPatient("Loy Self"); const foreign = await mkPatient("Loy Foreign", { hospital: hospitalId + 1 });
  const self = await book(RECEPTION, p, { referredByPatientId: p.id });
  assert.equal(self.status, 400);
  assert.match(self.error!.message, /themselves/);
  assert.equal((await book(RECEPTION, p, { familyOfPatientId: p.id })).status, 400);
  assert.equal((await book(RECEPTION, p, { referredByPatientId: foreign.id })).status, 404);
  assert.equal((await book(RECEPTION, p, { referredByPatientId: 9_999_999 })).status, 404);
});

test("receptionists and doctors can set, change and clear the links on an appointment; others can't", async () => {
  const a = await mkPatient("Loy Edit A"); const b = await mkPatient("Loy Edit B"); const c = await mkPatient("Loy Edit C");
  const appt = (await book(RECEPTION, a)).data.id;
  const set = await as(DOCTOR, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: b.id, familyOfPatientId: c.id, familyRelation: "Mother" });
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal(set.data.referredByName, "Loy Edit B");
  assert.equal(set.data.familyRelation, "Mother");
  const change = await as(RECEPTION, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: c.id });
  assert.equal(change.data.referredByName, "Loy Edit C");
  assert.equal(change.data.familyOfName, "Loy Edit C", "what wasn't mentioned is left alone");
  const clear = await as(RECEPTION, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: null, familyOfPatientId: null, familyRelation: null });
  assert.equal(clear.data.referredByPatientId, null);
  assert.equal(clear.data.familyOfName, null);
  assert.equal(clear.data.familyRelation, null);
  assert.equal((await as(PHARMACIST, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: b.id })).status, 403);
  assert.equal((await as(OTHER_HOSPITAL, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: b.id })).status, 404, "another hospital can't see it");
  assert.equal((await as(DOCTOR, "PUT", `/api/appointments/${appt}/links`, { referredByPatientId: a.id })).status, 400, "not themselves");
});

test("the links can be edited from the appointment edit too, by a receptionist", async () => {
  const a = await mkPatient("Loy Patch A"); const b = await mkPatient("Loy Patch B");
  const appt = (await book(RECEPTION, a)).data.id;
  const r = await as(RECEPTION, "PATCH", `/api/appointments/${appt}`, { referredByPatientId: b.id });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.referredByName, "Loy Patch B");
});

test("referrals: 10 points for each different patient referred, counted once each, at most 50", async () => {
  const referrer = await mkPatient("Loy Big Referrer");
  const kids = [];
  for (let i = 0; i < 3; i++) kids.push(await mkPatient(`Loy Referred ${i}`));
  for (const k of kids) await book(RECEPTION, k, { referredByPatientId: referrer.id });
  await book(RECEPTION, kids[0], { referredByPatientId: referrer.id });          // the same patient again
  let m = await member(referrer.id);
  assert.equal(m.referredCount, 3);
  assert.equal(line(m, "referrals").points, 30);
  assert.deepEqual(m.referrals.map((r: any) => r.name).sort(), ["Loy Referred 0", "Loy Referred 1", "Loy Referred 2"]);
  for (let i = 3; i < 8; i++) { const k = await mkPatient(`Loy Referred ${i}`); await book(RECEPTION, k, { referredByPatientId: referrer.id }); }
  m = await member(referrer.id);
  assert.equal(m.referredCount, 8);
  assert.equal(line(m, "referrals").points, 50, "capped");
  const kid = await member(kids[1].id);
  assert.equal(kid.referredBy.name, "Loy Big Referrer");
});

test("family: both sides count each other, 5 points a member, at most 25", async () => {
  const head = await mkPatient("Loy Family Head"); const spouse = await mkPatient("Loy Family Spouse");
  await book(RECEPTION, spouse, { familyOfPatientId: head.id, familyRelation: "Spouse" });
  const h = await member(head.id); const s = await member(spouse.id);
  assert.equal(h.familyCount, 1); assert.equal(s.familyCount, 1);
  assert.equal(line(h, "family").points, 5);
  assert.equal(s.familyOf.name, "Loy Family Head"); assert.equal(s.familyOf.relation, "Spouse");
  assert.equal(h.family[0].relation, "Spouse");
  for (let i = 0; i < 7; i++) { const m = await mkPatient(`Loy Member ${i}`); await book(RECEPTION, m, { familyOfPatientId: head.id }); }
  const big = await member(head.id);
  assert.equal(big.familyCount, 8);
  assert.equal(line(big, "family").points, 25, "capped");
});

// ── Ranks, inactive, manual points ──────────────────────────────────────────────────────────────────────────────────────

test("the card at every score: the boundaries of each rank", async () => {
  const at: [number, string][] = [[39, "Basic"], [40, "Silver"], [89, "Silver"], [90, "Gold"], [149, "Gold"], [150, "Platinum"], [219, "Platinum"], [220, "VIP"], [400, "VIP"]];
  for (const [points, rank] of at) {
    const p = await mkPatient(`Loy Score ${points}`);
    assert.equal((await adjust(p.id, points)).status, 201);
    const m = await member(p.id);
    assert.equal(m.points, points);
    assert.equal(m.rankName, rank, `${points} points`);
  }
  const vip = await mkPatient("Loy Top"); await adjust(vip.id, 300);
  const m = await member(vip.id);
  assert.equal(m.stars, 5); assert.equal(m.next, null); assert.equal(m.progress, 100);
  const silver = await mkPatient("Loy Mid"); await adjust(silver.id, 65);
  const s = await member(silver.id);
  assert.deepEqual(s.next, { name: "Gold", pointsNeeded: 25 });
  assert.equal(s.progress, 50, "halfway between 40 and 90");
});

test("points by hand: add, take off, never below zero; each needs a reason and a whole number", async () => {
  const p = await mkPatient("Loy Manual");
  const up = await adjust(p.id, 50, "Referred a patient");
  assert.equal(up.status, 201);
  assert.equal(up.data.manualPoints, 50);
  assert.equal(up.data.rankName, "Silver");
  const down = await adjust(p.id, -20, "Correction");
  assert.equal(down.data.manualPoints, 30);
  assert.equal(down.data.rankName, "Basic", "30 is under Silver's 40");
  assert.equal(down.data.adjustments.length, 2);
  assert.equal(down.data.adjustments[0].by, "Dr. Kevin Carter");
  assert.ok(down.data.adjustments.some((a: any) => a.reason === "Referred a patient" && a.points === 50));
  const floor = await adjust(p.id, -1000, "Reset");
  assert.equal(floor.data.points, 0, "points can't go negative");
  assert.equal((await adjust(p.id, 0)).status, 400);
  assert.equal((await adjust(p.id, 2.5)).status, 400);
  assert.equal((await adjust(p.id, 10_001)).status, 400);
  assert.equal((await adjust(p.id, 5, "ab")).status, 400);
  assert.equal((await adjust(p.id, 5, "")).status, 400);
  assert.equal((await as(ADMIN, "POST", `/api/loyalty/members/${p.id}/adjust`, { points: "ten", reason: "Words" })).status, 400);
  assert.equal((await adjust(9_999_999, 5)).status, 404);
});

test("who may change points: administrators; not the front desk, doctors or the pharmacy; not across hospitals", async () => {
  const p = await mkPatient("Loy Perms");
  for (const who of [RECEPTION, DOCTOR, PHARMACIST]) assert.equal((await as(who, "POST", `/api/loyalty/members/${p.id}/adjust`, { points: 5, reason: "Nope" })).status, 403, who);
  assert.equal((await as(IT_ADMIN, "POST", `/api/loyalty/members/${p.id}/adjust`, { points: 5, reason: "Admin" })).status, 201);
  assert.equal((await as(OTHER_HOSPITAL, "POST", `/api/loyalty/members/${p.id}/adjust`, { points: 5, reason: "Foreign" })).status, 404);
  assert.equal((await as(OTHER_HOSPITAL, "GET", `/api/loyalty/members/${p.id}`)).status, 404);
  assert.equal((await as(OTHER_HOSPITAL, "GET", `/api/loyalty/pricing?patientId=${p.id}`)).status, 404);
});

test("manual points are the hospital's own: another hospital's list doesn't include them", async () => {
  const mine = await as(ADMIN, "GET", "/api/loyalty/members?pageSize=200");
  const theirs = await as(OTHER_HOSPITAL, "GET", "/api/loyalty/members?pageSize=200");
  assert.ok(mine.data.members.some((m: any) => m.name === "Loy Perms"));
  assert.ok(!theirs.data.members.some((m: any) => m.name === "Loy Perms"));
});

test("an inactive card: no visit or bill for the set months; a new visit brings it back", async () => {
  const p = await mkPatient("Loy Dormant", { createdAt: new Date(Date.now() - 800 * 86_400_000).toISOString() });
  await visit(p.id, p.name, 400);
  let m = await member(p.id);
  assert.equal(m.status, "Inactive");
  const pricing = await as(RECEPTION, "GET", `/api/loyalty/pricing?patientId=${p.id}`);
  assert.equal(pricing.data.status, "Inactive");
  await visit(p.id, p.name, 0);
  m = await member(p.id);
  assert.equal(m.status, "Active");
  const edge = await mkPatient("Loy Almost", { createdAt: new Date(Date.now() - 800 * 86_400_000).toISOString() });
  await visit(edge.id, edge.name, 150);                                            // under six months ago
  assert.equal((await member(edge.id)).status, "Active");
  const six = await mkPatient("Loy Six Months", { createdAt: new Date(Date.now() - 800 * 86_400_000).toISOString() });
  await visit(six.id, six.name, 200);                                              // over six months ago
  assert.equal((await member(six.id)).status, "Inactive");
});

test("the admin is told who has gone quiet: the count, the window, and the quietest patients first", async () => {
  const r = await as(ADMIN, "GET", "/api/loyalty/members");
  const s = r.data.summary;
  assert.equal(s.inactiveMonths, 6);
  assert.ok(s.inactive >= 1);
  assert.ok(s.inactivePreview.length >= 1 && s.inactivePreview.length <= 6);
  assert.ok(s.inactivePreview.every((p: any) => p.daysQuiet > 180), "everyone listed has been quiet for over six months");
  const days = s.inactivePreview.map((p: any) => p.daysQuiet);
  assert.deepEqual(days, [...days].sort((a: number, b: number) => b - a), "quietest first");
  assert.ok(s.inactivePreview.some((p: any) => p.name === "Loy Six Months"));
  assert.ok(!s.inactivePreview.some((p: any) => p.name === "Loy Almost"), "someone seen within six months isn't listed");
  // The alert follows the window the hospital sets.
  const prog = structuredClone((await as(ADMIN, "GET", "/api/loyalty/program")).data);
  prog.scoring.inactiveMonths = 1;
  await as(ADMIN, "PUT", "/api/loyalty/program", prog);
  const tight = (await as(ADMIN, "GET", "/api/loyalty/members")).data.summary;
  assert.equal(tight.inactiveMonths, 1);
  assert.ok(tight.inactive >= s.inactive);
  await as(ADMIN, "PUT", "/api/loyalty/program", DEFAULT_PROGRAM);
});

test("the months before a card goes inactive can be changed", async () => {
  const p = await mkPatient("Loy Window", { createdAt: new Date(Date.now() - 800 * 86_400_000).toISOString() });
  await visit(p.id, p.name, 100);
  assert.equal((await member(p.id)).status, "Active");
  const prog = structuredClone((await as(ADMIN, "GET", "/api/loyalty/program")).data);
  prog.scoring.inactiveMonths = 2;
  assert.equal((await as(ADMIN, "PUT", "/api/loyalty/program", prog)).status, 200);
  assert.equal((await member(p.id)).status, "Inactive");
  await as(ADMIN, "PUT", "/api/loyalty/program", DEFAULT_PROGRAM);
  assert.equal((await member(p.id)).status, "Active");
});

test("changing the scoring rules changes the points straight away", async () => {
  const p = await mkPatient("Loy Rules"); for (let d = 1; d <= 4; d++) await visit(p.id, p.name, d * 5);
  assert.equal(line(await member(p.id), "visits").points, 8);
  const prog = structuredClone((await as(ADMIN, "GET", "/api/loyalty/program")).data);
  prog.scoring.perVisit = { points: 10, max: 25 };
  await as(ADMIN, "PUT", "/api/loyalty/program", prog);
  assert.equal(line(await member(p.id), "visits").points, 25, "10 each would be 40, capped at 25");
  await as(ADMIN, "PUT", "/api/loyalty/program", DEFAULT_PROGRAM);
});

// ── Prices on the bill ──────────────────────────────────────────────────────────────────────────────────────────────────

test("the price a card gives: each card's OPD and emergency fee and its four discounts", async () => {
  const cases: [number, string, number, number, number, number, number, number][] = [
    [0, "Basic", 400, 800, 10, 10, 10, 10], [40, "Silver", 300, 700, 15, 10, 10, 15], [90, "Gold", 200, 600, 20, 15, 15, 20], [150, "Platinum", 100, 500, 25, 15, 15, 25], [220, "VIP", 0, 0, 30, 20, 20, 30],
  ];
  for (const [points, rank, opd, er, lab, pharmacy, radiology, ipd] of cases) {
    const p = await mkPatient(`Loy Price ${rank}`); if (points) await adjust(p.id, points);
    const r = await as(RECEPTION, "GET", `/api/loyalty/pricing?patientId=${p.id}`);
    assert.equal(r.status, 200);
    assert.deepEqual({ rank: r.data.rankName, opd: r.data.opdFee, er: r.data.erFee, ...r.data.discounts, status: r.data.status, enrolled: r.data.enrolled }, { rank, opd, er, lab, pharmacy, radiology, ipd, status: "Active", enrolled: true }, rank);
  }
});

test("a changed price reaches the bill's pricing, and a switched-off programme prices nobody", async () => {
  const p = await mkPatient("Loy Reprice"); await adjust(p.id, 95);                    // Gold
  const prog = structuredClone((await as(ADMIN, "GET", "/api/loyalty/program")).data);
  prog.ranks[2].opdFee = 250; prog.ranks[2].discounts.lab = 22;
  await as(ADMIN, "PUT", "/api/loyalty/program", prog);
  let r = await as(PHARMACIST, "GET", `/api/loyalty/pricing?patientId=${p.id}`);
  assert.equal(r.data.opdFee, 250); assert.equal(r.data.discounts.lab, 22);
  prog.enabled = false;
  await as(ADMIN, "PUT", "/api/loyalty/program", prog);
  r = await as(PHARMACIST, "GET", `/api/loyalty/pricing?patientId=${p.id}`);
  assert.equal(r.data.enrolled, false);
  assert.equal(r.data.discounts.lab, 0);
  await as(ADMIN, "PUT", "/api/loyalty/program", DEFAULT_PROGRAM);
  assert.equal((await as(PHARMACIST, "GET", `/api/loyalty/pricing?patientId=${p.id}`)).data.opdFee, 200);
});

test("the pricing call needs a patient", async () => {
  assert.equal((await as(RECEPTION, "GET", "/api/loyalty/pricing")).status, 400);
  assert.equal((await as(RECEPTION, "GET", "/api/loyalty/pricing?patientId=abc")).status, 400);
  assert.equal((await as(RECEPTION, "GET", "/api/loyalty/pricing?patientId=9999999")).status, 404);
});

// ── The admin list ──────────────────────────────────────────────────────────────────────────────────────────────────────

test("the member list: only administrators, highest points first, with a summary that adds up", async () => {
  for (const who of [RECEPTION, DOCTOR, PHARMACIST]) assert.equal((await as(who, "GET", "/api/loyalty/members")).status, 403, who);
  const r = await as(ADMIN, "GET", "/api/loyalty/members?pageSize=200");
  assert.equal(r.status, 200);
  const pts = r.data.members.map((m: any) => m.points);
  assert.deepEqual(pts, [...pts].sort((a: number, b: number) => b - a));
  assert.equal(r.data.summary.byRank.reduce((n: number, x: any) => n + x.count, 0), r.data.summary.members);
  assert.equal(r.data.summary.members, r.data.total);
  assert.equal(r.data.summary.inactive, r.data.members.filter((m: any) => m.status === "Inactive").length);
});

test("search, card and status filters, and paging", async () => {
  const byName = await as(ADMIN, "GET", "/api/loyalty/members?search=Loy%20Dormant");
  assert.equal(byName.data.members.length, 1);
  const byCode = await as(ADMIN, "GET", `/api/loyalty/members?search=${byName.data.members[0].patientCode}`);
  assert.equal(byCode.data.members[0].name, "Loy Dormant");
  const byPhone = await as(ADMIN, "GET", `/api/loyalty/members?search=${byName.data.members[0].phone}`);
  assert.equal(byPhone.data.members[0].name, "Loy Dormant");
  const vip = await as(ADMIN, "GET", "/api/loyalty/members?rank=vip&pageSize=200");
  assert.ok(vip.data.members.length >= 2 && vip.data.members.every((m: any) => m.rankKey === "vip"));
  const inactive = await as(ADMIN, "GET", "/api/loyalty/members?status=Inactive&pageSize=200");
  assert.ok(inactive.data.members.length >= 1 && inactive.data.members.every((m: any) => m.status === "Inactive"));
  assert.ok(inactive.data.members.some((m: any) => m.name === "Loy Six Months"), "the dormant patient is listed");
  const none = await as(ADMIN, "GET", "/api/loyalty/members?search=zzzzzzzz");
  assert.equal(none.data.members.length, 0); assert.equal(none.data.total, 0);
  const p1 = await as(ADMIN, "GET", "/api/loyalty/members?pageSize=3&page=1"); const p2 = await as(ADMIN, "GET", "/api/loyalty/members?pageSize=3&page=2");
  assert.equal(p1.data.members.length, 3);
  assert.ok(!p1.data.members.some((a: any) => p2.data.members.some((b: any) => b.patientId === a.patientId)), "pages don't overlap");
  assert.ok(p1.data.total > 6);
});

test("the referral and family list names who is linked to whom, once each, and only administrators see it", async () => {
  assert.equal((await as(RECEPTION, "GET", "/api/loyalty/links")).status, 403);
  const r = await as(ADMIN, "GET", "/api/loyalty/links");
  assert.equal(r.status, 200);
  const l = r.data.find((x: any) => x.patientName === "Loy Referred 1");
  assert.equal(l.kind, "referral"); assert.equal(l.otherName, "Loy Big Referrer");
  const f = r.data.find((x: any) => x.patientName === "Loy Family Spouse");
  assert.equal(f.kind, "family"); assert.equal(f.otherName, "Loy Family Head"); assert.equal(f.relation, "Spouse");
  const keys = r.data.map((x: any) => `${x.kind}:${x.patientId}:${x.otherId}`);
  assert.equal(new Set(keys).size, keys.length, "no repeats");
  const theirs = await as(OTHER_HOSPITAL, "GET", "/api/loyalty/links");
  assert.ok(!theirs.data.some((x: any) => x.patientName.startsWith("Loy ")));
});

test("a member's detail: how the points add up equals the total", async () => {
  const p = await mkPatient("Loy Total"); await visit(p.id, p.name, 365 * 3 + 5); for (let d = 1; d <= 6; d++) await visit(p.id, p.name, d * 7);
  await followUp(p.id, p.name, "Done"); await adjust(p.id, 12, "Ambassador");
  const m = await member(p.id);
  assert.equal(m.breakdown.reduce((n: number, l: any) => n + l.points, 0), m.points);
  assert.equal(m.autoPoints + m.manualPoints, m.points);
  assert.equal(m.manualPoints, 12);
  assert.equal(line(m, "manual").points, 12);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
