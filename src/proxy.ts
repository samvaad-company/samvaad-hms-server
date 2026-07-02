/**
 * Proxy (formerly "middleware") — runs before routes render.
 *
 * Enforces authentication globally: unauthenticated page requests redirect to
 * /login; unauthenticated API requests get a 401 JSON response. Verification
 * uses Web Crypto so it runs in the Edge runtime.
 */
import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/session";
import { getConfig } from "@/server/config/env";

/** Paths that never require authentication. */
const PUBLIC_PATHS = ["/login"];
const PUBLIC_API = ["/api/auth/login", "/api/health"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true;
  if (PUBLIC_API.some((p) => pathname === p)) return true;
  return false;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const cfg = getConfig();
  const token = request.cookies.get(cfg.sessionCookieName)?.value;
  const session = await verifyToken(token);

  if (session) return NextResponse.next();

  // Unauthenticated.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
