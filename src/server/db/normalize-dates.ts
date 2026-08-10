/**
 * One-time normalization of stored dates to ISO "yyyy-mm-dd".
 *
 * Dates were originally persisted as display strings ("8 Nov 2025"), which sort
 * alphabetically rather than chronologically and compare inexactly — the cause
 * of date filters showing past/future rows incorrectly. This walks the date
 * columns once and rewrites any legacy value in place. It is idempotent: rows
 * already in ISO form are skipped, so it is safe to run on every boot.
 */
import { type DatabaseAdapter, type Row } from "@/server/db/adapter";
import { TABLES } from "@/server/db/tables";
import { isoDate } from "@/server/services/helpers";
import { logger } from "@/server/lib/logger";

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

export async function normalizeStoredDates(adapter: DatabaseAdapter): Promise<void> {
  let converted = 0;

  for (const [table, columns] of Object.entries(DATE_COLUMNS)) {
    let rows: Row[] = [];
    try {
      ({ rows } = await adapter.list<Row>(table, { unpaged: true }));
    } catch {
      continue; // table may not exist on this backend yet
    }

    for (const row of rows) {
      const patch: Record<string, unknown> = {};
      for (const col of columns) {
        const value = row[col];
        if (typeof value !== "string" || value === "" || ISO.test(value)) continue;
        const iso = isoDate(value);
        // Leave anything unparseable (e.g. "Mar 2027") exactly as it is.
        if (iso) patch[col] = iso;
      }
      if (Object.keys(patch).length > 0) {
        await adapter.update(table, row.id, patch);
        converted += 1;
      }
    }
  }

  if (converted > 0) logger.info("dates.normalized", { rows: converted });
}
