/**
 * The Hono application: auth gate + every route under `src/routes`.
 *
 * Route files keep the familiar layout — `routes/patients/[id]/route.ts` serves
 * `/api/patients/:id` and exports one function per HTTP method — so adding an
 * endpoint is just adding a file. They are discovered at startup (see
 * `load-routes.ts`); nothing needs registering by hand.
 */
import { Hono } from "hono";
import { verifyToken } from "@/auth/session";
import { getConfig } from "@/config/env";
import { readCookie, runWithRequest } from "@/http/request-context";
import { loadRoutes, type LoadedRoute } from "@/load-routes";

/** Paths that never require a staff session. */
const PUBLIC_API = new Set(["/api/auth/login", "/api/health", "/api/razorpay/webhook", "/api/whatsapp/webhook"]);
/**
 * Routes that do their own authentication instead of using a staff session:
 *  - /api/portal/*  — the patient portal's server, with a shared key
 *  - /api/public/*  — the HMS patient booking page, with a signed link token
 */
const PUBLIC_API_PREFIXES = ["/api/portal/", "/api/public/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_API.has(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

export async function createApp(): Promise<{ app: Hono; routes: LoadedRoute[] }> {
  const app = new Hono();
  const routes = await loadRoutes();

  // Defence in depth: a request with no valid session is turned away before any
  // handler runs. Handlers still enforce RBAC themselves.
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS" || isPublic(c.req.path)) return next();
    const token = await runWithRequest(c.req.raw, () => readCookie(getConfig().sessionCookieName));
    if (!(await verifyToken(token))) return json(401, "UNAUTHORIZED", "Authentication required");
    return next();
  });

  for (const route of routes) {
    app.all(route.pattern, (c) => {
      const method = c.req.method === "HEAD" ? "GET" : c.req.method;
      const handler = route.handlers[method as keyof typeof route.handlers];
      if (!handler) {
        return new Response(null, { status: 405, headers: { Allow: Object.keys(route.handlers).join(", ") } });
      }
      const params = Promise.resolve(c.req.param());
      return runWithRequest(c.req.raw, async () => {
        const res = await handler(c.req.raw, { params });
        return res;
      });
    });
  }

  app.notFound((c) => json(404, "NOT_FOUND", `No route for ${c.req.method} ${c.req.path}`));
  return { app, routes };
}
