/**
 * Tests for HR: leave (allowances, overlaps, approval, cancelling, leave showing in the directory and attendance), shifts
 * and the duty roster (including clashes with leave, copying a week and two edits at once), salary structures, monthly
 * payroll (the payslip arithmetic, unpaid leave, joining mid-month, draft → finalized), staff profile fields and
 * licence alerts, and permissions. In-process, in-memory.
 *
 *   npm run test:hr
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
const { computePayslip, firstPayableDay } = await import("@/services/hr-payroll-service");
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
const month = () => today().slice(0, 7);
let seq = 0;

const newStaff = async (over: Record<string, unknown> = {}) => {
  const r = await as(ADMIN, "POST", "/api/staff", { name: `HR Tester ${++seq}`, role: "Staff Nurse", department: "General Ward", joinDate: "1 Jan 2020", ...over });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  return r.data;
};
const leaveTypes = async () => (await as(ADMIN, "GET", "/api/hr/leave-types")).data as any[];
const typeOf = async (code: string) => (await leaveTypes()).find((t) => t.code === code);
const apply = async (staffId: number, code: string, fromDate: string, toDate: string, reason = "") =>
  as(ADMIN, "POST", "/api/hr/leave", { staffId, leaveTypeId: (await typeOf(code)).id, fromDate, toDate, reason });
const approve = async (id: number) => {
  const r = await as(ADMIN, "POST", `/api/hr/leave/${id}/decision`, { decision: "Approved" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  return r.data;
};
const setSalary = (staffId: number, over: Record<string, unknown> = {}) =>
  as(ADMIN, "PUT", `/api/hr/salaries/${staffId}`, { basic: 30000, hra: 12000, allowances: 3000, ...over });

// ── The payslip arithmetic (pure) ────────────────────────────────────────────

test("payslip: a full month pays the full structure, with PF on basic and flat professional tax", async () => {
  const f = computePayslip({ basic: 30000, hra: 12000, allowances: 3000, pfPercent: 12, profTax: 200, otherDeduction: 0 }, { month: "2026-10", joinDate: "2020-01-01", unpaidLeaveDays: 0, lopAdjust: 0 });
  assert.deepEqual([f.monthDays, f.paidDays, f.gross, f.pf, f.profTax, f.netPay], [31, 31, 45000, 3600, 200, 41200]);
});

test("payslip: unpaid days and loss-of-pay reduce the earnings in proportion", async () => {
  const f = computePayslip({ basic: 31000, hra: 0, allowances: 0, pfPercent: 12, profTax: 200, otherDeduction: 100 }, { month: "2026-10", joinDate: "", unpaidLeaveDays: 2, lopAdjust: 1 });
  assert.equal(f.paidDays, 28);
  assert.equal(f.basic, 28000);
  assert.equal(f.pf, 3360);
  assert.equal(f.netPay, 28000 - 3360 - 200 - 100);
  const everyDay = computePayslip({ basic: 31000, hra: 0, allowances: 0, pfPercent: 12, profTax: 200, otherDeduction: 100 }, { month: "2026-10", joinDate: "", unpaidLeaveDays: 31, lopAdjust: 5 });
  assert.deepEqual([everyDay.paidDays, everyDay.gross, everyDay.profTax, everyDay.otherDeduction, everyDay.netPay], [0, 0, 0, 0, 0]);
});

test("payslip: someone who joined mid-month is paid from the join day; one who joins later isn't in the run", async () => {
  assert.equal(firstPayableDay("2026-10", "2026-10-16"), 16);
  assert.equal(firstPayableDay("2026-10", "2026-11-01"), null);
  assert.equal(firstPayableDay("2026-10", "2019-05-02"), 1);
  const f = computePayslip({ basic: 31000, hra: 0, allowances: 0, pfPercent: 0, profTax: 0, otherDeduction: 0 }, { month: "2026-10", joinDate: "2026-10-16", unpaidLeaveDays: 0, lopAdjust: 0 });
  assert.deepEqual([f.paidDays, f.basic], [16, 16000]);
});

test("payslip: professional tax starts at the gross threshold", async () => {
  const t = { basic: 14999, hra: 0, allowances: 0, pfPercent: 0, profTax: 200, otherDeduction: 0 };
  const c = { month: "2026-10", joinDate: "", unpaidLeaveDays: 0, lopAdjust: 0 };
  assert.equal(computePayslip(t, c).profTax, 0);
  assert.equal(computePayslip({ ...t, basic: 15000 }, c).profTax, 200);
});

// ── Leave ────────────────────────────────────────────────────────────────────

test("leave types: a hospital starts with casual, sick, earned and unpaid leave; new ones need a unique name and code", async () => {
  const types = await leaveTypes();
  assert.deepEqual(types.map((t) => t.code).sort(), ["CL", "EL", "LWP", "SL"]);
  assert.equal((await as(ADMIN, "POST", "/api/hr/leave-types", { name: "Casual leave", code: "XX", daysPerYear: 3, paid: true })).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/hr/leave-types", { name: "Study leave", code: "CL", daysPerYear: 3, paid: true })).status, 409);
  const made = await as(ADMIN, "POST", "/api/hr/leave-types", { name: "Study leave", code: "STD", daysPerYear: 5, paid: true });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(ADMIN, "PATCH", `/api/hr/leave-types/${made.data.id}`, { active: false })).status, 200);
  const s = await newStaff();
  assert.equal((await apply(s.id, "STD", addDays(today(), 1), addDays(today(), 1))).status, 409, "a switched-off type can't be used");
});

test("leave: days count inclusively, overlaps are refused, the yearly allowance includes what is waiting", async () => {
  const s = await newStaff();
  const from = addDays(today(), 3), to = addDays(from, 3);
  const a = await apply(s.id, "CL", from, to, "Wedding");
  assert.equal(a.status, 201, JSON.stringify(a.error));
  assert.equal(a.data.days, 4);
  assert.equal(a.data.status, "Pending");
  const clash = await apply(s.id, "SL", addDays(to, 0), addDays(to, 2));
  assert.equal(clash.status, 409);
  assert.match(clash.error!.message, /already has pending leave/);
  // 12 casual days a year: 4 are waiting, so 9 more is too many and 8 fits.
  assert.equal((await apply(s.id, "CL", addDays(to, 5), addDays(to, 13))).status, 409);
  const ok = await apply(s.id, "CL", addDays(to, 5), addDays(to, 12));
  assert.equal(ok.status, 201, JSON.stringify(ok.error));
  const bal = (await as(ADMIN, "GET", `/api/hr/leave/balances?year=${from.slice(0, 4)}`)).data.find((b: any) => b.staffId === s.id);
  const cl = bal.balances.find((b: any) => b.code === "CL");
  assert.deepEqual([cl.allocated, cl.used, cl.pending, cl.remaining], [12, 0, 12, 0]);
});

test("leave: bad dates are refused — backwards, too far back, across two years", async () => {
  const s = await newStaff();
  assert.equal((await apply(s.id, "LWP", addDays(today(), 5), addDays(today(), 4))).status, 422);
  assert.equal((await apply(s.id, "LWP", addDays(today(), -90), addDays(today(), -89))).status, 422);
  assert.equal((await apply(s.id, "LWP", `${Number(today().slice(0, 4))}-12-30`, `${Number(today().slice(0, 4)) + 1}-01-02`)).status, 422);
  assert.equal((await apply(999999, "LWP", today(), today())).status, 404);
});

test("leave: rejecting needs a reason; a decided request can't be decided again", async () => {
  const s = await newStaff();
  const a = (await apply(s.id, "LWP", addDays(today(), 20), addDays(today(), 21))).data;
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${a.id}/decision`, { decision: "Rejected" })).status, 422);
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${a.id}/decision`, { decision: "Maybe" })).status, 422);
  const r = await as(ADMIN, "POST", `/api/hr/leave/${a.id}/decision`, { decision: "Rejected", note: "Short-staffed that week" });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "Rejected");
  assert.equal(r.data.decisionNote, "Short-staffed that week");
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${a.id}/decision`, { decision: "Approved" })).status, 409);
  // The days are free again once rejected.
  assert.equal((await apply(s.id, "LWP", addDays(today(), 20), addDays(today(), 21))).status, 201);
});

test("leave: two approvals racing for the last days of an allowance — only one fits", async () => {
  const s = await newStaff();
  const sl = await typeOf("SL"); // 10 a year
  const a = (await apply(s.id, "SL", addDays(today(), 30), addDays(today(), 35))).data; // 6
  // A second request that is within the allowance while a is pending (6 + 4), then both approved: fine…
  const b = (await apply(s.id, "SL", addDays(today(), 40), addDays(today(), 43))).data; // 4
  const [x, y] = await Promise.all([as(ADMIN, "POST", `/api/hr/leave/${a.id}/decision`, { decision: "Approved" }), as(ADMIN, "POST", `/api/hr/leave/${b.id}/decision`, { decision: "Approved" })]);
  assert.deepEqual([x.status, y.status], [200, 200]);
  assert.equal(sl.daysPerYear, 10);
  // …but the allowance is now used up entirely.
  assert.equal((await apply(s.id, "SL", addDays(today(), 50), addDays(today(), 50))).status, 409);
});

test("leave: approved leave today shows as On Leave in the directory, in today's attendance and in the monthly register", async () => {
  const s = await newStaff();
  const before = (await as(ADMIN, "GET", "/api/staff/attendance/today")).data.onLeave;
  const a = (await apply(s.id, "CL", today(), addDays(today(), 1))).data;
  assert.equal((await as(ADMIN, "GET", `/api/staff/${s.id}`)).data.status, "Active", "pending leave changes nothing");
  await approve(a.id);
  assert.equal((await as(ADMIN, "GET", `/api/staff/${s.id}`)).data.status, "On Leave");
  const list = (await as(ADMIN, "GET", "/api/staff?pageSize=100")).data as any[];
  assert.equal(list.find((x) => x.id === s.id).status, "On Leave");
  assert.equal((await as(ADMIN, "GET", "/api/staff/attendance/today")).data.onLeave, before + 1);
  const reg = (await as(ADMIN, "GET", `/api/staff/attendance/summary?month=${month()}`)).data;
  const row = reg.staff.find((x: any) => x.staffId === s.id);
  assert.equal(row.days[String(Number(today().slice(8, 10)))].status, "On Leave");
  const cal = (await as(ADMIN, "GET", `/api/hr/leave/calendar?month=${month()}`)).data;
  assert.ok(JSON.stringify(cal).includes(s.name));
});

test("leave: pending or future-approved leave can be cancelled; leave that has started can't", async () => {
  const s = await newStaff();
  const p = (await apply(s.id, "LWP", addDays(today(), 8), addDays(today(), 9))).data;
  const c = await as(ADMIN, "POST", `/api/hr/leave/${p.id}/cancel`);
  assert.equal(c.status, 200);
  assert.equal(c.data.status, "Cancelled");
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${p.id}/cancel`)).status, 409);
  const future = (await apply(s.id, "LWP", addDays(today(), 8), addDays(today(), 9))).data;
  await approve(future.id);
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${future.id}/cancel`)).status, 200);
  const started = (await apply(s.id, "LWP", today(), today())).data;
  await approve(started.id);
  assert.equal((await as(ADMIN, "POST", `/api/hr/leave/${started.id}/cancel`)).status, 409);
});

// ── Shifts and the roster ────────────────────────────────────────────────────

const shifts = async () => (await as(ADMIN, "GET", "/api/hr/shifts")).data as any[];
const shiftOf = async (code: string) => (await shifts()).find((s) => s.code === code);
const roster = async (from: string, to: string) => (await as(ADMIN, "GET", `/api/hr/roster?from=${from}&to=${to}`)).data;
const put = (staffId: number, date: string, shiftId: number | null) => as(ADMIN, "PUT", "/api/hr/roster", { staffId, date, shiftId });

test("shifts: the usual four exist; times must be HH:MM, different, and names unique", async () => {
  assert.deepEqual((await shifts()).map((s) => s.code).sort(), ["E", "G", "M", "N"]);
  assert.equal((await as(ADMIN, "POST", "/api/hr/shifts", { name: "Broken", code: "B", start: "9am", end: "17:00" })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/hr/shifts", { name: "Zero", code: "Z", start: "09:00", end: "09:00" })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/hr/shifts", { name: "Morning", code: "MM", start: "06:00", end: "14:00" })).status, 409);
  const made = await as(ADMIN, "POST", "/api/hr/shifts", { name: "Split", code: "SP", start: "10:00", end: "20:00" });
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.equal((await as(ADMIN, "PATCH", `/api/hr/shifts/${made.data.id}`, { end: "19:00" })).data.end, "19:00");
});

test("roster: assign, change and clear a shift; one shift per person per day, even when two edits race", async () => {
  const s = await newStaff();
  const m = await shiftOf("M"), e = await shiftOf("E");
  const d = addDays(today(), 2);
  assert.equal((await put(s.id, d, m.id)).status, 200);
  assert.equal((await put(s.id, d, e.id)).status, 200);
  let mine = (await roster(d, d)).entries.filter((x: any) => x.staffId === s.id);
  assert.deepEqual(mine.map((x: any) => x.shiftId), [e.id]);
  await Promise.all([put(s.id, addDays(d, 1), m.id), put(s.id, addDays(d, 1), e.id), put(s.id, addDays(d, 1), m.id)]);
  mine = (await roster(addDays(d, 1), addDays(d, 1))).entries.filter((x: any) => x.staffId === s.id);
  assert.equal(mine.length, 1, "exactly one row");
  assert.equal((await put(s.id, d, null)).status, 200);
  assert.equal((await roster(d, d)).entries.filter((x: any) => x.staffId === s.id).length, 0);
  assert.equal((await put(s.id, addDays(today(), -30), m.id)).status, 422, "too far back");
  assert.equal((await put(s.id, d, 999999)).status, 404);
  assert.equal((await as(ADMIN, "PUT", "/api/hr/roster", { staffId: s.id, date: "soon", shiftId: m.id })).status, 422);
  assert.equal((await as(ADMIN, "GET", `/api/hr/roster?from=${today()}&to=${addDays(today(), 90)}`)).status, 422, "range cap");
});

test("roster: nobody can be rostered on approved leave, and approving leave takes them off shifts already given", async () => {
  const s = await newStaff();
  const m = await shiftOf("M");
  const d1 = addDays(today(), 4), d2 = addDays(today(), 5);
  await put(s.id, d1, m.id);
  await put(s.id, d2, m.id);
  const a = (await apply(s.id, "CL", d1, d1)).data;
  await approve(a.id);
  const r = await roster(d1, d2);
  assert.deepEqual(r.entries.filter((x: any) => x.staffId === s.id).map((x: any) => x.date), [d2], "the leave day was cleared, the other kept");
  assert.ok(r.leaveDays.some((x: any) => x.staffId === s.id && x.date === d1));
  const blocked = await put(s.id, d1, m.id);
  assert.equal(blocked.status, 409);
  assert.match(blocked.error!.message, /on approved leave/);
});

test("roster: copying a week skips days already filled and days on leave, and is repeatable", async () => {
  const s = await newStaff();
  const n = await shiftOf("N");
  const src = addDays(today(), 14), dst = addDays(src, 7);
  for (let i = 0; i < 4; i++) await put(s.id, addDays(src, i), n.id);
  await put(s.id, addDays(dst, 1), n.id); // already there
  const leave = (await apply(s.id, "LWP", addDays(dst, 2), addDays(dst, 2))).data;
  await approve(leave.id);
  const first = await as(ADMIN, "POST", "/api/hr/roster/copy", { fromStart: src, toStart: dst });
  assert.equal(first.status, 200, JSON.stringify(first.error));
  const mine = (await roster(dst, addDays(dst, 6))).entries.filter((x: any) => x.staffId === s.id).map((x: any) => x.date).sort();
  assert.deepEqual(mine, [dst, addDays(dst, 1), addDays(dst, 3)].sort());
  assert.ok(first.data.skippedExisting >= 1 && first.data.skippedLeave >= 1);
  const again = await as(ADMIN, "POST", "/api/hr/roster/copy", { fromStart: src, toStart: dst });
  assert.equal(again.data.copied, 0, "nothing new the second time");
  assert.equal((await as(ADMIN, "POST", "/api/hr/roster/copy", { fromStart: src, toStart: src })).status, 422);
});

test("duty list: groups who is on each shift by department, lists those on leave and counts the unrostered", async () => {
  const s = await newStaff({ department: "Dialysis" });
  const g = await shiftOf("G");
  const d = addDays(today(), 3);
  await put(s.id, d, g.id);
  const duty = (await as(ADMIN, "GET", `/api/hr/roster/duty?date=${d}`)).data;
  assert.equal(duty.date, d);
  const general = duty.shifts.find((x: any) => x.shift.code === "G");
  assert.ok(general.departments.find((x: any) => x.department === "Dialysis").staff.some((p: any) => p.id === s.id));
  assert.ok(duty.unrostered >= 1);
});

// ── Salaries and payroll ─────────────────────────────────────────────────────

test("salary: set and change a structure; negative or missing figures are refused; the list says who has none", async () => {
  const s = await newStaff();
  const none = ((await as(ADMIN, "GET", "/api/hr/salaries")).data as any[]).find((x) => x.staffId === s.id);
  assert.equal(none.set, false);
  assert.equal((await as(ADMIN, "PUT", `/api/hr/salaries/${s.id}`, { hra: 100 })).status, 422);
  assert.equal((await setSalary(s.id, { basic: -5 })).status, 422);
  assert.equal((await setSalary(s.id, { pfPercent: 140 })).status, 422);
  const set = await setSalary(s.id);
  assert.equal(set.status, 200, JSON.stringify(set.error));
  assert.equal(set.data.gross, 45000);
  assert.equal((await setSalary(s.id, { basic: 35000 })).data.gross, 50000);
  const list = ((await as(ADMIN, "GET", "/api/hr/salaries")).data as any[]).filter((x) => x.staffId === s.id);
  assert.equal(list.length, 1, "changing a salary doesn't add a second row");
  assert.equal((await setSalary(999999)).status, 404);
});

test("payroll: a run covers people with a salary, deducts approved unpaid leave only, and skips those who haven't joined", async () => {
  const paid = await newStaff();
  const unpaid = await newStaff();
  const nosalary = await newStaff();
  const future = await newStaff({ joinDate: addDays(today(), 40) });
  await setSalary(paid.id);
  await setSalary(unpaid.id);
  await setSalary(future.id);
  // Two unpaid days and one paid day in this month (the 1st–3rd, which are never more than 31 days back).
  const m = month();
  const lwp = (await apply(unpaid.id, "LWP", `${m}-01`, `${m}-02`)).data;
  await approve(lwp.id);
  const cl = (await apply(paid.id, "CL", `${m}-03`, `${m}-03`)).data;
  await approve(cl.id);

  const gen = await as(ADMIN, "POST", "/api/hr/payroll", { month: m });
  assert.equal(gen.status, 201, JSON.stringify(gen.error));
  assert.equal(gen.data.status, "Draft");
  const slip = (id: number) => gen.data.payslips.find((p: any) => p.staffId === id);
  const days = slip(paid.id).monthDays;
  assert.deepEqual([slip(paid.id).paidDays, slip(paid.id).unpaidLeaveDays, slip(paid.id).gross], [days, 0, 45000], "paid leave isn't deducted");
  assert.deepEqual([slip(unpaid.id).paidDays, slip(unpaid.id).unpaidLeaveDays], [days - 2, 2]);
  const u = slip(unpaid.id);
  assert.equal(u.gross, u.basic + u.hra + u.allowances);
  assert.equal(u.netPay, u.gross - u.pf - u.profTax - u.otherDeduction);
  assert.ok(u.gross < 45000);
  assert.equal(slip(nosalary.id), undefined);
  assert.equal(slip(future.id), undefined);
  assert.ok(gen.data.skipped.some((x: any) => x.staffId === nosalary.id && x.reason === "No salary set"));
  assert.ok(gen.data.skipped.some((x: any) => x.staffId === future.id && x.reason === "Joined after this month"));
  assert.equal(gen.data.totalNet, gen.data.payslips.reduce((n: number, p: any) => n + p.netPay, 0));
  assert.equal(gen.data.staffCount, gen.data.payslips.length);
});

test("payroll: regenerating a draft picks up new salaries and keeps HR's loss-of-pay entries; adjusting recalculates and updates the totals", async () => {
  const s = await newStaff();
  await setSalary(s.id);
  const m = month();
  const first = (await as(ADMIN, "POST", "/api/hr/payroll", { month: m })).data;
  const slip = first.payslips.find((p: any) => p.staffId === s.id);
  const adj = await as(ADMIN, "PATCH", `/api/hr/payslips/${slip.id}`, { lopAdjust: 3 });
  assert.equal(adj.status, 200, JSON.stringify(adj.error));
  assert.equal(adj.data.paidDays, slip.monthDays - 3);
  assert.ok(adj.data.netPay < slip.netPay);
  assert.equal((await as(ADMIN, "PATCH", `/api/hr/payslips/${slip.id}`, { lopAdjust: -1 })).status, 422);
  const other = await as(ADMIN, "PATCH", `/api/hr/payslips/${slip.id}`, { otherDeduction: 500 });
  assert.equal(other.data.otherDeduction, 500);
  assert.equal(other.data.paidDays, slip.monthDays - 3, "the loss-of-pay stays");
  await setSalary(s.id, { basic: 60000 });
  const again = (await as(ADMIN, "POST", "/api/hr/payroll", { month: m })).data;
  assert.equal(again.id, first.id, "the same run, recalculated");
  const re = again.payslips.find((p: any) => p.staffId === s.id);
  assert.equal(re.lopAdjust, 3, "loss-of-pay survives");
  assert.equal(re.basic, Math.round(60000 * re.paidDays / re.monthDays));
  assert.equal(again.totalNet, again.payslips.reduce((n: number, p: any) => n + p.netPay, 0));
  assert.equal(((await as(ADMIN, "GET", "/api/hr/payroll")).data as any[]).filter((r) => r.month === m).length, 1, "one run per month");
});

test("payroll: two people generating the same month at once still leave one run", async () => {
  const s = await newStaff();
  await setSalary(s.id);
  const m = month();
  const results = await Promise.all([1, 2, 3].map(() => as(ADMIN, "POST", "/api/hr/payroll", { month: m })));
  assert.ok(results.every((r) => r.status === 201), JSON.stringify(results.map((r) => r.error)));
  assert.equal(new Set(results.map((r) => r.data.id)).size, 1);
  const slips = results[0].data.payslips.filter((p: any) => p.staffId === s.id);
  assert.equal(slips.length, 1);
});

test("payroll: the month must have started, and a finalized run is frozen", async () => {
  const s = await newStaff();
  await setSalary(s.id);
  const nextMonth = addDays(`${month()}-28`, 7).slice(0, 7);
  assert.equal((await as(ADMIN, "POST", "/api/hr/payroll", { month: nextMonth })).status, 422);
  assert.equal((await as(ADMIN, "POST", "/api/hr/payroll", { month: "October" })).status, 422);
  // Use a past month so the finalized run doesn't block the current month for the other tests.
  const past = addDays(`${month()}-01`, -20).slice(0, 7);
  const run = (await as(ADMIN, "POST", "/api/hr/payroll", { month: past })).data;
  assert.ok(run.payslips.some((p: any) => p.staffId === s.id));
  const fin = await as(ADMIN, "POST", `/api/hr/payroll/${run.id}/finalize`);
  assert.equal(fin.status, 200, JSON.stringify(fin.error));
  assert.equal(fin.data.status, "Finalized");
  assert.equal(fin.data.finalizedBy.length > 0, true);
  const slip = run.payslips[0];
  assert.equal((await as(ADMIN, "POST", `/api/hr/payroll/${run.id}/finalize`)).status, 409);
  assert.equal((await as(ADMIN, "POST", "/api/hr/payroll", { month: past })).status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/hr/payslips/${slip.id}`, { lopAdjust: 1 })).status, 409);
  assert.equal((await as(ADMIN, "DELETE", `/api/hr/payroll/${run.id}`)).status, 409);
  const detail = (await as(ADMIN, "GET", `/api/hr/payroll/${run.id}`)).data;
  assert.equal(detail.payslips.length, run.payslips.length);
  assert.deepEqual(detail.skipped, [], "a finalized run lists no skipped people");
});

test("payroll: a draft run can be deleted, then it is gone", async () => {
  const past = addDays(`${month()}-01`, -50).slice(0, 7);
  const run = (await as(ADMIN, "POST", "/api/hr/payroll", { month: past })).data;
  const del = await as(ADMIN, "DELETE", `/api/hr/payroll/${run.id}`);
  assert.equal(del.status, 204);
  assert.equal((await as(ADMIN, "GET", `/api/hr/payroll/${run.id}`)).status, 404);
});

// ── Staff profile, licences, overview ────────────────────────────────────────

test("staff profile: the HR fields save, dates can be cleared, and the employee ID is unique", async () => {
  const a = await newStaff();
  const b = await newStaff();
  assert.match(a.employeeNo, /^EMP-\d+$/);
  const upd = await as(ADMIN, "PATCH", `/api/staff/${a.id}`, { qualification: "GNM", licenceNo: "GNC-1", licenceExpiry: addDays(today(), 20), dob: "1990-04-02", emergencyName: "Asha", emergencyPhone: "+91 99999 00000", gender: "Female", address: "Ahmedabad" });
  assert.equal(upd.status, 200, JSON.stringify(upd.error));
  assert.deepEqual([upd.data.qualification, upd.data.licenceNo, upd.data.licenceExpiry, upd.data.dob, upd.data.emergencyName], ["GNM", "GNC-1", addDays(today(), 20), "1990-04-02", "Asha"]);
  assert.equal((await as(ADMIN, "PATCH", `/api/staff/${a.id}`, { licenceExpiry: "next week" })).status, 422);
  const cleared = await as(ADMIN, "PATCH", `/api/staff/${a.id}`, { dob: null, licenceExpiry: "" });
  assert.deepEqual([cleared.data.dob, cleared.data.licenceExpiry], [null, null]);
  assert.equal((await as(ADMIN, "PATCH", `/api/staff/${a.id}`, { employeeNo: "EMP-777" })).status, 200);
  const dup = await as(ADMIN, "PATCH", `/api/staff/${b.id}`, { employeeNo: "EMP-777" });
  assert.equal(dup.status, 409);
  assert.equal((await as(ADMIN, "PATCH", `/api/staff/${a.id}`, { employeeNo: "EMP-777" })).status, 200, "keeping your own number is fine");
});

test("overview: counts, pending leave, licences lapsing or lapsed, today's shifts and the latest payroll", async () => {
  const s = await newStaff();
  await as(ADMIN, "PATCH", `/api/staff/${s.id}`, { licenceNo: "L-9", licenceExpiry: addDays(today(), 10) });
  const gone = await newStaff();
  await as(ADMIN, "PATCH", `/api/staff/${gone.id}`, { licenceNo: "L-1", licenceExpiry: addDays(today(), -3) });
  const far = await newStaff();
  await as(ADMIN, "PATCH", `/api/staff/${far.id}`, { licenceNo: "L-2", licenceExpiry: addDays(today(), 400) });
  await apply(s.id, "LWP", addDays(today(), 12), addDays(today(), 12));
  await put(s.id, today(), (await shiftOf("M")).id);
  const o = (await as(ADMIN, "GET", "/api/hr/overview")).data;
  assert.equal(o.today, today());
  assert.ok(o.staff.total >= 12);
  assert.ok(o.pendingLeave >= 1);
  const l = (id: number) => o.licences.find((x: any) => x.staffId === id);
  assert.equal(l(s.id).daysLeft, 10);
  assert.equal(l(gone.id).daysLeft, -3);
  assert.equal(l(far.id), undefined, "a licence a year off isn't flagged");
  assert.ok(o.licences.findIndex((x: any) => x.staffId === gone.id) < o.licences.findIndex((x: any) => x.staffId === s.id), "most urgent first");
  assert.ok(o.roster.find((x: any) => x.code === "M").count >= 1);
  assert.equal(o.payroll.month.length, 7);
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: payroll is hidden from clinicians, the front desk and billing; HR can't be reached without a login", async () => {
  for (const email of [DOCTOR, RECEPTION, BILLING]) {
    for (const path of ["/api/hr/salaries", "/api/hr/payroll"]) assert.equal((await as(email, "GET", path)).status, 403, `${email} ${path}`);
    assert.equal((await as(email, "POST", "/api/hr/payroll", { month: month() })).status, 403);
    assert.equal((await as(email, "PUT", "/api/hr/salaries/1", { basic: 1 })).status, 403);
  }
  for (const email of [RECEPTION, BILLING]) {
    for (const path of ["/api/hr/overview", "/api/hr/leave", "/api/hr/shifts", "/api/hr/roster"]) assert.equal((await as(email, "GET", path)).status, 403, `${email} ${path}`);
    assert.equal((await as(email, "POST", "/api/hr/leave", { staffId: 1, leaveTypeId: 1, fromDate: today(), toDate: today() })).status, 403);
  }
  for (const path of ["/api/hr/overview", "/api/hr/leave", "/api/hr/salaries", "/api/hr/payroll"]) assert.equal((await request("GET", path)).status, 401);
  assert.equal((await as(ADMIN, "GET", "/api/hr/overview")).status, 200);
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
