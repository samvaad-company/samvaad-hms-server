/**
 * Dashboard service — cross-module summary counts for the landing overview.
 */
import {
  patientsRepo,
  appointmentsRepo,
  opdRepo,
  ipdRepo,
  bedsRepo,
  billsRepo,
  pharmacyRepo,
  labRepo,
} from "@/server/repositories";
import { type DashboardStatsDTO } from "@/types/api";
import { type Session } from "@/server/auth/session";
import { scopeToHospital } from "@/server/services/hospital-scope";

export async function getDashboardStats(actor: Session): Promise<DashboardStatsDTO> {
  const scoped = (filters: { column: string; op: "eq" | "neq"; value: unknown }[]) =>
    scopeToHospital({ filters }, actor);
  const [
    patients,
    apptToday,
    opdWaiting,
    ipdAdmitted,
    bedsAvail,
    pendingBills,
    bills,
    lowStock,
    outStock,
    pendingLabs,
  ] = await Promise.all([
    patientsRepo.count(scopeToHospital({}, actor)),
    appointmentsRepo.count(scoped([{ column: "status", op: "eq", value: "Today" }])),
    opdRepo.count(scoped([{ column: "status", op: "eq", value: "Waiting" }])),
    ipdRepo.count(scoped([{ column: "status", op: "neq", value: "Discharged" }])),
    bedsRepo.count(scoped([{ column: "status", op: "eq", value: "Available" }])),
    billsRepo.count(scoped([{ column: "status", op: "eq", value: "Pending" }])),
    billsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    pharmacyRepo.count(scoped([{ column: "status", op: "eq", value: "Low Stock" }])),
    pharmacyRepo.count(scoped([{ column: "status", op: "eq", value: "Out of Stock" }])),
    labRepo.count(scoped([{ column: "status", op: "eq", value: "Pending" }])),
  ]);

  const revenue = bills.rows
    .filter((b) => b.status === "Paid" || b.status === "Partial")
    .reduce((s, b) => s + Number(b.total), 0);

  return {
    patients,
    appointmentsToday: apptToday,
    opdWaiting,
    ipdAdmitted,
    bedsAvailable: bedsAvail,
    pendingBills,
    lowStock: lowStock + outStock,
    pendingLabs,
    revenue: Math.round(revenue),
  };
}
