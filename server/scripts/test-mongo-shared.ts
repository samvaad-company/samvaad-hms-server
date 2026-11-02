/**
 * MongoDB behaviour of the shared state, with several API processes at once: sequences never repeat, rate-limit windows are
 * shared, and the change feed reports writes from another process. Runs against a SCRATCH database in the cluster named by
 * MONGODB_URI (`samvaad_hms_scratch_<time>`), created here and dropped at the end; nothing else in the cluster is touched.
 *
 *   npm run test:mongoshared
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const isChild = process.argv[2] === "child";
const scratch = isChild ? String(process.env.SCRATCH_DB) : `samvaad_hms_scratch_${Date.now()}`;
if (!scratch.startsWith("samvaad_hms_scratch_")) throw new Error("refusing to run outside a scratch database");

Object.assign(process.env, {
  DATABASE_DRIVER: "mongo",
  MONGODB_DB: scratch,
  MONGODB_AUTO_SEED: "false",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: "error",
});
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (run through `npm run test:mongoshared`)");

const { MongoAdapter } = await import("@/db/mongo-adapter");
const db = new MongoAdapter();

if (isChild) {
  const seqs = await Promise.all(Array.from({ length: 100 }, () => db.nextSequence("proc|burst", 0)));
  const hits = await Promise.all(Array.from({ length: 20 }, () => db.countHit("proc:hits", 60_000)));
  console.log(JSON.stringify({ seqs, hits }));
  process.exit(0);
}

const runChild = () =>
  new Promise<{ seqs: number[]; hits: number[] }>((resolve, reject) => {
    const p = spawn(process.execPath, ["--import", "tsx", "scripts/test-mongo-shared.ts", "child"], {
      env: { ...process.env, SCRATCH_DB: scratch },
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("exit", (code) => (code === 0 ? resolve(JSON.parse(out.trim().split("\n").pop()!)) : reject(new Error(`child exited ${code}`))));
  });

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

test("three API processes asking for 100 sequence values each get 300 different, consecutive values", async () => {
  const results = await Promise.all([runChild(), runChild(), runChild()]);
  const all = results.flatMap((r) => r.seqs).sort((a, b) => a - b);
  assert.equal(all.length, 300);
  assert.deepEqual(all, Array.from({ length: 300 }, (_, i) => i + 1));
  const hits = results.flatMap((r) => r.hits).sort((a, b) => a - b);
  assert.deepEqual(hits, Array.from({ length: 60 }, (_, i) => i + 1), "the three processes share one rate-limit window");
});

test("a counter behind the existing records is lifted, never lowered", async () => {
  assert.equal(await db.nextSequence("floor", 40), 41);
  assert.equal(await db.nextSequence("floor", 10), 42);
  assert.equal(await db.nextSequence("floor", 100), 101);
});

test("a value is given back only while it is the latest", async () => {
  const a = await db.nextSequence("rel", 0);
  const b = await db.nextSequence("rel", 0);
  await db.releaseSequence("rel", a);
  assert.equal(await db.nextSequence("rel", 0), b + 1);
  const c = await db.nextSequence("rel", 0);
  await db.releaseSequence("rel", c);
  assert.equal(await db.nextSequence("rel", 0), c);
});

test("rate-limit windows count, peek, clear and are removed by the database when over", async () => {
  assert.equal(await db.peekHits("w", 60_000), 0);
  assert.equal(await db.countHit("w", 60_000), 1);
  assert.equal(await db.countHit("w", 60_000), 2);
  assert.equal(await db.peekHits("w", 60_000), 2);
  await db.clearHits("w");
  assert.equal(await db.peekHits("w", 60_000), 0);
  const d = await db.database();
  const idx = await d.collection("rate_limits").indexes();
  assert.ok(idx.some((i) => i.expireAfterSeconds === 0), "TTL index on expireAt");
});

test("the change feed reports a write made by another process, with its hospital, and ignores bookkeeping", async () => {
  const seen: { table: string; hospitalId: number | null }[] = [];
  const off = await db.watchChanges((c) => seen.push(c));
  assert.ok(off, "change streams are available on this cluster");
  const writer = new MongoAdapter(); // same client, but stands for another process's write
  await writer.insert("scratch_patients", { hospital_id: 7, name: "Watched" });
  await writer.nextSequence("noise", 0);
  await writer.countHit("noise", 60_000);
  const deadline = Date.now() + 8000;
  while (!seen.some((c) => c.table === "scratch_patients") && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  off!();
  assert.ok(seen.some((c) => c.table === "scratch_patients" && c.hospitalId === 7), JSON.stringify(seen));
  assert.ok(!seen.some((c) => c.table === "counters" || c.table === "rate_limits"), "bookkeeping isn't reported");
});

test("the database itself refuses a duplicate name, a second diet sheet for the same ward and day, and a repeated training row", async () => {
  const { ensureCompoundUniques } = await import("@/db/mongo-indexes");
  const { TABLES } = await import("@/db/tables");
  await ensureCompoundUniques(await db.database());
  const dup = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch (e) { return (e as { code?: number }).code === 11000; } };
  await db.insert(TABLES.dietTypes, { hospital_id: 1, name: "Diabetic" });
  assert.ok(await dup(() => db.insert(TABLES.dietTypes, { hospital_id: 1, name: "diabetic" })), "same name, other case");
  await db.insert(TABLES.dietTypes, { hospital_id: 2, name: "Diabetic" }); // another hospital may use it
  await db.insert(TABLES.dietSheets, { hospital_id: 1, sheet_date: "2026-11-02", ward_id: null });
  assert.ok(await dup(() => db.insert(TABLES.dietSheets, { hospital_id: 1, sheet_date: "2026-11-02", ward_id: null })), "whole-hospital sheet twice");
  await db.insert(TABLES.dietSheets, { hospital_id: 1, sheet_date: "2026-11-02", ward_id: 5 });
  await db.insert(TABLES.trainingProgress, { hospital_id: 1, user_id: 3, lesson_id: "walk-in" });
  assert.ok(await dup(() => db.insert(TABLES.trainingProgress, { hospital_id: 1, user_id: 3, lesson_id: "walk-in" })));
});

let passed = 0;
try {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  PASS  ${t.name}`);
    } catch (e) {
      console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`);
    }
  }
} finally {
  await (await db.database()).dropDatabase();
  console.log(`  (scratch database ${scratch} dropped)`);
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
