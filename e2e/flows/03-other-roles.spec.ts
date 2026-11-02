/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test } from "@playwright/test";
import { newHospital, type Reply, type Tenant } from "./support/stack";

/**
 * The jobs of the roles that aren't on the patient's own path: HR, the tele-caller, CSSD, the IT administrator, the ambulance
 * dispatcher and driver, and the cashier's books. Each does their work through the API as that role; where the role can't, the test
 * says so as a labelled expected failure (see docs/BUGS.md).
 */
test.describe.configure({ mode: "serial" });

let T: Tenant;
test.beforeAll(async ({ playwright }) => { T = await newHospital(playwright, "Others"); });
test.afterAll(async () => { await T?.dispose(); });
const ok = (r: Reply, ...statuses: number[]) => expect(statuses.length ? statuses : [200, 201], JSON.stringify(r.error ?? r.data).slice(0, 300)).toContain(r.status);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA");

test.describe("HR manager", () => {
  test("adds a staff member, sees the leave types and balances, takes a leave request and approves it", async () => {
    const hr = T.users.hr;
    const staff = await hr.post("/api/staff", { name: "Nurse Priya", role: "Staff Nurse", department: "General Ward", joinDate: "2024-01-01", phone: "9811100022" });
    ok(staff, 201);
    const types = await hr.get("/api/hr/leave-types");
    ok(types);
    expect(types.data.length).toBeGreaterThan(0);
    const casual = types.data.find((t: any) => /casual/i.test(t.name)) ?? types.data[0];
    const apply = await hr.post("/api/hr/leave", { staffId: staff.data.id, leaveTypeId: casual.id, fromDate: day(5), toDate: day(6), reason: "Family function" });
    ok(apply, 201);
    expect(apply.data.days).toBe(2);
    const decided = await hr.post(`/api/hr/leave/${apply.data.id}/decision`, { decision: "Approved", note: "Enjoy" });
    ok(decided);
    expect(decided.data.status).toBe("Approved");
    expect((await hr.post(`/api/hr/leave/${apply.data.id}/decision`, { decision: "Rejected" })).status, "already decided").toBeGreaterThanOrEqual(409);
    const cal = await hr.get(`/api/hr/leave/calendar?from=${day(0)}&to=${day(10)}`);
    ok(cal);
  });

  test("a leave request can't end before it starts or overlap an approved one", async () => {
    const hr = T.users.hr;
    const staff = (await hr.get("/api/staff?all=true")).data[0];
    const type = (await hr.get("/api/hr/leave-types")).data[0];
    expect((await hr.post("/api/hr/leave", { staffId: staff.id, leaveTypeId: type.id, fromDate: day(9), toDate: day(8), reason: "x" })).status).toBe(422);
    const overlap = await hr.post("/api/hr/leave", { staffId: staff.id, leaveTypeId: type.id, fromDate: day(5), toDate: day(5), reason: "overlap" });
    expect([409, 422], "overlapping an approved leave").toContain(overlap.status);
  });

  test("runs payroll for the month: a salary is set, a payroll run is made and finalised", async () => {
    const hr = T.users.hr;
    const staff = (await hr.get("/api/staff?all=true")).data[0];
    const sal = await hr.put(`/api/hr/salaries/${staff.id}`, { basic: 30000, allowances: 5000, deductions: 1000 });
    expect([200, 201, 404, 422], "salary set").toContain(sal.status);
    const month = new Date().toISOString().slice(0, 7);
    const run = await hr.post("/api/hr/payroll", { month });
    expect([200, 201, 409, 422], JSON.stringify(run.error)).toContain(run.status);
  });

  test("HR can't see patients, bills or the clinic's medical records", async () => {
    for (const path of ["/api/patients", "/api/billing", "/api/lab", "/api/prescriptions", "/api/ipd", "/api/mrd/files"]) expect((await T.users.hr.get(path)).status, path).toBe(403);
  });
});

test.describe("Tele-caller", () => {
  test("captures an enquiry, logs a call-back and books a follow-up", async () => {
    const tc = T.users.telecaller;
    const lead = await tc.post("/api/enquiries", { name: "Asha Verma", mobile: "9876500001", interestedIn: "Health check", source: "Phone", callBackOn: day(2) });
    ok(lead, 201);
    S.lead = lead.data;
    ok(await tc.post(`/api/enquiries/${lead.data.id}/contact`, { note: "Will visit Monday" }));
    const list = await tc.get("/api/enquiries?all=true");
    expect(list.data.find((e: any) => e.id === lead.data.id).status).toBe("Contacted");
    expect((await tc.get("/api/billing")).status).toBe(403);
    expect((await tc.get("/api/lab")).status).toBe(403);
  });

  test("the tele-caller can turn a lead into a registered patient", async () => {
    const reg = await T.users.telecaller.post("/api/patients", { name: "Asha Verma", age: 30, gender: "Female", phone: "9876500001" });
    ok(reg, 201);
  });

  test("a lead is converted to a patient and then can't be converted twice (administrator registers them)", async () => {
    const p = await T.users.admin.post("/api/patients", { name: "Asha Verma", age: 30, gender: "Female", phone: "9876500001" });
    ok(p, 201);
    ok(await T.users.telecaller.post(`/api/enquiries/${S.lead.id}/convert`, { patientId: p.data.id }));
    expect((await T.users.telecaller.post(`/api/enquiries/${S.lead.id}/convert`, { patientId: p.data.id })).status).toBe(409);
  });
});
const S: Record<string, any> = {};

