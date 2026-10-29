/**
 * Tests for the operation theatre: booking, the room / surgeon / equipment conflict check with its 15-minute
 * turnaround, anaesthetic fitness gating the start (never the booking), status rules, rooms and equipment.
 * In-process, in-memory database.
 *
 *   npm run test:ot
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
const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

// A day well away from the seeded demo bookings, so these tests own it.
let dayCounter = 0;
const freshDay = () => `2031-03-${String(10 + ++dayCounter).padStart(2, "0")}`;

const options = async () => (await as(ADMIN, "GET", "/api/ot/options")).data;
const book = async (over: Record<string, unknown>) => {
  const o = await options();
  return as(ADMIN, "POST", "/api/ot", {
    patientId: 1, patientName: "Olivia Turner", surgeryName: "Test surgery", roomId: o.rooms[0].id, surgeonId: o.doctors[0].id,
    scheduledDate: freshDay(), scheduledTime: "09:00", durationMin: 60, ...over,
  });
};

// ── Rooms, equipment, options ────────────────────────────────────────────────

test("a hospital has four theatres and ten pieces of equipment, one under maintenance", async () => {
  const o = await options();
  assert.deepEqual(o.rooms.map((r: any) => r.name), ["Major OT-1", "Major OT-2", "Major OT-3", "Minor OT"]);
  assert.equal(o.equipment.length, 10);
  assert.deepEqual(o.equipment.filter((e: any) => e.status === "Maintenance").map((e: any) => e.name), ["Electrosurgical Unit / Diathermy"]);
  assert.equal(o.bufferMin, 15);
});

test("the options include nurses and technicians even for a role with no access to the staff list", async () => {
  assert.equal((await as(DOCTOR, "GET", "/api/staff?all=true")).status, 403, "a doctor can't read staff");
  const o = (await as(DOCTOR, "GET", "/api/ot/options")).data;
  assert.ok(o.nurses.length > 0 && o.technicians.length > 0 && o.doctors.length > 0);
  assert.ok(o.technicians.every((t: any) => t.name));
});

// ── Booking ──────────────────────────────────────────────────────────────────

test("a booking stores the case, team and equipment, and is numbered OT/yyyy/nnnn", async () => {
  const o = await options();
  const date = freshDay();
  const r = await as(ADMIN, "POST", "/api/ot", {
    patientId: 1, patientName: "Placeholder", surgeryName: "Open Appendectomy", procedure: "Appendicectomy, open", caseType: "Emergency", category: "Major",
    procedureCode: "0DTJ0ZZ", roomId: o.rooms[0].id, scheduledDate: date, scheduledTime: "10:30", durationMin: 90,
    surgeonId: o.doctors[0].id, coSurgeonId: o.doctors[1].id, anesthetistId: o.doctors[2].id, anaesthesiaType: "Spinal",
    scrubNurseId: o.nurses[0].id, circulatingNurseId: o.nurses[1].id, technicianIds: [o.technicians[0].id],
    equipmentIds: [o.equipment[0].id, o.equipment[1].id], specialRequirements: "Reserve 2 units of blood",
  });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const d = r.data;
  assert.match(d.bookingNo, new RegExp(`^OT/${date.slice(0, 4)}/\\d{4}$`));
  assert.deepEqual([d.surgeryName, d.procedure, d.caseType, d.category, d.procedureCode, d.durationMin, d.anaesthesiaType, d.fitness, d.status],
    ["Open Appendectomy", "Appendicectomy, open", "Emergency", "Major", "0DTJ0ZZ", 90, "Spinal", "Pending", "Scheduled"]);
  assert.deepEqual([d.otRoom, d.surgeon, d.coSurgeon, d.anesthetist], [o.rooms[0].name, o.doctors[0].name, o.doctors[1].name, o.doctors[2].name]);
  assert.deepEqual([d.scrubNurse, d.circulatingNurse], [o.nurses[0].name, o.nurses[1].name]);
  assert.deepEqual(d.equipment, [o.equipment[0].name, o.equipment[1].name]);
  assert.deepEqual([d.startMinute, d.endMinute], [630, 720]);
  assert.match(d.patientCode, /^HMS-/);
  assert.equal(d.patientName, "Olivia Turner", "the name comes from the patient record");
  const next = await book({ scheduledDate: date, scheduledTime: "16:00", roomId: o.rooms[2].id });
  assert.equal(Number(next.data.bookingNo.slice(-4)), Number(d.bookingNo.slice(-4)) + 1);
});

test("bad bookings are refused", async () => {
  const o = await options();
  const base = { patientId: 1, patientName: "Olivia Turner", surgeryName: "X surgery", roomId: o.rooms[0].id, scheduledDate: freshDay(), scheduledTime: "09:00" };
  for (const bad of [
    { surgeryName: "", procedure: "" }, { scheduledTime: "soon" }, { scheduledDate: "next week" }, { durationMin: 5 }, { durationMin: 9000 },
    { roomId: undefined, otRoom: "" }, { caseType: "Whenever" }, { anaesthesiaType: "Gas and air" }, { technicianIds: [1, 2, 3, 4] }, { equipmentIds: "all" },
    { coSurgeonId: 99999 }, { scrubNurseId: 99999 }, { equipmentIds: [99999] },
  ]) {
    const r = await as(ADMIN, "POST", "/api/ot", { ...base, ...bad });
    assert.ok(r.status === 422 || r.status === 404, `${JSON.stringify(bad)} → ${r.status} ${JSON.stringify(r.error)}`);
  }
});

// ── Conflicts ────────────────────────────────────────────────────────────────

test("the same theatre can't be booked over another surgery or inside its 15-minute turnaround", async () => {
  const o = await options();
  const date = freshDay();
  const room = o.rooms[1].id;
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", durationMin: 60, roomId: room })).status, 201);
  const clash = await book({ scheduledDate: date, scheduledTime: "09:30", durationMin: 30, roomId: room, surgeonId: o.doctors[3].id });
  assert.equal(clash.status, 409);
  assert.match(clash.error!.message, /Major OT-2 is booked 09:00–10:00/);
  assert.equal((await book({ scheduledDate: date, scheduledTime: "10:10", roomId: room, surgeonId: o.doctors[3].id })).status, 409, "inside the turnaround");
  assert.equal((await book({ scheduledDate: date, scheduledTime: "10:15", roomId: room, surgeonId: o.doctors[3].id })).status, 201, "right after the turnaround");
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[2].id, surgeonId: o.doctors[4].id })).status, 201, "another theatre is free");
  // A surgery ending just before the booked one needs the turnaround too.
  assert.equal((await book({ scheduledDate: date, scheduledTime: "07:50", durationMin: 60, roomId: room, surgeonId: o.doctors[5].id })).status, 409, "would run into the 09:00 start with no turnaround");
});

test("a surgeon, co-surgeon or anaesthetist can't be in two surgeries at once, but needs no turnaround", async () => {
  const o = await options();
  const date = freshDay();
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id, surgeonId: o.doctors[0].id, anesthetistId: o.doctors[1].id })).status, 201);
  const sameSurgeon = await book({ scheduledDate: date, scheduledTime: "09:30", roomId: o.rooms[1].id, surgeonId: o.doctors[0].id });
  assert.equal(sameSurgeon.status, 409);
  assert.match(sameSurgeon.error!.message, new RegExp(`${o.doctors[0].name} is already in`));
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:30", roomId: o.rooms[1].id, surgeonId: o.doctors[2].id, coSurgeonId: o.doctors[1].id })).status, 409, "the anaesthetist of one is the co-surgeon of the other");
  assert.equal((await book({ scheduledDate: date, scheduledTime: "10:00", roomId: o.rooms[1].id, surgeonId: o.doctors[0].id })).status, 201, "back to back is fine for a person");
});

test("equipment is held for the surgery plus the turnaround; maintenance equipment can never be booked", async () => {
  const o = await options();
  const date = freshDay();
  const drager = o.equipment[0].id;
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id, surgeonId: o.doctors[0].id, equipmentIds: [drager] })).status, 201);
  const clash = await book({ scheduledDate: date, scheduledTime: "09:30", roomId: o.rooms[1].id, surgeonId: o.doctors[1].id, equipmentIds: [drager] });
  assert.equal(clash.status, 409);
  assert.match(clash.error!.message, /Anaesthesia Workstation \(Drager\) is in use/);
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:30", roomId: o.rooms[1].id, surgeonId: o.doctors[1].id, equipmentIds: [o.equipment[1].id] })).status, 201, "different equipment");
  const diathermy = o.equipment.find((e: any) => e.status === "Maintenance").id;
  for (const allowOverlap of [false, true]) {
    const r = await book({ scheduledDate: freshDay(), roomId: o.rooms[0].id, equipmentIds: [diathermy], allowOverlap });
    assert.equal(r.status, 409, `allowOverlap=${allowOverlap}`);
    assert.match(r.error!.message, /out for maintenance/);
  }
});

test("allowing overlap skips the clash check, and the booking remembers it", async () => {
  const o = await options();
  const date = freshDay();
  await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id });
  const r = await book({ scheduledDate: date, scheduledTime: "09:15", roomId: o.rooms[0].id, allowOverlap: true });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.allowOverlap, true);
});

test("the preview reports clashes and offline equipment without booking anything", async () => {
  const o = await options();
  const date = freshDay();
  await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id, surgeonId: o.doctors[0].id });
  const before = (await as(ADMIN, "GET", "/api/ot?all=true")).data.length;
  const diathermy = o.equipment.find((e: any) => e.status === "Maintenance").id;
  const p = (await as(ADMIN, "POST", "/api/ot/conflicts", { scheduledDate: date, scheduledTime: "09:30", durationMin: 60, roomId: o.rooms[0].id, surgeonId: o.doctors[0].id, equipmentIds: [diathermy] })).data;
  assert.deepEqual(p.conflicts.map((c: any) => c.kind).sort(), ["room", "surgeon"]);
  assert.deepEqual(p.offline, ["Electrosurgical Unit / Diathermy"]);
  assert.equal((await as(ADMIN, "GET", "/api/ot?all=true")).data.length, before, "nothing was booked");
  assert.deepEqual((await as(ADMIN, "POST", "/api/ot/conflicts", { scheduledDate: "garbage" })).data, { conflicts: [], offline: [] });
});

test("editing a surgery updates the team, nurses, technicians and clears optional ones", async () => {
  const o = await options();
  const b = (await book({ roomId: o.rooms[0].id, coSurgeonId: o.doctors[1].id, scrubNurseId: o.nurses[0].id, technicianIds: [o.technicians[0].id] })).data;
  assert.equal(b.scrubNurse, o.nurses[0].name);
  const e = (await as(ADMIN, "PATCH", `/api/ot/${b.id}`, {
    coSurgeonId: null, scrubNurseId: o.nurses[1].id, circulatingNurseId: o.nurses[0].id, technicianIds: [], anaesthesiaType: "Local", specialRequirements: "Implants on hold",
  })).data;
  assert.deepEqual([e.coSurgeon, e.coSurgeonId, e.scrubNurse, e.circulatingNurse, e.technicians, e.anaesthesiaType, e.specialRequirements],
    ["", null, o.nurses[1].name, o.nurses[0].name, [], "Local", "Implants on hold"]);
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${b.id}`, { technicianIds: [1, 2, 3, 4] })).status, 422);
});

test("a cancelled surgery frees its slot", async () => {
  const o = await options();
  const date = freshDay();
  const first = (await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id })).data;
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id })).status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${first.id}`, { status: "Cancelled" })).data.status, "Cancelled");
  assert.equal((await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id })).status, 201);
});

test("rescheduling is checked again, ignores the surgery itself, and a finished one can't be moved", async () => {
  const o = await options();
  const date = freshDay();
  const a = (await book({ scheduledDate: date, scheduledTime: "09:00", roomId: o.rooms[0].id, surgeonId: o.doctors[0].id })).data;
  const b = (await book({ scheduledDate: date, scheduledTime: "13:00", roomId: o.rooms[0].id, surgeonId: o.doctors[1].id })).data;
  const into = await as(ADMIN, "PATCH", `/api/ot/${b.id}`, { scheduledTime: "09:30" });
  assert.equal(into.status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${a.id}`, { scheduledTime: "09:30", durationMin: 45 })).status, 200, "moving within its own slot is not a clash with itself");
  const moved = await as(ADMIN, "PATCH", `/api/ot/${b.id}`, { scheduledTime: "15:00", roomId: o.rooms[3].id });
  assert.deepEqual([moved.status, moved.data.scheduledTime, moved.data.otRoom], [200, "15:00", "Minor OT"]);
  await as(ADMIN, "PATCH", `/api/ot/${a.id}`, { status: "Completed" });
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${a.id}`, { scheduledTime: "10:00" })).status, 409);
});

// ── Fitness and status ───────────────────────────────────────────────────────

test("anaesthetic fitness never blocks booking, only starting; an emergency can start without it, an unfit patient never", async () => {
  const o = await options();
  const elective = (await book({ roomId: o.rooms[0].id })).data;
  assert.equal(elective.fitness, "Pending", "booked without fitness recorded");
  const blocked = await as(ADMIN, "PATCH", `/api/ot/${elective.id}`, { status: "In Progress" });
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /fitness/i);
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${elective.id}`, { fitness: "Unfit" })).data.fitness, "Unfit");
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${elective.id}`, { status: "In Progress" })).status, 409, "unfit");
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${elective.id}`, { fitness: "Fit" })).data.fitness, "Fit");
  const started = (await as(ADMIN, "PATCH", `/api/ot/${elective.id}`, { status: "In Progress" })).data;
  assert.equal(started.status, "In Progress");
  assert.ok(started.startedAt);

  const emergency = (await book({ roomId: o.rooms[1].id, caseType: "Emergency" })).data;
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${emergency.id}`, { status: "In Progress" })).status, 200, "emergency, fitness still pending");
  const unfitEmergency = (await book({ roomId: o.rooms[2].id, caseType: "Emergency" })).data;
  await as(ADMIN, "PATCH", `/api/ot/${unfitEmergency.id}`, { fitness: "Unfit" });
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${unfitEmergency.id}`, { status: "In Progress" })).status, 409, "unfit blocks even an emergency");
});

test("starting and completing record the real duration; finished surgeries are closed; nothing returns to scheduled", async () => {
  const o = await options();
  const s = (await book({ roomId: o.rooms[0].id, durationMin: 60, fitness: "Fit" })).data;
  assert.equal(s.fitness, "Fit");
  assert.equal(s.actualMin, null);
  await as(ADMIN, "PATCH", `/api/ot/${s.id}`, { status: "In Progress" });
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${s.id}`, { status: "Scheduled" })).status, 409);
  const done = (await as(ADMIN, "PATCH", `/api/ot/${s.id}`, { status: "Completed" })).data;
  assert.equal(done.status, "Completed");
  assert.ok(done.endedAt && done.actualMin >= 1);
  for (const status of ["Cancelled", "In Progress"]) assert.equal((await as(ADMIN, "PATCH", `/api/ot/${s.id}`, { status })).status, 409, status);
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/${(await book({ roomId: o.rooms[1].id })).data.id}`, { status: "Completed" })).status, 200, "a scheduled surgery can be closed without being started");
});

test("surgeries booked before the new fields existed read with sensible defaults", async () => {
  const list = (await as(ADMIN, "GET", "/api/ot?all=true")).data;
  const legacy = list.find((x: any) => x.scheduledDate < "2026-01-01" && !x.roomId) ?? list[0];
  assert.match(legacy.bookingNo, /^OT\/\d{4}\/\d{4}$/);
  assert.deepEqual([legacy.caseType, legacy.category, legacy.durationMin, legacy.fitness, legacy.equipment.length], ["Elective", "Major", 60, "Pending", 0]);
  assert.ok(legacy.surgeryName);
});

// ── Rooms and equipment management ───────────────────────────────────────────

test("theatres: add, refuse a duplicate name, rename (bookings follow), switch off (can't be booked), delete only if unused", async () => {
  const r = await as(ADMIN, "POST", "/api/ot/rooms", { name: "Cath Lab", kind: "Daycare" });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal((await as(ADMIN, "POST", "/api/ot/rooms", { name: "cath lab" })).status, 409, "names are unique, ignoring case");
  const b = (await book({ roomId: r.data.id })).data;
  const renamed = await as(ADMIN, "PATCH", `/api/ot/rooms/${r.data.id}`, { name: "Cath Lab 1" });
  assert.equal(renamed.data.name, "Cath Lab 1");
  assert.equal((await as(ADMIN, "GET", `/api/ot/${b.id}`)).data.otRoom, "Cath Lab 1", "the booking shows the new name");
  assert.equal((await as(ADMIN, "DELETE", `/api/ot/rooms/${r.data.id}`)).status, 409, "has a surgery on record");
  assert.equal((await as(ADMIN, "PATCH", `/api/ot/rooms/${r.data.id}`, { active: false })).data.active, false);
  assert.equal((await book({ roomId: r.data.id })).status, 409, "switched off");
  assert.ok(!(await options()).rooms.some((x: any) => x.id === r.data.id), "and not offered");
  const empty = (await as(ADMIN, "POST", "/api/ot/rooms", { name: "Spare room" })).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/ot/rooms/${empty.id}`)).status, 204);
});

test("equipment: add, take out of use and back, rename (bookings follow), delete only if not booked", async () => {
  const e = (await as(ADMIN, "POST", "/api/ot/equipment", { name: "Neuro Navigation System" })).data;
  assert.equal(e.status, "Available");
  const o = await options();
  const b = (await book({ roomId: o.rooms[0].id, equipmentIds: [e.id] })).data;
  assert.deepEqual(b.equipment, ["Neuro Navigation System"]);
  assert.equal((await as(ADMIN, "DELETE", `/api/ot/equipment/${e.id}`)).status, 409, "booked");
  const down = await as(ADMIN, "PATCH", `/api/ot/equipment/${e.id}`, { status: "Maintenance", note: "Calibration" });
  assert.deepEqual([down.data.status, down.data.note], ["Maintenance", "Calibration"]);
  assert.equal((await book({ roomId: o.rooms[1].id, equipmentIds: [e.id], scheduledDate: freshDay() })).status, 409);
  await as(ADMIN, "PATCH", `/api/ot/equipment/${e.id}`, { status: "Available", name: "Neuro Navigation (Brainlab)" });
  assert.deepEqual((await as(ADMIN, "GET", `/api/ot/${b.id}`)).data.equipment, ["Neuro Navigation (Brainlab)"]);
  const spare = (await as(ADMIN, "POST", "/api/ot/equipment", { name: "Spare item" })).data;
  assert.equal((await as(ADMIN, "DELETE", `/api/ot/equipment/${spare.id}`)).status, 204);
});

test("permissions: a doctor can see the OT and its options but not book; the front desk can't see it; nobody unauthenticated", async () => {
  const o = await options();
  const attempt = await as(DOCTOR, "POST", "/api/ot", { patientId: 2, patientName: "Ethan Miller", surgeryName: "Doctor-booked", roomId: o.rooms[3].id, surgeonId: 2, scheduledDate: freshDay(), scheduledTime: "09:00" });
  assert.equal(attempt.status, 403, "booking needs OT write, which doctors don't have");
  assert.equal((await as(DOCTOR, "GET", "/api/ot/options")).status, 200);
  assert.equal((await as(DOCTOR, "GET", "/api/ot?all=true")).status, 200);
  assert.equal((await as(DOCTOR, "POST", "/api/ot/rooms", { name: "Nope" })).status, 403);
  for (const path of ["/api/ot", "/api/ot/options", "/api/ot/rooms", "/api/ot/equipment"]) assert.equal((await as(RECEPTION, "GET", path)).status, 403, path);
  assert.equal((await as(RECEPTION, "POST", "/api/ot/rooms", { name: "Nope" })).status, 403);
  assert.equal((await request("GET", "/api/ot/options")).status, 401);
});

test("a hospital with surgeries but no theatres list takes its theatres from those surgeries; it invents none otherwise", async () => {
  const { otRoomsRepo, otRepo } = await import("@/repositories");
  // Take the rooms away, as if this hospital predated them.
  const rooms = (await otRoomsRepo.listRows({ unpaged: true })).rows;
  for (const r of rooms) await otRoomsRepo.remove(r.id);
  for (const b of (await otRepo.listRows({ unpaged: true })).rows) await otRepo.update(b.id, { room_id: null });
  // Asked for twice at once, as the page does (rooms and options): still one theatre per name.
  const [first] = await Promise.all([as(ADMIN, "GET", "/api/ot/rooms"), as(ADMIN, "GET", "/api/ot/options"), as(ADMIN, "GET", "/api/ot/rooms")]);
  const adopted = first.data;
  const names = adopted.map((r: any) => r.name);
  for (const legacy of ["OT-1", "OT-2", "OT-3"]) assert.ok(names.includes(legacy), `${legacy} adopted from existing surgeries`);
  assert.ok(adopted.every((r: any) => r.kind === "Major" && r.active), "adopted as active major theatres, for the user to adjust");
  assert.equal(new Set(names).size, names.length, "one theatre per name");
  const linked = (await otRepo.listRows({ unpaged: true })).rows;
  assert.ok(linked.every((b) => b.room_id != null), "every surgery is linked to its theatre");
  assert.equal((await as(ADMIN, "GET", "/api/ot/rooms")).data.length, adopted.length, "and not adopted a second time");
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}\n        ${(err as Error).message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
