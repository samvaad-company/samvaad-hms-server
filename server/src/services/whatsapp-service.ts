/**
 * A hospital's WhatsApp Business connection (Meta Cloud API): connecting a number — through Meta's Embedded Signup or by entering
 * its ids and token — the settings around it, sending messages (and logging them), and checking what Meta posts to our webhook.
 *
 * The access token is encrypted before it is stored and never sent back to the browser.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hospitalsRepo, whatsappAccountsRepo, whatsappMessagesRepo } from "@/repositories";
import { type WhatsappAccountRow, type WhatsappMessageRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { currentRequest } from "@/http/request-context";
import { publicOrigin } from "@/http/web";
import { validate } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { requireHospitalId } from "@/services/hospital-scope";
import {
  DEFAULT_API_VERSION, DEFAULT_COUNTRY_DIGITS, WhatsAppApiError, exchangeCode, fetchPhoneInfo, namedParams, normalizeWhatsAppTo, positionalParams,
  sendWhatsAppButtons, sendWhatsAppTemplate, sendWhatsAppText, subscribeApp, type Credentials,
} from "@/services/whatsapp-cloud";
import type { WhatsappLiteDTO, WhatsappMessageDTO, WhatsappSendResult, WhatsappStatusDTO } from "@shared/types/api";

const env = () => ({
  appId: process.env.FACEBOOK_APP_ID ?? "",
  appSecret: process.env.FACEBOOK_APP_SECRET ?? "",
  configId: process.env.FACEBOOK_WHATSAPP_CONFIGURATION_ID ?? "",
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "",
  apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || DEFAULT_API_VERSION,
});

// ── Token at rest ────────────────────────────────────────────────────────────

const cryptoKey = () => createHash("sha256").update(`whatsapp-token:${process.env.SESSION_SECRET ?? "samvaad-dev-secret"}`).digest();

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(stored: string): string | null {
  try {
    const [iv, tag, body] = stored.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", cryptoKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return null; // the key changed or the value is damaged — treat the connection as needing to be redone
  }
}

// ── The account ──────────────────────────────────────────────────────────────

export const accountOf = (hospitalId: number): Promise<WhatsappAccountRow | null> =>
  whatsappAccountsRepo.findRow([{ column: "hospital_id", op: "eq", value: hospitalId }]) as Promise<WhatsappAccountRow | null>;

export const accountByPhoneNumberId = (phoneNumberId: string): Promise<WhatsappAccountRow | null> =>
  whatsappAccountsRepo.findRow([{ column: "phone_number_id", op: "eq", value: phoneNumberId }]) as Promise<WhatsappAccountRow | null>;

export interface Outbound extends Credentials { hospitalId: number; defaultCountryDigits: string; account: WhatsappAccountRow }

/** What sending needs, or null when the hospital has no usable connection. */
export function outboundOf(a: WhatsappAccountRow | null): Outbound | null {
  if (!a) return null;
  const accessToken = decryptToken(a.access_token_enc);
  if (!accessToken) return null;
  return { phoneNumberId: a.phone_number_id, accessToken, apiVersion: a.api_version, hospitalId: a.hospital_id, defaultCountryDigits: a.default_country || DEFAULT_COUNTRY_DIGITS, account: a };
}

export async function outboundForHospital(hospitalId: number): Promise<Outbound | null> {
  return outboundOf(await accountOf(hospitalId));
}

const templateOf = (a: WhatsappAccountRow) => ({ name: a.consent_template || "", language: a.consent_template_lang || "en", format: (a.consent_template_format === "named" ? "named" : "positional") as "named" | "positional" });

export async function getStatus(actor: Session): Promise<WhatsappStatusDTO> {
  const a = await accountOf(requireHospitalId(actor));
  const e = env();
  const usable = outboundOf(a) !== null;
  return {
    connected: !!a && usable,
    wabaId: a?.waba_id ?? "", phoneNumberId: a?.phone_number_id ?? "", displayPhone: a?.display_phone ?? "", verifiedName: a?.verified_name ?? "",
    apiVersion: a?.api_version ?? e.apiVersion, via: (a?.connected_via as "embedded" | "manual" | undefined) ?? "", subscribed: a?.subscribed ?? false,
    botEnabled: a?.bot_enabled ?? true, consentTemplate: a ? templateOf(a) : { name: "", language: "en", format: "positional" },
    defaultCountry: a?.default_country ?? DEFAULT_COUNTRY_DIGITS, updatedAt: a?.updated_at ?? null,
    webhook: { path: "/api/whatsapp/webhook", verifyTokenConfigured: !!e.verifyToken, signatureCheck: !!e.appSecret },
    embedded: { available: !!(e.appId && e.appSecret && e.configId), appId: e.appId, configId: e.configId, apiVersion: e.apiVersion },
  };
}

