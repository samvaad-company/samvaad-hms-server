/**
 * Centralized, validated environment configuration.
 *
 * The application reads every runtime setting through this module so that
 * swapping the data backend (in-memory → Supabase) is purely a matter of
 * changing environment variables — no code changes required.
 */

export type DatabaseDriver = "memory" | "supabase";

export interface AppConfig {
  /** Which data-access driver to use. */
  databaseDriver: DatabaseDriver;
  /** Supabase project URL (only required when databaseDriver === "supabase"). */
  supabaseUrl: string | null;
  /** Supabase service-role key for server-side access. */
  supabaseServiceKey: string | null;
  /** Postgres schema Supabase exposes through PostgREST. */
  supabaseSchema: string;
  /** Secret used to sign session tokens (HMAC-SHA256). */
  sessionSecret: string;
  /** Session lifetime in seconds. */
  sessionMaxAge: number;
  /** Cookie name that stores the session token. */
  sessionCookieName: string;
  /** Whether we are running in production. */
  isProduction: boolean;
  /** Minimum log level to emit. */
  logLevel: "debug" | "info" | "warn" | "error";
  /** Sarvam AI API key for speech-to-text scribing (null → mock mode). */
  sarvamApiKey: string | null;
}

function pickDriver(): DatabaseDriver {
  const explicit = (process.env.DATABASE_DRIVER ?? "").toLowerCase();
  if (explicit === "supabase" || explicit === "memory") return explicit;
  // Auto-detect: if Supabase creds are present, prefer Supabase.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "supabase";
  }
  return "memory";
}

/**
 * A development-only fallback secret. In production a real SESSION_SECRET must
 * be provided; we throw at session-signing time if it is missing there.
 */
const DEV_SESSION_SECRET = "samvaad-hms-dev-secret-change-me";

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;

  const isProduction = process.env.NODE_ENV === "production";
  const driver = pickDriver();

  cached = {
    databaseDriver: driver,
    supabaseUrl: process.env.SUPABASE_URL ?? null,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    supabaseSchema: process.env.SUPABASE_SCHEMA ?? "public",
    sessionSecret: process.env.SESSION_SECRET ?? DEV_SESSION_SECRET,
    sessionMaxAge: Number(process.env.SESSION_MAX_AGE ?? 60 * 60 * 8), // 8h
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "samvaad_session",
    isProduction,
    logLevel:
      (process.env.LOG_LEVEL as AppConfig["logLevel"]) ??
      (isProduction ? "info" : "debug"),
    sarvamApiKey: process.env.SARVAM_API_KEY ?? null,
  };

  return cached;
}

/** Test/HMR helper to force re-read of env. */
export function resetConfigCache(): void {
  cached = null;
}
