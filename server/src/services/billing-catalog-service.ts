/**
 * What the billing counter can charge, from Setup: the service catalogue, priced from the rate plan that suits the patient, taxed
 * from each service's GST mapping, plus the payment modes and the hospital's billing switches. Billing never invents a price —
 * it asks here.
 */
import { doctorsRepo, ipdRepo, patientsRepo, wardsRepo } from "@/repositories";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { groupChain, patientContracts } from "@/services/coverage-service";
import { effectivePrice, getConfig, listSetup } from "@/services/setup-service";
import { localDate } from "@/lib/clock";
import type { BillingCatalogDTO, BillingServiceDTO } from "@shared/types/api";
import type { SetupRecordDTO } from "@shared/types/setup";

/**
 * The plan for a patient: the one made for their patient category, else the default plan, else any plan in force today. When
 * the patient is in a ward, a plan made for that ward's class is preferred among those that fit.
 */
export function pickPlan(plans: SetupRecordDTO[], categoryId: number | null, today: string, wardClassId: number | null = null): SetupRecordDTO | null {
  const inForce = plans.filter((p) => p.active && (!p.data.effectiveFrom || String(p.data.effectiveFrom) <= today) && (!p.data.effectiveTo || String(p.data.effectiveTo) >= today));
  const forWard = (list: SetupRecordDTO[]) => (wardClassId !== null ? list.find((p) => Number(p.data.wardClassId) === wardClassId) : undefined) ?? list[0];
  const forCategory = categoryId !== null ? inForce.filter((p) => Number(p.data.patientCategoryId) === categoryId) : [];
  if (forCategory.length) return forWard(forCategory);
  const defaults = inForce.filter((p) => p.data.isDefault === true);
  return defaults.length ? forWard(defaults) : inForce[0] ?? null;
}

/** A service's GST rate today: its mapped rate when GST applies from a date that has arrived, else exempt. */
export function taxFor(service: SetupRecordDTO, today: string): { applies: boolean; rate: number } {
  const applies = service.data.gstApplies === true && (!service.data.taxFrom || String(service.data.taxFrom) <= today);
  return { applies, rate: applies ? Number(service.data.gstRate ?? 0) : 0 };
}

/** A plan a contract names, if it is in force today. */
function contractPlan(plans: SetupRecordDTO[], planId: number | null, today: string): SetupRecordDTO | null {
  const p = planId === null ? undefined : plans.find((x) => x.id === planId);
  return p && p.active && (!p.data.effectiveFrom || String(p.data.effectiveFrom) <= today) && (!p.data.effectiveTo || String(p.data.effectiveTo) >= today) ? p : null;
}

/** `contractPlanId` is the rate plan of the contract the bill is under: when it names one, its prices win over the category's. */
export async function loadPatientPlan(patientId: number | null, actor: Session, contractPlanId: number | null = null) {
  const today = localDate();
  const [plans, categories, services, groups] = await Promise.all([listSetup("rate_plan", actor), listSetup("patient_category", actor), listSetup("service", actor, { activeOnly: true }), listSetup("service_group", actor)]);
  let categoryId: number | null = null;
  let wardClassId: number | null = null;
  if (patientId !== null) {
    const patient = await patientsRepo.getRow(patientId);
    assertOwnedByHospital(patient, actor, "Patient");
    const name = (patient?.patient_category ?? "").toLowerCase();
    categoryId = name ? categories.find((c) => c.name.toLowerCase() === name)?.id ?? null : null;
    // A patient on a ward is priced for that ward's class when the hospital has a plan for it.
    const stay = await ipdRepo.findRow([{ column: "patient_id", op: "eq", value: patientId }, { column: "status", op: "neq", value: "Discharged" }]);
    const ward = stay?.ward_id ? await wardsRepo.getRow(stay.ward_id) : null;
    wardClassId = ward?.ward_class_id ?? null;
  }
  return { plan: contractPlan(plans, contractPlanId, today) ?? pickPlan(plans, categoryId, today, wardClassId), plans, services, groups, today };
}

export async function billingCatalog(patientId: number | null, actor: Session, contractId: number | null = null): Promise<BillingCatalogDTO> {
  const contracts = await patientContracts(patientId, actor);
  const chosen = contractId !== null ? contracts.find((c) => c.id === contractId) ?? null : null;
  const [{ plan, plans, services, groups, today }, modes, hospital, doctors] = await Promise.all([
    loadPatientPlan(patientId, actor, chosen?.ratePlanId ?? null), listSetup("payment_mode", actor, { activeOnly: true }), getConfig("hospital", actor),
    doctorsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const out: BillingServiceDTO[] = services.map((s) => {
    const tax = taxFor(s, today);
    const chain = groupChain(s.data.groupId, groups);
    return {
      id: s.id, code: s.code, name: s.name, group: chain.names[0] ?? "", unit: String(s.data.unit ?? ""),
      price: plan ? effectivePrice(plan, plans, s, "general") : Number(s.data.price ?? 0), gstApplies: tax.applies, gstRate: tax.rate, hsnSac: String(s.data.hsnSac ?? ""),
      groupIds: chain.ids, groupNames: chain.names,
    };
  });
  return {
    planId: plan?.id ?? null, planName: plan?.name ?? "", services: out, paymentModes: modes.map((m) => m.name),
    settings: { gstOnBills: hospital.gstOnBills !== false, pricesInclusive: hospital.pricesInclusive === true, roundOff: hospital.roundOff !== false, invoicePrefix: String(hospital.invoicePrefix ?? "") },
    contracts: contracts.map((c) => ({ id: c.id, name: c.name, sponsor: c.sponsor, sponsorType: c.sponsorType, validFrom: c.validFrom, validTo: c.validTo, ratePlan: plans.find((p) => p.id === c.ratePlanId)?.name ?? "", terms: c.terms, past: c.past })),
    contractId: chosen?.id ?? null,
    doctors: doctors.rows.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