export async function getLite(actor: Session): Promise<WhatsappLiteDTO> {
  const a = await accountOf(requireHospitalId(actor));
  return { connected: !!a && outboundOf(a) !== null, displayPhone: a?.display_phone ?? "", templateReady: !!a?.consent_template };
}

const idText = (field: string, v: unknown): string => {
  const s = String(v ?? "").trim();
  if (!/^\d{5,25}$/.test(s)) throw new ValidationError([{ field, message: "must be the number Meta shows (digits only)" }]);
  return s;
};
const versionOf = (v: unknown): string => {
  const s = String(v ?? "").trim() || env().apiVersion;
  if (!/^v\d{1,2}\.\d$/.test(s)) throw new ValidationError([{ field: "apiVersion", message: "looks like v21.0" }]);
  return s;
};
const metaMessage = (e: unknown): string => (e instanceof WhatsAppApiError ? e.message : e instanceof Error ? e.message : "Couldn't reach Meta");

/** One number can only belong to one hospital — the webhook finds the hospital by it. */
async function assertFree(phoneNumberId: string, hospitalId: number): Promise<void> {
  const other = await accountByPhoneNumberId(phoneNumberId);
  if (other && other.hospital_id !== hospitalId) throw new ConflictError("That WhatsApp number is already connected to another hospital");
}

async function saveAccount(hospitalId: number, v: { wabaId: string; phoneNumberId: string; accessToken: string; apiVersion: string; via: "embedded" | "manual"; subscribed: boolean; displayPhone: string; verifiedName: string }, actor: Session) {
  await assertFree(v.phoneNumberId, hospitalId);
  const existing = await accountOf(hospitalId);
  const fields = {
    waba_id: v.wabaId, phone_number_id: v.phoneNumberId, display_phone: v.displayPhone, verified_name: v.verifiedName, access_token_enc: encryptToken(v.accessToken),
    api_version: v.apiVersion, connected_via: v.via, subscribed: v.subscribed,
  };
  if (existing) await whatsappAccountsRepo.update(existing.id, fields as never);
  else {
    await whatsappAccountsRepo.create({
      hospital_id: hospitalId, ...fields, bot_enabled: true, consent_template: "", consent_template_lang: "en", consent_template_format: "positional", default_country: DEFAULT_COUNTRY_DIGITS,
    } as never);
  }
  await audit(actor, existing ? "update" : "create", "whatsapp", hospitalId, { phoneNumberId: v.phoneNumberId, via: v.via });
}

/** Subscribe our app to the WABA; a failure is reported but doesn't undo the connection (it can be retried). */
async function trySubscribe(wabaId: string, accessToken: string, apiVersion: string): Promise<{ ok: boolean; error?: string }> {
  try { await subscribeApp({ wabaId, accessToken, apiVersion }); return { ok: true }; } catch (e) { return { ok: false, error: metaMessage(e) }; }
}

/** Connect by typing in the ids and token Meta gave (or a permanent System User token). Checks them with Meta first. */
export async function connectManually(input: unknown, actor: Session): Promise<WhatsappStatusDTO> {
  const hospitalId = requireHospitalId(actor);
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const existing = await accountOf(hospitalId);
  const wabaId = idText("wabaId", body.wabaId);
  const phoneNumberId = idText("phoneNumberId", body.phoneNumberId);
  const apiVersion = versionOf(body.apiVersion);
  const typed = String(body.accessToken ?? "").trim();
  const accessToken = typed || (existing ? decryptToken(existing.access_token_enc) ?? "" : "");
  if (accessToken.length < 20) throw new ValidationError([{ field: "accessToken", message: "paste the access token from Meta" }]);
  let info: { display_phone_number?: string; verified_name?: string };
  try { info = await fetchPhoneInfo({ phoneNumberId, accessToken, apiVersion }); }
  catch (e) { throw new ValidationError([{ field: "accessToken", message: `Meta didn't accept these details: ${metaMessage(e)}` }]); }
  const sub = await trySubscribe(wabaId, accessToken, apiVersion);
  await saveAccount(hospitalId, { wabaId, phoneNumberId, accessToken, apiVersion, via: "manual", subscribed: sub.ok, displayPhone: info.display_phone_number ?? "", verifiedName: info.verified_name ?? "" }, actor);
  return getStatus(actor);
}

