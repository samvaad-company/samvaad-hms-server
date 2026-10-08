/**
 * Minimal structured logger. Emits single-line JSON in production (easy to
 * ingest) and human-friendly output in development. Honors LOG_LEVEL.
 */
import { getConfig } from "@/config/env";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function emit(
  level: Level,
  bindings: Record<string, unknown>,
  msg: string,
  meta?: Record<string, unknown>,
): void {
  const cfg = getConfig();
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[cfg.logLevel]) return;

  const record = {
    level,
    time: new Date().toISOString(),
    msg,
    ...bindings,
    ...meta,
  };

  if (cfg.isProduction) {
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const prefix = `[${level.toUpperCase()}]`;
  const extra =
    Object.keys({ ...bindings, ...meta }).length > 0
      ? { ...bindings, ...meta }
      : undefined;
  if (level === "error") console.error(prefix, msg, extra ?? "");
  else if (level === "warn") console.warn(prefix, msg, extra ?? "");
  else console.log(prefix, msg, extra ?? "");
}

function build(bindings: Record<string, unknown>): Logger {
  return {
    debug: (msg, meta) => emit("debug", bindings, msg, meta),
    info: (msg, meta) => emit("info", bindings, msg, meta),
    warn: (msg, meta) => emit("warn", bindings, msg, meta),
    error: (msg, meta) => emit("error", bindings, msg, meta),
    child: (extra) => build({ ...bindings, ...extra }),
  };
}

export const logger = build({});
