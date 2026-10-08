/**
 * Discovers route modules on disk. A file `routes/<path>/route.ts` serves
 * `/api/<path>`, where `[id]` becomes the `:id` path parameter, and exports a
 * handler per HTTP method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Method = (typeof METHODS)[number];
export type RouteHandler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;

export interface LoadedRoute {
  pattern: string;
  file: string;
  handlers: Partial<Record<Method, RouteHandler>>;
}

const ROUTES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "routes");

async function findRouteFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findRouteFiles(full)));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function toPattern(file: string): string {
  const segments = path
    .relative(ROUTES_DIR, path.dirname(file))
    .split(path.sep)
    .filter(Boolean)
    .map((s) => (s.startsWith("[") && s.endsWith("]") ? `:${s.slice(1, -1)}` : s));
  return "/api" + (segments.length ? "/" + segments.join("/") : "");
}

/** Static segments before dynamic ones, so `/staff/attendance/summary` wins over `/staff/attendance/:id`. */
function bySpecificity(a: LoadedRoute, b: LoadedRoute): number {
  const sa = a.pattern.split("/");
  const sb = b.pattern.split("/");
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (sa[i] === undefined) return -1;
    if (sb[i] === undefined) return 1;
    const da = sa[i].startsWith(":");
    const db = sb[i].startsWith(":");
    if (da !== db) return da ? 1 : -1;
  }
  return a.pattern.localeCompare(b.pattern);
}

export async function loadRoutes(): Promise<LoadedRoute[]> {
  const files = await findRouteFiles(ROUTES_DIR);
  const routes = await Promise.all(
    files.map(async (file) => {
      const mod = (await import(pathToFileURL(file).href)) as Partial<Record<Method, RouteHandler>>;
      const handlers: LoadedRoute["handlers"] = {};
      for (const m of METHODS) if (typeof mod[m] === "function") handlers[m] = mod[m];
      return { pattern: toPattern(file), file, handlers } satisfies LoadedRoute;
    }),
  );
  return routes.sort(bySpecificity);
}
