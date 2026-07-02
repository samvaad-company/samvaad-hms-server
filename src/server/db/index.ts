/**
 * Database factory + lazy seeding.
 *
 * `getDb()` returns the configured adapter, seeding the in-memory store on
 * first use. Switching to Supabase is purely configuration: set the Supabase
 * env vars (and DATABASE_DRIVER=supabase) and run the SQL migrations — no
 * application code changes are required.
 */
import { type DatabaseAdapter } from "@/server/db/adapter";
import { MemoryAdapter } from "@/server/db/memory-adapter";
import { SupabaseAdapter } from "@/server/db/supabase-adapter";
import { buildSeed } from "@/server/db/seed";
import { seedIfEmpty } from "@/server/db/seed-runner";
import { getConfig } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

let adapter: DatabaseAdapter | null = null;
let readyPromise: Promise<DatabaseAdapter> | null = null;

async function initialize(): Promise<DatabaseAdapter> {
  const cfg = getConfig();
  logger.info("db.init", { driver: cfg.databaseDriver });

  if (cfg.databaseDriver === "supabase") {
    const supabase = new SupabaseAdapter();
    await supabase.ready();
    // Optionally populate sample data the first time (empty DB only).
    if (process.env.SUPABASE_AUTO_SEED === "true") {
      try {
        await seedIfEmpty(supabase);
      } catch (err) {
        logger.error("supabase.seed_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    adapter = supabase;
    return supabase;
  }

  const memory = new MemoryAdapter();
  const seed = await buildSeed();
  memory.seed(seed);
  await memory.ready();
  adapter = memory;
  return memory;
}

/** Get the configured, ready-to-use database adapter. */
export function getDb(): Promise<DatabaseAdapter> {
  if (adapter) return Promise.resolve(adapter);
  if (!readyPromise) readyPromise = initialize();
  return readyPromise;
}
