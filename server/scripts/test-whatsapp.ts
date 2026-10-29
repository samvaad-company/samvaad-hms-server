/**
 * Tests for WhatsApp: connecting a hospital's number (by hand and through Meta's Embedded Signup), the encrypted token, sending a
 * signing link to a patient, the webhook (verification, signature, replies) and the chat assistant's flows. Meta's Graph API is
 * stubbed — nothing leaves the process. In-process, in-memory.
 *
 *   npm run test:whatsapp
 */
import assert from "node:assert/strict";

import { createHmac } from "node:crypto";

const APP_SECRET = "test-app-secret-0123456789";
const VERIFY = "test-verify-token";
Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
  FACEBOOK_APP_ID: "123456789",
  FACEBOOK_APP_SECRET: APP_SECRET,
  FACEBOOK_WHATSAPP_CONFIGURATION_ID: "987654321",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: VERIFY,
  PUBLIC_APP_URL: "https://app.example.test",
});

// ── Meta, stubbed ────────────────────────────────────────────────────────────
interface Call { url: string; method: string; auth: string; body: any }
const calls: Call[] = [];
const sent = () => calls.filter((c) => c.url.endsWith("/messages"));
let nextError: { status: number; code: number; message: string; details?: string } | null = null;
let rejectToken = false;
let counter = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof URL ? input.href : input);
  const headers = new Headers(init?.headers);
  const call: Call = { url, method: init?.method ?? "GET", auth: headers.get("authorization") ?? "", body: init?.body ? JSON.parse(String(init.body)) : null };
  calls.push(call);
  const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  if (url.endsWith("/messages")) {
    if (nextError) { const e = nextError; nextError = null; return json(e.status, { error: { message: e.message, code: e.code, error_data: e.details ? { details: e.details } : undefined } }); }
    return json(200, { messages: [{ id: `wamid.${++counter}` }] });
  }
  if (url.includes("/oauth/access_token")) return new URL(url).searchParams.get("code") === "bad-code" ? json(400, { error: { message: "Invalid verification code format.", code: 100 } }) : json(200, { access_token: "EAAB-token-from-code-1234567890" });
  if (url.endsWith("/subscribed_apps")) return json(200, { success: true });
  if (url.includes("fields=display_phone_number")) return rejectToken || call.auth.includes("badtoken") ? json(401, { error: { message: "Invalid OAuth access token.", code: 190 } }) : json(200, { display_phone_number: "+91 98765 43210", verified_name: "Samvaad Hospital" });
  return json(404, { error: { message: "not stubbed" } });
}) as typeof fetch;

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
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";

const { whatsappAccountsRepo, whatsappMessagesRepo, appointmentsRepo, signatureRequestsRepo } = await import("@/repositories");
const { decryptToken } = await import("@/services/whatsapp-service");
const { resetBot, parseDate } = await import("@/services/whatsapp-bot");
const { localDate } = await import("@/lib/clock");
const { slotsFor } = await import("@/services/scheduling-service");
const { doctorsRepo } = await import("@/repositories");

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });
const TOKEN = "EAAB-permanent-system-user-token-abcdef123456";
const PHONE_ID = "1055550001111";
const OUR_NUMBER = "919876543210";
let seq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const connect = (over: Record<string, unknown> = {}) => as(ADMIN, "PUT", "/api/whatsapp", { wabaId: "2055550002222", phoneNumberId: PHONE_ID, accessToken: TOKEN, ...over });

// ── The webhook ──────────────────────────────────────────────────────────────

