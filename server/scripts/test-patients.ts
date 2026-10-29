/**
 * Tests for patient registration with the wider profile: only name, gender and mobile are
 * required; personal/work/payer/COVID details are stored; identity documents keep only the last
 * four characters and a fingerprint, Aadhaar is checksum-validated and can't be registered twice.
 *
 *   npm run test:patients
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo } = await import("@/repositories");
const { verhoeffCheckDigit, verhoeffValid } = await import("@/lib/identity-documents");

// ── Harness ──────────────────────────────────────────────────────────────────

const { app } = await createApp();

if (process.env.DATABASE_DRIVER === "mongo") {
  const { getDb } = await import("@/db");
  const mongo = (await getDb()) as unknown as { database(): Promise<import("mongodb").Db> };
  const meta = (await mongo.database()).collection("_meta");
  for (let i = 0; i < 240 && !(await meta.findOne({ _id: "schema" } as never)); i++) await new Promise((r) => setTimeout(r, 500));
}

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
const admin = (m: string, p: string, b?: unknown) => as(ADMIN, m, p, b);

let n = 0;
/** A different valid mobile number each time. */
const mobile = () => `9${String(100000000 + ++n * 7919).slice(0, 9)}`.slice(0, 10);
/** A valid, unused Aadhaar: 11 digits (first 2-9) plus the Verhoeff check digit. */
const aadhaar = () => { const body = `${2 + (n % 8)}${String(10_000_000_000 + ++n * 104729).slice(0, 10)}`; return body + verhoeffCheckDigit(body); };

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("the Verhoeff helper agrees with itself", async () => {
  const body = "23412341234";
  assert.ok(verhoeffValid(body + verhoeffCheckDigit(body)));
  assert.ok(!verhoeffValid(body + ((verhoeffCheckDigit(body) + 1) % 10)));
});

test("only name, gender and mobile are needed to register", async () => {
  const r = await admin("POST", "/api/patients", { name: "Asha Patel", gender: "Female", phone: mobile() });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.name, "Asha Patel");
  assert.deepEqual([r.data.payers, r.data.identityDocuments, r.data.covid], [[], [], null]);
  assert.equal((await admin("POST", "/api/patients", { name: "No Gender", phone: mobile() })).status, 422);
  assert.equal((await admin("POST", "/api/patients", { name: "No Mobile", gender: "Male" })).status, 422);
  assert.equal((await admin("POST", "/api/patients", { gender: "Male", phone: mobile() })).status, 422);
});

test("an age in years and months is kept when there is no date of birth", async () => {
  const r = await admin("POST", "/api/patients", { name: "Baby Rao", gender: "Male", phone: mobile(), age: 0, ageMonths: 4 });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual([r.data.age, r.data.ageMonths], [0, 4]);
  assert.equal((await admin("POST", "/api/patients", { name: "Bad Months", gender: "Male", phone: mobile(), ageMonths: 12 })).status, 422);
});

test("every profile field is stored and returned", async () => {
  const body = {
    name: "Ravi Menon", gender: "Male", phone: mobile(), dob: "1985-03-12", email: "ravi@example.com", reason: "Chest pain",
    referralSource: "Walk-in", medicoLegal: true, temporary: false, dataConsent: true,
    alternatePhone: "9876543210", address: "12 MG Road", addressLine2: "Near the park", city: "Pune", state: "Maharashtra", pincode: "411001",
    title: "Mr", guardianName: "K. Menon", careOf: "S. Menon", anniversary: "2012-11-20", bloodGroup: "B+", maritalStatus: "Married",
    religion: "Hindu", language: "Malayalam", nationality: "Indian", education: "Graduate", abhaId: "12345678901234", notes: "Prefers morning slots",
    occupation: "Engineer", employer: "Acme Ltd", designation: "Manager", workPhone: "02012345678", privilegeCardNo: "PC-1001", corporate: "Acme Ltd",
    allergies: "Penicillin", chronic: "Asthma", emergencyName: "Sita Menon", emergencyRelation: "spouse", emergencyPhone: "9812345678",
    payers: [{ type: "Insurance", name: "Star Health", policyNumber: "SH-778", validUntil: "2027-03-31" }, { type: "Corporate", name: "Acme Ltd", policyNumber: "", validUntil: "" }],
    covid: { vaccination: "Fully vaccinated", lastDose: "2022-01-10", infectedBefore: true },
  };
  const r = await admin("POST", "/api/patients", body);
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const d = (await admin("GET", `/api/patients/${r.data.id}`)).data;
  for (const k of ["referralSource", "alternatePhone", "addressLine2", "title", "guardianName", "careOf", "anniversary", "maritalStatus", "religion", "language", "nationality", "education", "notes", "occupation", "employer", "designation", "workPhone", "privilegeCardNo"] as const) {
    assert.equal(d[k], (body as Record<string, unknown>)[k], k);
  }
  assert.deepEqual([d.medicoLegal, d.temporary, d.dataConsent], [true, false, true]);
  assert.deepEqual(d.allergies, ["Penicillin"]);
  assert.equal(d.emergencyName, "Sita Menon");
  assert.equal(d.payers.length, 2);
  assert.equal(d.payers[0].policyNumber, "SH-778");
  assert.deepEqual(d.covid, body.covid);
  // the older insurance fields still fill from the first insurance payer
  assert.deepEqual([d.insurer, d.policyNumber], ["Star Health", "SH-778"]);
});

