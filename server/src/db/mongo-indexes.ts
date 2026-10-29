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
import { type Db, type Document } from "mongodb";
import { TABLES } from "@/db/tables";
import { COUNTERS } from "@/db/mongo-adapter";
import { logger } from "@/lib/logger";

/** Secondary indexes per collection, beyond the unique `id` index. */
const SECONDARY: Record<string, string[]> = {
  [TABLES.users]: ["hospital_id", "radiology_center_id", "lab_center_id", "email", "role", "status", "doctor_id"],
  [TABLES.radiologyCenters]: ["status", "code"],
  [TABLES.hospitalRadiologyLinks]: ["hospital_id", "radiology_center_id", "status"],
  [TABLES.labCenters]: ["status", "code"],
  [TABLES.hospitalLabLinks]: ["hospital_id", "lab_center_id", "status"],
  [TABLES.departments]: ["hospital_id"],
  [TABLES.doctors]: ["hospital_id", "status", "department_id", "name"],
  [TABLES.staff]: ["hospital_id", "status", "department_id", "role"],
  [TABLES.patients]: ["hospital_id", "status", "patient_code", "doctor_id", "phone", "abha_id"],
  [TABLES.appointments]: ["hospital_id", "status", "type", "doctor_id", "patient_id", "appointment_date"],
  [TABLES.opdVisits]: ["hospital_id", "status", "doctor_id", "patient_id", "token_number", "priority", "appointment_id"],
  [TABLES.medicines]: ["hospital_id"],
  [TABLES.prescriptions]: ["hospital_id", "status", "doctor_id", "patient_id", "rx_number"],
  [TABLES.prescriptionItems]: ["prescription_id"],
  [TABLES.pharmacyItems]: ["hospital_id", "status", "category", "name"],
  [TABLES.labTests]: ["hospital_id", "status", "patient_id", "report_status", "order_number", "priority", "doctor_id", "lab_center_id"],
  [TABLES.bills]: ["hospital_id", "status", "type", "patient_id", "bill_number"],
  [TABLES.platformBills]: ["hospital_id", "status", "bill_number"],
  [TABLES.wards]: ["hospital_id"],
  [TABLES.beds]: ["hospital_id", "status", "ward_id", "ward"],
  [TABLES.ipdAdmissions]: ["hospital_id", "status", "patient_id", "doctor_id", "bed_id"],
  [TABLES.otSchedules]: ["hospital_id", "status", "patient_id", "surgeon_id", "scheduled_date", "room_id"],
  [TABLES.otRooms]: ["hospital_id", "active"],
  [TABLES.otEquipment]: ["hospital_id", "status"],
  [TABLES.auditLogs]: ["hospital_id", "actor_id", "entity", "created_at"],
  [TABLES.bloodDonors]: ["hospital_id", "blood_group", "status"],
  [TABLES.bloodUnits]: ["hospital_id", "status", "blood_group", "component", "expiry_on", "root_unit_id", "unit_no"],
  [TABLES.bloodCrossmatches]: ["hospital_id", "status", "unit_id", "patient_id"],
  [TABLES.mrdLocations]: ["hospital_id", "kind"],
  [TABLES.mrdFiles]: ["hospital_id", "patient_id", "status", "location_id", "file_no", "due_on"],
  [TABLES.mrdFileRequests]: ["hospital_id", "file_id", "status"],
  [TABLES.mrdFileMovements]: ["hospital_id", "file_id"],
  [TABLES.mrdRetentionPolicies]: ["hospital_id", "class"],
  [TABLES.mrdFolders]: ["hospital_id"],
  [TABLES.mrdCodingCases]: ["hospital_id", "admission_id", "status", "patient_id"],
  [TABLES.mrdDeficiencies]: ["hospital_id", "case_id", "status"],
  [TABLES.mrdRegisterEntries]: ["hospital_id", "register", "entry_no"],
  [TABLES.billItems]: ["hospital_id", "bill_id"],
  [TABLES.billPayouts]: ["hospital_id", "bill_id", "status", "payee_name"],
  [TABLES.pharmacyBatches]: ["hospital_id", "item_id"],
  [TABLES.pharmacyDispenses]: ["hospital_id", "patient_id", "dispense_no"],
  [TABLES.pharmacyDispenseLines]: ["dispense_id", "item_id", "batch_id"],
  [TABLES.pharmacyReturns]: ["hospital_id", "dispense_id"],
  [TABLES.setupRecords]: ["hospital_id", "kind", "code"],
  [TABLES.hrLeaveTypes]: ["hospital_id", "code"],
  [TABLES.hrLeaveRequests]: ["hospital_id", "staff_id", "status", "from_date"],
  [TABLES.hrShifts]: ["hospital_id"],
  [TABLES.hrRoster]: ["hospital_id", "staff_id", "work_date"],
  [TABLES.hrSalaries]: ["hospital_id", "staff_id"],
  [TABLES.hrPayrollRuns]: ["hospital_id", "month"],
  [TABLES.hrPayslips]: ["hospital_id", "run_id", "staff_id"],
  [TABLES.cssdSterilizers]: ["hospital_id"],
  [TABLES.cssdSets]: ["hospital_id", "status", "set_no", "department_id"],
  [TABLES.cssdCycles]: ["hospital_id", "status", "sterilizer_id"],
  [TABLES.cssdIssues]: ["hospital_id", "set_id", "status", "patient_id"],
  [TABLES.cssdSettings]: ["hospital_id"],
  [TABLES.consentTemplates]: ["hospital_id", "key"],
  [TABLES.signatureRequests]: ["hospital_id", "token", "status", "patient_id"],
  [TABLES.bloodTransfusions]: ["hospital_id", "unit_id", "patient_id", "crossmatch_id"],
  [TABLES.radiologyTests]: ["hospital_id", "status", "patient_id", "order_number"],
  [TABLES.ambulances]: ["hospital_id", "status"],
  [TABLES.ambulanceCalls]: ["hospital_id", "status", "ambulance_id"],
  [TABLES.birthRecords]: ["hospital_id", "gender"],
  [TABLES.deathRecords]: ["hospital_id", "gender"],
  [TABLES.tpas]: ["hospital_id", "status", "code"],
  [TABLES.tpaClaims]: ["hospital_id", "status", "tpa_id", "patient_id"],
  [TABLES.ipdVitals]: ["hospital_id", "admission_id", "recorded_at"],
  [TABLES.ipdIvLines]: ["hospital_id", "admission_id", "status"],
  [TABLES.ipdDoseLog]: ["hospital_id", "admission_id", "medication_id", "scheduled_at"],
  [TABLES.ipdNursingTasks]: ["hospital_id", "admission_id", "status", "due_at"],
  [TABLES.ipdHandovers]: ["hospital_id", "admission_id", "shift_date"],
  [TABLES.ipdAlertAcks]: ["hospital_id", "alert_key"],
  [TABLES.ipdChecklistTemplates]: ["hospital_id", "scope", "active"],
  [TABLES.ipdChecklists]: ["hospital_id", "status", "admission_id", "patient_id", "template_id"],
  [TABLES.followups]: ["hospital_id", "status", "due_on", "doctor_id", "patient_id"],
  [TABLES.enquiries]: ["hospital_id", "status", "follow_up_on", "mobile"],
  [TABLES.financeIncomes]: ["hospital_id", "category", "entry_date"],
  [TABLES.financeExpenses]: ["hospital_id", "category", "entry_date"],
  [TABLES.inventoryItems]: ["hospital_id", "status", "category"],
  [TABLES.inventoryIssues]: ["hospital_id", "item_id", "department"],
  [TABLES.purchaseOrders]: ["hospital_id", "status", "supplier"],
  [TABLES.purchaseOrderItems]: ["purchase_order_id"],
  [TABLES.pharmacySales]: ["hospital_id", "patient_id", "payment_mode"],
  [TABLES.pharmacySaleItems]: ["sale_id"],
  [TABLES.bedTransfers]: ["hospital_id"],
  [TABLES.staffAttendance]: ["hospital_id", "staff_id", "work_date"],
  [TABLES.ipdNotes]: ["admission_id", "note_type"],
  [TABLES.ipdMedications]: ["admission_id", "status"],
  [TABLES.documents]: ["hospital_id", "owner_type", "owner_id", "category"],
  [TABLES.tasks]: ["hospital_id", "status", "priority", "assignee_id"],
  [TABLES.chatThreads]: ["user_id", "updated_at"],
  [TABLES.chatMessages]: ["thread_id", "created_at", "patient_id"],
  [TABLES.scribeNotes]: ["hospital_id", "appointment_id", "patient_id", "doctor_id", "status"],
  [TABLES.prescriptionTemplates]: ["hospital_id", "doctor_id"],
  [TABLES.teleconsultBookings]: ["hospital_id", "patient_id", "doctor_id", "status", "gateway_order_id", "appointment_date"],
  [TABLES.googleConnections]: ["hospital_id"],
  [TABLES.teleconsultPayments]: ["hospital_id", "booking_id", "appointment_id", "patient_id", "order_id", "status"],
};

