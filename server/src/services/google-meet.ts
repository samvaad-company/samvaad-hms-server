/**
 * Google Calendar / Meet integration for tele-consults.
 *
 * Each hospital connects one Google account (OAuth, offline access). When a
 * tele-consult is confirmed we create a Meet room and put it on that account's
 * primary calendar, inviting the patient and doctor.
 *
 * Who may join is decided by the room's access type. A room made as a side
 * effect of a calendar event is "invited guests only" — a patient who opens the
 * link with a different Google account, or signed out, is told "You can't join
 * this video call" and isn't even offered "Ask to join". So the room is created
 * through the Meet API instead, where the hospital picks the access type:
 *   OPEN       anyone with the link joins directly (works with any accounts)
 *   TRUSTED    the host's organization and invitees join directly; others ask to join
 *   RESTRICTED invitees only; others ask to join
 * If the Meet API isn't available (permission not granted yet, API not enabled in
 * the Google project) the calendar-created room is used and the appointment is
 * flagged so staff know the access is Google's default.
 *
 * Only the refresh token is persisted, AES-GCM encrypted with a key derived
 * from SESSION_SECRET, and it is never sent to the browser.
 */
import { googleConnectionsRepo } from "@/repositories";
import { getConfig } from "@/config/env";
import { signPayload, verifyPayload } from "@/auth/session";
import { BadRequestError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const OAUTH_PURPOSE = "google-oauth";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const HTTP_TIMEOUT_MS = 8_000;
const MEET_SPACES_URL = "https://meet.googleapis.com/v2/spaces";
const CALENDAR_SCOPE_URL = "https://www.googleapis.com/auth/calendar.events";
const MEET_SCOPE_URL = "https://www.googleapis.com/auth/meetings.space.created";
const SCOPES = [CALENDAR_SCOPE_URL, MEET_SCOPE_URL, "openid", "email"];

export type MeetAccess = "OPEN" | "TRUSTED" | "RESTRICTED";
export const MEET_ACCESS_VALUES: readonly MeetAccess[] = ["OPEN", "TRUSTED", "RESTRICTED"];

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleConfigured(): boolean {
  return credentials() !== null;
}

function redirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/teleconsult/google/callback`;
}

// ── Token encryption ─────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function cryptoKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${getConfig().sessionSecret}:google-token`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");

export async function encryptToken(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), enc.encode(plain));
  return `${b64(iv)}.${b64(cipher)}`;
}

export async function decryptToken(stored: string): Promise<string> {
  const [iv, cipher] = stored.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
    await cryptoKey(),
    Buffer.from(cipher, "base64"),
  );
  return new TextDecoder().decode(plain);
}

// ── Connect / disconnect ─────────────────────────────────────────────────────

/** The Google consent URL for a hospital admin; `state` ties the callback back to them. */
export async function buildConnectUrl(hospitalId: number, userId: number, origin: string): Promise<string> {
  const cred = credentials();
  if (!cred) {
    throw new BadRequestError("Google isn't configured on this server — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }
  const { token } = await signPayload(OAUTH_PURPOSE, { h: hospitalId, u: userId }, 600);
  const params = new URLSearchParams({
    client_id: cred.clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Forces Google to return a refresh token even when the account approved us before.
    prompt: "consent",
    include_granted_scopes: "true",
    state: token,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  /** Space-separated scopes the user actually allowed (they can untick some on Google's consent screen). */
  scope?: string;
  error?: string;
  error_description?: string;
}

/** What we need from the account to put a Meet room on the calendar… */
const hasCalendarScope = (scope?: string) =>
  (scope ?? "").split(/\s+/).some((s) => s === CALENDAR_SCOPE_URL || s === "https://www.googleapis.com/auth/calendar");
/** …and, separately, to choose who may join it. */
const hasMeetScope = (scope?: string) => (scope ?? "").split(/\s+/).includes(MEET_SCOPE_URL);

/** A connection that can't be used any more (revoked, expired, or calendar access never granted). */
export class GoogleReconnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleReconnectError";
  }
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || json.error) {
    // invalid_grant = the refresh token was revoked or expired (Google expires them after 7 days while the OAuth app is in "Testing").
    if (json.error === "invalid_grant") {
      throw new GoogleReconnectError("Google sign-in expired or was revoked — reconnect Google in Admin → Settings");
    }
    throw new Error(json.error_description || json.error || `Google token request failed (${res.status})`);
  }
  return json;
}

function emailFromIdToken(idToken?: string): string {
  if (!idToken) return "";
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? "";
  } catch {
    return "";
  }
}

