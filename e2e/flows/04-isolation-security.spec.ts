/* eslint-disable @typescript-eslint/no-explicit-any -- API replies are untyped JSON in these tests */
import { expect, test } from "@playwright/test";
import { FLOW_API, newHospital, type Tenant } from "./support/stack";

/**
 * Two hospitals side by side. Whatever one does, the other must never see, change or count — and anyone who isn't signed in sees
 * nothing. Then the usual ways of getting a system to misbehave: odd input, over-long input, markup in names, values that aren't
 * what they claim to be.
 */
test.describe.configure({ mode: "serial" });
let A: Tenant, B: Tenant;
const S: Record<string, number> = {};

test.beforeAll(async ({ playwright }) => {
  A = await newHospital(playwright, "Alpha"); B = await newHospital(playwright, "Bravo");
  const a = A.users.admin;
  S.patient = (await a.post("/api/patients", { name: "Alpha Patient", age: 40, gender: "Male", phone: "9811000001" })).data.id;
  S.bill = (await a.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 500 })).data.id;
  S.lab = (await a.post("/api/lab/orders", { patientId: S.patient, patientName: "Alpha Patient", tests: [{ testName: "CBC" }] })).data.tests[0].id;
  S.adm = (await a.post("/api/ipd", { patientId: S.patient, patientName: "Alpha Patient", bedId: A.bedIds[0] })).data.id;
  S.consent = (await a.post("/api/consents", { patientId: S.patient, template: "general-consent", language: "English" })).data.id;
  S.rx = (await a.post("/api/prescriptions", { patientId: S.patient, patientName: "Alpha Patient", diagnosis: "Cold", items: [] })).data.id;
  S.opd = (await a.post("/api/opd", { patientId: S.patient, patientName: "Alpha Patient", doctorId: A.doctorId })).data.id;
  S.mrdFile = (await a.post("/api/mrd/files", { patientId: S.patient })).data.id;
  S.task = (await a.post("/api/tasks", { title: "Alpha task", assignedTo: 1 })).data?.id;
});
test.afterAll(async () => { await Promise.all([A?.dispose(), B?.dispose()]); });

