/**
 * Tests for a doctor's usual medicines per disease: every prescription is recorded against its diagnoses in that doctor's own table, the
 * same disease later offers those medicines (the most used first, with the dose used last), another doctor does not see them, and the
 * table is built from earlier prescriptions the first time it is asked for.
 *
 *   npm run test:usual-medicines
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { diseaseKey } = await import("@/services/usual-medicines-service");
const { app } = await createApp();

const cookies = new Map<string, string>();
async function cookie(email: string) {
  if (!cookies.has(email)) {
    const res = await app.fetch(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Samvaad@123" }) }));
    assert.equal(res.status, 200, `login ${email}`);
    cookies.set(email, (res.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return cookies.get(email)!;
}
async function as(email: string, method: string, path: string, body?: unknown) {
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers: { cookie: await cookie(email), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error };
}
const DOCTOR = "sophia.adams@samvaadhospital.in"; // doctor id 2
const OTHER_DOCTOR = "daniel.reed@samvaadhospital.in"; // doctor id 5
const ADMIN = "kevin.carter@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const med = (name: string, over: Record<string, unknown> = {}) => ({ medicineName: name, dosage: "1 tablet", frequency: "1-0-1", duration: "5 days", timing: "After Meal", ...over });
const write = (email: string, doctorId: number, diagnosis: string, items: unknown[]) =>
  as(email, "POST", "/api/prescriptions", { patientName: "Test Patient", patientAge: 40, doctorId, diagnosis, items, status: "Draft" });
const usual = (email: string, q: string, doctorId?: number) => as(email, "GET", `/api/prescriptions/usual-medicines?diagnoses=${encodeURIComponent(q)}${doctorId ? `&doctorId=${doctorId}` : ""}`);

test("a disease is matched without its ICD code, capitals or punctuation", async () => {
  assert.equal(diseaseKey("Acute Bronchitis (J20.9)"), "acute bronchitis");
  assert.equal(diseaseKey("  acute   bronchitis "), "acute bronchitis");
  assert.equal(diseaseKey("Type-2 Diabetes, Mellitus"), "type 2 diabetes mellitus");
});

test("medicines written for a disease are offered for the same disease later, most used first, with the last dose", async () => {
  assert.equal((await write(DOCTOR, 2, "Acute Gastritis", [med("Pantoprazole 40mg", { dosage: "1 tablet", frequency: "1-0-0", timing: "Before Meal" }), med("Domperidone 10mg")])).status, 201);
  assert.equal((await write(DOCTOR, 2, "acute gastritis (K29.1)", [med("Pantoprazole 40mg", { frequency: "1-0-1", duration: "7 days" })])).status, 201);
  const r = await usual(DOCTOR, "Acute gastritis");
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].diagnosis, "Acute gastritis");
  const [first, second] = r.data[0].items;
  assert.equal(first.medicineName, "Pantoprazole 40mg");
  assert.equal(first.useCount, 2);
  assert.equal(first.frequency, "1-0-1", "the dose used last");
  assert.equal(first.duration, "7 days");
  assert.equal(second.medicineName, "Domperidone 10mg");
  assert.equal(second.useCount, 1);
});

test("a longer or shorter form of the disease finds the same medicines; an unrelated one finds none", async () => {
  await write(DOCTOR, 2, "Type 2 Diabetes", [med("Metformin 500mg")]);
  assert.equal((await usual(DOCTOR, "Type 2 Diabetes Mellitus")).data[0].items[0].medicineName, "Metformin 500mg");
  assert.equal((await usual(DOCTOR, "Hypertension")).data.length, 0);
  const several = await usual(DOCTOR, "Acute gastritis;Type 2 diabetes;Hypertension");
  assert.deepEqual(several.data.map((g: any) => g.diagnosis), ["Acute gastritis", "Type 2 diabetes"]);
});

test("another doctor does not see these, and a doctor cannot ask for someone else's", async () => {
  assert.equal((await usual(OTHER_DOCTOR, "Acute gastritis")).data.filter((g: any) => g.items.some((i: any) => i.medicineName === "Domperidone 10mg")).length, 0);
  assert.equal((await usual(OTHER_DOCTOR, "Acute gastritis", 2)).status, 403);
  // Staff choose the doctor themselves.
  const staff = await usual(ADMIN, "Acute gastritis", 2);
  assert.equal(staff.status, 200);
  assert.equal(staff.data[0].items[0].medicineName, "Pantoprazole 40mg");
  assert.equal((await usual(ADMIN, "Acute gastritis")).data.length, 0, "no doctor chosen");
});

test("the first request builds the table from the doctor's earlier prescriptions", async () => {
  // Doctor 5 already has seed prescriptions; the table starts empty and is filled when first asked.
  const seeded = await as(OTHER_DOCTOR, "GET", "/api/prescriptions");
  const mine = (seeded.data as any[]).filter((p) => p.doctorId === 5 && p.diagnosis);
  assert.ok(mine.length > 0, "seed has prescriptions for this doctor");
  const first = mine[0];
  const detail = await as(OTHER_DOCTOR, "GET", `/api/prescriptions/${first.id}`);
  const name = detail.data.items[0]?.medicineName;
  assert.ok(name, "the seed prescription has a medicine");
  const diagnosis = String(first.diagnosis).split(";")[0].trim();
  const r = await usual(OTHER_DOCTOR, diagnosis);
  assert.ok(r.data.length >= 1, `usual medicines for "${diagnosis}"`);
  assert.ok(r.data.some((g: any) => g.items.some((i: any) => i.medicineName === name)), "the earlier medicine is offered");
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
