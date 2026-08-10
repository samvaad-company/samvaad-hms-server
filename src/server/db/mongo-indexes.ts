/**
 * MongoDB index setup.
 *
 * Replaces what `supabase/migrations/*.sql` does with `create index` for
 * Postgres. Every collection gets a unique index on the application-level `id`,
 * plus indexes on the columns the API filters, sorts, or joins on (the
 * `filterable` / `searchColumns` fields declared by each service's list config).
 *
 * Safe to run repeatedly — `createIndex` is idempotent.
 */
import { type Db } from "mongodb";
import { TABLES } from "@/server/db/tables";
import { logger } from "@/server/lib/logger";

/** Secondary indexes per collection, beyond the unique `id` index. */
const SECONDARY: Record<string, string[]> = {
  [TABLES.users]: ["email", "role", "status", "doctor_id"],
  [TABLES.doctors]: ["status", "department_id", "name"],
  [TABLES.staff]: ["status", "department_id", "role"],
  [TABLES.patients]: ["status", "patient_code", "doctor_id", "phone", "abha_id"],
  [TABLES.appointments]: ["status", "type", "doctor_id", "patient_id", "appointment_date"],
  [TABLES.opdVisits]: ["status", "doctor_id", "patient_id", "token_number", "priority", "appointment_id"],
  [TABLES.prescriptions]: ["status", "doctor_id", "patient_id", "rx_number"],
  [TABLES.prescriptionItems]: ["prescription_id"],
  [TABLES.pharmacyItems]: ["status", "category", "name"],
  [TABLES.labTests]: ["status", "patient_id", "report_status", "order_number", "priority"],
  [TABLES.bills]: ["status", "type", "patient_id", "bill_number"],
  [TABLES.beds]: ["status", "ward_id", "ward"],
  [TABLES.ipdAdmissions]: ["status", "patient_id", "doctor_id", "bed_id"],
  [TABLES.otSchedules]: ["status", "patient_id", "surgeon_id"],
  [TABLES.auditLogs]: ["actor_id", "entity", "created_at"],
  [TABLES.bloodDonors]: ["blood_group", "status"],
  [TABLES.bloodStock]: ["blood_group", "component"],
  [TABLES.bloodIssues]: ["status", "patient_id"],
  [TABLES.radiologyTests]: ["status", "patient_id"],
  [TABLES.ambulances]: ["status"],
  [TABLES.ambulanceCalls]: ["status", "ambulance_id"],
  [TABLES.birthRecords]: ["gender"],
  [TABLES.deathRecords]: ["gender"],
  [TABLES.tpas]: ["status", "code"],
  [TABLES.tpaClaims]: ["status", "tpa_id", "patient_id"],
  [TABLES.financeIncomes]: ["category", "entry_date"],
  [TABLES.financeExpenses]: ["category", "entry_date"],
  [TABLES.inventoryItems]: ["status", "category"],
  [TABLES.inventoryIssues]: ["item_id", "department"],
  [TABLES.purchaseOrders]: ["status", "supplier"],
  [TABLES.purchaseOrderItems]: ["purchase_order_id"],
  [TABLES.pharmacySales]: ["patient_id", "payment_mode"],
  [TABLES.pharmacySaleItems]: ["sale_id"],
  [TABLES.documents]: ["owner_type", "owner_id", "category"],
  [TABLES.tasks]: ["status", "priority", "assignee_id"],
  [TABLES.scribeNotes]: ["appointment_id", "patient_id", "doctor_id", "status"],
};

export async function ensureIndexes(db: Db): Promise<void> {
  const collections = Object.values(TABLES);
  let created = 0;

  for (const name of collections) {
    const col = db.collection(name);
    // The application treats `id` as the primary key, so it must be unique.
    await col.createIndex({ id: 1 }, { unique: true, name: "uniq_id" });
    created += 1;

    for (const field of SECONDARY[name] ?? []) {
      await col.createIndex({ [field]: 1 }, { name: `idx_${field}` });
      created += 1;
    }
  }

  logger.info("mongo.indexes_ready", { collections: collections.length, indexes: created });
}