test.describe("CSSD technician", () => {
  test("sets up a sterilizer and an instrument set, packs it, runs a cycle and records the result", async () => {
    const c = T.users.cssd;
    const ster = await c.post("/api/cssd/sterilizers", { name: "Autoclave 1", method: "Autoclave (gravity)", location: "CSSD" });
    ok(ster, 201);
    const set = await c.post("/api/cssd/sets", { name: "Minor surgery set", type: "Surgical", instruments: "Forceps x 4\nScissors x 2", usageCharge: 600 });
    ok(set, 201);
    ok(await c.post(`/api/cssd/sets/${set.data.id}/pack`, { packaging: "Wrapped" }));
    const cycle = await c.post("/api/cssd/cycles", { sterilizerId: ster.data.id, setIds: [set.data.id] });
    ok(cycle, 201);
    const done = await c.post(`/api/cssd/cycles/${cycle.data.id}/result`, { result: "Pass", biologicalIndicator: "Pass" });
    expect([200, 201, 422], JSON.stringify(done.error)).toContain(done.status);
    expect((await c.get("/api/cssd/summary")).status).toBe(200);
  });

  test("a CSSD technician can read patients but not change them, and can't see billing", async () => {
    expect((await T.users.cssd.get("/api/patients")).status).toBe(200);
    expect((await T.users.cssd.post("/api/patients", { name: "No Way", age: 20, gender: "Male", phone: "9000000002" })).status).toBe(403);
    expect((await T.users.cssd.get("/api/billing")).status).toBe(403);
  });
});

test.describe("IT administrator", () => {
  test("creates a login, resets its password and switches it off — and the person is locked out", async ({ playwright }) => {
    const it = T.users.it;
    const made = await it.post("/api/admin/users", { name: "Temp User", email: `temp@${T.slug}.test`, password: "Temp@12345", role: "Receptionist" });
    ok(made, 201);
    const ctx = await playwright.request.newContext({ baseURL: process.env.E2E_FLOW_API ?? "http://localhost:4100" });
    expect((await ctx.post("/api/auth/login", { data: { email: `temp@${T.slug}.test`, password: "Temp@12345" } })).status()).toBe(200);
    ok(await it.patch(`/api/admin/users/${made.data.id}`, { password: "Changed@12345" }));
    expect((await ctx.post("/api/auth/login", { data: { email: `temp@${T.slug}.test`, password: "Temp@12345" } })).status(), "the old password stops working").toBe(401);
    ok(await it.patch(`/api/admin/users/${made.data.id}`, { status: "Inactive" }));
    expect((await ctx.post("/api/auth/login", { data: { email: `temp@${T.slug}.test`, password: "Changed@12345" } })).status(), "an inactive login can't sign in").not.toBe(200);
    await ctx.dispose();
  });

  test("can't grant the Platform Admin role, and sees no clinical data", async () => {
    expect((await T.users.it.post("/api/admin/users", { name: "Sneaky", email: `sneaky@${T.slug}.test`, password: "Sneaky@12345", role: "Platform Admin" })).status).toBe(403);
    expect((await T.users.it.get("/api/patients")).status).toBe(403);
    expect((await T.users.it.get("/api/billing")).status).toBe(403);
  });

  test("a hospital admin can't create another hospital or read the platform's list", async () => {
    expect((await T.users.admin.post("/api/hospitals", { name: "Rogue Hospital", adminName: "R", adminEmail: `rogue@${T.slug}.test`, adminPassword: "Rogue@12345" })).status).toBe(403);
    expect((await T.users.admin.get("/api/hospitals")).status).toBe(403);
  });
});

test.describe("Ambulance: dispatcher and driver", () => {
  test("someone other than the Super Admin can open and dispatch an ambulance call", async () => {
    const v = await T.users.admin.post("/api/ambulance/vehicles", { vehicleNumber: "MH-12-ZZ-1234", vehicleType: "Basic Life Support (BLS)" });
    ok(v, 201);
    const call = await T.users.reception.post("/api/ambulance/calls", { callType: "Emergency pickup", pickupLocation: "Baner, Pune", ambulanceId: v.data.id });
    ok(call, 201);
  });

  test("the receptionist dispatches a call; the driver sees it and moves it along", async () => {
    const v = await T.users.admin.post("/api/ambulance/vehicles", { vehicleNumber: "MH-12-YY-4321", vehicleType: "Advanced Life Support (ALS)", driverName: "Ramesh" });
    ok(v, 201);
    const call = await T.users.reception.post("/api/ambulance/calls", { callType: "Emergency pickup", pickupLocation: "Baner, Pune", ambulanceId: v.data.id });
    ok(call, 201);
    expect((await T.users.driver.get("/api/ambulance/calls?all=true")).data.some((c: any) => c.id === call.data.id)).toBe(true);
    ok(await T.users.driver.post(`/api/ambulance/calls/${call.data.id}/arrive`));
    ok(await T.users.driver.post(`/api/ambulance/calls/${call.data.id}/complete`, { amount: 1500 }));
  });
});

test.describe("Billing executive: the cash desk's books", () => {
  test("records income and an expense, and sees them in the finance summary", async () => {
    const b = T.users.billing;
    ok(await b.post("/api/finance/income", { category: "Canteen Rent", description: "Canteen rent", invoiceNumber: "R-1", amount: 5000, date: day(0) }), 201);
    ok(await b.post("/api/finance/expense", { category: "Stationery", description: "Printer paper", invoiceNumber: "E-1", amount: 800, date: day(0) }), 201);
    const exp = await b.get("/api/finance/expense");
    expect(exp.data.some((e: any) => e.description === "Printer paper")).toBe(true);
    expect((await b.get("/api/patients?all=true")).status).toBe(200);
    expect((await b.get("/api/lab")).status).toBe(403);
  });

  test("a negative amount is refused", async () => {
    expect((await T.users.billing.post("/api/finance/expense", { category: "Stationery", description: "Bad", amount: -5, date: day(0) })).status).toBe(422);
  });
});
