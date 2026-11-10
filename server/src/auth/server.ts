/**
 * Server-side authentication helpers for route handlers.
 * Reads the session from the request cookie, enforces auth + RBAC, and
 * sets/clears the session cookie on responses.
 */
import { currentRequest, readCookie } from "@/http/request-context";
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
import { hospitalIsOpen } from "@/auth/tenant-gate";

/** Read and verify the current session, or null when unauthenticated. */
export async function getSession(): Promise<Session | null> {
  const cfg = getConfig();
  const session = await verifyToken(readCookie(cfg.sessionCookieName));
  // Signing in is refused for a paused hospital; sessions already open must stop working too.
  if (session?.hospitalId != null && !(await hospitalIsOpen(session.hospitalId))) return null;
  // What this hospital's admin has changed about each role's access (reloaded every few seconds).
  if (session?.hospitalId != null) await (await import("@/services/role-access-service")).ensureRoleAccess(session.hospitalId);
  return session;
}

/** Require an authenticated session or throw 401. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** POST adds, PUT/PATCH changes, DELETE deletes. */
function writeKindOf(method: string | undefined): Action {
  const m = (method ?? "POST").toUpperCase();
  return m === "DELETE" ? "delete" : m === "PUT" || m === "PATCH" ? "edit" : "add";
}

/** Require a session with permission on a resource or throw 401/403. */
export async function requirePermission(
  resource: Resource,
  action: Action = "read",
): Promise<Session> {
  const session = await requireSession();
  // "write" on a route means "changes something": what that needs depends on what the request does.
  const needed: Action = action === "write" ? writeKindOf(currentRequest()?.method) : action;
  if (!can(session.role, resource, needed, session.hospitalId)) {
    const verb = { read: "view", add: "add to", edit: "change", delete: "delete from", write: "change" }[needed];
    throw new ForbiddenError(`Your role (${session.role}) cannot ${verb} ${resource}.`);
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
