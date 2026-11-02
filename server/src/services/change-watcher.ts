/**
 * Keeps the dashboard/analytics cache honest by listening to the database itself: any write — from this process, another API
 * process, a script or a person in the Atlas console — drops the cached summaries of the hospital it belongs to. Without this,
 * only changes recorded through `audit()` do, and a summary can be up to 30 seconds behind a change that wasn't audited.
 *
 * Needs a driver that can report changes (MongoDB on a replica set — Atlas always is; a standalone mongod can't). If it can't,
 * this quietly does nothing and the audit-based invalidation stays in charge. A dropped connection is reopened from where it
 * stopped; if that isn't possible every cached summary is dropped once.
 */
import { getDb } from "@/db";
import { logger } from "@/lib/logger";
import { touchHospital, touchEverything } from "@/lib/summary-cache";
import { publishAppointmentCreatedFromFeed } from "@/services/live-events";
import { TABLES, type AppointmentRow } from "@/db/tables";

let stop: (() => void) | null = null;

export async function startChangeWatcher(): Promise<boolean> {
  if (stop || process.env.DB_CHANGE_WATCH === "off") return false;
  const db = await getDb();
  if (!db.watchChanges) return false;
  const off = await db.watchChanges((change) => {
    if (change.hospitalId == null) touchEverything();
    else touchHospital(change.hospitalId);
    // An appointment made by another API process (or any tool): open dashboards in this process hear about it too. One made
    // here was already published by the code that saved it, and the bus drops the repeat.
    if (change.table === TABLES.appointments && change.operation === "insert" && change.document) {
      publishAppointmentCreatedFromFeed(change.document as unknown as AppointmentRow);
    }
  });
  if (!off) return false;
  stop = off;
  logger.info("db.change_watcher_started", { driver: db.driver });
  return true;
}

export function stopChangeWatcher(): void {
  stop?.();
  stop = null;
}