test.describe("another hospital's records are out of reach", () => {
  const RECORDS: [string, () => number][] = [
    ["/api/patients", () => S.patient], ["/api/billing", () => S.bill], ["/api/lab", () => S.lab], ["/api/ipd", () => S.adm], ["/api/consents", () => S.consent],
    ["/api/prescriptions", () => S.rx], ["/api/opd", () => S.opd], ["/api/mrd/files", () => S.mrdFile],
  ];
  for (const [path, id] of RECORDS) {
    test(`${path}/:id of hospital A is not found, changed or deleted by hospital B's administrator`, async () => {
      const b = B.users.admin;
      expect((await b.get(`${path}/${id()}`)).status, "read").toBe(404);
      expect([404, 405, 403], "change").toContain((await b.patch(`${path}/${id()}`, { notes: "hijack", status: "Paid", name: "Hijacked" })).status);
      expect([404, 405, 403], "delete").toContain((await b.del(`${path}/${id()}`)).status);
    });
  }

  test("every list in hospital B is empty of hospital A's data", async () => {
    const b = B.users.admin;
    for (const path of ["/api/patients", "/api/billing", "/api/lab", "/api/ipd", "/api/consents", "/api/prescriptions", "/api/opd", "/api/mrd/files", "/api/appointments", "/api/radiology", "/api/pharmacy", "/api/followups", "/api/enquiries", "/api/housekeeping", "/api/audit", "/api/dietary/orders"]) {
      const r = await b.get(path.includes("?") ? path : `${path}?all=true`);
      expect(r.status, path).toBe(200);
      expect(JSON.stringify(r.data), `${path} leaks`).not.toContain("Alpha Patient");
    }
    const audit = (await b.get("/api/audit?pageSize=500")).data;
    expect(JSON.stringify(audit.rows)).not.toContain("Alpha");
  });

  test("hospital B can't act on hospital A's ids when creating its own records (a bed, a doctor, a patient)", async () => {
    const b = B.users.admin;
    expect((await b.post("/api/ipd", { patientId: S.patient, patientName: "Alpha Patient", bedId: B.bedIds[0] })).status, "someone else's patient").toBe(404);
    expect((await b.post("/api/ipd", { patientId: (await b.post("/api/patients", { name: "Bravo P", age: 30, gender: "Male", phone: "9811000002" })).data.id, patientName: "Bravo P", bedId: A.bedIds[1] })).status, "someone else's bed").toBe(404);
    expect((await b.post("/api/appointments", { patientName: "Bravo P", doctorId: A.doctorId, date: B.tomorrow, time: "10:00 AM" })).status, "someone else's doctor").toBe(404);
    expect((await b.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 10 })).status, "someone else's patient on a bill").toBe(404);
    expect((await b.post("/api/mrd/files", { patientId: S.patient })).status).toBe(404);
  });

  test("a client can't choose which hospital a record is saved to", async () => {
    const r = await B.users.admin.post("/api/patients", { name: "Smuggled", age: 30, gender: "Male", phone: "9811000003", hospital_id: A.hospitalId, hospitalId: A.hospitalId });
    expect(r.status).toBe(201);
    expect((await A.users.admin.get("/api/patients?all=true")).data.some((p: any) => p.name === "Smuggled")).toBe(false);
  });

  test("a hospital's staff can't read the other's analytics, reports, setup or users", async () => {
    const b = B.users.admin;
    const adminsA = (await A.users.admin.get("/api/admin/users")).data.map((u: any) => u.email);
    const adminsB = (await b.get("/api/admin/users")).data.map((u: any) => u.email);
    expect(adminsB.some((e: string) => adminsA.includes(e))).toBe(false);
    expect((await b.get(`/api/hospitals/${A.hospitalId}`)).status).toBe(403);
    expect((await b.get(`/api/hospitals/${A.hospitalId}/analytics`)).status).toBe(403);
    const day = (await b.get(`/api/reports/run?id=collection&from=${B.today}&to=${B.today}`)).data;
    expect(JSON.stringify(day)).not.toContain("Alpha");
  });

  test("a paused hospital can't be signed in to, and is open again when reactivated", async ({ playwright }) => {
    const c = await newHospital(playwright, "Pausing");
    expect((await c.platform.post(`/api/hospitals/${c.hospitalId}/pause`)).status).toBe(200);
    const ctx = await playwright.request.newContext({ baseURL: FLOW_API });
    expect((await ctx.post("/api/auth/login", { data: { email: c.email("admin"), password: "Flow@12345" } })).status(), "paused").not.toBe(200);
    expect((await c.platform.post(`/api/hospitals/${c.hospitalId}/activate`)).status).toBe(200);
    expect((await ctx.post("/api/auth/login", { data: { email: c.email("admin"), password: "Flow@12345" } })).status()).toBe(200);
    await ctx.dispose(); await c.dispose();
  });

  test("pausing a hospital also ends the sessions already open in it", async ({ playwright }) => {
    const c = await newHospital(playwright, "Pausing2");
    await c.platform.post(`/api/hospitals/${c.hospitalId}/pause`);
    const r = await c.users.admin.get("/api/patients");
    await c.platform.post(`/api/hospitals/${c.hospitalId}/activate`);
    await c.dispose();
    expect(r.status, "an already-open session of a paused hospital").not.toBe(200);
  });
});