test("identity documents keep the last four characters and a fingerprint — never the whole number", async () => {
  const num = aadhaar();
  const r = await admin("POST", "/api/patients", { name: "Doc Holder", gender: "Female", phone: mobile(), identityDocuments: [{ type: "Aadhaar", number: num }] });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.deepEqual(r.data.identityDocuments, [{ type: "Aadhaar", last4: num.slice(-4) }]);
  assert.ok(!JSON.stringify(r.data).includes(num), "the response never contains the number");
  const row = await patientsRepo.getRow(r.data.id);
  assert.ok(!JSON.stringify(row).includes(num), "the stored row never contains the number");
  assert.match(row!.identity_documents![0].fingerprint, /^[0-9a-f]{64}$/);
});

test("an Aadhaar that fails the checksum, or breaks the format, is refused", async () => {
  const good = aadhaar();
  const bad = good.slice(0, 11) + ((Number(good[11]) + 1) % 10);
  const make = (number: string, type = "Aadhaar") => admin("POST", "/api/patients", { name: "Doc Check", gender: "Male", phone: mobile(), identityDocuments: [{ type, number }] });
  assert.equal((await make(bad)).status, 400);
  assert.equal((await make("123412341234")).status, 400, "cannot start with 1");
  assert.equal((await make("2345")).status, 400, "too short");
  assert.equal((await make("ABCDE1234F", "PAN")).status, 201);
  assert.equal((await make("ABCDE12345", "PAN")).status, 400);
});

test("the same Aadhaar can't be registered for two patients", async () => {
  const num = aadhaar();
  const a = await admin("POST", "/api/patients", { name: "First Owner", gender: "Male", phone: mobile(), identityDocuments: [{ type: "Aadhaar", number: num }] });
  assert.equal(a.status, 201);
  const spaced = `${num.slice(0, 4)} ${num.slice(4, 8)} ${num.slice(8)}`;
  const b = await admin("POST", "/api/patients", { name: "Second Owner", gender: "Male", phone: mobile(), identityDocuments: [{ type: "Aadhaar", number: spaced }] });
  assert.equal(b.status, 409);
  assert.match(b.error?.message ?? "", /already registered/);
});

test("bad optional values are refused", async () => {
  const make = (extra: Record<string, unknown>) => admin("POST", "/api/patients", { name: "Bad Values", gender: "Male", phone: mobile(), ...extra });
  assert.equal((await make({ alternatePhone: "123" })).status, 422);
  assert.equal((await make({ anniversary: "2999-01-01" })).status, 422);
  assert.equal((await make({ payers: [{ name: "X", validUntil: "not a date" }] })).status, 400);
  assert.equal((await make({ covid: { vaccination: "Sort of" } })).status, 400);
});

test("updating adds details without dropping what is already on file", async () => {
  const num1 = aadhaar();
  const made = await admin("POST", "/api/patients", { name: "Update Me", gender: "Female", phone: mobile(), occupation: "Teacher", identityDocuments: [{ type: "Aadhaar", number: num1 }] });
  assert.equal(made.status, 201);
  const r = await admin("PATCH", `/api/patients/${made.data.id}`, { maritalStatus: "Single", identityDocuments: [{ type: "PAN", number: "FGHIJ5678K" }] });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.occupation, "Teacher");
  assert.equal(r.data.maritalStatus, "Single");
  assert.deepEqual(r.data.identityDocuments.map((d: { type: string }) => d.type).sort(), ["Aadhaar", "PAN"]);
});

type Listed = { data: { id: number; name: string; status: string }[]; meta: { total: number; totalPages: number } };
/** One page of the patient list, exactly as the browser asks for it. */
async function listed(query: string): Promise<Listed> {
  const res = await app.fetch(new Request(`http://localhost/api/patients?${query}`, { headers: { cookie: cookies.get(ADMIN)! } }));
  assert.equal(res.status, 200);
  return (await res.json()) as Listed;
}

test("pages of the list join up into the whole list, in name order, with nothing repeated or missing", async () => {
  // names that differ only by case, and a duplicate name, to exercise the ordering and the tie-break
  for (const name of ["zed lower", "Zed Upper", "zed lower"]) await admin("POST", "/api/patients", { name, gender: "Male", phone: mobile() });
  const all = (await listed("all=true&sort=name:asc")).data;
  const seen: Listed["data"] = [];
  for (let page = 1, pages = 1; page <= pages; page++) {
    const r = await listed(`page=${page}&pageSize=7&sort=name:asc`);
    pages = r.meta.totalPages;
    seen.push(...r.data);
  }
  assert.equal(seen.length, all.length);
  assert.equal(new Set(seen.map((p) => p.id)).size, seen.length, "no patient on two pages");
  assert.deepEqual(seen.map((p) => p.id), all.map((p) => p.id), "same order as the unpaged list");
  const lowered = seen.map((p) => p.name.toLowerCase());
  assert.deepEqual(lowered, [...lowered].sort((a, b) => a.localeCompare(b)), "sorted without regard to case");
});

test("search and a status filter narrow the paged list, and the totals add up", async () => {
  const everyone = await listed("pageSize=5");
  const search = await listed("pageSize=5&search=zed");
  assert.ok(search.meta.total >= 3 && search.data.every((p) => /zed/i.test(p.name)));
  const today = await listed("pageSize=5&status=Today");
  assert.ok(today.data.every((p) => p.status === "Today"));
  const sum = (await admin("GET", "/api/patients/summary")).data as Record<string, number>;
  assert.equal(sum.total, everyone.meta.total);
  assert.equal(sum.Today, today.meta.total);
  assert.equal(sum.Today + sum.Upcoming + sum.Completed + sum.Cancelled, sum.total);
  assert.deepEqual((await listed("page=999&pageSize=5")).data, []);
});

let failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  PASS  ${t.name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${t.name}`); console.log("        " + String((err as Error).stack ?? err).split("\n").slice(0, 7).join("\n        ")); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
