/**
 * Billing service — invoices with server-computed GST and totals.
 */
import { billsRepo, patientsRepo } from "@/repositories";
import { toBillDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type BillRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { computeBillTotals, displayDate, nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  type: { type: "enum", required: false, values: ["OPD", "Pharmacy", "Lab", "IPD", "Blood", "Ambulance", "Radiology"], default: "OPD" },
  amount: { type: "number", required: true, min: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Paid", "Pending", "Partial", "Refunded"], default: "Pending" },
} as const;

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
  return toBillDTO(row);
}

export async function createBill(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }
  const { gst, total } = computeBillTotals(data.amount, data.discount ?? 0, data.type);

  const all = await billsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const billNumber = nextCode(
    all.rows.map((r) => r.bill_number),
    "INV-",
    8,
  );

  const row = await billsRepo.create({
    hospital_id: actor.hospitalId,
    bill_number: billNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    type: data.type,
    bill_date: displayDate(),
    amount: data.amount,
    discount: data.discount,
    gst,
    total,
    status: data.status,
  });
  await audit(actor, "create", "bill", row.id, { billNumber, total });
  return toBillDTO(row as BillRow);
}

export async function updateBill(id: number, input: unknown, actor: Session) {
  const existing = await billsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bill");
  const data = validatePartial(createSchema, input);
  const patch: Record<string, unknown> = {};
  if ("status" in data) patch.status = data.status;
  if ("type" in data) patch.type = data.type;
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
  await audit(actor, "update", "bill", id, patch);
  return toBillDTO(row as BillRow);
}

export async function deleteBill(id: number, actor: Session) {
  const existing = await billsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bill");
  await billsRepo.remove(id);
  await audit(actor, "delete", "bill", id);
}
