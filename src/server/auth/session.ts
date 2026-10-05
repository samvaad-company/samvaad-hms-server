/**
 * Stateless signed session tokens using Web Crypto (HMAC-SHA256).
 *
 * Using `crypto.subtle` keeps this module runtime-agnostic: it works in both
 * the Node.js route-handler runtime and the Edge runtime where the proxy
 * middleware executes. Token format: `<base64url(payload)>.<base64url(sig)>`.
 */
import { getConfig } from "@/server/config/env";

export interface SessionPayload {
  /** user id */
  sub: number;
  name: string;
  email: string;
  role: string;
  /** owning hospital id — set for hospital accounts, absent for radiology center accounts */
  hid?: number;
  /** owning radiology center id — set for radiology center accounts only */
  rcid?: number;
  /** owning lab center id — set for lab center accounts only */
  lcid?: number;
  /** linked doctor id, present only for doctor accounts */
  did?: number;
  /** issued-at (epoch seconds) */
  iat: number;
  /** expiry (epoch seconds) */
  exp: number;
}

export interface Session {
  userId: number;
  name: string;
  email: string;
  role: string;
  /** null for radiology/lab center accounts, which belong to no single hospital */
  hospitalId: number | null;
  /** set only for radiology center accounts */
  radiologyCenterId: number | null;
  /** set only for lab center accounts */
  labCenterId: number | null;
  doctorId: number | null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "===".slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      encoder.encode(getConfig().sessionSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return keyPromise;
}

async function sign(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/**
 * Short-lived signed payloads for things that aren't a login session (e.g.
 * the attendance QR). The `purpose` is mixed into the signature, so a token
 * minted for one purpose — or a session token — can never verify as another.
 */
export async function signPayload(
  purpose: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const encoded = toBase64Url(encoder.encode(JSON.stringify({ ...payload, exp: expiresAt })));
  return { token: `${encoded}.${await sign(`${purpose}:${encoded}`)}`, expiresAt };
}

export async function verifyPayload<T extends Record<string, unknown>>(
  purpose: string,
  token: string | undefined | null,
): Promise<(T & { exp: number }) | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  if ((await sign(`${purpose}:${encoded}`)) !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as T & { exp: number };
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createToken(
  session: Session,
  maxAgeSeconds?: number,
): Promise<string> {
  const cfg = getConfig();
  const iat = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    ...(session.hospitalId != null ? { hid: session.hospitalId } : {}),
    ...(session.radiologyCenterId != null ? { rcid: session.radiologyCenterId } : {}),
    ...(session.labCenterId != null ? { lcid: session.labCenterId } : {}),
    ...(session.doctorId != null ? { did: session.doctorId } : {}),
    iat,
    exp: iat + (maxAgeSeconds ?? cfg.sessionMaxAge),
  };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await sign(encoded);
  return `${encoded}.${sig}`;
}

export async function verifyToken(
  token: string | undefined | null,
): Promise<Session | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = await sign(encoded);
  if (expected !== sig) return null;

  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      hospitalId: payload.hid ?? null,
      radiologyCenterId: payload.rcid ?? null,
      labCenterId: payload.lcid ?? null,
      doctorId: payload.did ?? null,
    };
  } catch {
    return null;
  }
}
