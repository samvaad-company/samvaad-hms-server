/**
 * The server's own request/response types.
 *
 * Route handlers are plain Web-standard functions — `(req: Request, ctx) =>
 * Response` — so they run on any host (Node, Vercel, Bun, a Worker). These are
 * the few conveniences they lean on: JSON/redirect helpers and a cookie setter
 * on the response.
 */

export type ApiRequest = Request;

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

function serializeCookie(c: CookieOptions): string {
  const parts = [`${c.name}=${encodeURIComponent(c.value)}`];
  if (c.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(c.maxAge)}`);
  parts.push(`Path=${c.path ?? "/"}`);
  if (c.httpOnly) parts.push("HttpOnly");
  if (c.secure) parts.push("Secure");
  if (c.sameSite) parts.push(`SameSite=${c.sameSite[0].toUpperCase()}${c.sameSite.slice(1)}`);
  return parts.join("; ");
}

export class ApiResponse extends Response {
  readonly cookies = {
    set: (cookie: CookieOptions) => {
      this.headers.append("Set-Cookie", serializeCookie(cookie));
    },
  };

  static json(data: unknown, init: ResponseInit = {}): ApiResponse {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new ApiResponse(JSON.stringify(data), { ...init, headers });
  }

  static redirect(url: string | URL, status = 307): ApiResponse {
    return new ApiResponse(null, { status, headers: { Location: String(url) } });
  }
}

/**
 * The origin the browser actually used. Behind the frontend's `/api` rewrite
 * (or any reverse proxy) the request reaches this server as its own host, so
 * trust the forwarded headers — or an explicit PUBLIC_APP_URL — when a response
 * must send the user back to the app (e.g. the Google OAuth redirect).
 */
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = req.headers.get("x-forwarded-host");
  if (host) {
    const first = host.split(",")[0].trim();
    // Not every proxy sends the scheme (Next's dev rewrite often doesn't): assume plain http for a
    // local host, which can't be serving https without a header, and https for anything else.
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(first);
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (isLocal ? "http" : "https");
    return `${proto}://${first}`;
  }
  return new URL(req.url).origin;
}
