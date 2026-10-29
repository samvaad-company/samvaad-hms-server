/**
 * Insurance on the billing counter: which sponsor contracts a patient is covered under today, and the split of one invoice between
 * the payer and the patient under a contract's rules (the rules themselves are `@shared/types/coverage`).
 */
import { billItemsRepo, billsRepo, patientsRepo } from "@/repositories";
import { type BillItemRow, type BillRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { listSetup } from "@/services/setup-service";
import { localDate } from "@/lib/clock";
import { readTerms, splitCoverage, type CoverageLine, type CoveragePast, type CoverageResult, type CoverageTerms } from "@shared/types/coverage";
import type { Payer } from "@/services/patient-profile";
import type { SetupRecordDTO } from "@shared/types/setup";

export interface PatientContract {
  id: number;
  name: string;
  sponsor: string;
  sponsorType: string;
  validFrom: string | null;
  validTo: string | null;
  ratePlanId: number | null;
  terms: CoverageTerms;
  past: CoveragePast;
}

/** A service group's id and its parents', nearest first, with their names. */
export function groupChain(groupId: unknown, groups: SetupRecordDTO[]): { ids: number[]; names: string[] } {
  const ids: number[] = [];
  const names: string[] = [];
  let id = groupId === null || groupId === undefined || groupId === "" ? null : Number(groupId);
  while (id !== null && !ids.includes(id) && ids.length < 5) {
    const g = groups.find((x) => x.id === id);
    if (!g) break;
    ids.push(g.id);
    names.push(g.name);
    id = g.data.parentId == null ? null : Number(g.data.parentId);
  }
  return { ids, names };
}

/** The invoice lines as the coverage rules see them. */
export function coverageLines(lines: { serviceId: number | null; name: string; code: string; quantity: number }[], totals: number[], services: SetupRecordDTO[], groups: SetupRecordDTO[]): CoverageLine[] {
  return lines.map((l, i) => {
    const svc = l.serviceId !== null ? services.find((s) => s.id === l.serviceId) : undefined;
    const chain = groupChain(svc?.data.groupId, groups);
    return { name: l.name, code: l.code, groupIds: chain.ids, groupNames: chain.names, quantity: l.quantity, total: totals[i] };
  });
}

const yearAgo = (today: string) => { const d = new Date(`${today}T12:00:00`); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); };

/** What the contract already paid this patient: for the annual limit, and the limits that count earlier charges. */
async function pastUnder(contractId: number, patientId: number, from: string | null, today: string, services: SetupRecordDTO[], groups: SetupRecordDTO[], actor: Session): Promise<CoveragePast> {
  const { rows } = await billsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] }, actor));
  const bills = (rows as BillRow[]).filter((b) => b.contract_id === contractId && b.status !== "Refunded" && Number(b.payer_share ?? 0) > 0);
  const earliest = [yearAgo(today), from ?? ""].filter(Boolean).sort()[0] ?? yearAgo(today);
  const annualPaid = bills.filter((b) => b.bill_date >= yearAgo(today)).reduce((n, b) => n + Number(b.payer_share ?? 0), 0);
  const items: CoveragePast["items"] = [];
  for (const b of bills.filter((x) => x.bill_date >= earliest)) {
    const { rows: its } = await billItemsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: b.id }] }, actor));
    for (const it of its as BillItemRow[]) {
      const svc = it.service_id !== null ? services.find((s) => s.id === it.service_id) : undefined;
      items.push({ name: it.name, code: it.code, groupNames: groupChain(svc?.data.groupId, groups).names, quantity: it.quantity, payer: Number(it.payer_amount ?? 0), date: b.bill_date });
    }
  }
  return { annualPaid, items };
}

/** The contracts a patient can be billed under today: their payers' contracts that are active and in force, and cover not lapsed. */
export async function patientContracts(patientId: number | null, actor: Session): Promise<PatientContract[]> {
  if (patientId === null) return [];
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const payers = ((patient as { payers?: Payer[] } | null)?.payers ?? []).filter((p) => p.contractId);
  if (!payers.length) return [];
  const today = localDate();
  const [contracts, sponsors, services, groups] = await Promise.all([listSetup("contract", actor), listSetup("sponsor", actor), listSetup("service", actor), listSetup("service_group", actor)]);
  const out: PatientContract[] = [];
  for (const p of payers) {
    const c = contracts.find((x) => x.id === p.contractId);
    if (!c || !c.active || out.some((o) => o.id === c.id)) continue;
    if (c.data.validFrom && String(c.data.validFrom) > today) continue;
    if (c.data.validTo && String(c.data.validTo) < today) continue;
    if (p.validUntil && p.validUntil < today) continue;
    const sponsor = sponsors.find((s) => s.id === Number(c.data.sponsorId));
    out.push({
      id: c.id, name: c.name, sponsor: sponsor?.name ?? "", sponsorType: String(sponsor?.data.type ?? ""),
      validFrom: c.data.validFrom ? String(c.data.validFrom) : null, validTo: c.data.validTo ? String(c.data.validTo) : null,
      ratePlanId: c.data.ratePlanId == null ? null : Number(c.data.ratePlanId), terms: readTerms(c.data),
      past: await pastUnder(c.id, patientId, c.data.validFrom ? String(c.data.validFrom) : null, today, services, groups, actor),
    });
  }
  return out;
}

export function splitUnder(contract: PatientContract, lines: CoverageLine[]): CoverageResult {
  return splitCoverage(contract.terms, lines, contract.past, { today: localDate(), contractFrom: contract.validFrom });
}