/**
 * Uniqueness the application relies on to stay correct under concurrent
 * requests (a webhook and the patient's own confirmation arriving together):
 * one appointment per booking, one ledger row per gateway payment. Partial, so
 * rows without the field (ordinary appointments, staff payments) don't collide.
 */
const UNIQUE_PARTIAL: { table: string; field: string; type: "number" | "string" }[] = [
  { table: TABLES.appointments, field: "booking_id", type: "number" },
  { table: TABLES.teleconsultPayments, field: "payment_id", type: "string" },
];

export async function ensureIndexes(db: Db): Promise<void> {
  const collections = Object.values(TABLES);

  const jobs = collections.flatMap((name) => {
    const col = db.collection(name);
    return [
      // The application treats `id` as the primary key, so it must be unique.
      col.createIndex({ id: 1 }, { unique: true, name: "uniq_id" }),
      ...(SECONDARY[name] ?? []).map((field) => col.createIndex({ [field]: 1 }, { name: `idx_${field}` })),
    ];
  });

  await Promise.all(jobs);

  for (const u of UNIQUE_PARTIAL) {
    try {
      await db.collection(u.table).createIndex(
        { [u.field]: 1 },
        { unique: true, name: `uniq_${u.field}`, partialFilterExpression: { [u.field]: { $type: u.type } } },
      );
    } catch (err) {
      // Existing duplicates would block the index; the service layer still de-duplicates, so don't stop the app.
      logger.error("mongo.unique_index_failed", { table: u.table, field: u.field, error: err instanceof Error ? err.message : String(err) });
    }
  }
  logger.info("mongo.indexes_ready", { collections: collections.length, indexes: jobs.length + UNIQUE_PARTIAL.length });
}

/**
 * Catch the `counters` collection up to the real max `id` already stored in
 * each collection. Needed because rows inserted outside `MongoAdapter.insert`
 * — e.g. a one-off script, or a collection seeded before the counter-bump
 * logic existed — never advance the counter, so the next API-driven insert
 * for that table collides with an existing id (`E11000 duplicate key`).
 * Idempotent and safe to re-run: only ever raises a counter, never lowers one.
 */
export async function reconcileCounters(db: Db): Promise<void> {
  const collections = Object.values(TABLES);
  const counters = db.collection(COUNTERS);

  const jobs = collections.map(async (name) => {
    const [top] = await db.collection(name).find().sort({ id: -1 }).limit(1).toArray();
    const maxId = typeof top?.id === "number" ? top.id : 0;
    if (maxId <= 0) return;

    await counters.updateOne(
      { _id: name as unknown as Document["_id"], seq: { $lt: maxId } },
      { $set: { seq: maxId } },
      { upsert: false },
    );
    await counters.updateOne(
      { _id: name as unknown as Document["_id"] },
      { $setOnInsert: { seq: maxId } },
      { upsert: true },
    );
  });

  await Promise.all(jobs);
  logger.info("mongo.counters_reconciled", { collections: collections.length });
}
