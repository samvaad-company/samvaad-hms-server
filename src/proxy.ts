/**
 * Proxy (formerly "middleware") — runs before pages render.
 *
 * A light gate on page navigation: no session cookie → redirect to /login.
 * It only checks the cookie is present; the API server owns the session secret
 * and verifies the token on every request, and the client bounces to /login on
 * any 401, so an expired or tampered cookie can't reach data.
 *
 * `/api/*` is excluded from the matcher below on purpose: next.config.ts rewrites it
 * straight to the API server, and keeping this proxy off those requests means their
 * bodies (audio, documents) stream through untouched instead of being buffered.
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "samvaad_session";

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/login/")) return NextResponse.next();
  // Patients open this from a link a tele-caller sent; the link's signed token is the credential.
  if (pathname.startsWith("/book-video/")) return NextResponse.next();
  if (request.cookies.get(COOKIE)?.value) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on page requests only: not /api, Next internals or static assets.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