/** Meta's Embedded Signup finished in the browser: swap its one-time code for a token, subscribe, and save. */
export async function connectWithCode(input: unknown, actor: Session): Promise<WhatsappStatusDTO> {
  const hospitalId = requireHospitalId(actor);
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const code = String(body.code ?? "").trim();
  if (!code) throw new ValidationError([{ field: "code", message: "is required" }]);
  const wabaId = idText("wabaId", body.wabaId);
  const phoneNumberId = idText("phoneNumberId", body.phoneNumberId);
  const e = env();
  if (!e.appId || !e.appSecret) throw new BadRequestError("Facebook login isn't set up on this server (FACEBOOK_APP_ID and FACEBOOK_APP_SECRET)");
  let accessToken: string;
  try { accessToken = await exchangeCode({ code, appId: e.appId, appSecret: e.appSecret, apiVersion: e.apiVersion }); }
  catch (err) { throw new BadRequestError(`Meta rejected the sign-in: ${metaMessage(err)}`); }
  let info: { display_phone_number?: string; verified_name?: string } = {};
  try { info = await fetchPhoneInfo({ phoneNumberId, accessToken, apiVersion: e.apiVersion }); } catch (err) { logger.warn("whatsapp.phone_info_failed", { error: metaMessage(err) }); }
  const sub = await trySubscribe(wabaId, accessToken, e.apiVersion);
  await saveAccount(hospitalId, { wabaId, phoneNumberId, accessToken, apiVersion: e.apiVersion, via: "embedded", subscribed: sub.ok, displayPhone: info.display_phone_number ?? "", verifiedName: info.verified_name ?? "" }, actor);
  return getStatus(actor);
}

/** The bot switch, the country code for numbers without one, and the signing-link template. A blank template name turns the template off. */
export async function updateSettings(input: unknown, actor: Session): Promise<WhatsappStatusDTO> {
  const a = await accountOf(requireHospitalId(actor));
  if (!a) throw new NotFoundError("WhatsApp connection");
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("botEnabled" in body) {
    if (typeof body.botEnabled !== "boolean") throw new ValidationError([{ field: "botEnabled", message: "must be on or off" }]);
    patch.bot_enabled = body.botEnabled;
  }
  if ("defaultCountry" in body) {
    const cc = String(body.defaultCountry ?? "").replace(/\D/g, "");
    if (!/^\d{1,3}$/.test(cc)) throw new ValidationError([{ field: "defaultCountry", message: "a country calling code like 91" }]);
    patch.default_country = cc;
  }
  if ("templateName" in body) {
    const name = String(body.templateName ?? "").trim();
    if (name && !/^[a-z0-9_]{1,120}$/.test(name)) throw new ValidationError([{ field: "templateName", message: "lower-case letters, digits and underscores, exactly as in Meta" }]);
    patch.consent_template = name;
  }
  if ("templateLanguage" in body) {
    const lang = String(body.templateLanguage ?? "").trim() || "en";
    if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(lang)) throw new ValidationError([{ field: "templateLanguage", message: "a language code like en or en_US" }]);
    patch.consent_template_lang = lang;
  }
  if ("templateFormat" in body) {
    if (body.templateFormat !== "named" && body.templateFormat !== "positional") throw new ValidationError([{ field: "templateFormat", message: "named or positional" }]);
    patch.consent_template_format = body.templateFormat;
  }
  if (Object.keys(patch).length) await whatsappAccountsRepo.update(a.id, patch as never);
  await audit(actor, "update", "whatsapp", a.hospital_id, patch);
  return getStatus(actor);
}

export async function disconnect(actor: Session): Promise<void> {
  const a = await accountOf(requireHospitalId(actor));
  if (!a) throw new NotFoundError("WhatsApp connection");
  await whatsappAccountsRepo.remove(a.id);
  await audit(actor, "delete", "whatsapp", a.hospital_id, { phoneNumberId: a.phone_number_id });
}

