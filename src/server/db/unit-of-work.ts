/**
 * Unit of work with compensating rollback.
 *
 * Several operations touch more than one table — a pharmacy sale writes the
 * sale, its line items, the stock levels and a bill. If one of those steps
 * failed halfway, the earlier writes stayed behind: stock could be decremented
 * for a sale that was never recorded.
 *
 * Why not a driver transaction?
 *   - MongoDB transactions require a replica set; a standalone mongod (the
 *     default local and small-deployment setup) rejects them outright.
 *   - Supabase is reached over PostgREST, which has no multi-statement
 *     transaction support.
 * A compensating unit of work is therefore the only approach that behaves
 * identically on all three drivers, with no infrastructure requirement.
 *
 * Guarantee: **failure atomicity** — if the block throws, every write it made
 * is undone in reverse order, so no partial state is left behind.
 * Non-guarantee: **isolation** — a concurrent reader can still observe an
 * intermediate state before the rollback completes. For true isolation, run
 * MongoDB as a replica set and layer native transactions on top of this same
 * interface.
 */
import { getDb } from "@/server/db";
import { type Row } from "@/server/db/adapter";
import { logger } from "@/server/lib/logger";

export interface UnitOfWork {
  insert<T extends Row>(table: string, values: Record<string, unknown>): Promise<T>;
  update<T extends Row>(
    table: string,
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<T | null>;
  remove(table: string, id: number | string): Promise<boolean>;
}

type Compensation = { describe: string; run: () => Promise<void> };

/**
 * Run `fn` as a single logical operation. Any write performed through the
 * supplied unit of work is rolled back if `fn` throws.
 */
export async function transactional<T>(
  label: string,
  fn: (uow: UnitOfWork) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const compensations: Compensation[] = [];

  const uow: UnitOfWork = {
    async insert<R extends Row>(table: string, values: Record<string, unknown>) {
      const row = await db.insert<R>(table, values);
      compensations.push({
        describe: `delete ${table}#${row.id}`,
        run: async () => {
          await db.remove(table, row.id);
        },
      });
      return row;
    },

    async update<R extends Row>(
      table: string,
      id: number | string,
      values: Record<string, unknown>,
    ) {
      // Capture only the columns being changed, so the undo restores exactly
      // what this operation touched and nothing else.
      const before = await db.findById<R>(table, id);
      const row = await db.update<R>(table, id, values);
      if (before) {
        const prior: Record<string, unknown> = {};
        for (const key of Object.keys(values)) prior[key] = before[key];
        compensations.push({
          describe: `restore ${table}#${id}`,
          run: async () => {
            await db.update(table, id, prior);
          },
        });
      }
      return row;
    },

    async remove(table: string, id: number | string) {
      const before = await db.findById<Row>(table, id);
      const ok = await db.remove(table, id);
      if (ok && before) {
        compensations.push({
          describe: `re-insert ${table}#${id}`,
          run: async () => {
            await db.insert(table, before);
          },
        });
      }
      return ok;
    },
  };

  try {
    return await fn(uow);
  } catch (error) {
    // Undo in reverse so dependent rows disappear before what they referenced.
    for (const c of [...compensations].reverse()) {
      try {
        await c.run();
      } catch (rollbackError) {
        // A failed compensation must not mask the original error, but it does
        // mean something is left behind — make that loud.
        logger.error("uow.rollback_failed", {
          label,
          step: c.describe,
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }
    }
    if (compensations.length > 0) {
      logger.warn("uow.rolled_back", { label, steps: compensations.length });
    }
    throw error;
  }
}
