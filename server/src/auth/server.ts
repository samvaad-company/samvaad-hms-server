/**
 * Server-side authentication helpers for route handlers.
 * Reads the session from the request cookie, enforces auth + RBAC, and
 * sets/clears the session cookie on responses.
 */
import { readCookie } from "@/http/request-context";
import { type ApiResponse } from "@/http/web";
import { getConfig } from "@/config/env";
import {
  createToken,
  verifyToken,
  type Session,
} from "@/auth/session";
import {
  can,
  type Action,
  type Resource,
} from "@/auth/rbac";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

/** Read and verify the current session, or null when unauthenticated. */
export async function getSession(): Promise<Session | null> {
  const cfg = getConfig();
  return verifyToken(readCookie(cfg.sessionCookieName));
}

/** Require an authenticated session or throw 401. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Require a session with permission on a resource or throw 401/403. */
export async function requirePermission(
  resource: Resource,
  action: Action = "read",
): Promise<Session> {
  const session = await requireSession();
  if (!can(session.role, resource, action)) {
    throw new ForbiddenError(
      `Your role (${session.role}) cannot ${action} ${resource}.`,
    );
  }
  return session;
}

/** Attach a freshly-signed session cookie to a response. */
export async function setSessionCookie(
  res: ApiResponse,
  session: Session,
): Promise<void> {
  const cfg = getConfig();
  const token = await createToken(session);
  res.cookies.set({
    name: cfg.sessionCookieName,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.isProduction,
    path: "/",
    maxAge: cfg.sessionMaxAge,
  });
}

/** Clear the session cookie on a response (logout). */
export function clearSessionCookie(res: ApiResponse): void {
  const cfg = getConfig();
  res.cookies.set({
    name: cfg.sessionCookieName,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: cfg.isProduction,
    path: "/",
    maxAge: 0,
  });
}
