/**
 * Billing service — invoices with server-computed GST and totals.
 */
import { billsRepo, patientsRepo } from "@/server/repositories";
import { toBillDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type BillRow } from "@/server/db/tables";
import { NotFoundError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { computeBillTotals, displayDate, nextCode } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

const createSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  type: { type: "enum", required: false, values: ["OPD", "Pharmacy", "Lab", "IPD"], default: "OPD" },
  amount: { type: "number", required: true, min: 0 },
  discount: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Paid", "Pending", "Partial", "Refunded"], default: "Pending" },
} as const;

export const BILLING_LIST_CONFIG = {
  searchColumns: ["bill_number", "patient_name", "type"],
  filterable: ["status", "type"],
  sortable: ["bill_date", "total", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listBills(options: QueryOptions) {
  return billsRepo.list(options);
}

export async function getBill(id: number) {
  const b = await billsRepo.get(id);
  if (!b) throw new NotFoundError("Bill");
  return b;
}

export async function createBill(input: unknown, actor: Session) {
  const data = validate(createSchema, input);
  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }
  const { gst, total } = computeBillTotals(data.amount, data.discount ?? 0, data.type);

  const all = await billsRepo.listRows({ unpaged: true });
  const billNumber = nextCode(
    all.rows.map((r) => r.bill_number),
    "INV-",
    8,
  );

  const row = await billsRepo.create({
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
  if (!existing) throw new NotFoundError("Bill");
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
  const ok = await billsRepo.remove(id);
  if (!ok) throw new NotFoundError("Bill");
  await audit(actor, "delete", "bill", id);
}