const signed = async (body: unknown, secret = APP_SECRET) => {
  const raw = JSON.stringify(body);
  return request("POST", "/api/whatsapp/webhook", { body, headers: { "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}` } });
};
/** A patient writes to the hospital's number. */
const inbound = (from: string, msg: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "2055550002222", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: OUR_NUMBER, phone_number_id: PHONE_ID }, contacts: [{ wa_id: from, profile: { name: "Asha" } }], messages: [{ from, id: `wamid.in.${++seq}`, timestamp: "1", ...msg }], ...extra } }] }],
});
const said = (from: string, text: string, id?: string) => inbound(from, { type: "text", text: { body: text }, ...(id ? { id } : {}) });
const tapped = (from: string, buttonId: string, title = "x") => inbound(from, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: buttonId, title } } });
/** Deliver a patient message and wait for the bot's answer(s). */
async function talk(body: unknown, expectReplies = 1): Promise<Call[]> {
  const before = sent().length;
  const r = await signed(body);
  assert.equal(r.status, 200);
  for (let i = 0; i < 60 && sent().length < before + expectReplies; i++) await sleep(25);
  await sleep(30);
  return sent().slice(before);
}
const textOf = (c: Call): string => c.body?.text?.body ?? c.body?.interactive?.body?.text ?? "";
const buttonsOf = (c: Call): string[] => (c.body?.interactive?.action?.buttons ?? []).map((b: any) => b.reply.id);

test("Meta's verification: the right token gets the challenge back with no login; a wrong one is refused", async () => {
  const ok = await app.fetch(new Request(`http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=12345`));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "12345");
  assert.equal(ok.headers.get("content-type"), "text/plain");
  assert.equal((await app.fetch(new Request(`http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`))).status, 403);
  assert.equal((await app.fetch(new Request(`http://localhost/api/whatsapp/webhook?hub.mode=unsubscribe&hub.verify_token=${VERIFY}&hub.challenge=1`))).status, 403);
});

