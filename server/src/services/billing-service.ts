/**
 * Billing service — invoices with server-computed GST and totals.
 */
import { billsRepo, billItemsRepo, billPayoutsRepo, doctorsRepo, patientsRepo } from "@/repositories";
import { toBillDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES, type BillItemRow, type BillRow } from "@/db/tables";
import { ConflictError, ValidationError, type FieldError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { canonicalMaster, effectivePrice, getConfig, listSetup } from "@/services/setup-service";
import { loadPatientPlan, taxFor } from "@/services/billing-catalog-service";
import type { BillItemDTO } from "@shared/types/api";
import { priceLines as computeLines, r2 } from "@shared/types/billing";
import { computeBillTotals, displayDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { nextNumber } from "@/services/id-service";
import { coverageLines, patientContracts, splitUnder, type PatientContract } from "@/services/coverage-service";
import { computePayouts, payoutRules, voidPayoutsFor, type PayoutLine } from "@/services/payouts-service";
import type { BillPayoutRow } from "@/db/tables";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  type: { type: "enum", required: false, values: ["OPD", "Pharmacy", "Lab", "IPD", "Blood", "Ambulance", "Radiology"], default: "OPD" },
  amount: { type: "number", required: true, min: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Paid", "Pending", "Partial", "Refunded"], default: "Pending" },
  paymentMode: { type: "string", required: false, max: 80 },
} as const;

const itemsSchema = { ...createSchema, amount: { type: "number", required: false, min: 0, default: 0 } } as const;
const CUSTOM_GST = [0, 5, 12, 18, 28];
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const toItemDto = (r: BillItemRow): BillItemDTO => ({ id: r.id, serviceId: r.service_id, code: r.code, name: r.name, quantity: r.quantity, unitPrice: Number(r.unit_price), gstRate: Number(r.gst_rate), hsnSac: r.hsn_sac ?? "", amount: Number(r.amount), ...(Number(r.payer_amount ?? 0) > 0 ? { payerAmount: Number(r.payer_amount) } : {}) });

async function itemsOf(billId: number, actor: Session): Promise<BillItemRow[]> {
  const { rows } = await billItemsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: billId }] }, actor));
  return (rows as BillItemRow[]).sort((a, b) => a.id - b.id);
}