// ── Message log ──────────────────────────────────────────────────────────────

export async function logMessage(m: { hospitalId: number; direction: "in" | "out"; phone: string; kind: string; body: string; waMessageId?: string | null; status: string; error?: string | null }): Promise<void> {
  try {
    await whatsappMessagesRepo.create({
      hospital_id: m.hospitalId, direction: m.direction, phone: m.phone.replace(/\D/g, ""), kind: m.kind, body: m.body.slice(0, 1500),
      wa_message_id: m.waMessageId ?? null, status: m.status, error: m.error ?? null,
    } as never);
  } catch (e) { logger.warn("whatsapp.log_failed", { error: e instanceof Error ? e.message : String(e) }); }
}

const toMessageDto = (r: WhatsappMessageRow): WhatsappMessageDTO => ({
  id: r.id, direction: r.direction as "in" | "out", phone: maskPhone(r.phone), kind: r.kind, body: r.body, status: r.status as WhatsappMessageDTO["status"], error: r.error, at: r.created_at,
});

export async function listMessages(actor: Session, limit = 40): Promise<WhatsappMessageDTO[]> {
  const { rows } = await whatsappMessagesRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: requireHospitalId(actor) }] } as never);
  return (rows as WhatsappMessageRow[]).sort((a, b) => b.id - a.id).slice(0, Math.min(Math.max(limit, 1), 100)).map(toMessageDto);
}

/** A delivery report arrived for a message we sent. */
export async function applyStatus(s: { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] }): Promise<void> {
  if (!s.id || !s.status) return;
  const row = (await whatsappMessagesRepo.findRow([{ column: "wa_message_id", op: "eq", value: s.id }])) as WhatsappMessageRow | null;
  if (!row) return;
  const known = ["sent", "delivered", "read", "failed"];
  if (!known.includes(s.status)) return;
  // A late "sent" must not undo "delivered" / "read".
  const rank = (x: string) => known.indexOf(x);
  if (rank(s.status) < rank(row.status) && row.status !== "failed") return;
  const err = s.errors?.[0];
  await whatsappMessagesRepo.update(row.id, { status: s.status, error: s.status === "failed" ? [err?.title || err?.message, err?.error_data?.details].filter(Boolean).join(" — ") || "Delivery failed" : null } as never);
}

// ── Sending ──────────────────────────────────────────────────────────────────

export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 5) return d;
  const country = d.length > 10 ? d.slice(0, d.length - 10) : "";
  return `${country ? `+${country} ` : ""}••••• ${d.slice(-5)}`;
}

/** Meta's re-engagement rule: outside 24 hours of the person's last message only an approved template may be sent. */
const OUTSIDE_WINDOW = new Set([131047, 131026]);

/** Send plain text; the outcome is recorded and returned, never thrown. */
export async function sendText(hospitalId: number, to: string, text: string, kind: string): Promise<WhatsappSendResult> {
  const out = await outboundForHospital(hospitalId);
  if (!out) return { state: "not_connected" };
  const digits = normalizeWhatsAppTo(to, out.defaultCountryDigits);
  if (!digits) return { state: "failed", detail: "That isn't a valid WhatsApp phone number" };
  try {
    const res = await sendWhatsAppText({ ...out, to: digits, text });
    await logMessage({ hospitalId, direction: "out", phone: digits, kind, body: text, waMessageId: res.messages?.[0]?.id, status: "sent" });
    return { state: "sent", to: maskPhone(digits) };
  } catch (e) {
    const detail = failureText(e, false);
    await logMessage({ hospitalId, direction: "out", phone: digits, kind, body: text, status: "failed", error: detail });
    return { state: "failed", to: maskPhone(digits), detail };
  }
}

function failureText(e: unknown, templateAvailable: boolean): string {
  if (e instanceof WhatsAppApiError && e.code !== null && OUTSIDE_WINDOW.has(e.code)) {
    return templateAvailable
      ? `WhatsApp wouldn't deliver it: ${e.message}`
      : "WhatsApp only lets a hospital start a conversation with an approved message template. Add one under Setup → WhatsApp (or ask the patient to message the hospital first).";
  }
  return metaMessage(e);
}

