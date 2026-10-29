/**
 * WhatsApp Cloud API (Meta Graph): sending messages, and the few account calls onboarding needs.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 *
 * Every call goes through `globalThis.fetch` looked up at call time, so tests can stand in for Meta.
 */

export const DEFAULT_API_VERSION = "v21.0";
export const DEFAULT_COUNTRY_DIGITS = "91";

/** A failed Graph call. `apiDetail` is Meta's own explanation (e.g. a template-parameter mismatch). */
export class WhatsAppApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: number | null, readonly details: unknown, readonly apiDetail: string | null) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

/**
 * Digits-only `to` for the Cloud API: country code + national number, no `+`.
 *  - 10 digits → prefixed with the default country; a leading `00` or a trunk `0` is dropped;
 *  - anything already carrying its country code is kept as it is.
 */
export function normalizeWhatsAppTo(raw: string | null | undefined, defaultCountryDigits: string = DEFAULT_COUNTRY_DIGITS): string | null {
  const cc = String(defaultCountryDigits || DEFAULT_COUNTRY_DIGITS).replace(/\D/g, "") || DEFAULT_COUNTRY_DIGITS;
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  while (digits.startsWith("00") && digits.length > 2) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith(cc) && digits.length >= cc.length + 10) return digits;
  if (digits.length === 10) return `${cc}${digits}`;
  if (digits.length >= 11) return digits;
  return null;
}

const base = (version?: string) => `https://graph.facebook.com/${version || DEFAULT_API_VERSION}`;

/** The error Meta sent back, as one readable error with its status and its own detail text. */
async function failure(res: Response): Promise<WhatsAppApiError> {
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_data?: { details?: string } | { details?: string }[] } };
  const nested = Array.isArray(data.error?.error_data) ? data.error?.error_data[0]?.details : data.error?.error_data?.details;
  const message = data.error?.message || `WhatsApp API HTTP ${res.status}`;
  return new WhatsAppApiError(nested ? `${message} — ${nested}` : message, res.status, data.error?.code ?? null, data, nested ?? null);
}

export interface Credentials { phoneNumberId: string; accessToken: string; apiVersion?: string }

export async function graphSendMessages({ phoneNumberId, accessToken, payload, apiVersion }: Credentials & { payload: Record<string, unknown> }): Promise<{ messages?: { id: string }[] }> {
  const res = await globalThis.fetch(`${base(apiVersion)}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await failure(res);
  return (await res.json().catch(() => ({}))) as { messages?: { id: string }[] };
}

interface Recipient { to: string; defaultCountryDigits?: string }
function recipient(r: Recipient): string {
  const to = normalizeWhatsAppTo(r.to, r.defaultCountryDigits);
  if (!to) throw new Error("That isn't a valid WhatsApp phone number");
  return to;
}

export const sendWhatsAppText = (o: Credentials & Recipient & { text: string }) =>
  graphSendMessages({ ...o, payload: { messaging_product: "whatsapp", to: recipient(o), type: "text", text: { body: o.text.slice(0, 4096), preview_url: true } } });

/** Reply buttons: at most 3, titles up to 20 characters, body up to 1024. */
export function sendWhatsAppButtons(o: Credentials & Recipient & { body: string; buttons: { id: string; title: string }[] }) {
  const buttons = o.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: String(b.id || "btn").slice(0, 256), title: String(b.title || "OK").slice(0, 20) } }));
  if (!buttons.length) throw new Error("At least one button is needed");
  return graphSendMessages({
    ...o,
    payload: { messaging_product: "whatsapp", to: recipient(o), type: "interactive", interactive: { type: "button", body: { text: o.body.trim().slice(0, 1024) }, action: { buttons } } },
  });
}

export const sendWhatsAppTemplate = (o: Credentials & Recipient & { template: string; language?: string; components?: unknown[] }) =>
  graphSendMessages({
    ...o,
    payload: { messaging_product: "whatsapp", to: recipient(o), type: "template", template: { name: o.template, language: { code: o.language || "en" }, components: o.components ?? [] } },
  });

/** Body parameters for a template whose variables are numbered ({{1}}, {{2}} …). */
export const positionalParams = (texts: string[]) => [{ type: "body", parameters: texts.map((t) => ({ type: "text", text: String(t ?? "") })) }];
/** Body parameters for a template whose variables are named ({{patient_name}} …). */
export const namedParams = (values: Record<string, string>) => [{ type: "body", parameters: Object.entries(values).map(([parameter_name, v]) => ({ type: "text", text: String(v ?? ""), parameter_name })) }];

// ── Account calls (onboarding) ───────────────────────────────────────────────

async function graphGet<T>(path: string, accessToken: string, apiVersion?: string): Promise<T> {
  const res = await globalThis.fetch(`${base(apiVersion)}/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

/** The number's display phone and verified business name — also proves the token can reach it. */
export const fetchPhoneInfo = (c: Credentials) =>
  graphGet<{ display_phone_number?: string; verified_name?: string }>(`${c.phoneNumberId}?fields=display_phone_number,verified_name`, c.accessToken, c.apiVersion);

/** Exchange the code Embedded Signup returned for an access token. */
export async function exchangeCode(opts: { code: string; appId: string; appSecret: string; apiVersion?: string }): Promise<string> {
  const url = new URL(`${base(opts.apiVersion)}/oauth/access_token`);
  url.searchParams.set("client_id", opts.appId);
  url.searchParams.set("client_secret", opts.appSecret);
  url.searchParams.set("code", opts.code);
  const res = await globalThis.fetch(url);
  if (!res.ok) throw await failure(res);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!data.access_token) throw new WhatsAppApiError("Meta didn't return an access token", 502, null, data, null);
  return data.access_token;
}

/** Subscribe our app to the WABA so Meta delivers its messages and statuses to the webhook. */
export async function subscribeApp(c: { wabaId: string; accessToken: string; apiVersion?: string }): Promise<void> {
  const res = await globalThis.fetch(`${base(c.apiVersion)}/${c.wabaId}/subscribed_apps`, { method: "POST", headers: { Authorization: `Bearer ${c.accessToken}` } });
  if (!res.ok) throw await failure(res);
}