test("a POST must carry Meta's signature over the exact bytes sent", async () => {
  const body = { object: "whatsapp_business_account", entry: [] };
  assert.equal((await signed(body)).status, 200);
  assert.equal((await signed(body, "someone-elses-secret")).status, 403);
  assert.equal((await request("POST", "/api/whatsapp/webhook", { body })).status, 403, "unsigned");
  const raw = JSON.stringify(body);
  const sig = `sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
  const tampered = await app.fetch(new Request("http://localhost/api/whatsapp/webhook", { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body: raw + " " }));
  assert.equal(tampered.status, 403, "a changed body no longer matches");
});

// ── Connecting a number ──────────────────────────────────────────────────────

test("a hospital with nothing connected says so; the lite status is open to any signed-in user, the full one to admins", async () => {
  const s = (await as(ADMIN, "GET", "/api/whatsapp")).data;
  assert.equal(s.connected, false);
  assert.deepEqual([s.embedded.available, s.embedded.appId, s.embedded.configId], [true, "123456789", "987654321"]);
  assert.deepEqual([s.webhook.verifyTokenConfigured, s.webhook.signatureCheck, s.webhook.path], [true, true, "/api/whatsapp/webhook"]);
  assert.equal(JSON.stringify(s).includes(APP_SECRET), false, "the app secret never goes to the browser");
  assert.equal((await as(RECEPTION, "GET", "/api/whatsapp/status")).data.connected, false);
  assert.equal((await as(RECEPTION, "GET", "/api/whatsapp")).status, 403);
  assert.equal((await as(RECEPTION, "PUT", "/api/whatsapp", { wabaId: "1", phoneNumberId: "2", accessToken: TOKEN })).status, 403);
  assert.equal((await request("GET", "/api/whatsapp/status")).status, 401);
});

test("typed-in details are checked with Meta first: bad ids are refused, and so is a token Meta doesn't accept", async () => {
  assert.equal((await connect({ phoneNumberId: "abc" })).status, 422);
  assert.equal((await connect({ wabaId: "" })).status, 422);
  assert.equal((await connect({ accessToken: "short" })).status, 422);
  assert.equal((await connect({ apiVersion: "latest" })).status, 422);
  const bad = await connect({ accessToken: "badtoken-badtoken-badtoken-1234" });
  assert.equal(bad.status, 422);
  assert.match(JSON.stringify(bad.error), /Invalid OAuth access token/);
  assert.equal((await as(ADMIN, "GET", "/api/whatsapp")).data.connected, false, "nothing was saved");
});

test("connecting stores the token encrypted, subscribes the app to the account, and never sends the token back", async () => {
  const r = await connect();
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.connected, r.data.displayPhone, r.data.verifiedName, r.data.via, r.data.subscribed, r.data.botEnabled], [true, "+91 98765 43210", "Samvaad Hospital", "manual", true, true]);
  assert.equal(JSON.stringify(r.data).includes(TOKEN), false);
  assert.equal(JSON.stringify((await as(ADMIN, "GET", "/api/whatsapp")).data).includes(TOKEN), false);
  const row: any = (await whatsappAccountsRepo.listRows({ unpaged: true } as never)).rows[0];
  assert.notEqual(row.access_token_enc, TOKEN);
  assert.equal(row.access_token_enc.includes(TOKEN), false);
  assert.equal(decryptToken(row.access_token_enc), TOKEN);
  assert.ok(calls.some((c) => c.url.endsWith("/2055550002222/subscribed_apps") && c.method === "POST" && c.auth === `Bearer ${TOKEN}`));
  // Saving again without retyping the token keeps the one stored.
  const again = await connect({ accessToken: "" });
  assert.equal(again.status, 200, JSON.stringify(again.error));
  assert.equal(decryptToken(((await whatsappAccountsRepo.listRows({ unpaged: true } as never)).rows[0] as any).access_token_enc), TOKEN);
});

test("one number belongs to one hospital", async () => {
  await whatsappAccountsRepo.create({ hospital_id: 999, waba_id: "1", phone_number_id: "777000111222", display_phone: "", verified_name: "", access_token_enc: "x", api_version: "v21.0", connected_via: "manual", subscribed: false, bot_enabled: true, consent_template: "", consent_template_lang: "en", consent_template_format: "positional", default_country: "91" } as never);
  const r = await connect({ phoneNumberId: "777000111222" });
  assert.equal(r.status, 409);
  const other: any = (await whatsappAccountsRepo.listRows({ unpaged: true } as never)).rows.find((x: any) => x.hospital_id === 999);
  await whatsappAccountsRepo.remove(other.id);
});

test("Meta's Embedded Signup: the code is swapped for a token on the server, the app subscribed, and the number saved", async () => {
  const before = calls.length;
  assert.equal((await as(ADMIN, "POST", "/api/whatsapp/callback", { wabaId: "2055550002222", phoneNumberId: PHONE_ID })).status, 422, "no code");
  const bad = await as(ADMIN, "POST", "/api/whatsapp/callback", { code: "bad-code", wabaId: "2055550002222", phoneNumberId: PHONE_ID });
  assert.equal(bad.status, 400);
  assert.match(JSON.stringify(bad.error), /Invalid verification code/);
  const r = await as(ADMIN, "POST", "/api/whatsapp/callback", { code: "good-code", wabaId: "2055550002222", phoneNumberId: PHONE_ID });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.connected, r.data.via, r.data.subscribed], [true, "embedded", true]);
  const exchange = calls.slice(before).filter((c) => c.url.includes("/oauth/access_token")).pop()!;
  const q = new URL(exchange.url).searchParams;
  assert.deepEqual([q.get("client_id"), q.get("client_secret"), q.get("code")], ["123456789", APP_SECRET, "good-code"]);
  assert.equal(decryptToken(((await whatsappAccountsRepo.listRows({ unpaged: true } as never)).rows[0] as any).access_token_enc), "EAAB-token-from-code-1234567890");
  assert.equal((await as(RECEPTION, "POST", "/api/whatsapp/callback", { code: "x", wabaId: "1", phoneNumberId: "2" })).status, 403);
});

test("settings: the bot switch, the country code and the signing-link template, each checked", async () => {
  assert.equal((await as(ADMIN, "PATCH", "/api/whatsapp", { templateName: "Has Spaces" })).status, 422);
  assert.equal((await as(ADMIN, "PATCH", "/api/whatsapp", { defaultCountry: "abc" })).status, 422);
  const r = await as(ADMIN, "PATCH", "/api/whatsapp", { defaultCountry: "+91", templateName: "consent_sign_link", templateLanguage: "en_US", templateFormat: "positional" });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.defaultCountry, r.data.consentTemplate], ["91", { name: "consent_sign_link", language: "en_US", format: "positional" }]);
  assert.equal((await as(RECEPTION, "GET", "/api/whatsapp/status")).data.templateReady, true);
  await as(ADMIN, "PATCH", "/api/whatsapp", { templateName: "" });
});

test("a test message goes out from the connected number to a normalised phone, and is logged with the number masked", async () => {
  assert.equal((await as(ADMIN, "POST", "/api/whatsapp/test", { to: "12" })).status, 422);
  const r = await as(ADMIN, "POST", "/api/whatsapp/test", { to: "98765 11111" });
  assert.equal(r.status, 200);
  assert.equal(r.data.state, "sent");
  const c = sent().pop()!;
  assert.equal(c.url, `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`);
  assert.deepEqual([c.auth, c.body.to, c.body.type], ["Bearer EAAB-token-from-code-1234567890", "919876511111", "text"]);
  const log = (await as(ADMIN, "GET", "/api/whatsapp/messages")).data;
  assert.equal(log[0].direction, "out");
  assert.equal(log[0].phone.includes("98765"), false, "the stored number isn't shown in full");
  assert.match(log[0].phone, /••••• 11111$/);
});

// ── Signing links ────────────────────────────────────────────────────────────

const patient = async (over: Record<string, unknown> = {}) => (await as(ADMIN, "POST", "/api/patients", { name: `Wa Patient ${++seq}`, age: 40, gender: "Female", phone: `98${String(20000000 + seq).slice(-8)}`, ...over })).data;
const consent = async (p: any, language = "English") => (await as(ADMIN, "POST", `/api/patients/${p.id}/consents`, { template: "general-consent", language })).data;

test("\"Send via WhatsApp\" sends the signing link to the patient's number from the hospital's WhatsApp", async () => {
  const p = await patient({ phone: "98765 00001" });
  const c = await consent(p);
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", signerName: p.name, validDays: 3 });
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.equal(r.data.whatsapp.state, "sent");
  assert.match(r.data.whatsapp.to, /••••• 00001$/);
  assert.match(r.data.link, /^\/sign\/[A-Za-z0-9_-]+$/);
  const m = sent().pop()!;
  assert.deepEqual([m.body.to, m.body.type], ["919876500001", "text"]);
  assert.ok(m.body.text.body.includes(`https://app.example.test${r.data.link}`), "the full public address, not a path");
  assert.ok(m.body.text.body.includes(c.formTitle));
  assert.equal(r.data.delivery, "whatsapp");
});