/** Finish the OAuth dance: verify `state`, swap the code for tokens, store the refresh token. */
export async function completeConnect(code: string, state: string, origin: string): Promise<{ hospitalId: number; email: string }> {
  const cred = credentials();
  if (!cred) throw new BadRequestError("Google isn't configured on this server");
  const payload = await verifyPayload<{ h: number; u: number }>(OAUTH_PURPOSE, state);
  if (!payload) throw new BadRequestError("This Google sign-in link expired — start again from Settings");

  const tokens = await tokenRequest({
    code,
    client_id: cred.clientId,
    client_secret: cred.clientSecret,
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });
  // Google lets people untick individual permissions. Without Calendar the connection would look fine
  // and then fail on every booking, so refuse it here, where the admin can fix it straight away.
  if (!hasCalendarScope(tokens.scope)) {
    throw new GoogleReconnectError("Google was connected without calendar access — connect again and tick the Calendar permission");
  }
  if (!tokens.refresh_token) {
    throw new BadRequestError(
      "Google didn't return offline access. Remove Samvaad from your Google account's third-party access and connect again",
    );
  }
  const email = emailFromIdToken(tokens.id_token);
  const values = {
    hospital_id: payload.h,
    account_email: email,
    refresh_token_enc: await encryptToken(tokens.refresh_token),
    connected_by: payload.u,
    scopes: tokens.scope ?? "",
    needs_reconnect: false,
    last_error: null,
  };
  const existing = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: payload.h }]);
  if (existing) await googleConnectionsRepo.update(existing.id, values);
  else await googleConnectionsRepo.create(values);
  return { hospitalId: payload.h, email };
}

export async function disconnectGoogle(hospitalId: number): Promise<void> {
  const existing = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: hospitalId }]);
  if (existing) await googleConnectionsRepo.remove(existing.id);
}

export async function googleStatus(hospitalId: number) {
  const row = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: hospitalId }]);
  return {
    configured: isGoogleConfigured(),
    /** Connected AND usable. */
    connected: !!row && !row.needs_reconnect,
    /** A connection exists but Google won't let us use it (calendar access missing, revoked or expired). */
    needsReconnect: !!row?.needs_reconnect,
    /** The connection can create rooms with a chosen access type (needs the Meet permission; older connections lack it). */
    meetAccessControl: !!row && hasMeetScope(row.scopes),
    lastError: row?.needs_reconnect ? row.last_error ?? null : null,
    accountEmail: row?.account_email ?? "",
  };
}

async function markNeedsReconnect(rowId: number, reason: string): Promise<void> {
  await googleConnectionsRepo.update(rowId, { needs_reconnect: true, last_error: reason });
}

// ── Meet links ───────────────────────────────────────────────────────────────

async function accessFor(hospitalId: number): Promise<{ token: string; scopes: string }> {
  const cred = credentials();
  if (!cred) throw new Error("Google isn't configured on this server");
  const row = await googleConnectionsRepo.findRow([{ column: "hospital_id", op: "eq", value: hospitalId }]);
  if (!row) throw new Error("Google Calendar isn't connected for this hospital");
  if (row.needs_reconnect) throw new GoogleReconnectError(row.last_error || "Google needs to be reconnected in Admin → Settings");
  const refresh = await decryptToken(row.refresh_token_enc);
  let tokens: TokenResponse;
  try {
    tokens = await tokenRequest({
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    });
  } catch (err) {
    if (err instanceof GoogleReconnectError) await markNeedsReconnect(row.id, err.message);
    throw err;
  }
  if (!tokens.access_token) throw new Error("Google didn't return an access token");
  // Connections made before scopes were checked may lack Calendar; find out now rather than via a 403 on every booking.
  if (tokens.scope !== undefined && !hasCalendarScope(tokens.scope)) {
    const msg = "Google was connected without calendar access — reconnect Google in Admin → Settings and tick the Calendar permission";
    await markNeedsReconnect(row.id, msg);
    throw new GoogleReconnectError(msg);
  }
  // Google reports what the grant covers on every refresh: keep the stored copy honest.
  const scopes = tokens.scope ?? row.scopes ?? "";
  if (tokens.scope !== undefined && tokens.scope !== row.scopes) await googleConnectionsRepo.update(row.id, { scopes: tokens.scope });
  return { token: tokens.access_token, scopes };
}

export interface MeetRequest {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  /** Emails to invite; blanks are ignored. */
  attendees: string[];
  /** Idempotency key so a retry never creates a second Meet room for the same booking. */
  requestId: string;
  /** Fixed calendar event id (base32hex: 0-9, a-v): a retry after a lost response finds the event instead of duplicating it. */
  eventId?: string;
  /** Who may join without being let in. */
  access: MeetAccess;
}

export interface MeetResult {
  url: string;
  eventId: string;
  /** The access type the room really has; "calendar-default" = Google's invited-guests-only default. */
  access: MeetAccess | "calendar-default";
  /** Why the room doesn't have the requested access type, if it doesn't. */
  warning?: string;
}