test.describe("nobody signed in sees nothing", () => {
  test("every protected API answers 401 without a session", async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: FLOW_API });
    const paths = ["/api/patients", "/api/billing", "/api/lab", "/api/ipd", "/api/consents", "/api/prescriptions", "/api/opd", "/api/mrd/files", "/api/admin/users", "/api/audit", "/api/reports/catalog", "/api/analytics", "/api/housekeeping", "/api/dietary/board", "/api/waste/dashboard", "/api/training", "/api/ambulance/calls", "/api/staff", "/api/hr/leave", "/api/pharmacy", "/api/hospitals", "/api/auth/me"];
    for (const p of paths) expect((await anon.get(p)).status(), p).toBe(401);
    for (const p of ["/api/patients", "/api/billing", "/api/admin/users"]) expect((await anon.post(p, { data: { name: "x" } })).status(), `POST ${p}`).toBe(401);
    await anon.dispose();
  });

  test("the public consent endpoints say nothing about a wrong token, and need the right one", async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: FLOW_API });
    for (const t of ["", "nope", "' OR '1'='1", "../../etc/passwd", "a".repeat(5000)]) {
      const r = await anon.get(`/api/public/signatures?token=${encodeURIComponent(t)}`);
      expect([404, 400, 414], `token ${t.slice(0, 20)}`).toContain(r.status());
      expect(await r.text()).not.toMatch(/Alpha|patientName/);
    }
    await anon.dispose();
  });

  test("a logged-out session can't be reused", async ({ playwright }) => {
    const c = await newHospital(playwright, "Logout");
    const me = await c.users.admin.get("/api/auth/me");
    expect(me.status).toBe(200);
    await c.users.admin.post("/api/auth/logout");
    const after = await c.users.admin.get("/api/patients");
    expect(after.status, "after logging out").toBe(401);
    await c.dispose();
  });

  test("sign-in: a wrong password and an unknown address look the same, and the cookie can't be read by scripts", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: FLOW_API });
    const wrong = await ctx.post("/api/auth/login", { data: { email: A.email("admin"), password: "nope-nope" } });
    const unknown = await ctx.post("/api/auth/login", { data: { email: "nobody@nowhere.test", password: "nope-nope" } });
    expect([wrong.status(), unknown.status()]).toEqual([401, 401]);
    expect((await wrong.json()).error.message).toBe((await unknown.json()).error.message);
    const ok = await ctx.post("/api/auth/login", { data: { email: A.email("admin"), password: "Flow@12345" } });
    const cookie = ok.headers()["set-cookie"] ?? "";
    expect(cookie.toLowerCase(), "the session cookie is HttpOnly").toContain("httponly");
    expect(cookie.toLowerCase(), "and SameSite").toContain("samesite");
    await ctx.dispose();
  });

  test("repeated wrong passwords are slowed or locked out", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: FLOW_API });
    const codes: number[] = [];
    // (A throw-away address, so the lock-out doesn't land on an account the rest of the suite signs in with.)
    const email = `probe-${Date.now()}@${A.slug}.test`;
    for (let i = 0; i < 15; i++) codes.push((await ctx.post("/api/auth/login", { data: { email, password: `wrong-${i}` } })).status());
    expect(codes.some((c) => c === 429 || c === 423), `attempt statuses: ${codes.join(",")}`).toBe(true);
    await ctx.dispose();
  });
});