test("the message is in the form's language, and a number typed in beats the one on the record", async () => {
  const p = await patient();
  const c = await consent(p, "Hindi");
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", validDays: 1, phone: "+91 90000 12345" });
  assert.equal(r.data.whatsapp.state, "sent");
  const m = sent().pop()!;
  assert.equal(m.body.to, "919000012345");
  assert.match(m.body.text.body, /कृपया/);
});

test("with an approved template set, the link goes out as that template — numbered or named variables", async () => {
  await as(ADMIN, "PATCH", "/api/whatsapp", { templateName: "consent_sign_link", templateLanguage: "en_US", templateFormat: "positional" });
  const p = await patient({ name: "Template Patient" });
  const c = await consent(p);
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", validDays: 3 });
  assert.equal(r.data.whatsapp.state, "sent");
  const t = sent().pop()!;
  assert.deepEqual([t.body.type, t.body.template.name, t.body.template.language.code], ["template", "consent_sign_link", "en_US"]);
  const params = t.body.template.components[0].parameters.map((x: any) => x.text);
  assert.deepEqual(params.slice(0, 3), ["Template Patient", c.formTitle, `https://app.example.test${r.data.link}`]);
  await as(ADMIN, "PATCH", "/api/whatsapp", { templateFormat: "named" });
  await as(ADMIN, "POST", `/api/consents/${c.id}/whatsapp`, {});
  const n = sent().pop()!;
  assert.deepEqual(n.body.template.components[0].parameters.map((x: any) => x.parameter_name), ["patient_name", "form_title", "link", "hospital_name"]);
  await as(ADMIN, "PATCH", "/api/whatsapp", { templateName: "", templateFormat: "positional" });
});

