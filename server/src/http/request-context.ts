/**
 * Request-scoped context, so auth helpers can read the current request's
 * cookies without every service threading `req` through its arguments.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ req: Request }>();

export function runWithRequest<T>(req: Request, fn: () => T): T {
  return storage.run({ req }, fn);
}

/** Read one cookie from the request currently being handled. */
export function readCookie(name: string): string | undefined {
  const header = storage.getStore()?.req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0 && part.slice(0, idx).trim() === name) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}
