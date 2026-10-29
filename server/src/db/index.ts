/**
 * Database factory + lazy seeding.
 *
 * `getDb()` returns the configured adapter, seeding the in-memory store on
 * first use. Switching to Supabase is purely configuration: set the Supabase
 * env vars (and DATABASE_DRIVER=supabase) and run the SQL migrations — no
 * application code changes are required.
 */
import { type DatabaseAdapter } from "@/db/adapter";
import { MemoryAdapter } from "@/db/memory-adapter";
import { SupabaseAdapter } from "@/db/supabase-adapter";
import { MongoAdapter } from "@/db/mongo-adapter";
import { ensureIndexes, reconcileCounters } from "@/db/mongo-indexes";
import { buildSeed } from "@/db/seed";
import { seedIfEmpty } from "@/db/seed-runner";
import { normalizeStoredDates, renameLegacyEnquiryStatus } from "@/db/normalize-dates";
import { getConfig } from "@/config/env";
import { logger } from "@/lib/logger";

let adapter: DatabaseAdapter | null = null;
let readyPromise: Promise<DatabaseAdapter> | null = null;

// Bump this whenever SECONDARY (mongo-indexes.ts) or DATE_COLUMNS
// (normalize-dates.ts) changes, so the next cold start re-runs maintenance
// once and then goes back to skipping it.
// v2: added reconcileCounters — catches up the `counters` collection to each
// table's real max id, fixing E11000 collisions on tables whose rows
// predate (or otherwise bypassed) the counter-bump logic.
// v3: unique partial indexes for tele-consult (one appointment per booking, one ledger row per payment).
// v4: enquiry status "Follow-up" renamed "Contacted"; new IPD nurse-station and checklist collections.
// v5: blood bank, MRD, consents and CSSD collections and indexes.
// v6: HR collections and indexes (leave, shifts, roster, salaries, payroll).
// v7: Setup records (masters, hospital setup, branches).
// v8: pharmacy batches, dispenses and returns.
// v9: bill line items.
const MONGO_SCHEMA_VERSION = 11;

async function runMongoMaintenance(mongo: MongoAdapter): Promise<void> {
  try {
    const db = await mongo.database();
    const meta = db.collection<{ _id: string; version: number; updatedAt: Date }>("_meta");

    // Index creation/seeding/date-normalization are each idempotent, but
    // running all ~215 index-creation calls on every cold start still means
    // ~215 real round trips to Atlas that saturate the connection pool
    // (default maxPoolSize is 100) and queue out real request traffic behind
    // them. Once they've succeeded against this cluster, a single fast
    // findOne is enough to confirm there's nothing to do.
    const existing = await meta.findOne({ _id: "schema" });
    if (existing?.version === MONGO_SCHEMA_VERSION) return;

    // Indexes are Mongo's equivalent of the SQL migrations; idempotent.
    await ensureIndexes(db);
    // Catch the id counters up to reality before anything else inserts.
    await reconcileCounters(db);
    // Populate sample data the first time only (empty database).
    if (process.env.MONGODB_AUTO_SEED !== "false") {
      try {
        await seedIfEmpty(mongo);
      } catch (err) {
        logger.error("mongo.seed_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    await normalizeStoredDates(mongo);
    await renameLegacyEnquiryStatus(mongo);

    await meta.updateOne(
      { _id: "schema" },
      { $set: { version: MONGO_SCHEMA_VERSION, updatedAt: new Date() } },
      { upsert: true },
    );
  } catch (err) {
    logger.error("mongo.maintenance_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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
    await normalizeStoredDates(supabase);
    adapter = supabase;
    return supabase;
  }

  if (cfg.databaseDriver === "mongo") {
    const mongo = new MongoAdapter();
    await mongo.ready();
    // The adapter is usable the moment the connection is live — indexes,
    // demo seeding, and date normalization are all idempotent maintenance
    // (see their own doc comments) that queries don't need to wait on, so
    // they run in the background instead of adding several extra seconds
    // to every cold start (each createIndex/list call is a real round trip
    // to Atlas, and there are 200+ of them). A request landing in the tiny
    // window before this finishes just runs unindexed/unseeded/unnormalized
    // for that one query, which is only ever actually possible against a
    // brand-new empty database (first-ever deploy), not steady-state prod.
    adapter = mongo;
    void runMongoMaintenance(mongo);
    return mongo;
  }

  const memory = new MemoryAdapter();
  const seed = await buildSeed();
  memory.seed(seed);
  await memory.ready();
  await normalizeStoredDates(memory);
  adapter = memory;
  return memory;
}

/** Get the configured, ready-to-use database adapter. */
export function getDb(): Promise<DatabaseAdapter> {
  if (adapter) return Promise.resolve(adapter);
  if (!readyPromise) readyPromise = initialize();
  return readyPromise;
}