test("when WhatsApp refuses (outside the 24-hour window), the link is still made and the screen is told why and what to do", async () => {
  const p = await patient();
  const c = await consent(p);
  nextError = { status: 400, code: 131047, message: "Re-engagement message", details: "Message failed to send because more than 24 hours have passed" };
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", validDays: 3 });
  assert.equal(r.status, 200);
  assert.ok(r.data.link, "the link exists, so the QR code and copy still work");
  assert.equal(r.data.whatsapp.state, "failed");
  assert.match(r.data.whatsapp.detail, /approved message template/);
  const log = (await as(ADMIN, "GET", "/api/whatsapp/messages")).data[0];
  assert.deepEqual([log.status, log.kind], ["failed", "consent"]);
  // Another reason: Meta's own explanation comes through.
  const c2 = await consent(await patient());
  await as(ADMIN, "POST", `/api/consents/${c2.id}/link`, { delivery: "qr", validDays: 3 });
  nextError = { status: 400, code: 100, message: "(#100) Invalid parameter", details: "number of parameters does not match" };
  const again = await as(ADMIN, "POST", `/api/consents/${c2.id}/whatsapp`, {});
  assert.match(again.data.detail, /number of parameters does not match/);
});

test("no number to send to, or no live link, is said plainly; and without a connection the old share-menu path still works", async () => {
  const p = await patient();
  const c = await consent(p);
  await signatureRequestsRepo.update(c.id, { patient_phone: "" } as never);
  const noLink = await as(ADMIN, "POST", `/api/consents/${c.id}/whatsapp`, {});
  assert.equal(noLink.status, 409);
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", validDays: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.data.whatsapp.state, "failed");
  assert.match(r.data.whatsapp.detail, /no number/);
  assert.equal((await as(DOCTOR, "POST", `/api/consents/${c.id}/whatsapp`, { phone: "9000011111" })).status, 200);
  assert.equal((await as(BILLING, "POST", `/api/consents/${c.id}/whatsapp`, { phone: "9000011111" })).status, 403);
});

// ── The chat assistant ───────────────────────────────────────────────────────

const CASE = "919811100001";
test("a greeting gets the menu as reply buttons; the same message delivered twice is answered once", async () => {
  resetBot();
  const body = said(CASE, "Hello", "wamid.dup.1");
  const [reply] = await talk(body);
  assert.equal(reply.body.to, CASE);
  assert.equal(reply.body.type, "interactive");
  assert.deepEqual(buttonsOf(reply), ["menu_book", "menu_upcoming", "menu_rx"]);
  assert.match(textOf(reply), /Welcome to \*Samvaad/);
  const more = await talk(body, 1).catch(() => []);
  assert.equal(more.length, 0, "a repeated delivery is ignored");
  const incoming = (await as(ADMIN, "GET", "/api/whatsapp/messages")).data.filter((m: any) => m.direction === "in");
  assert.ok(incoming.length >= 1 && incoming[0].status === "received");
});

test("an emergency phrase gets the fixed safety message, never an AI answer", async () => {
  resetBot();
  const [reply] = await talk(said(CASE, "my father has chest pain"));
  assert.match(textOf(reply), /call your local emergency number/);
  assert.match(textOf(reply), /Samvaad/);
});

test("anything else goes to the assistant; with no AI key it points to the hospital instead of guessing", async () => {
  resetBot();
  const [reply] = await talk(said(CASE, "what are your visiting hours?"));
  assert.match(textOf(reply), /contact \*Samvaad/);
  assert.deepEqual(buttonsOf(reply), ["menu_book", "menu_upcoming", "menu_rx"]);
});

test("a message from a number nobody has connected is ignored; so is anything while the bot is switched off", async () => {
  resetBot();
  const stranger = inbound(CASE, { type: "text", text: { body: "hi" } });
  (stranger.entry[0].changes[0].value.metadata as any).phone_number_id = "999999999";
  assert.equal((await talk(stranger, 1).catch(() => [])).length, 0);
  await as(ADMIN, "PATCH", "/api/whatsapp", { botEnabled: false });
  assert.equal((await talk(said(CASE, "hello"), 1).catch(() => [])).length, 0);
  const log = (await as(ADMIN, "GET", "/api/whatsapp/messages")).data;
  assert.ok(log.some((m: any) => m.direction === "in" && m.body === "hello"), "still recorded");
  await as(ADMIN, "PATCH", "/api/whatsapp", { botEnabled: true });
});

