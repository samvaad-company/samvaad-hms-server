/**
 * One-time normalization of stored dates to ISO "yyyy-mm-dd".
 *
 * Dates were originally persisted as display strings ("8 Nov 2025"), which sort
 * alphabetically rather than chronologically and compare inexactly — the cause
 * of date filters showing past/future rows incorrectly. This walks the date
 * columns once and rewrites any legacy value in place. It is idempotent: rows
 * already in ISO form are skipped, so it is safe to run on every boot.
 */
import { type DatabaseAdapter, type Row } from "@/db/adapter";
import { TABLES } from "@/db/tables";
import { isoDate } from "@/services/helpers";
import { logger } from "@/lib/logger";

/** Date-bearing columns per table. Month-year fields (expiry) are excluded. */
const DATE_COLUMNS: Record<string, string[]> = {
  [TABLES.patients]: ["visit_date", "dob"],
  [TABLES.appointments]: ["appointment_date"],
  [TABLES.prescriptions]: ["prescribed_date"],
  [TABLES.labTests]: ["test_date"],
  [TABLES.bills]: ["bill_date"],
  [TABLES.ipdAdmissions]: ["admission_date"],
  [TABLES.otSchedules]: ["scheduled_date"],
  [TABLES.staff]: ["join_date"],
  [TABLES.radiologyTests]: ["test_date"],
  [TABLES.bloodDonors]: ["last_donation_date"],
  [TABLES.bloodIssues]: ["issue_date"],
  [TABLES.ambulanceCalls]: ["call_date"],
  [TABLES.birthRecords]: ["birth_date"],
  [TABLES.deathRecords]: ["death_date"],
  [TABLES.tpaClaims]: ["claim_date"],
  [TABLES.financeIncomes]: ["entry_date"],
  [TABLES.financeExpenses]: ["entry_date"],
  [TABLES.inventoryIssues]: ["issue_date"],
  [TABLES.tasks]: ["due_date"],
  [TABLES.purchaseOrders]: ["order_date", "expected_date"],
  [TABLES.pharmacySales]: ["sale_date"],
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function normalizeTable(adapter: DatabaseAdapter, table: string, columns: string[]): Promise<number> {
  let rows: Row[] = [];
  try {
    ({ rows } = await adapter.list<Row>(table, { unpaged: true }));
  } catch {
    return 0; // table may not exist on this backend yet
  }

  const updates = rows.flatMap((row) => {
    const patch: Record<string, unknown> = {};
    for (const col of columns) {
      const value = row[col];
      if (typeof value !== "string" || value === "" || ISO.test(value)) continue;
      const iso = isoDate(value);
      // Leave anything unparseable (e.g. "Mar 2027") exactly as it is.
      if (iso) patch[col] = iso;
    }
    return Object.keys(patch).length > 0 ? [adapter.update(table, row.id, patch)] : [];
  });

  await Promise.all(updates);
  return updates.length;
}

export async function normalizeStoredDates(adapter: DatabaseAdapter): Promise<void> {
  const counts = await Promise.all(
    Object.entries(DATE_COLUMNS).map(([table, columns]) => normalizeTable(adapter, table, columns)),
  );
  const converted = counts.reduce((sum, n) => sum + n, 0);

  if (converted > 0) logger.info("dates.normalized", { rows: converted });
}