export const BILLING_LIST_CONFIG = {
  searchColumns: ["bill_number", "patient_name", "type"],
  filterable: ["status", "type", "patient_id"],
  sortable: ["bill_date", "total", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listBills(options: QueryOptions, actor: Session) {
  return billsRepo.list(scopeToHospital(options, actor));
}

export async function getBill(id: number, actor: Session) {
  const row = await billsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Bill");
  const items = await itemsOf(id, actor);
  return { ...toBillDTO(row), paymentMode: row.payment_mode ?? null, ...(items.length ? { items: items.map(toItemDto) } : {}) };
}

interface Line { serviceId: number | null; code: string; name: string; quantity: number; unitPrice: number; gstRate: number; hsnSac: string }

/**
 * Turn the submitted lines into priced, taxed ones. A line that names a service is priced from the patient's rate plan and taxed from
 * the service's GST mapping — whatever price the browser showed is ignored, so a bill can't carry a price the hospital didn't set.
 * A custom line (no service) brings its own price and GST rate.
 */
async function resolveLines(raw: unknown, patientId: number | null, actor: Session, contractPlanId: number | null = null): Promise<Line[]> {
  if (!Array.isArray(raw) || raw.length === 0) throw new ValidationError([{ field: "items", message: "add at least one charge" }]);
  if (raw.length > 100) throw new ValidationError([{ field: "items", message: "a bill can have at most 100 lines" }]);
  const { plan, plans, services, today } = await loadPatientPlan(patientId, actor, contractPlanId);
  const errors: FieldError[] = [];
  const out: Line[] = [];
  for (const [i, x] of raw.entries()) {
    const l = isRecord(x) ? x : {};
    const quantity = Number(l.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) { errors.push({ field: `items[${i}]`, message: "quantity must be a whole number" }); continue; }
    if (l.serviceId !== undefined && l.serviceId !== null && l.serviceId !== "") {
      const svc = services.find((s) => s.id === Number(l.serviceId));
      if (!svc) { errors.push({ field: `items[${i}]`, message: "that service isn't in the catalogue (or is switched off)" }); continue; }
      const tax = taxFor(svc, today);
      out.push({ serviceId: svc.id, code: svc.code, name: svc.name, quantity, unitPrice: r2(plan ? effectivePrice(plan, plans, svc, "general") : Number(svc.data.price ?? 0)), gstRate: tax.rate, hsnSac: String(svc.data.hsnSac ?? "") });
      continue;
    }
    const name = typeof l.description === "string" ? l.description.trim().slice(0, 160) : "";
    const price = Number(l.unitPrice), rate = Number(l.gstRate ?? 0);
    if (!name) { errors.push({ field: `items[${i}]`, message: "pick a service or describe the charge" }); continue; }
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) { errors.push({ field: `items[${i}]`, message: "price must be a number from 0" }); continue; }
    if (!CUSTOM_GST.includes(rate)) { errors.push({ field: `items[${i}]`, message: `GST must be one of ${CUSTOM_GST.join(", ")}%` }); continue; }
    out.push({ serviceId: null, code: "", name, quantity, unitPrice: r2(price), gstRate: rate, hsnSac: "" });
  }
  if (errors.length) throw new ValidationError(errors);
  return out;
}


export async function createBill(input: unknown, actor: Session) {
  const body = isRecord(input) ? input : {};
  const hasItems = body.items !== undefined && body.items !== null;
  // With catalogue lines the amount comes from the lines, so it isn't asked for.
  const data = (hasItems ? validate(itemsSchema, input) : validate(createSchema, input)) as ReturnType<typeof validate<typeof createSchema>>;
  let patientName = data.patientName;
  let patient: Awaited<ReturnType<typeof patientsRepo.getRow>> | null = null;
  if (data.patientId) {
    patient = await patientsRepo.getRow(data.patientId);
    assertOwnedByHospital(patient, actor, "Patient");
    if (patient) patientName = patient.name;
  }
  const cfg = await getConfig("hospital", actor);
  const switches = { gstOnBills: cfg.gstOnBills !== false, pricesInclusive: cfg.pricesInclusive === true, roundOff: cfg.roundOff !== false };
  const paymentMode = data.paymentMode ? await canonicalMaster("payment_mode", data.paymentMode, actor, "paymentMode") : "";

  // Numbers follow the "Bill / invoice no." format (Setup → ID formats); the hospital's invoice prefix fills {PREFIX} when it has one.
  const all = await billsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const billNumber = await nextNumber("invoice", actor, all.rows.map((r) => r.bill_number), { prefix: "INV-", pad: 8 });

  if (!hasItems) {
    const base = computeBillTotals(data.amount, data.discount ?? 0, data.type);
    const gst = switches.gstOnBills ? base.gst : 0;
    const total = switches.gstOnBills ? base.total : r2(Math.max(0, data.amount - (data.discount ?? 0)));
    const row = await billsRepo.create({
      hospital_id: actor.hospitalId, bill_number: billNumber, patient_id: data.patientId ?? null, patient_name: patientName, type: data.type, bill_date: displayDate(),
      amount: data.amount, discount: data.discount, gst, total, status: data.status, payment_mode: paymentMode || null,
    });
    await audit(actor, "create", "bill", row.id, { billNumber, total });
    return toBillDTO(row as BillRow);
  }

  // Under a sponsor contract (one of the patient's own, in force today) the invoice is split between the payer and the patient.
  let contract: PatientContract | null = null;
  if (body.contractId !== undefined && body.contractId !== null && body.contractId !== "") {
    const wanted = Number(body.contractId);
    contract = (await patientContracts(data.patientId ?? null, actor)).find((c) => c.id === wanted) ?? null;
    if (!contract) throw new ValidationError([{ field: "contractId", message: "that isn't a contract this patient is covered under today" }]);
  }
  let doctor: { id: number; name: string } | null = null;
  if (body.doctorId !== undefined && body.doctorId !== null && body.doctorId !== "") {
    const d = await doctorsRepo.getRow(Number(body.doctorId));
    assertOwnedByHospital(d, actor, "Doctor");
    doctor = { id: d.id, name: d.name };
  }

  const lines = await resolveLines(body.items, data.patientId ?? null, actor, contract?.ratePlanId ?? null);
  const discount = r2(data.discount ?? 0);
  if (discount > r2(lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0))) throw new ValidationError([{ field: "discount", message: "the discount can't be more than the bill" }]);
  const priced = computeLines(lines, discount, switches);
  const [services, groups] = await Promise.all([listSetup("service", actor), listSetup("service_group", actor)]);
  const split = contract ? splitUnder(contract, coverageLines(lines, priced.totals, services, groups)) : null;
  const payerShare = split ? Math.min(split.payer, priced.total) : 0;

  // Payouts the rules earn on what was billed (after the discount, before GST).
  const centres = await listSetup("collection_center", actor);
  const payoutLines: PayoutLine[] = lines.map((l, i) => {
    const svc = l.serviceId !== null ? services.find((x) => x.id === l.serviceId) : undefined;
    const c = svc?.data.collectionCenterId != null ? centres.find((x) => x.id === Number(svc.data.collectionCenterId)) : undefined;
    return { serviceId: l.serviceId, name: l.name, net: r2(priced.amounts[i] - (priced.amount > 0 ? (discount * priced.amounts[i]) / priced.amount : 0)), centre: c ? { id: c.id, name: c.name, external: c.data.external === true } : null };
  });
  let referral: { name: string; type: string; payoutValue: number | null } | null = null;
  if (patient?.referral_source) {
    const src = (await listSetup("referral_source", actor)).find((r) => r.name.toLowerCase() === String(patient.referral_source).toLowerCase());
    if (src) referral = { name: src.name, type: String(src.data.type ?? ""), payoutValue: src.data.payoutValue == null ? null : Number(src.data.payoutValue) };
  }
  const payouts = computePayouts(await payoutRules(actor), { billType: data.type, billDate: displayDate(), lines: payoutLines, doctor, referral });

  const billId = await transactional("billing.create", async (uow) => {
    const bill = await uow.insert<BillRow>(TABLES.bills, {
      hospital_id: actor.hospitalId, bill_number: billNumber, patient_id: data.patientId ?? null, patient_name: patientName, type: data.type, bill_date: displayDate(),
      amount: priced.amount, discount, gst: priced.gst, total: priced.total, status: data.status, payment_mode: paymentMode || null,
      doctor_id: doctor?.id ?? null, doctor_name: doctor?.name ?? null,
      contract_id: contract?.id ?? null, contract_name: contract?.name ?? null, payer_share: payerShare, patient_share: r2(priced.total - payerShare),
    });
    for (const [i, l] of lines.entries()) {
      await uow.insert(TABLES.billItems, { hospital_id: actor.hospitalId, bill_id: bill.id, service_id: l.serviceId, code: l.code, name: l.name, quantity: l.quantity, unit_price: l.unitPrice, gst_rate: l.gstRate, hsn_sac: l.hsnSac, amount: priced.amounts[i], payer_amount: split?.lines[i].payer ?? 0 });
    }
    for (const p of payouts) {
      await uow.insert<BillPayoutRow>(TABLES.billPayouts, {
        hospital_id: actor.hospitalId, bill_id: bill.id, bill_number: billNumber, bill_date: displayDate(), rule_id: p.ruleId, rule_name: p.ruleName, role: p.role,
        payee_type: p.payeeType, payee_id: p.payeeId, payee_name: p.payeeName, basis: p.basis, value_kind: p.valueKind, value: p.value, amount: p.amount, status: "Pending", paid_on: null,
      });
    }
    return bill.id;
  });
  await audit(actor, "create", "bill", billId, { billNumber, total: priced.total, lines: lines.length, ...(contract ? { contract: contract.name, payerShare } : {}) });
  return getBill(billId, actor);
}