test("voice notes, photos and the like get a polite reply instead of silence", async () => {
  resetBot();
  const [reply] = await talk(inbound(CASE, { type: "audio", audio: { id: "a1" } }));
  assert.match(textOf(reply), /text messages only/);
});

test("booking an appointment end to end for a registered patient, by numbers and buttons — and it's really in the schedule", async () => {
  resetBot();
  const p = await patient({ name: "Booking Patient", phone: "98111 22233" });
  const from = "919811122233";
  const doctors = ((await doctorsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: 1 }] } as never)).rows as any[]).filter((d) => d.status !== "On Leave").slice(0, 9);
  // Find a day this doctor works.
  let day = ""; let slotLabel = "";
  for (let i = 1; i < 14 && !day; i++) {
    const d = new Date(Date.now() + i * 86_400_000).toLocaleDateString("en-CA");
    const s = await slotsFor({ doctorId: doctors[0].id, date: d, mode: "in_person" });
    const open = s.slots.filter((x) => x.status === "open");
    if (s.isOpen && open.length) { day = d; slotLabel = open[0].label; }
  }
  assert.ok(day, "the first doctor has a working day this fortnight");

  const [d1] = await talk(said(from, "I want to book an appointment"));
  assert.match(textOf(d1), /Booking for \*Booking Patient\*/);
  assert.match(textOf(d1), new RegExp(`1\\. ${doctors[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  const [dateAsk] = await talk(said(from, "1"));
  assert.match(textOf(dateAsk), /Which day/);
  assert.deepEqual(buttonsOf(dateAsk), ["date_today", "date_tomorrow"]);
  const [slots] = await talk(said(from, day));
  assert.match(textOf(slots), /Free times/);
  assert.ok(textOf(slots).includes(`1. ${slotLabel}`));
  const [why] = await talk(said(from, "1"));
  assert.match(textOf(why), /What is the visit for/);
  const [confirm] = await talk(said(from, "knee pain"));
  assert.match(textOf(confirm), /Please confirm/);
  assert.match(textOf(confirm), /knee pain/);
  assert.deepEqual(buttonsOf(confirm), ["book_confirm", "book_cancel"]);
  // A second patient reaches the same step with the same time on screen before the first confirms.
  const p2 = await patient({ name: "Second Patient", phone: "98111 22244" });
  const f2 = "919811122244";
  await talk(said(f2, "book")); await talk(said(f2, "1")); await talk(said(f2, day)); await talk(said(f2, "1")); await talk(said(f2, "skip"));
  const [done] = await talk(tapped(from, "book_confirm", "Confirm"));
  assert.match(textOf(done), /Your appointment is booked/);

  const booked = ((await appointmentsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: p.id }] } as never)).rows as any[]);
  assert.equal(booked.length, 1);
  assert.deepEqual([booked[0].appointment_date, booked[0].doctor, booked[0].reason], [day, doctors[0].name, "knee pain"]);
  const [mine] = await talk(said(from, "my appointments"));
  assert.match(textOf(mine), new RegExp(doctors[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const [rx] = await talk(tapped(from, "menu_rx"));
  assert.match(textOf(rx), /no prescriptions/);

  // The time the second patient chose has just been taken: they are told, not double-booked.
  const [taken] = await talk(tapped(f2, "book_confirm"));
  assert.match(textOf(taken), /another day or time/, textOf(taken));
  assert.equal(((await appointmentsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: p2.id }] } as never)).rows as any[]).length, 0);
});

test("an unknown number is asked its name and age first; 'cancel' backs out of a booking at any step", async () => {
  resetBot();
  const from = "919000099999";
  const [ask] = await talk(said(from, "book"));
  assert.match(textOf(ask), /full name/);
  const [age] = await talk(said(from, "Ravi Kumar"));
  assert.match(textOf(age), /age/);
  assert.match(textOf((await talk(said(from, "abc")))[0]), /number/);
  const [docs] = await talk(said(from, "34"));
  assert.match(textOf(docs), /Which doctor/);
  const [menu] = await talk(said(from, "cancel"));
  assert.match(textOf(menu), /How can I help/);
  const [again] = await talk(said(from, "1"));
  assert.doesNotMatch(textOf(again), /Free times|Which day/, "the booking is gone");
});

test("dates are read the way people write them", async () => {
  const today = "2026-10-29";
  assert.equal(parseDate("today", today), "2026-10-29");
  assert.equal(parseDate("Tomorrow", today), "2026-10-30");
  assert.equal(parseDate("2026-11-03", today), "2026-11-03");
  assert.equal(parseDate("3/11", today), "2026-11-03");
  assert.equal(parseDate("3 Nov", today), "2026-11-03");
  assert.equal(parseDate("nov 3rd", today), "2026-11-03");
  assert.equal(parseDate("5 jan", today), "2027-01-05", "a day already past this year means next year");
  assert.equal(parseDate("31/02", today), null);
  assert.equal(parseDate("whenever", today), null);
});

test("delivery reports update the log: delivered, read, and a failure with its reason", async () => {
  const to = await as(ADMIN, "POST", "/api/whatsapp/test", { to: "9811100777" });
  assert.equal(to.data.state, "sent");
  const id = ((await whatsappMessagesRepo.listRows({ unpaged: true } as never)).rows as any[]).find((m) => m.direction === "out" && m.phone === "919811100777").wa_message_id;
  const status = (s: string, errors?: unknown) => signed({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_ID }, statuses: [{ id, status: s, errors }] } }] }] });
  await status("delivered"); await sleep(60);
  assert.equal((await as(ADMIN, "GET", "/api/whatsapp/messages")).data.find((m: any) => m.phone.endsWith("00777")).status, "delivered");
  await status("read"); await sleep(60);
  await status("sent"); await sleep(60);
  assert.equal((await as(ADMIN, "GET", "/api/whatsapp/messages")).data.find((m: any) => m.phone.endsWith("00777")).status, "read", "a late 'sent' doesn't undo 'read'");
  const to2 = await as(ADMIN, "POST", "/api/whatsapp/test", { to: "9811100888" });
  assert.equal(to2.data.state, "sent");
  const id2 = ((await whatsappMessagesRepo.listRows({ unpaged: true } as never)).rows as any[]).find((m) => m.phone === "919811100888").wa_message_id;
  await signed({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: PHONE_ID }, statuses: [{ id: id2, status: "failed", errors: [{ code: 131026, title: "Message undeliverable", error_data: { details: "Not a WhatsApp user" } }] }] } }] }] });
  await sleep(60);
  const failed = (await as(ADMIN, "GET", "/api/whatsapp/messages")).data.find((m: any) => m.phone.endsWith("00888"));
  assert.deepEqual([failed.status, failed.error], ["failed", "Message undeliverable — Not a WhatsApp user"]);
});

test("disconnecting removes the connection and the bot goes quiet", async () => {
  assert.equal((await as(RECEPTION, "DELETE", "/api/whatsapp")).status, 403);
  assert.equal((await as(ADMIN, "DELETE", "/api/whatsapp")).status, 204);
  assert.equal((await as(ADMIN, "GET", "/api/whatsapp")).data.connected, false);
  assert.equal((await whatsappAccountsRepo.listRows({ unpaged: true } as never)).rows.length, 0);
  resetBot();
  assert.equal((await talk(said(CASE, "hello"), 1).catch(() => [])).length, 0);
  const p = await patient();
  const c = await consent(p);
  const r = await as(ADMIN, "POST", `/api/consents/${c.id}/link`, { delivery: "whatsapp", validDays: 3 });
  assert.equal(r.status, 200);
  assert.equal(r.data.whatsapp, undefined, "not connected: the screen falls back to the share menu");
  assert.ok(r.data.link);
  assert.equal((await as(ADMIN, "POST", "/api/whatsapp/test", { to: "9811100999" })).data.state, "not_connected");
  void localDate;
});

let passed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  PASS  ${t.name}`); }
  catch (e) { console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 7).join("\n        ")}`); }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
