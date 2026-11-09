/**
 * Tests for awareness programmes: hospital staff write, publish, cancel and delete them; the patient portal (by key, one patient at a time)
 * lists them, gets notifications, marks them read; who may see which; and the signed webhook the portal can listen on.
 * In-process, in-memory.
 *
 *   npm run test:awareness
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";

const PORTAL_KEY = "test-portal-key-0123456789";
Object.assign(process.env, {
  DATABASE_DRIVER: "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: PORTAL_KEY,
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { patientsRepo, usersRepo } = await import("@/repositories");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | undefined;
  if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string; details?: any } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown) {
  if (!cookies.has(email)) {
    const res = await app.fetch(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "Samvaad@123" }) }));
    assert.equal(res.status, 200, `login ${email}`);
    cookies.set(email, (res.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, headers: { cookie: cookies.get(email)! } });
}
const portal = (method: string, path: string, body?: unknown, key: string | null = PORTAL_KEY) => request(method, path, { body, headers: key ? { "x-portal-key": key } : {} });

const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const PHARMACIST = "arun.tiwari@samvaadhospital.in";
const OTHER_ADMIN = "admin@sunrisehospital.in";

const homeHospital = (await patientsRepo.getRow(1))!.hospital_id;
const otherHospital = ((await usersRepo.listRows({ unpaged: true } as never)).rows.find((u: any) => u.email === OTHER_ADMIN) as any).hospital_id as number;
assert.notEqual(homeHospital, otherHospital);
let seq = 0;
async function mkPatient(name: string, hospital = homeHospital) {
  seq++;
  return patientsRepo.create({ hospital_id: hospital, patient_code: `AW-${hospital}-${seq}`, name, age: 40, gender: "Male", phone: `93000${String(seq).padStart(5, "0")}`, reason: "", doctor_id: null, doctor: "", status: "Completed", visit_date: "2026-01-01", visit_time: "10:00 AM" }) as Promise<{ id: number }>;
}
const in10 = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const valid = (extra: Record<string, unknown> = {}) => ({ title: "Free diabetes screening camp", category: "Health camp", summary: "Free blood sugar and BP checks for everyone this Saturday.", details: "Come fasting. Reports the same day.", eventDate: in10(5), eventTime: "09:30", mode: "In person", venue: "Main lobby", contact: "022 4567 8900", audience: "all", ...extra });
const mine = await mkPatient("AW Home Patient");
const theirs = await mkPatient("AW Other Hospital Patient", otherHospital);

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("a draft is saved but the portal sees nothing of it", async () => {
  const r = await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Draft only" }));
  assert.equal(r.status, 201, JSON.stringify(r.error));
  assert.equal(r.data.status, "Draft");
  assert.equal(r.data.publishedAt, null);
  assert.ok(r.data.hospitalName.length > 0);
  const list = await portal("GET", `/api/portal/awareness?patientId=${mine.id}`);
  assert.equal(list.status, 200);
  assert.ok(!list.data.items.some((e: any) => e.title === "AW Draft only"));
  assert.ok(!(await portal("GET", `/api/portal/notifications?patientId=${mine.id}`)).data.items.some((n: any) => n.title === "AW Draft only"));
  assert.equal((await portal("GET", `/api/portal/awareness/${r.data.id}?patientId=${mine.id}`)).status, 404);
});

test("what is entered is checked", async () => {
  const bad = async (patch: Record<string, unknown>, field: string) => {
    const r = await as(ADMIN, "POST", "/api/awareness", valid(patch));
    assert.equal(r.status, 422, `${field}: ${JSON.stringify(r.data)}`);
    assert.ok(JSON.stringify(r.error).includes(field), `${field} not named: ${JSON.stringify(r.error)}`);
  };
  await bad({ title: "ab" }, "title");
  await bad({ summary: "short" }, "summary");
  await bad({ category: "Party" }, "category");
  await bad({ eventDate: "next friday" }, "eventDate");
  await bad({ eventTime: "9.30" }, "eventTime");
  await bad({ endDate: in10(1) }, "endDate");
  await bad({ mode: "Hybrid" }, "mode");
  await bad({ link: "javascript:alert(1)" }, "link");
  await bad({ link: "ftp://x.y/z" }, "link");
  await bad({ audience: "everyone" }, "audience");
  await bad({ image: "http://insecure.example/x.png" }, "image");
  await bad({ image: "data:image/svg+xml;base64,PHN2Zz4=" }, "image");
  await bad({ image: "data:image/png;base64," + "A".repeat(460_000) }, "image");
  assert.equal((await as(ADMIN, "POST", "/api/awareness", valid({ link: "https://meet.example.com/abc", image: "https://cdn.example.com/a.png" }))).status, 201);
});

test("publishing makes it appear in the awareness list and as a notification, newest first", async () => {
  const a = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW First" }))).data;
  await as(ADMIN, "POST", `/api/awareness/${a.id}/publish`);
  const b = await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Second", publish: true }));
  assert.equal(b.status, 201);
  assert.equal(b.data.status, "Published");
  assert.ok(b.data.publishedAt);
  const list = (await portal("GET", `/api/portal/awareness?patientId=${mine.id}`)).data;
  const titles = list.items.map((e: any) => e.title);
  assert.ok(titles.indexOf("AW Second") >= 0 && titles.indexOf("AW Second") < titles.indexOf("AW First"), "newest first");
  const it = list.items.find((e: any) => e.title === "AW Second");
  assert.equal(it.isNew, true);
  assert.equal(it.details, "", "lists carry no long details");
  assert.equal(it.status, "Published");
  assert.equal(it.state, "upcoming");
  assert.ok(it.hospital.name.length > 0 && it.hospital.id === homeHospital);
  assert.ok(list.categories.includes("Webinar"));
  const notes = (await portal("GET", `/api/portal/notifications?patientId=${mine.id}`)).data;
  const n = notes.items.find((x: any) => x.eventId === b.data.id);
  assert.ok(n && n.kind === "awareness_published" && !n.read);
  assert.ok(n.body.includes("Free blood sugar"));
  assert.ok(notes.unread >= 2);
  assert.equal((await as(ADMIN, "POST", `/api/awareness/${b.data.id}/publish`)).status, 409, "can't be published twice");
});

test("opening a programme gives its details and marks it read; the reads are counted for the hospital", async () => {
  const e = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Open me", publish: true }))).data;
  const read = await portal("GET", `/api/portal/awareness/${e.id}?patientId=${mine.id}`);
  assert.equal(read.status, 200);
  assert.equal(read.data.details, "Come fasting. Reports the same day.");
  assert.equal(read.data.isNew, true, "it was new when first opened");
  const again = await portal("GET", `/api/portal/awareness/${e.id}?patientId=${mine.id}`);
  assert.equal(again.data.isNew, false);
  assert.equal((await portal("GET", `/api/portal/awareness?patientId=${mine.id}`)).data.items.find((x: any) => x.id === e.id).isNew, false);
  assert.ok((await portal("GET", `/api/portal/notifications?patientId=${mine.id}`)).data.items.find((x: any) => x.eventId === e.id).read);
  assert.equal((await as(ADMIN, "GET", `/api/awareness/${e.id}`)).data.reads, 1);
  // Another patient's reading is separate.
  const other = await mkPatient("AW Another Home Patient");
  assert.equal((await portal("GET", `/api/portal/awareness?patientId=${other.id}`)).data.items.find((x: any) => x.id === e.id).isNew, true);
});

test("marking notifications read: some by id, or all; never changes another patient's", async () => {
  const p = await mkPatient("AW Reader");
  const q = await mkPatient("AW Bystander");
  const e1 = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Mark 1", publish: true }))).data;
  await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Mark 2", publish: true }));
  const before = (await portal("GET", `/api/portal/notifications?patientId=${p.id}`)).data.unread;
  const one = await portal("POST", "/api/portal/notifications/read", { patientId: p.id, ids: [e1.id] });
  assert.equal(one.status, 200, JSON.stringify(one.error));
  assert.equal(one.data.unread, before - 1);
  assert.ok(one.data.items.find((x: any) => x.eventId === e1.id).read);
  assert.equal((await portal("GET", `/api/portal/notifications?patientId=${q.id}`)).data.unread, before, "someone else is unaffected");
  const all = await portal("POST", "/api/portal/notifications/read", { patientId: p.id, all: true });
  assert.equal(all.data.unread, 0);
  assert.equal((await portal("GET", `/api/portal/awareness?patientId=${p.id}`)).data.unread, 0);
  assert.equal((await portal("POST", "/api/portal/notifications/read", { ids: [1] })).status, 400, "needs the patient");
});

test("who sees what: 'all' reaches every hospital's patients; 'hospital' only the posting hospital's", async () => {
  const everyone = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW For everyone", audience: "all", publish: true }))).data;
  const ownOnly = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Own patients only", audience: "hospital", publish: true }))).data;
  const theirsOnly = (await as(OTHER_ADMIN, "POST", "/api/awareness", valid({ title: "AW Sunrise only", audience: "hospital", publish: true }))).data;
  const has = async (patientId: number, id: number) => (await portal("GET", `/api/portal/awareness?patientId=${patientId}&pageSize=50`)).data.items.some((e: any) => e.id === id);
  assert.ok(await has(mine.id, everyone.id) && await has(theirs.id, everyone.id), "for everyone");
  assert.ok(await has(mine.id, ownOnly.id)); assert.ok(!(await has(theirs.id, ownOnly.id)), "own patients only");
  assert.ok(await has(theirs.id, theirsOnly.id)); assert.ok(!(await has(mine.id, theirsOnly.id)), "the other hospital's own");
  assert.equal((await portal("GET", `/api/portal/awareness/${ownOnly.id}?patientId=${theirs.id}`)).status, 404);
  assert.ok(!(await portal("GET", `/api/portal/notifications?patientId=${theirs.id}`)).data.items.some((n: any) => n.eventId === ownOnly.id));
  assert.ok((await portal("GET", `/api/portal/notifications?patientId=${theirs.id}`)).data.items.some((n: any) => n.eventId === everyone.id));
  assert.equal((await portal("GET", `/api/portal/awareness?patientId=${theirs.id}`)).data.items.find((e: any) => e.id === everyone.id).hospital.id, homeHospital);
});

test("cancelling: the portal shows it cancelled and notifies; a draft can't be cancelled", async () => {
  const draft = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Never posted" }))).data;
  assert.equal((await as(ADMIN, "POST", `/api/awareness/${draft.id}/cancel`)).status, 409);
  const e = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW To cancel", publish: true }))).data;
  await portal("POST", "/api/portal/notifications/read", { patientId: mine.id, all: true });
  const c = await as(ADMIN, "POST", `/api/awareness/${e.id}/cancel`);
  assert.equal(c.status, 200);
  assert.equal(c.data.status, "Cancelled");
  assert.ok(c.data.cancelledAt);
  const item = (await portal("GET", `/api/portal/awareness?patientId=${mine.id}`)).data.items.find((x: any) => x.id === e.id);
  assert.equal(item.status, "Cancelled");
  const n = (await portal("GET", `/api/portal/notifications?patientId=${mine.id}`)).data.items.find((x: any) => x.eventId === e.id);
  assert.equal(n.kind, "awareness_cancelled");
  assert.ok(n.title.startsWith("Cancelled:"));
  assert.equal((await as(ADMIN, "POST", `/api/awareness/${e.id}/cancel`)).status, 409, "only once");
  // It can be put back on.
  assert.equal((await as(ADMIN, "POST", `/api/awareness/${e.id}/publish`)).status, 200);
  assert.equal((await portal("GET", `/api/portal/awareness?patientId=${mine.id}`)).data.items.find((x: any) => x.id === e.id).status, "Published");
});

test("editing changes what the portal shows; deleting removes it from the portal", async () => {
  const e = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Editable", publish: true }))).data;
  const up = await as(ADMIN, "PUT", `/api/awareness/${e.id}`, { venue: "Hall B", summary: "Moved to Hall B, same time, same checks." });
  assert.equal(up.status, 200, JSON.stringify(up.error));
  assert.equal(up.data.venue, "Hall B");
  assert.equal(up.data.title, "AW Editable", "what wasn't sent stays");
  assert.equal((await portal("GET", `/api/portal/awareness/${e.id}?patientId=${mine.id}`)).data.venue, "Hall B");
  assert.equal((await as(ADMIN, "PUT", `/api/awareness/${e.id}`, { endDate: in10(-3) })).status, 422, "end before start");
  assert.equal((await as(ADMIN, "DELETE", `/api/awareness/${e.id}`)).status, 200);
  assert.equal((await as(ADMIN, "GET", `/api/awareness/${e.id}`)).status, 404);
  assert.equal((await portal("GET", `/api/portal/awareness/${e.id}?patientId=${mine.id}`)).status, 404);
  assert.ok(!(await portal("GET", `/api/portal/notifications?patientId=${mine.id}`)).data.items.some((n: any) => n.eventId === e.id));
});

test("state follows the dates; scope, category, search and paging filter the list", async () => {
  const mk = async (title: string, patch: Record<string, unknown>) => (await as(ADMIN, "POST", "/api/awareness", valid({ title, publish: true, ...patch }))).data;
  const past = await mk("AW Past camp zebra", { eventDate: in10(-10), category: "Webinar" });
  const now = await mk("AW Ongoing drive zebra", { eventDate: in10(-1), endDate: in10(2), category: "Vaccination drive" });
  const future = await mk("AW Future talk zebra", { eventDate: in10(9), category: "Awareness talk" });
  const none = await mk("AW Undated campaign zebra", { eventDate: "", eventTime: "", category: "Campaign" });
  const q = (s: string) => portal("GET", `/api/portal/awareness?patientId=${mine.id}&pageSize=50&${s}`);
  const by = (r: any, id: number) => r.data.items.find((x: any) => x.id === id);
  const all = await q("search=zebra");
  assert.deepEqual([by(all, past.id).state, by(all, now.id).state, by(all, future.id).state, by(all, none.id).state], ["past", "ongoing", "upcoming", "info"]);
  const up = await q("search=zebra&scope=upcoming");
  assert.deepEqual(up.data.items.map((x: any) => x.id).sort(), [now.id, future.id, none.id].sort());
  assert.deepEqual((await q("search=zebra&scope=past")).data.items.map((x: any) => x.id), [past.id]);
  assert.deepEqual((await q("search=zebra&category=Webinar")).data.items.map((x: any) => x.id), [past.id]);
  const paged = await portal("GET", `/api/portal/awareness?patientId=${mine.id}&search=zebra&pageSize=2&page=2`);
  assert.equal(paged.data.total, 4);
  assert.equal(paged.data.items.length, 2);
  assert.equal(paged.data.page, 2);
});

test("the portal is let in only with its key, and only for a patient that exists", async () => {
  const path = `/api/portal/awareness?patientId=${mine.id}`;
  assert.equal((await portal("GET", path, undefined, null)).status, 401);
  assert.equal((await portal("GET", path, undefined, "wrong-key-0123456789abcdef")).status, 401);
  assert.equal((await portal("GET", "/api/portal/awareness")).status, 400, "needs a patient");
  assert.equal((await portal("GET", "/api/portal/awareness?patientId=999999")).status, 404);
  assert.equal((await portal("GET", "/api/portal/notifications?patientId=999999")).status, 404);
  // A staff login is not the portal.
  assert.equal((await as(ADMIN, "GET", path)).status, 401);
});

test("who on the hospital side may post: admin, doctors and the front desk; not pharmacy; nobody across hospitals", async () => {
  assert.equal((await as(DOCTOR, "POST", "/api/awareness", valid({ title: "AW By a doctor" }))).status, 201);
  assert.equal((await as(RECEPTION, "POST", "/api/awareness", valid({ title: "AW By the front desk" }))).status, 201);
  assert.equal((await as(PHARMACIST, "POST", "/api/awareness", valid())).status, 403);
  assert.equal((await as(PHARMACIST, "GET", "/api/awareness")).status, 403);
  const e = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Home hospital only", publish: true }))).data;
  assert.ok(!(await as(OTHER_ADMIN, "GET", "/api/awareness")).data.some((x: any) => x.id === e.id), "not in their list");
  for (const [method, path] of [["GET", ""], ["PUT", ""], ["DELETE", ""], ["POST", "/publish"], ["POST", "/cancel"]] as const) {
    const r = await as(OTHER_ADMIN, method, `/api/awareness/${e.id}${path}`, method === "PUT" ? { venue: "x" } : undefined);
    assert.ok([403, 404].includes(r.status), `${method}${path} gave ${r.status}`);
  }
  assert.equal((await as(ADMIN, "GET", `/api/awareness/${e.id}`)).data.status, "Published", "untouched");
});

test("the hospital's list filters by status, category and search", async () => {
  const draft = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Findable quokka", category: "Screening" }))).data;
  const r = await as(ADMIN, "GET", "/api/awareness?status=Draft&category=Screening&search=quokka");
  assert.deepEqual(r.data.map((x: any) => x.id), [draft.id]);
  assert.deepEqual((await as(ADMIN, "GET", "/api/awareness?status=Published&search=quokka")).data, []);
  assert.ok(r.data.every((x: any) => typeof x.reads === "number"));
});

test("publishing pushes a signed event to the portal's webhook, and so does cancelling", async () => {
  const got: { headers: IncomingMessage["headers"]; body: string }[] = [];
  const server = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { got.push({ headers: req.headers, body: b }); res.statusCode = 200; res.end("ok"); }); });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  process.env.PORTAL_WEBHOOK_URL = `http://127.0.0.1:${port}/hooks/hms`;
  try {
    const e = (await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Webhook camp", publish: true }))).data;
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(got.length, 1);
    const g = got[0];
    assert.equal(g.headers["x-hms-event"], "awareness.published");
    assert.equal(g.headers["x-hms-signature"], `sha256=${createHmac("sha256", PORTAL_KEY).update(g.body).digest("hex")}`, "signed with the portal key");
    const p = JSON.parse(g.body);
    assert.equal(p.type, "awareness.published");
    assert.equal(p.awareness.id, e.id);
    assert.equal(p.awareness.title, "AW Webhook camp");
    assert.equal(p.awareness.audience, "all");
    assert.equal(p.awareness.hospitalId, homeHospital);
    assert.equal(p.awareness.details, "Come fasting. Reports the same day.");
    assert.ok(p.occurredAt);
    await as(ADMIN, "POST", `/api/awareness/${e.id}/cancel`);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(got.length, 2);
    assert.equal(got[1].headers["x-hms-event"], "awareness.cancelled");
    // A draft sends nothing; an edit sends nothing.
    await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW quiet draft" }));
    await as(ADMIN, "PUT", `/api/awareness/${e.id}`, { venue: "elsewhere" });
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(got.length, 2);
  } finally { delete process.env.PORTAL_WEBHOOK_URL; await new Promise((r) => server.close(r)); }
});

test("a portal that is down does not stop a programme being posted", async () => {
  process.env.PORTAL_WEBHOOK_URL = "http://127.0.0.1:1/nope";
  try {
    const r = await as(ADMIN, "POST", "/api/awareness", valid({ title: "AW Portal is down", publish: true }));
    assert.equal(r.status, 201);
    await new Promise((res) => setTimeout(res, 300));
    assert.equal((await portal("GET", `/api/portal/awareness?patientId=${mine.id}&search=Portal+is+down`)).data.items.length, 1);
  } finally { delete process.env.PORTAL_WEBHOOK_URL; }
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