export async function updateBill(id: number, input: unknown, actor: Session) {
  const existing = await billsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bill");
  const data = validatePartial(createSchema, input);
  const patch: Record<string, unknown> = {};
  if ("status" in data) patch.status = data.status;
  if ("type" in data) patch.type = data.type;
  if ("paymentMode" in data) patch.payment_mode = (await canonicalMaster("payment_mode", data.paymentMode, actor, "paymentMode", existing.payment_mode)) || null;
  if ("amount" in data || "discount" in data || "type" in data) {
    const amount = (data.amount as number) ?? existing.amount;
    const discount = (data.discount as number) ?? existing.discount;
    const type = (data.type as string) ?? existing.type;
    const totals = computeBillTotals(Number(amount), Number(discount), type);
    patch.amount = amount;
    patch.discount = discount;
    patch.gst = totals.gst;
    patch.total = totals.total;
  }
  const row = await billsRepo.update(id, patch);
  if (patch.status === "Refunded") await voidPayoutsFor(id, actor);
  await audit(actor, "update", "bill", id, patch);
  return toBillDTO(row as BillRow);
}

export async function deleteBill(id: number, actor: Session) {
  const existing = await billsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bill");
  const { rows: payouts } = await billPayoutsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: id }] }, actor));
  if ((payouts as BillPayoutRow[]).some((p) => p.status === "Paid")) throw new ConflictError("Payouts on this bill have already been paid out — refund it instead of deleting it");
  await voidPayoutsFor(id, actor, true);
  for (const it of await itemsOf(id, actor)) await billItemsRepo.remove(it.id);
  await billsRepo.remove(id);
  await audit(actor, "delete", "bill", id);
}
