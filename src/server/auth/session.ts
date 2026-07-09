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
      doctorId: payload.did ?? null,
    };
  } catch {
    return null;
  }
}