type EventBody = {
  id?: string;
  hangoutLink?: string;
  location?: string;
  extendedProperties?: { private?: Record<string, string> };
  error?: { message?: string };
};

const MEET_URL = /^https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+/;

const linkOf = (ev: EventBody): string | null => ev.hangoutLink ?? (ev.location && MEET_URL.test(ev.location) ? ev.location : null);

/** Create a Meet room through the Meet API with the chosen access type. */
async function createSpace(token: string, access: MeetAccess): Promise<string> {
  const res = await fetch(MEET_SPACES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ config: { accessType: access } }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as { meetingUri?: string; error?: { message?: string } };
  if (!res.ok || !json.meetingUri) throw new Error(json.error?.message || `Google Meet returned ${res.status} without a meeting link`);
  return json.meetingUri;
}

/** Create the Meet room, put it on the calendar, invite the attendees, and return the join URL. Throws with a readable message on failure. */
export async function createMeetLink(hospitalId: number, req: MeetRequest): Promise<MeetResult> {
  const { token, scopes } = await accessFor(hospitalId);
  const tz = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const eventUrl = (id: string) => `${EVENTS_URL}/${encodeURIComponent(id)}`;

  // The event id is fixed per appointment, so an event that already exists means an earlier attempt got as far as
  // creating it (we may just never have seen the response): reuse it instead of making a second room.
  const existing = async (): Promise<MeetResult | null> => {
    if (!req.eventId) return null;
    const res = await fetch(eventUrl(req.eventId), { headers, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    if (!res.ok) return null;
    const ev = (await res.json().catch(() => ({}))) as EventBody;
    const url = linkOf(ev);
    if (!url) return null;
    const access = (ev.extendedProperties?.private?.meetAccess as MeetAccess | "calendar-default" | undefined) ?? (ev.hangoutLink ? "calendar-default" : req.access);
    return { url, eventId: ev.id ?? req.eventId!, access };
  };
  const found = await existing();
  if (found) return found;

  let spaceUrl: string | null = null;
  let warning: string | undefined;
  if (hasMeetScope(scopes)) {
    try {
      spaceUrl = await createSpace(token, req.access);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      warning = `Couldn't set who can join the call (${reason}); Google's default applies — only invited guests can join without asking.`;
      logger.warn("google.meet.space_failed", { hospitalId, reason });
    }
  } else {
    warning = "Google was connected before call-access control existed; reconnect Google in Admin → Settings so patients can join without being invited.";
  }

  const attendees = req.attendees.filter(Boolean).map((email) => ({ email }));
  const base = {
    ...(req.eventId ? { id: req.eventId } : {}),
    summary: req.summary,
    start: { dateTime: req.start.toISOString(), timeZone: tz },
    end: { dateTime: req.end.toISOString(), timeZone: tz },
    attendees,
  };
  const body = spaceUrl
    ? {
        ...base,
        description: `${req.description}\n\nJoin the video call: ${spaceUrl}`,
        location: spaceUrl,
        extendedProperties: { private: { meetAccess: req.access } },
      }
    : {
        ...base,
        description: req.description,
        conferenceData: { createRequest: { requestId: req.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        extendedProperties: { private: { meetAccess: "calendar-default" } },
      };

  const res = await fetch(`${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as EventBody;

  if (res.status === 409 && req.eventId) {
    const again = await existing();
    if (again) return again;
  }
  const url = spaceUrl ?? linkOf(json);
  if (!res.ok || !url) {
    // The room exists even if the calendar entry failed; the link alone is still what the patient needs.
    if (spaceUrl) {
      logger.warn("google.calendar.failed_after_space", { hospitalId, status: res.status, message: json.error?.message });
      return { url: spaceUrl, eventId: "", access: req.access, warning: `The room was created but couldn't be added to the calendar (${json.error?.message ?? res.status}) — no calendar invites were sent.` };
    }
    const msg = json.error?.message || `Google Calendar returned ${res.status} without a Meet link`;
    logger.warn("google.meet.failed", { hospitalId, status: res.status, message: msg });
    throw new Error(msg);
  }
  return spaceUrl
    ? { url, eventId: json.id ?? req.eventId ?? "", access: req.access, ...(warning ? { warning } : {}) }
    : { url, eventId: json.id ?? req.eventId ?? "", access: "calendar-default", ...(warning ? { warning } : {}) };
}

/** Move a calendar event (a rescheduled consultation). The Meet room, and so the link, doesn't change. Throws with a readable message on failure. */
export async function moveMeetEvent(hospitalId: number, eventId: string, start: Date, end: Date): Promise<void> {
  const { token } = await accessFor(hospitalId);
  const tz = process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata";
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    body: JSON.stringify({ start: { dateTime: start.toISOString(), timeZone: tz }, end: { dateTime: end.toISOString(), timeZone: tz } }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(json.error?.message || `Google Calendar returned ${res.status}`);
  }
}