test.describe("odd input", () => {
  test("markup and quotes in names are stored as text and come back unchanged", async () => {
    const a = A.users.admin;
    const name = `<img src=x onerror=alert(1)> O'Brien "Q" & Sons`;
    const r = await a.post("/api/patients", { name, age: 33, gender: "Male", phone: "9811000010" });
    expect(r.status).toBe(201);
    expect((await a.get(`/api/patients/${r.data.id}`)).data.name).toBe(name);
  });

  test("operators in query strings are treated as plain text, not as database operators", async () => {
    const a = A.users.admin;
    for (const q of ["search[$ne]=x", "status[$gt]=", "search=%7B%22%24where%22%3A%22sleep(100)%22%7D", "sort=password_hash", "pageSize=-1", "page=abc", "pageSize=999999999"]) {
      const r = await a.get(`/api/patients?${q}`);
      expect([200, 400, 422], q).toContain(r.status);
      expect(JSON.stringify(r.data ?? ""), q).not.toContain("password_hash");
    }
  });

  test("over-long, empty and wrongly-typed fields are refused with a clear message, not a crash", async () => {
    const a = A.users.admin;
    const cases: [string, any][] = [
      ["name 5,000 characters", { name: "x".repeat(5000), age: 30, gender: "Male", phone: "9811000011" }],
      ["age is text", { name: "Typed Age", age: "forty", gender: "Male", phone: "9811000012" }],
      ["age is 500", { name: "Old Age", age: 500, gender: "Male", phone: "9811000013" }],
      ["negative age", { name: "Neg Age", age: -3, gender: "Male", phone: "9811000014" }],
      ["gender not allowed", { name: "Odd Gender", age: 30, gender: "Robot", phone: "9811000015" }],
    ];
    for (const [label, body] of cases) {
      const r = await a.post("/api/patients", body);
      expect([400, 422], label).toContain(r.status);
      expect(r.error?.message, label).toBeTruthy();
    }
    expect((await A.users.admin.post("/api/patients", "not json at all" as any)).status).toBeGreaterThanOrEqual(400);
  });

  test("a malformed email address is refused", async () => {
    const r = await A.users.admin.post("/api/patients", { name: "Bad Email", age: 30, gender: "Male", phone: "9811000017", email: "not-an-email" });
    expect([400, 422]).toContain(r.status);
  });

  test("an object or a list sent where text is expected is refused, not saved as \"[object Object]\"", async () => {
    const r = await A.users.admin.post("/api/patients", { name: { $ne: 1 }, age: 30, gender: "Male", phone: "9811000016" });
    if (r.status === 201) expect(r.data.name).not.toBe("[object Object]");
    expect([400, 422]).toContain(r.status);
  });

  test("an impossible calendar date (31 February) is refused as a date of birth", async () => {
    const r = await A.users.admin.post("/api/patients", { name: "Feb Thirty-one", gender: "Male", phone: "9811000019", dob: "2020-02-31" });
    expect([400, 422]).toContain(r.status);
  });

  test("a date of birth in the future, or an impossible one, is refused", async () => {
    const a = A.users.admin;
    for (const dob of ["2999-01-01", "yesterday"]) {
      const r = await a.post("/api/patients", { name: "Odd Dob", gender: "Male", phone: "9811000018", dob });
      expect.soft([400, 422], dob).toContain(r.status);
    }
  });

  test("money: a bill's parts add up whatever the discount, and a discount can't exceed the bill", async () => {
    const a = A.users.admin;
    const ok = await a.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 1000, discount: 250 });
    expect(ok.status).toBe(201);
    expect(Math.round(ok.data.total * 100)).toBe(Math.round((ok.data.amount - ok.data.discount + ok.data.gst) * 100));
    const odd = await a.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 33.333333 });
    expect(odd.status).toBe(201);
    expect(Number.isInteger(Math.round(odd.data.total * 100))).toBe(true);
  });

  test("a discount bigger than the bill is refused (the total can never be negative)", async () => {
    const over = await A.users.admin.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 100, discount: 500 });
    if (over.status === 201) expect(over.data.total, "the total after discount").toBeGreaterThanOrEqual(0);
    expect([400, 422], "a discount bigger than the bill").toContain(over.status);
  });

  test("a bill that is paid can't be pushed back to pending", async () => {
    const a = A.users.admin;
    const b = (await a.post("/api/billing", { patientId: S.patient, patientName: "Alpha Patient", type: "OPD", amount: 400 })).data;
    expect((await a.patch(`/api/billing/${b.id}`, { status: "Paid", paymentMode: "Cash" })).status).toBe(200);
    const back = await a.patch(`/api/billing/${b.id}`, { status: "Pending" });
    expect([400, 409, 422], "paid → pending").toContain(back.status);
  });
});
