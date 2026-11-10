/**
 * Tests for the IPD case file: every admission has the forms in order, staff with access can save and change them, two people editing at
 * once are told rather than overwritten, what the rest of the app knows (vitals, rounds, medicines, IV, handover) shows in the file, and
 * no hospital sees another's.
 *
 *   npm run test:casefile
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { CASE_FILE_FORMS } = await import("@shared/types/casefile");
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
    assert.equal(login.status, 200, `login ${email}: ${JSON.stringify(login.error)}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}

const ADMIN = "kevin.carter@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in"; // Head Nurse: case file full
const RECEPTION = "deepak.nair@samvaadhospital.in"; // Receptionist: case file add & edit
const PHARMACIST = "arun.tiwari@samvaadhospital.in"; // no case file access
const OTHER_HOSPITAL = "admin@sunrisehospital.in";

const stays = (await as(ADMIN, "GET", "/api/ipd?all=true")).data as any[];
const adm = stays.find((a) => a.status !== "Discharged");
assert.ok(adm, "the demo data has an admitted patient");
const ID = adm.id as number;
const url = (form = "") => `/api/casefile/${ID}${form ? `/${form}` : ""}`;

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("the file has every form, in the order the hospital keeps them, with the patient and hospital at the top", async () => {
  const r = await as(NURSE, "GET", url());
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual(Object.keys(r.data.forms), [...CASE_FILE_FORMS]);
  assert.deepEqual(r.data.order, [...CASE_FILE_FORMS], "the standard order until the admin changes it");
  assert.deepEqual([...CASE_FILE_FORMS], ["admission_history", "past_history", "physical_exam", "diagnosis_plan", "doctor_notes", "progress_note", "treatment_sheet", "nursing_handover", "tpr_chart", "io_chart", "investigation_sheet", "room_charges", "room_handover"]);
  assert.equal(CASE_FILE_FORMS.length, 13);
  for (const k of CASE_FILE_FORMS) assert.equal(r.data.forms[k].version, 0, `${k} starts blank`);
  assert.ok(r.data.hospital.name, "hospital name for the page header");
  assert.equal(r.data.patient.name, adm.patientName);
  assert.equal(r.data.admission.id, ID);
  for (const k of ["vitals", "doctorNotes", "dailyNotes", "medicines", "prescriptions", "ivLines", "handovers", "labTests"]) assert.ok(Array.isArray(r.data.linked[k]), `linked.${k}`);
});

test("the list shows admitted patients with how many forms are filled", async () => {
  const r = await as(NURSE, "GET", "/api/casefile");
  assert.equal(r.status, 200);
  const mine = r.data.find((x: any) => x.admissionId === ID);
  assert.ok(mine);
  assert.equal(mine.total, 13);
  assert.equal(mine.filled, 0);
});

test("saving: the first save creates the form, later saves need the version that was loaded, and a stale one is refused", async () => {
  const first = await as(NURSE, "POST", url("progress_note"), { data: { rows: [{ mo: "Dr. A", sbDr: "Dr. B" }] } });
  assert.equal(first.status, 201, JSON.stringify(first.error));
  assert.equal(first.data.version, 1);
  assert.equal(first.data.updatedBy, "Rekha Menon");
  assert.equal((await as(NURSE, "POST", url("progress_note"), { data: {} })).status, 409, "can't create it twice");

  const next = await as(NURSE, "PUT", url("progress_note"), { data: { rows: [{ mo: "Dr. A", sbDr: "Dr. B" }, { mo: "Dr. C" }] }, version: 1 });
  assert.equal(next.status, 200, JSON.stringify(next.error));
  assert.equal(next.data.version, 2);

  // Someone else still holding version 1 is told, and nothing is overwritten.
  const stale = await as(RECEPTION, "PUT", url("progress_note"), { data: { rows: [] }, version: 1 });
  assert.equal(stale.status, 409);
  assert.match(stale.error!.message, /Rekha Menon saved this form/);
  const read = (await as(NURSE, "GET", url())).data.forms.progress_note;
  assert.equal(read.version, 2);
  assert.equal(read.data.rows.length, 2);
  assert.equal((await as(NURSE, "GET", "/api/casefile")).data.find((x: any) => x.admissionId === ID).filled, 1);
});

test("a form that doesn't exist, a body that isn't a form, and one that is far too big are refused", async () => {
  assert.equal((await as(NURSE, "POST", url("secret_form"), { data: {} })).status, 404);
  assert.equal((await as(NURSE, "POST", url("tpr_chart"), { data: "text" })).status, 422);
  assert.equal((await as(NURSE, "POST", url("tpr_chart"), {})).status, 422);
  const huge = { rows: Array.from({ length: 400 }, () => ({ a: "x".repeat(4000), b: "y".repeat(4000) })) };
  assert.equal((await as(NURSE, "POST", url("tpr_chart"), { data: huge })).status, 422);
});

test("what is saved is cleaned: long text is clipped and dangerous keys are dropped", async () => {
  const r = await as(NURSE, "POST", url("doctor_notes"), { data: { long: "z".repeat(9000), __proto__: { x: 1 }, constructor: "no", ok: "fine", n: 5, flag: true } });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.data.long.length, 5000);
  assert.equal(r.data.data.ok, "fine");
  assert.equal(r.data.data.n, 5);
  assert.equal(r.data.data.flag, true);
  assert.equal(Object.prototype.hasOwnProperty.call(r.data.data, "constructor"), false);
});

test("what the rest of the app holds shows in the file: vitals (in °F), doctor rounds, medicines with their dose windows, IV, handover", async () => {
  await as(NURSE, "POST", "/api/ipd/nurse/vitals", { admissionId: ID, tempC: 38, pulse: 90, bpSystolic: 120, bpDiastolic: 80, spo2: 97, respRate: 18 });
  await as(ADMIN, "POST", "/api/ipd/notes", { admissionId: ID, noteType: "Doctor Round", content: "Improving, continue same." });
  await as(ADMIN, "POST", "/api/ipd/notes", { admissionId: ID, noteType: "Daily Note", content: "Slept well." });
  const med = (await as(ADMIN, "POST", "/api/ipd/medications", { admissionId: ID, medicineName: "Inj. Linked", dosage: "1 g", frequency: "TDS", route: "IV" })).data;
  await as(NURSE, "POST", "/api/ipd/nurse/iv", { admissionId: ID, fluid: "NS 500 ml", volumeMl: 500, rateMlHr: 100 });
  await as(NURSE, "POST", "/api/ipd/nurse/handover", { admissionId: ID, note: "Stable overnight." });

  const l = (await as(NURSE, "GET", url())).data.linked;
  assert.ok(l.vitals.length >= 1);
  const v = l.vitals[l.vitals.length - 1];
  assert.equal(v.tempF, 100.4, "38 °C is shown as 100.4 °F");
  assert.equal(v.bp, "120/80");
  assert.equal(v.spo2, 97);
  assert.ok(l.doctorNotes.some((n: any) => n.text === "Improving, continue same."));
  assert.ok(l.dailyNotes.some((n: any) => n.text === "Slept well."));
  const m = l.medicines.find((x: any) => x.name === "Inj. Linked");
  assert.ok(m, "the medicine is listed");
  assert.equal(m.id, med.id);
  const today = Object.keys(m.days)[0];
  assert.ok(today, "it has doses on at least one day");
  assert.equal(m.days[today].length, 4, "four sheet windows per day");
  assert.ok(m.days[today].some((c: string) => c !== ""), "TDS gives doses in the windows");
  assert.ok(l.ivLines.some((x: any) => x.fluid === "NS 500 ml" && x.volumeMl === 500));
  assert.ok(l.handovers.some((h: any) => h.note === "Stable overnight." && ["Morning", "Evening", "Night"].includes(h.shift)), "the handover note with its shift");
});

test("who may do what: the nurse and doctor edit, reception can add and change, the pharmacist can't even look", async () => {
  assert.equal((await as(PHARMACIST, "GET", url())).status, 403);
  assert.equal((await as(PHARMACIST, "GET", "/api/casefile")).status, 403);
  assert.equal((await as(PHARMACIST, "POST", url("room_charges"), { data: {} })).status, 403);
  const r = await as(RECEPTION, "POST", url("room_charges"), { data: { relative: "Mr. X" } });
  assert.equal(r.status, 201, "reception can add a form");
  assert.equal((await as(RECEPTION, "PUT", url("room_charges"), { data: { relative: "Mr. Y" }, version: 1 })).status, 200, "and change it");
});

test("the hospital's admin can narrow it: a role set to read only can look but not save", async () => {
  assert.equal((await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", levels: { casefile: "read" } })).status, 200);
  assert.equal((await as(RECEPTION, "GET", url())).status, 200);
  assert.equal((await as(RECEPTION, "POST", url("room_handover"), { data: {} })).status, 403);
  assert.equal((await as(RECEPTION, "PUT", url("room_charges"), { data: {}, version: 2 })).status, 403);
  await as(ADMIN, "PUT", "/api/admin/role-access", { role: "Receptionist", reset: true });
});

test("the admin arranges the forms for their staff; the standard order comes back on reset; nobody else can change it", async () => {
  const mine = [...CASE_FILE_FORMS].reverse();
  assert.equal((await as(NURSE, "PUT", "/api/casefile-order", { order: mine })).status, 403, "a nurse can't");
  assert.equal((await as(RECEPTION, "PUT", "/api/casefile-order", { order: mine })).status, 403);
  assert.equal((await as(ADMIN, "PUT", "/api/casefile-order", { order: mine.slice(1) })).status, 422, "all forms are needed");
  assert.equal((await as(ADMIN, "PUT", "/api/casefile-order", { order: [...mine.slice(1), "progress_note"] })).status, 422, "none twice");
  assert.equal((await as(ADMIN, "PUT", "/api/casefile-order", { order: [...mine.slice(1), "secret"] })).status, 422, "only real forms");
  const done = await as(ADMIN, "PUT", "/api/casefile-order", { order: mine });
  assert.equal(done.status, 200, JSON.stringify(done.error));
  assert.deepEqual(done.data, mine);
  // Their staff see the new order in the file and from the order call.
  assert.deepEqual((await as(NURSE, "GET", url())).data.order, mine);
  assert.deepEqual((await as(NURSE, "GET", "/api/casefile-order")).data, mine);
  assert.equal((await as(PHARMACIST, "GET", "/api/casefile-order")).status, 403);
  // Another hospital is untouched.
  assert.deepEqual((await as(OTHER_HOSPITAL, "GET", "/api/casefile-order")).data, [...CASE_FILE_FORMS]);
  // Reset.
  assert.deepEqual((await as(ADMIN, "PUT", "/api/casefile-order", { reset: true })).data, [...CASE_FILE_FORMS]);
  assert.deepEqual((await as(NURSE, "GET", url())).data.order, [...CASE_FILE_FORMS]);
});

test("another hospital can't see or change this file", async () => {
  assert.equal((await as(OTHER_HOSPITAL, "GET", url())).status, 404);
  assert.equal((await as(OTHER_HOSPITAL, "POST", url("tpr_chart"), { data: { x: 1 } })).status, 404);
  const theirs = (await as(OTHER_HOSPITAL, "GET", "/api/casefile")).data as any[];
  assert.ok(!theirs.some((x) => x.admissionId === ID));
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (e) { failed++; console.log(`  FAIL  ${t.name}\n        ${(e as Error).message.split("\n").join("\n        ")}\n${(e as Error).stack?.split("\n").slice(1, 3).join("\n")}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
