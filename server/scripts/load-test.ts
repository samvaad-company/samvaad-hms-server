/**
 * How much data and how many people the API can carry on a small server.
 *
 * Runs the real app in-process on the in-memory driver (no network, no database), grows one hospital through a few sizes, and at each
 * size times the screens and actions that matter and measures memory. Start it with a heap cap to mimic a small machine:
 *
 *   node --max-old-space-size=600 --import tsx scripts/load-test.ts            (what `npm run load` does)
 *
 * It measures this machine's CPU, not the target's — read the ratios (how time grows with data), then scale the absolute times by how
 * much slower the target is. See docs/CAPACITY.md.
 */
import { performance } from "node:perf_hooks";

Object.assign(process.env, { DATABASE_DRIVER: "memory", SESSION_SECRET: "load-test-secret-0123456789abcdef", PORTAL_API_KEY: "load-test-key-0123456789", LOG_LEVEL: "error" });
const { createApp } = await import("@/app");
const { app } = await createApp();
const repos = await import("@/repositories");

async function call(method: string, path: string, cookie: string, body?: unknown) {
  const headers: Record<string, string> = { cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, bytes: text.length, headers: res.headers };
}
const login = await app.fetch(new Request("http://localhost/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "kevin.carter@samvaadhospital.in", password: "Samvaad@123" }) }));
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const mb = (n: number) => Math.round(n / 1048576);
const today = new Date().toLocaleDateString("en-CA");
/** A date up to 90 days back — a real hospital's records are spread over time, not all dated today. */
const daysAgo = (n: number) => new Date(Date.now() - (n % 90) * 86_400_000).toLocaleDateString("en-CA");

async function time(label: string, n: number, fn: () => Promise<{ status: number; bytes?: number }>) {
  const t: number[] = []; let status = 0, bytes = 0;
  for (let i = 0; i < n; i++) { const s = performance.now(); const r = await fn(); t.push(performance.now() - s); status = r.status; bytes = r.bytes ?? 0; }
  return { label, ms: Math.round(median(t)), max: Math.round(Math.max(...t)), status, kb: Math.round(bytes / 1024) };
}

let total = 0;
async function grow(to: number) {
  const doctors = (await repos.doctorsRepo.listRows({ unpaged: true } as never)).rows as { id: number; name: string }[];
  for (; total < to; total++) {
    const n = total + 1;
    const p = await repos.patientsRepo.create({ hospital_id: 1, patient_code: `HMS-L${n}`, name: `Load Patient ${n}`, age: 20 + (n % 60), gender: n % 2 ? "Male" : "Female", phone: `9${String(100000000 + n).slice(-9)}`, reason: "x", doctor: "", status: "Today", visit_date: today, visit_time: "10:00 AM" });
    const doc = doctors[n % doctors.length];
    for (let k = 0; k < 2; k++) await repos.appointmentsRepo.create({ hospital_id: 1, patient_id: p.id, patient_name: p.name, patient_age: 30, doctor_id: doc.id, doctor: doc.name, appointment_date: daysAgo(n + k), appointment_time: "10:00 AM", type: "Booked", reason: "x", status: "Completed" });
    for (let k = 0; k < 2; k++) await repos.opdRepo.create({ hospital_id: 1, token_number: `T-${n}-${k}`, patient_id: p.id, patient_name: p.name, patient_age: 30, doctor_id: doc.id, doctor: doc.name, reason: "x", priority: "Normal", vitals_recorded: false, wait_time: "0", check_in_time: "10:00 AM", status: "Completed", created_at: new Date(Date.now() - ((n + k) % 90) * 86_400_000).toISOString() });
    for (let k = 0; k < 3; k++) await repos.billsRepo.create({ hospital_id: 1, bill_number: `INV-L${n}-${k}`, patient_id: p.id, patient_name: p.name, type: "OPD", bill_date: daysAgo(n + k), amount: 500, discount: 0, gst: 0, total: 500, status: k ? "Paid" : "Pending", payment_mode: "Cash" });
    await repos.labRepo.create({ hospital_id: 1, order_number: `LAB-L${n}`, patient_id: p.id, patient_name: p.name, patient_age: 30, test_name: "CBC", requested_by: "", doctor_id: doc.id, doctor: doc.name, priority: "Routine", sample_status: "Collected", report_status: "Ready", test_date: daysAgo(n), collection_date: daysAgo(n), amount: 0, discount: 0, discount_type: "amount", status: "Report Ready" });
  }
}

const tiers = (process.env.LOAD_TIERS ?? "1000,5000,20000").split(",").map(Number);
const out: any[] = [];
let seq = 0;
console.log(`heap cap ${mb((await import("node:v8")).getHeapStatistics().heap_size_limit)} MB · node ${process.version}`);
for (const tier of tiers) {
  const g0 = performance.now();
  await grow(tier);
  const grew = Math.round(performance.now() - g0);
  global.gc?.();
  const mem = process.memoryUsage();
  if (process.env.LOAD_DEBUG) {
    const j = (await (await app.fetch(new Request("http://localhost/api/dashboard/overview", { headers: { cookie } }))).json()) as { data: Record<string, unknown> };
    console.log("overview payload by part (bytes):", Object.entries(j.data).map(([k, v]) => [k, JSON.stringify(v).length]).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6));
  }
  const rows: any[] = [];
  rows.push(await time("patients list (page of 20)", 5, () => call("GET", "/api/patients?pageSize=20", cookie)));
  rows.push(await time("patients search by name", 5, () => call("GET", "/api/patients?search=Load%20Patient%20777&pageSize=20", cookie)));
  rows.push(await time("register a patient", 5, () => call("POST", "/api/patients", cookie, { name: `New Person ${++seq}`, age: 30, gender: "Male", phone: `97${String(10000000 + seq + tier).slice(-8)}` })));
  rows.push(await time("OPD queue", 5, () => call("GET", "/api/opd?pageSize=20", cookie)));
  rows.push(await time("check a patient in", 5, () => call("POST", "/api/opd", cookie, { patientId: 1, patientName: "Load Patient 1", doctorId: 1 })));
  rows.push(await time("bills list (page of 20)", 5, () => call("GET", "/api/billing?pageSize=20", cookie)));
  rows.push(await time("raise a bill", 5, () => call("POST", "/api/billing", cookie, { patientId: 1, patientName: "Load Patient 1", type: "OPD", amount: 500 })));
  rows.push(await time("home dashboard", 3, () => call("GET", "/api/dashboard/overview", cookie)));
  rows.push(await time("analytics", 3, () => call("GET", "/api/analytics?range=month", cookie)));
  rows.push(await time("report: collection", 3, () => call("GET", `/api/reports/run?id=collection&from=${today}&to=${today}`, cookie)));
  rows.push(await time("lab worklist", 3, () => call("GET", "/api/lab?pageSize=20", cookie)));
  rows.push(await time("appointments list", 3, () => call("GET", "/api/appointments?pageSize=20", cookie)));
  // Many people at once: 50 requests in flight, a mix of reads and writes.
  const mix = Array.from({ length: 50 }, (_, i) => (i % 5 === 0 ? () => call("POST", "/api/opd", cookie, { patientId: 2, patientName: "Load Patient 2", doctorId: 1 }) : i % 5 === 1 ? () => call("GET", "/api/patients?pageSize=20", cookie) : i % 5 === 2 ? () => call("GET", "/api/opd?pageSize=20", cookie) : i % 5 === 3 ? () => call("GET", "/api/billing?pageSize=20", cookie) : () => call("GET", "/api/dashboard/overview", cookie)));
  const c0 = performance.now();
  const rs = await Promise.all(mix.map((f) => f()));
  const wall = performance.now() - c0;
  global.gc?.();
  const after = process.memoryUsage();
  const errors = rs.filter((r) => r.status >= 500).length;
  const tierOut = { patients: tier, rowsInStore: tier * 9, seedMs: grew, heapMB: mb(mem.heapUsed), rssMB: mb(mem.rss), rssAfterBurstMB: mb(after.rss), burst50: { wallMs: Math.round(wall), perSec: Math.round(50 / (wall / 1000)), errors }, rows };
  out.push(tierOut);
  console.log(`\n=== ${tier.toLocaleString()} patients (${(tier * 9).toLocaleString()} records) — heap ${tierOut.heapMB} MB, rss ${tierOut.rssMB} MB, 50 at once: ${tierOut.burst50.wallMs} ms (${tierOut.burst50.perSec}/s, ${errors} errors)`);
  for (const r of rows) console.log(`  ${r.label.padEnd(30)} ${String(r.ms).padStart(6)} ms (worst ${String(r.max).padStart(6)})  ${r.status}  ${r.kb} KB`);
}
console.log("\nJSON " + JSON.stringify(out));
process.exit(0);
