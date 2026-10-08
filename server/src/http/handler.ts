/**
 * Route handler wrapper: centralizes error handling, logging, and retry of
 * transient backend failures so individual route files stay declarative.
 */
import { ApiResponse, type ApiRequest } from "@/http/web";
import { AppError, isAppError } from "@/lib/errors";
import { errorResponse } from "@/http/response";
import { logger } from "@/lib/logger";

export type RouteHandler<Ctx = unknown> = (
  req: ApiRequest,
  ctx: Ctx,
) => Promise<ApiResponse> | ApiResponse;

/** Wrap a route handler with consistent error handling + access logging. */
export function withRoute<Ctx = unknown>(
  handler: RouteHandler<Ctx>,
): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const start = Date.now();
    const reqLog = logger.child({
      method: req.method,
      path: new URL(req.url).pathname,
    });
    try {
      const res = await handler(req, ctx);
      reqLog.info("request.ok", {
        status: res.status,
        ms: Date.now() - start,
      });
      return res;
    } catch (err) {
      if (isAppError(err)) {
        // Client/expected errors are logged at warn, not error.
        const level = err.status >= 500 ? "error" : "warn";
        reqLog[level]("request.failed", {
          status: err.status,
          code: err.code,
          message: err.message,
          ms: Date.now() - start,
        });
        return errorResponse(err);
      }

      reqLog.error("request.unhandled", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ms: Date.now() - start,
      });
      return errorResponse(
        new AppError(500, "INTERNAL", "An unexpected error occurred"),
      );
    }
  };
}

/**
 * Retry a transient async operation with exponential backoff. Used by the
 * Supabase adapter for network blips; the in-memory adapter never throws here.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 100;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Never retry deterministic application errors.
      if (isAppError(err)) throw err;
      if (attempt === retries) break;
      const delay = base * 2 ** attempt;
      logger.warn("retry", {
        label: opts.label,
        attempt: attempt + 1,
        delay,
      });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
