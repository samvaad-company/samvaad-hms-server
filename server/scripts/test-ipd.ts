/**
 * Tests for the IPD admission fields, the nurse station (dose schedule, vitals, IV, tasks, alerts, handover)
 * and checklists. In-process, in-memory database.
 *
 *   npm run test:ipd
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { slotTimes, doseSlots, shiftOf } = await import("@/services/ipd-schedule");
const { parseLines, toLines } = await import("@/services/checklists-service");
const { criticalReasons } = await import("@/services/nurse-station-service");
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
const NURSE = "rekha.menon@samvaadhospital.in"; // Head Nurse
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

const freeBed = async () => (await as(ADMIN, "GET", "/api/beds?all=true&status=Available")).data[0];
const iso = (d = new Date()) => d.toISOString();

// ── Pure rules ───────────────────────────────────────────────────────────────

test("frequencies are read into drug-round times; as-needed and unknown ones have none", async () => {
  const hours = (f: string) => slotTimes(f).map((m) => m / 60);
  assert.deepEqual(hours("OD"), [9]);
  assert.deepEqual(hours("Once daily"), [9]);
  assert.deepEqual(hours("BD"), [9, 21]);
  assert.deepEqual(hours("Twice a day"), [9, 21]);
  assert.deepEqual(hours("TDS"), [6, 14, 22]);
  assert.deepEqual(hours("Three times a day"), [6, 14, 22]);
  assert.deepEqual(hours("QID"), [6, 12, 18, 22]);
  assert.deepEqual(hours("1-0-1"), [9, 21]);
  assert.deepEqual(hours("At night"), [21]);
  for (const none of ["SOS", "PRN", "as needed", "stat", "", "every 5 hours"]) assert.deepEqual(slotTimes(none), [], none);
});

test("a dose is upcoming, due, or missed by the clock, and a recorded one is given or held; an order owes nothing from before it was written", async () => {
  const med: any = { id: 1, admission_id: 1, medicine_name: "X", dosage: "1", frequency: "OD", route: "Oral", status: "Active", start_date: "2026-01-01", end_date: "", created_at: "2026-01-01T00:00:00Z" };
  const noon = new Date("2026-01-05T03:30:00Z"); // 09:00 in Asia/Kolkata
  const at = (iso: string) => doseSlots([med], [], "2026-01-05", "2026-01-05", new Date(iso))[0].state;
  assert.equal(at("2026-01-05T02:00:00Z"), "upcoming"); // 07:30 IST — 90 min before
  assert.equal(at("2026-01-05T03:00:00Z"), "due");      // 08:30 IST
  assert.equal(at("2026-01-05T04:00:00Z"), "due");      // 09:30 IST — inside the window
  assert.equal(at("2026-01-05T05:00:00Z"), "missed");   // 10:30 IST
  const log: any = { medication_id: 1, scheduled_at: "2026-01-05T03:30:00.000Z", status: "Given", given_at: "x", given_by: "N", note: "" };
  assert.equal(doseSlots([med], [log], "2026-01-05", "2026-01-05", new Date("2026-01-05T09:00:00Z"))[0].state, "given");
  assert.equal(doseSlots([med], [{ ...log, status: "Held" }], "2026-01-05", "2026-01-05", noon)[0].state, "held");
  // Written at 15:00 IST on the 5th: that morning's round is not owed.
  const late = { ...med, created_at: "2026-01-05T09:30:00Z" };
  assert.deepEqual(doseSlots([late], [], "2026-01-05", "2026-01-05", new Date("2026-01-05T10:00:00Z")), []);
  // Stopped or finished orders owe nothing.
  assert.deepEqual(doseSlots([{ ...med, status: "Stopped" }], [], "2026-01-05", "2026-01-05"), []);
  assert.deepEqual(doseSlots([{ ...med, end_date: "2026-01-04" }], [], "2026-01-05", "2026-01-05"), []);
});

test("shifts: morning 6–14, evening 14–22, night after; a night shift after midnight belongs to the day before", async () => {
  assert.deepEqual(shiftOf(new Date("2026-01-05T03:30:00Z")), { shift: "Morning", date: "2026-01-05" }); // 09:00 IST
  assert.deepEqual(shiftOf(new Date("2026-01-05T09:30:00Z")), { shift: "Evening", date: "2026-01-05" }); // 15:00 IST
  assert.deepEqual(shiftOf(new Date("2026-01-05T17:00:00Z")), { shift: "Night", date: "2026-01-05" });   // 22:30 IST
  assert.deepEqual(shiftOf(new Date("2026-01-05T21:00:00Z")), { shift: "Night", date: "2026-01-05" });   // 02:30 IST on the 6th
});

test("critical vitals are flagged; ordinary ones are not", async () => {
  const v = (o: object) => ({ temp_c: 37, pulse: 80, bp_systolic: 120, bp_diastolic: 80, spo2: 98, resp_rate: 16, ...o }) as any;
  assert.deepEqual(criticalReasons(v({})), []);
  assert.deepEqual(criticalReasons(v({ spo2: 88 })), ["SpO₂ 88%"]);
  assert.equal(criticalReasons(v({ temp_c: 40, pulse: 140 })).length, 2);
  assert.equal(criticalReasons(v({ bp_systolic: 80 })).length, 1);
});

test("checklist lines round-trip through the text form: * is required, > is a sub-line", async () => {
  const items = parseLines(["Identity checked*", "Consents*", "> Surgery", "> Anaesthesia", "Site marked"]);
  assert.deepEqual(items.map((i) => [i.label, i.required, i.children?.length ?? 0]), [["Identity checked", true, 0], ["Consents", true, 2], ["Site marked", false, 0]]);
  assert.deepEqual(toLines(items), ["Identity checked*", "Consents*", "> Surgery", "> Anaesthesia", "Site marked"]);
});

// ── Admissions ───────────────────────────────────────────────────────────────

test("admitting records the type, MLC flag, family contact, deposit and primary nurse, and numbers the admission", async () => {
  const bed = await freeBed();
  const r = await as(ADMIN, "POST", "/api/ipd", {
    patientId: 1, patientName: "Olivia Turner", doctorId: 2, bedId: bed.id, diagnosis: "Chest pain",
    admissionType: "Emergency", isMlc: true, familyName: "Ravi", familyRelation: "Brother", familyPhone: "9800000000",
    depositAmount: 5000, depositMode: "UPI", primaryNurseId: 5, expectedStayDays: 4, diet: "Soft diet",
  });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.match(r.data.admissionNo, /^ADM\/\d{4}\/\d{5}$/);
  assert.deepEqual([r.data.admissionType, r.data.isMlc, r.data.familyName, r.data.depositAmount, r.data.depositMode, r.data.primaryNurse, r.data.expectedStayDays, r.data.diet],
    ["Emergency", true, "Ravi", 5000, "UPI", "Pooja Iyer", 4, "Soft diet"]);
  assert.equal(r.data.gender, "Female");
  const second = await as(ADMIN, "POST", "/api/ipd", { patientId: 2, patientName: "Ethan Miller", bedId: (await freeBed()).id });
  assert.equal(second.status, 201, "only the patient is required — no reason, no doctor");
  assert.notEqual(second.data.admissionNo, r.data.admissionNo);
  assert.equal(second.data.admissionType, "Planned");
});

test("an admission can be made with no bed yet, and a bad nurse or type is refused", async () => {
  const noBed = await as(ADMIN, "POST", "/api/ipd", { patientId: 3, patientName: "Sophia Adams" });
  assert.equal(noBed.status, 201);
  assert.equal(noBed.data.bedId, null);
  assert.equal((await as(ADMIN, "POST", "/api/ipd", { patientId: 3, patientName: "Sophia Adams", primaryNurseId: 9999 })).status, 404);
  assert.equal((await as(ADMIN, "POST", "/api/ipd", { patientId: 3, patientName: "Sophia Adams", admissionType: "Whenever" })).status, 422);
});

test("beds carry their ward's daily rate", async () => {
  const wards = (await as(ADMIN, "GET", "/api/wards")).data;
  const w = wards[0];
  await as(ADMIN, "PATCH", `/api/wards/${w.id}`, { dailyRate: 1800 });
  const beds = (await as(ADMIN, "GET", "/api/beds?all=true")).data.filter((b: any) => b.wardId === w.id);
  assert.ok(beds.length > 0 && beds.every((b: any) => b.dailyRate === 1800));
});

test("the primary nurse can be changed and cleared", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 4, patientName: "Noah Carter", primaryNurseId: 5 })).data;
  assert.equal((await as(ADMIN, "PATCH", `/api/ipd/${a.id}`, { primaryNurseId: 1 })).data.primaryNurse, "Rekha Menon");
  const cleared = await as(ADMIN, "PATCH", `/api/ipd/${a.id}`, { primaryNurseId: null });
  assert.deepEqual([cleared.data.primaryNurseId, cleared.data.primaryNurse], [null, ""]);
});

// ── Nurse station ────────────────────────────────────────────────────────────

test("the live board counts a new order as unactioned until its dose is recorded, and rounds as seen once a round note exists", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 5, patientName: "Ava Johnson", doctorId: 1, primaryNurseId: 5 })).data;
  const med = (await as(NURSE, "POST", "/api/ipd/medications", { admissionId: a.id, medicineName: "Inj. Test", dosage: "1 g", frequency: "OD", route: "IV" }));
  assert.equal(med.status, 403, "a nurse cannot write orders — that is the doctor's");
  const order = await as(ADMIN, "POST", "/api/ipd/medications", { admissionId: a.id, medicineName: "Inj. Test", dosage: "1 g", frequency: "OD", route: "IV" });
  assert.equal(order.status, 201);
  const live = (await as(NURSE, "GET", "/api/ipd/board")).data.live.find((l: any) => l.admissionId === a.id);
  assert.deepEqual([live.newOrders, live.seenToday, live.vitalsDue, live.ivRunning], [1, false, true, 0]);
  await as(ADMIN, "POST", "/api/ipd/notes", { admissionId: a.id, noteType: "Doctor Round", content: "Stable, continue." });
  const after = (await as(NURSE, "GET", "/api/ipd/board")).data.live.find((l: any) => l.admissionId === a.id);
  assert.equal(after.seenToday, true);
  assert.equal(after.lastRoundBy, "Dr. Kevin Carter");
});

test("recording a dose logs who gave it; the same dose cannot be recorded twice; holding needs a reason", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 6, patientName: "Grace Mitchell" })).data;
  const med = (await as(ADMIN, "POST", "/api/ipd/medications", { admissionId: a.id, medicineName: "Tab. Dose", dosage: "1", frequency: "SOS", route: "Oral" })).data;
  const at = iso();
  const given = await as(NURSE, "POST", "/api/ipd/nurse/doses", { medicationId: med.id, scheduledAt: at, status: "Given" });
  assert.equal(given.status, 201, JSON.stringify(given.error));
  assert.equal(given.data.given_by, "Rekha Menon");
  assert.equal((await as(NURSE, "POST", "/api/ipd/nurse/doses", { medicationId: med.id, scheduledAt: at, status: "Given" })).status, 409);
  assert.equal((await as(NURSE, "POST", "/api/ipd/nurse/doses", { medicationId: med.id, scheduledAt: iso(new Date(Date.now() + 3_600_000)), status: "Held" })).status, 400);
  const held = await as(NURSE, "POST", "/api/ipd/nurse/doses", { medicationId: med.id, scheduledAt: iso(new Date(Date.now() + 7_200_000)), status: "Held", note: "Patient nil by mouth" });
  assert.equal(held.status, 201);
  const board = (await as(NURSE, "GET", "/api/ipd/nurse/board")).data;
  assert.ok(board.alerts.some((x: any) => x.kind === "Dose held" && x.admissionId === a.id && x.detail.includes("nil by mouth")));
});

test("vitals are validated, and critical ones raise a critical alert that stays until acknowledged", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 7, patientName: "Daniel Reed" })).data;
  for (const bad of [{}, { pulse: 80, bpSystolic: 120 }, { bpSystolic: 80, bpDiastolic: 90 }, { spo2: 140 }]) {
    const r = await as(NURSE, "POST", "/api/ipd/nurse/vitals", { admissionId: a.id, ...bad });
    assert.ok(r.status === 400 || r.status === 422, `${JSON.stringify(bad)} → ${r.status}`);
  }
  const ok = await as(NURSE, "POST", "/api/ipd/nurse/vitals", { admissionId: a.id, tempC: 37, pulse: 80, bpSystolic: 120, bpDiastolic: 80, spo2: 98, respRate: 16 });
  assert.equal(ok.status, 201);
  let alerts = (await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts;
  assert.ok(!alerts.some((x: any) => x.kind === "Critical vitals" && x.admissionId === a.id));
  await as(NURSE, "POST", "/api/ipd/nurse/vitals", { admissionId: a.id, spo2: 86, pulse: 128 });
  alerts = (await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts;
  const crit = alerts.find((x: any) => x.kind === "Critical vitals" && x.admissionId === a.id);
  assert.ok(crit && crit.severity === "critical" && crit.detail.includes("SpO₂ 86%"));
  assert.equal(alerts[0].severity, "critical", "critical alerts come first");
  assert.equal((await as(NURSE, "POST", "/api/ipd/nurse/alerts/ack", { keys: [crit.key] })).status, 200);
  alerts = (await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts;
  assert.ok(!alerts.some((x: any) => x.key === crit.key), "an acknowledged alert is gone");
  const latest = (await as(NURSE, "GET", "/api/ipd/nurse/vitals")).data.find((v: any) => v.admissionId === a.id);
  assert.equal(latest.spo2, 86);
});

test("an IV bottle runs, is counted on the board, alerts when it is about to finish, and can be stopped", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 8, patientName: "Priya Sharma" })).data;
  assert.equal((await as(NURSE, "POST", "/api/ipd/nurse/iv", { admissionId: a.id, fluid: "NS", volumeMl: 500, rateMlHr: 0 })).status, 422);
  const line = (await as(NURSE, "POST", "/api/ipd/nurse/iv", { admissionId: a.id, fluid: "Normal saline", volumeMl: 500, rateMlHr: 100 })).data;
  assert.equal(line.status, "Running");
  assert.ok(Math.abs(new Date(line.endsAt).getTime() - new Date(line.startedAt).getTime() - 5 * 3_600_000) < 1000, "500 ml at 100 ml/hr runs five hours");
  const live = (await as(NURSE, "GET", "/api/ipd/board")).data.live.find((l: any) => l.admissionId === a.id);
  assert.equal(live.ivRunning, 1);
  assert.ok(!(await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts.some((x: any) => x.kind === "IV bottle" && x.admissionId === a.id));
  const fast = (await as(NURSE, "POST", "/api/ipd/nurse/iv", { admissionId: a.id, fluid: "Quick bag", volumeMl: 10, rateMlHr: 1500 })).data;
  assert.ok((await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts.some((x: any) => x.kind === "IV bottle" && x.title.includes("Quick bag")), "a bottle that has run dry alerts");
  assert.equal((await as(NURSE, "POST", `/api/ipd/nurse/iv/${fast.id}/stop`, { completed: true })).data.status, "Completed");
  assert.equal((await as(NURSE, "POST", `/api/ipd/nurse/iv/${fast.id}/stop`, {})).status, 409);
  assert.equal((await as(NURSE, "GET", "/api/ipd/nurse/iv")).data.filter((l: any) => l.admissionId === a.id).length, 1);
});

test("ward tasks: add, finish, undo; one that is past its time for a patient raises an alert", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 9, patientName: "Emily Cooper" })).data;
  const t = (await as(NURSE, "POST", "/api/ipd/nurse/tasks", { title: "Change dressing", admissionId: a.id, dueAt: iso(new Date(Date.now() - 3_600_000)) })).data;
  assert.deepEqual([t.status, t.overdue], ["To do", true]);
  assert.ok((await as(NURSE, "GET", "/api/ipd/nurse/board")).data.alerts.some((x: any) => x.kind === "Nursing task" && x.admissionId === a.id));
  const done = (await as(NURSE, "POST", `/api/ipd/nurse/tasks/${t.id}/done`, {})).data;
  assert.deepEqual([done.status, done.doneBy], ["Done", "Rekha Menon"]);
  assert.ok((await as(NURSE, "GET", "/api/ipd/nurse/tasks?status=Done")).data.some((x: any) => x.id === t.id));
  assert.ok(!(await as(NURSE, "GET", "/api/ipd/nurse/tasks")).data.some((x: any) => x.id === t.id));
  assert.equal((await as(NURSE, "POST", `/api/ipd/nurse/tasks/${t.id}/done`, { undo: true })).data.status, "To do");
  assert.equal((await as(NURSE, "POST", "/api/ipd/nurse/tasks", { title: "x" })).status, 422);
});

test("handover notes belong to the shift in progress", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 10, patientName: "Karan Joshi" })).data;
  const n = await as(NURSE, "POST", "/api/ipd/nurse/handover", { admissionId: a.id, note: "Needs 2-hourly turning." });
  assert.equal(n.status, 201);
  const now = (await as(NURSE, "GET", "/api/ipd/nurse/handover")).data;
  assert.ok(["Morning", "Evening", "Night"].includes(now.shift));
  assert.ok(now.notes.some((x: any) => x.id === n.data.id && x.author === "Rekha Menon"));
});

test("diet lists every admitted patient's instruction", async () => {
  const a = (await as(ADMIN, "POST", "/api/ipd", { patientId: 2, patientName: "Ethan Miller", diet: "Diabetic diet" })).data;
  const diet = (await as(NURSE, "GET", "/api/ipd/nurse/diet")).data;
  assert.equal(diet.find((d: any) => d.admissionId === a.id).diet, "Diabetic diet");
});

// ── Checklists ───────────────────────────────────────────────────────────────

test("a hospital starts with the standard templates; the pre-operative one has 15 lines", async () => {
  const t = (await as(NURSE, "GET", "/api/ipd/checklist-templates")).data;
  const names = t.map((x: any) => x.name);
  for (const n of ["Pre-operative checklist", "Admission checklist (nursing)", "Discharge checklist", "Blood transfusion bedside check", "OPD procedure checklist"]) assert.ok(names.includes(n), n);
  assert.equal(t.find((x: any) => x.name === "Pre-operative checklist").lineCount, 15);
  assert.equal(t.find((x: any) => x.name === "OPD procedure checklist").scope, "OPD");
  assert.equal((await as(NURSE, "GET", "/api/ipd/checklist-templates")).data.length, t.length, "not seeded twice");
});

test("a checklist is started for a patient, ticked with who and when, and only completes once the required lines are done", async () => {
  const tpl = (await as(NURSE, "GET", "/api/ipd/checklist-templates")).data.find((x: any) => x.name === "Discharge checklist");
  const c = (await as(NURSE, "POST", "/api/ipd/checklists", { templateId: tpl.id, patientId: 1 })).data;
  assert.deepEqual([c.status, c.done, c.total, c.patientName], ["In progress", 0, 8, "Olivia Turner"]);
  assert.ok(c.admissionId, "linked to the patient's current admission");
  assert.ok(c.requiredLeft > 0);
  assert.equal((await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/complete`)).status, 409, "required lines are not done");
  assert.equal((await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: "nope", done: true })).status, 400);
  let cur = c;
  for (const item of c.items) cur = (await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: item.key, done: true })).data;
  assert.deepEqual([cur.done, cur.requiredLeft], [8, 0]);
  assert.equal(cur.ticks[c.items[0].key].by, "Rekha Menon");
  assert.ok(cur.ticks[c.items[0].key].at);
  const untick = (await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: c.items[0].key, done: false })).data;
  assert.equal(untick.ticks[c.items[0].key].done, false);
  await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: c.items[0].key, done: true });
  const complete = (await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/complete`)).data;
  assert.deepEqual([complete.status, complete.completedBy], ["Complete", "Rekha Menon"]);
  assert.equal((await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: c.items[0].key, done: false })).status, 409, "a completed checklist is closed");
});

test("sub-lines are ticked individually and a heading counts as done only when all are", async () => {
  const tpl = (await as(NURSE, "GET", "/api/ipd/checklist-templates")).data.find((x: any) => x.name === "Pre-operative checklist");
  const c = (await as(NURSE, "POST", "/api/ipd/checklists", { templateId: tpl.id, patientId: 2 })).data;
  assert.equal(c.requiredLeft, 14, "ten required headings, three with three sub-lines each… counted in lines");
  const consents = c.items.find((i: any) => i.label === "Consents signed");
  assert.equal(consents.children.length, 3);
  assert.equal((await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: consents.key, done: true })).status, 400, "a heading is ticked through its sub-lines");
  const one = (await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/tick`, { key: consents.children[0].key, done: true })).data;
  assert.deepEqual([one.done, one.requiredLeft], [1, 13]);
});

test("a checklist can be cancelled; the list filters by status and finds by patient", async () => {
  const tpl = (await as(NURSE, "GET", "/api/ipd/checklist-templates")).data[1];
  const c = (await as(NURSE, "POST", "/api/ipd/checklists", { templateId: tpl.id, patientId: 3 })).data;
  const cancelled = (await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/cancel`, { reason: "Started on the wrong patient" })).data;
  assert.deepEqual([cancelled.status, cancelled.cancelledReason], ["Cancelled", "Started on the wrong patient"]);
  assert.equal((await as(NURSE, "POST", `/api/ipd/checklists/${c.id}/cancel`, {})).status, 409);
  const byStatus = (await as(NURSE, "GET", "/api/ipd/checklists?all=true&status=Cancelled")).data;
  assert.ok(byStatus.length >= 1 && byStatus.every((x: any) => x.status === "Cancelled"));
  const search = (await as(NURSE, "GET", "/api/ipd/checklists?all=true&q=Sophia")).data;
  assert.ok(search.some((x: any) => x.id === c.id));
});

test("templates can be added, edited as text, and removed without touching running checklists", async () => {
  const t = await as(NURSE, "POST", "/api/ipd/checklist-templates", { name: "Falls risk", scope: "Inpatient (IPD)", lines: ["Bed rails up*", "Call bell in reach"] });
  assert.equal(t.status, 201, JSON.stringify(t.error));
  assert.equal(t.data.lineCount, 2);
  const c = (await as(NURSE, "POST", "/api/ipd/checklists", { templateId: t.data.id, patientId: 4 })).data;
  const edited = await as(NURSE, "PUT", `/api/ipd/checklist-templates/${t.data.id}`, { name: "Falls risk v2", lines: ["Bed rails up*", "Call bell in reach", "Non-slip footwear"] });
  assert.equal(edited.data.lineCount, 3);
  assert.equal((await as(NURSE, "GET", `/api/ipd/checklists/${c.id}`)).data.total, 2, "the running checklist keeps its own lines");
  assert.equal((await as(NURSE, "DELETE", `/api/ipd/checklist-templates/${t.data.id}`)).status, 204);
  assert.equal((await as(NURSE, "GET", `/api/ipd/checklists/${c.id}`)).status, 200);
  assert.equal((await as(NURSE, "POST", "/api/ipd/checklist-templates", { name: "Empty", lines: [] })).status, 400);
});

test("permissions: nurse-station data needs the nursing permission; the front desk and billing have none", async () => {
  for (const email of [RECEPTION, BILLING]) {
    assert.equal((await as(email, "GET", "/api/ipd/nurse/board")).status, 403, email);
    assert.equal((await as(email, "GET", "/api/ipd/checklists")).status, 403, email);
  }
  assert.equal((await request("GET", "/api/ipd/nurse/board")).status, 401);
  assert.equal((await as(BILLING, "GET", "/api/ipd/board")).status, 403);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
