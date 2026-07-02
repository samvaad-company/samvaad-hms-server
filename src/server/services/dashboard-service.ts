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

export async function getDashboardStats(): Promise<DashboardStatsDTO> {
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
    patientsRepo.count(),
    appointmentsRepo.count({ filters: [{ column: "status", op: "eq", value: "Today" }] }),
    opdRepo.count({ filters: [{ column: "status", op: "eq", value: "Waiting" }] }),
    ipdRepo.count({ filters: [{ column: "status", op: "neq", value: "Discharged" }] }),
    bedsRepo.count({ filters: [{ column: "status", op: "eq", value: "Available" }] }),
    billsRepo.count({ filters: [{ column: "status", op: "eq", value: "Pending" }] }),
    billsRepo.listRows({ unpaged: true }),
    pharmacyRepo.count({ filters: [{ column: "status", op: "eq", value: "Low Stock" }] }),
    pharmacyRepo.count({ filters: [{ column: "status", op: "eq", value: "Out of Stock" }] }),
    labRepo.count({ filters: [{ column: "status", op: "eq", value: "Pending" }] }),
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
