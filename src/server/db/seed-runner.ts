/**
 * Seeds a live database (e.g. Supabase) the first time it is used, if empty.
 *
 * For the in-memory adapter, seeding happens in-process. For Supabase, run the
 * SQL migrations under `supabase/migrations/` to create the schema, then this
 * runner populates the sample data on first boot when SUPABASE_AUTO_SEED=true
 * and the database is empty. Inserts preserve ids so foreign keys line up.
 */
import { type DatabaseAdapter } from "@/server/db/adapter";
import { TABLES } from "@/server/db/tables";
import { buildSeed } from "@/server/db/seed";
import { logger } from "@/server/lib/logger";

// Tables inserted in dependency order so foreign keys resolve.
const SEED_ORDER: string[] = [
  TABLES.departments,
  TABLES.doctors,
  TABLES.staff,
  TABLES.users,
  TABLES.patients,
  TABLES.appointments,
  TABLES.opdVisits,
  TABLES.medicines,
  TABLES.prescriptions,
  TABLES.prescriptionItems,
  TABLES.pharmacyItems,
  TABLES.labTests,
  TABLES.bills,
  TABLES.wards,
  TABLES.beds,
  TABLES.ipdAdmissions,
  TABLES.otSchedules,
  TABLES.hospitalSettings,
];

export async function seedIfEmpty(adapter: DatabaseAdapter): Promise<void> {
  const existing = await adapter.count(TABLES.hospitalSettings);
  if (existing > 0) {
    logger.info("seed.skip", { reason: "already populated" });
    return;
  }

  logger.info("seed.start", { driver: adapter.driver });
  const data = await buildSeed();

  for (const table of SEED_ORDER) {
    const rows = data[table] ?? [];
    for (const row of rows) {
      await adapter.insert(table, row);
    }
    logger.info("seed.table", { table, rows: rows.length });
  }
  logger.info("seed.done", { driver: adapter.driver });
}