/** Reply to an inbound message: buttons when asked and possible, otherwise text. Never throws. */
export async function reply(out: Outbound, to: string, text: string, buttons?: { id: string; title: string }[]): Promise<void> {
  const send = async () => {
    if (buttons?.length) {
      try { return await sendWhatsAppButtons({ ...out, to, body: text, buttons }); }
      catch (e) { logger.warn("whatsapp.buttons_failed", { error: metaMessage(e) }); }
    }
    return sendWhatsAppText({ ...out, to, text: text.slice(0, 3500) });
  };
  try {
    const res = await send();
    await logMessage({ hospitalId: out.hospitalId, direction: "out", phone: to, kind: "bot", body: text, waMessageId: res.messages?.[0]?.id, status: "sent" });
  } catch (e) {
    const detail = failureText(e, true);
    logger.error("whatsapp.reply_failed", { error: detail });
    await logMessage({ hospitalId: out.hospitalId, direction: "out", phone: to, kind: "bot", body: text, status: "failed", error: detail });
  }
}

/** Send the hospital's approved signing-link template (or plain text without one) to a patient. */
export async function sendSigningLink(hospitalId: number, o: { to: string; patientName: string; formTitle: string; link: string; message: string }): Promise<WhatsappSendResult> {
  const out = await outboundForHospital(hospitalId);
  if (!out) return { state: "not_connected" };
  const t = templateOf(out.account);
  if (!t.name) return sendText(hospitalId, o.to, o.message, "consent");
  const digits = normalizeWhatsAppTo(o.to, out.defaultCountryDigits);
  if (!digits) return { state: "failed", detail: "That isn't a valid WhatsApp phone number" };
  const hospital = await hospitalsRepo.getRow(hospitalId);
  // The template's variables, in order: {{1}} patient name, {{2}} form title, {{3}} signing link, {{4}} hospital name.
  const components = t.format === "named"
    ? namedParams({ patient_name: o.patientName, form_title: o.formTitle, link: o.link, hospital_name: hospital?.name ?? "" })
    : positionalParams([o.patientName, o.formTitle, o.link, hospital?.name ?? ""]);
  try {
    const res = await sendWhatsAppTemplate({ ...out, to: digits, template: t.name, language: t.language, components });
    await logMessage({ hospitalId, direction: "out", phone: digits, kind: "consent", body: o.message, waMessageId: res.messages?.[0]?.id, status: "sent" });
    return { state: "sent", to: maskPhone(digits) };
  } catch (e) {
    const detail = failureText(e, true);
    await logMessage({ hospitalId, direction: "out", phone: digits, kind: "consent", body: o.message, status: "failed", error: detail });
    return { state: "failed", to: maskPhone(digits), detail };
  }
}

export async function sendTest(input: unknown, actor: Session): Promise<WhatsappSendResult> {
  const hospitalId = requireHospitalId(actor);
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const to = String(body.to ?? "").trim();
  if (!normalizeWhatsAppTo(to)) throw new ValidationError([{ field: "to", message: "enter a WhatsApp number" }]);
  const hospital = await hospitalsRepo.getRow(hospitalId);
  return sendText(hospitalId, to, `This is a test message from ${hospital?.name ?? "your hospital"}. WhatsApp is connected.`, "test");
}

// ── The public link signing messages carry ───────────────────────────────────

/** The address patients open: PUBLIC_APP_URL, else the host the browser used (see `publicOrigin`). Empty outside a request with none set. */
export function publicAppUrl(): string {
  const req = currentRequest();
  return req ? publicOrigin(req) : (process.env.PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
}

// ── Webhook security ─────────────────────────────────────────────────────────

/** Meta signs each POST: `X-Hub-Signature-256: sha256=` + HMAC-SHA256(raw body, app secret). Unset secret → not checked. */
export function verifySignature(raw: string, header: string | null): boolean {
  const secret = env().appSecret;
  if (!secret) return true;
  if (!header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

export function verifyChallenge(q: { mode: string | null; token: string | null; challenge: string | null }): { status: number; body: string } {
  const expected = env().verifyToken;
  if (!expected) return { status: 503, body: "Webhook verify token isn't configured" };
  if (q.mode === "subscribe" && q.token === expected) return { status: 200, body: q.challenge ?? "" };
  return { status: 403, body: "Forbidden" };
}
