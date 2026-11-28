/**
 * Tests for the AI spending caps and the monthly cost view: what each call costs in rupees, the monthly budget that pauses a feature
 * when it is used up, the per-number daily limit for the WhatsApp bot, and who may see or change any of it.
 *
 *   npm run test:ai-budget
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { costInr, readUsage, recordFeatureUsage, budgetState, botAiAllowed } = await import("@/services/ai-budget-service");
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
const ADMIN = "kevin.carter@samvaadhospital.in";
const NURSE = "rekha.menon@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const setCaps = (patch: Record<string, unknown>) => as(ADMIN, "PUT", "/api/setup/config/ai_budget", patch);
const line = async (key: string) => ((await as(ADMIN, "GET", "/api/admin/ai-usage/cost")).data.lines as any[]).find((l) => l.key === key);

test("a call's cost in rupees comes from the token counts and the rates in Settings", async () => {
  const cfg = { geminiInputUsdPerMillion: 0.25, geminiOutputUsdPerMillion: 1.5, geminiAudioUsdPerMillion: 0.5, usdToInr: 100 };
  assert.equal(costInr(cfg, { prompt: 1_000_000, output: 0, audio: 0 }), 25);
  assert.equal(costInr(cfg, { prompt: 0, output: 1_000_000, audio: 0 }), 150);
  assert.equal(costInr(cfg, { prompt: 0, output: 0, audio: 1_000_000 }), 50);
  assert.equal(costInr(cfg, { prompt: 200_000, output: 10_000, audio: 100_000 }), 5 + 1.5 + 5);
  // Audio is split out of the prompt count so it is priced at the audio rate.
  assert.deepEqual(readUsage({ usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 50, thoughtsTokenCount: 10, promptTokensDetails: [{ modality: "AUDIO", tokenCount: 800 }, { modality: "TEXT", tokenCount: 200 }] } }), { prompt: 200, output: 60, audio: 800 });
  assert.deepEqual(readUsage({}), { prompt: 0, output: 0, audio: 0 });
});

test("the caps have sensible defaults and an admin can change them; bad values are refused", async () => {
  const d = await as(ADMIN, "GET", "/api/setup/config/ai_budget");
  assert.equal(d.status, 200, JSON.stringify(d.error));
  assert.equal(d.data.scribeBudgetInr, 8000);
  assert.equal(d.data.botRepliesPerNumberPerDay, 20);
  const u = await setCaps({ scribeBudgetInr: 5000, hostingMonthlyInr: 4500 });
  assert.equal(u.status, 200, JSON.stringify(u.error));
  assert.equal(u.data.scribeBudgetInr, 5000);
  assert.equal(u.data.hostingMonthlyInr, 4500);
  assert.equal((await setCaps({ scribeBudgetInr: "lots" })).status, 422);
  assert.equal((await setCaps({ notASetting: 1 })).status, 422);
});

test("the scribe is paused once its monthly budget is used up, and says why", async () => {
  await setCaps({ scribeBudgetInr: 10 });
  assert.equal((await budgetState(1, "scribe")).exceeded, false);
  await recordFeatureUsage({ hospitalId: 1, feature: "scribe", usage: { prompt: 0, output: 0, audio: 2_000_000 }, userId: 9, userName: "Dr Test" }); // 2M audio tokens = ₹88
  const s = await budgetState(1, "scribe");
  assert.equal(s.exceeded, true);
  assert.ok(s.spent >= 10);
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(64)], { type: "audio/wav" }), "a.wav");
  const res = await app.fetch(new Request("http://localhost/api/scribe/transcribe", { method: "POST", headers: { cookie: await cookie(DOCTOR) }, body: form }));
  const body = (await res.json()) as { data: { transcript: string; mock: boolean; detail?: string } };
  assert.equal(res.status, 200);
  assert.equal(body.data.transcript, "");
  assert.equal(body.data.mock, true);
  assert.match(body.data.detail ?? "", /used up/);
  // No cap (0) turns it back on.
  await setCaps({ scribeBudgetInr: 0 });
  assert.equal((await budgetState(1, "scribe")).exceeded, false);
});

test("the WhatsApp bot stops answering with AI at its budget, and per number at the daily limit", async () => {
  await setCaps({ botBudgetInr: 0, botRepliesPerNumberPerDay: 2 });
  assert.equal((await botAiAllowed(1, "9800000001")).ok, true);
  await recordFeatureUsage({ hospitalId: 1, feature: "whatsapp_bot", usage: { prompt: 100, output: 20, audio: 0 }, ref: "9800000001" });
  await recordFeatureUsage({ hospitalId: 1, feature: "whatsapp_bot", usage: { prompt: 100, output: 20, audio: 0 }, ref: "9800000001" });
  const daily = await botAiAllowed(1, "9800000001");
  assert.deepEqual([daily.ok, daily.why], [false, "daily"]);
  assert.equal((await botAiAllowed(1, "9800000002")).ok, true, "another number is not affected");
  await setCaps({ botBudgetInr: 0.0001, botRepliesPerNumberPerDay: 0 });
  assert.deepEqual([(await botAiAllowed(1, "9800000002")).ok, (await botAiAllowed(1, "9800000002")).why], [false, "budget"]);
  await setCaps({ botBudgetInr: 0 });
  assert.equal((await botAiAllowed(1, "9800000001")).ok, true, "no cap and no daily limit");
});

test("the cost view lists every service, shows what each feature spent against its cap, and adds up", async () => {
  await setCaps({ rxReviewBudgetInr: 5 });
  await recordFeatureUsage({ hospitalId: 1, feature: "rx_review", usage: { prompt: 1_000_000, output: 0, audio: 0 } }); // ₹22
  const r = await as(ADMIN, "GET", "/api/admin/ai-usage/cost");
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual(r.data.lines.map((l: any) => l.key), ["chat", "scribe", "rx_review", "whatsapp_bot", "whatsapp", "razorpay", "hosting", "database", "other"]);
  const rx = await line("rx_review");
  assert.equal(rx.kind, "measured");
  assert.equal(rx.budgetInr, 5);
  assert.equal(rx.capped, true);
  assert.equal(rx.amountInr, 22);
  assert.equal((await line("hosting")).amountInr, 4500);
  assert.equal((await line("hosting")).kind, "entered");
  assert.equal(r.data.totalInr, Math.round(r.data.lines.reduce((n: number, l: any) => n + l.amountInr, 0) * 100) / 100);
  assert.match(r.data.month, /^\d{4}-\d{2}$/);
  assert.equal((await as(ADMIN, "GET", "/api/admin/ai-usage/cost?month=2020-01")).data.lines.find((l: any) => l.key === "rx_review").amountInr, 0, "an earlier month starts from nothing");
});

test("only a super admin or admin can see or change the cost view and the caps", async () => {
  assert.equal((await as(NURSE, "GET", "/api/admin/ai-usage/cost")).status, 403);
  assert.equal((await as(DOCTOR, "GET", "/api/admin/ai-usage/cost")).status, 403);
  assert.equal((await as(NURSE, "PUT", "/api/setup/config/ai_budget", { scribeBudgetInr: 1 })).status, 403);
  assert.equal((await as(DOCTOR, "GET", "/api/setup/config/ai_budget")).status, 403);
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
