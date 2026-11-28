/**
 * Patient portal: the patient's bills and what is still to pay.
 *
 * What the HMS stores, and what this therefore shows (decided from billing-service and the bills table, not guessed):
 *  - A bill has a status: Pending, Paid, Partial or Refunded. There is NO "amount paid so far" column and no payment ledger for bills, so
 *    for a Partial bill the amount still owed is not known: it is returned as `due: null` and left out of the pending total.
 *  - For a Pending bill the patient owes `patient_share` when the bill was raised under a sponsor contract (the insurer or TPA owes the
 *    rest), otherwise the whole `total`. That amount is `due`.
 *  - There is no stored "paid on" date either; for a Paid bill `paidOn` is the day the bill was last updated, which is when it was marked paid.
 *  - Nothing about how a discount was decided, the payer's share, the contract or any payout is returned.
 */
import { billItemsRepo, billsRepo } from "@/repositories";
import { type BillItemRow, type BillRow } from "@/db/tables";
import { assertPatientRecord, dayOf, portalPatient, slicePage } from "@/services/portal-common";

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** What the patient still owes on a bill: the amount for a Pending one, null when it is not known (Partial) or nothing is owed. */
function dueOf(b: BillRow): number | null {
  if (b.status === "Pending") return r2(num(b.patient_share ?? b.total));
  if (b.status === "Partial") return null;
  return 0;
}

/** A short line that says what kind of bill it is, when the type alone does not. */
function labelOf(b: BillRow): string {
  const remark = String(b.remarks ?? "").trim();
  if (b.type === "Pharmacy" && b.admission_id && /^bedside/i.test(remark)) return remark.slice(0, 120);
  if (b.type === "IPD" && b.admission_no) return `Hospital stay ${b.admission_no}`;
  if (String(b.bill_number).startsWith("CB-")) return "Full bill for the stay";
  return "";
}

function rowOf(b: BillRow) {
  return {
    id: b.id,
    billNumber: b.bill_number,
    type: b.type,
    date: b.bill_date,
    time: b.bill_time ?? "",
    total: r2(num(b.total)),
    status: b.status,
    due: dueOf(b),
    label: labelOf(b),
    ...(b.doctor_name ? { doctorName: b.doctor_name } : {}),
    ...(b.admission_no ? { admissionNo: b.admission_no } : {}),
  };
}

async function billsOf(patientId: number, hospitalId: number): Promise<BillRow[]> {
  const { rows } = await billsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] } as never);
  return (rows as BillRow[]).filter((b) => b.hospital_id === hospitalId)
    .sort((a, b) => `${b.bill_date} ${b.bill_time ?? ""}`.localeCompare(`${a.bill_date} ${a.bill_time ?? ""}`) || b.id - a.id);
}

/** The patient's bills with the pending total. `status`: pending (Pending and Partial), paid, or all. */
export async function portalBills(patientId: number, status: string, page: number, pageSize: number) {
  const patient = await portalPatient(patientId);
  const all = await billsOf(patient.id, patient.hospital_id);
  const pending = all.filter((b) => b.status === "Pending");
  const partial = all.filter((b) => b.status === "Partial");
  const want = status === "pending" ? [...pending, ...partial].sort((a, b) => b.id - a.id) : status === "paid" ? all.filter((b) => b.status === "Paid") : all;
  return {
    summary: {
      pendingCount: pending.length + partial.length,
      pendingTotal: r2(pending.reduce((n, b) => n + (dueOf(b) ?? 0), 0)),
      partialCount: partial.length,
      currency: "INR",
    },
    items: slicePage(want, page, pageSize).map(rowOf),
  };
}

/** One bill with its lines. 404 when it is not this patient's. */
export async function portalBill(billId: number, patientId: number) {
  const patient = await portalPatient(patientId);
  const bill = assertPatientRecord(await billsRepo.getRow(billId) as BillRow | null, patient, "Bill");
  const { rows } = await billItemsRepo.listRows({ unpaged: true, filters: [{ column: "bill_id", op: "eq", value: bill.id }] } as never);
  const items = (rows as BillItemRow[]).sort((a, b) => a.id - b.id).map((i) => ({ name: i.name, quantity: num(i.quantity), rate: r2(num(i.unit_price)), amount: r2(num(i.amount)) }));
  return {
    ...rowOf(bill),
    amount: r2(num(bill.amount)),
    discount: r2(num(bill.discount)),
    gst: r2(num(bill.gst)),
    items,
    paymentMode: bill.status === "Paid" ? bill.payment_mode ?? null : null,
    paidOn: bill.status === "Paid" ? dayOf(bill.updated_at) : null,
  };
}
