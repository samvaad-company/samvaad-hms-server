/**
 * The combined bill: everything one patient was charged, on one statement. Bills are grouped by what they were for (IPD, consultation,
 * pharmacy, lab, radiology, …), each group lists its lines with date, quantity, rate and amount and a subtotal, and the prescriptions
 * written in the period are listed beneath (they carry no charge). The statement is assembled from the patient's bills; issuing it
 * saves a copy with its own invoice number (CB-00000001…) so every combined bill can be found again in the history.
 */
import { combinedBillsRepo, billsRepo, billItemsRepo, ipdRepo, patientsRepo, prescriptionsRepo, prescriptionItemsRepo } from "@/repositories";
import type { CombinedBillRow, BillItemRow, BillRow, IpdAdmissionRow, PatientRow, PrescriptionItemRow, PrescriptionRow } from "@/db/tables";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { r2 } from "@shared/types/billing";
import type { CombinedBillDTO, CombinedBillHistoryDTO, CombinedBillSection } from "@shared/types/api";

/** The order sections print in, and the heading each one gets. */
const SECTIONS: { type: string; title: string }[] = [
  { type: "IPD", title: "IPD charges" },
  { type: "OPD", title: "Consultation (OPD) charges" },
  { type: "Pharmacy", title: "Pharmacy" },
  { type: "Lab", title: "Lab charges" },
  { type: "Radiology", title: "Radiology charges" },
  { type: "Blood", title: "Blood bank" },
  { type: "Ambulance", title: "Ambulance" },
];

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

async function assemble(query: URLSearchParams, actor: Session): Promise<CombinedBillDTO> {
  const patientId = Number(query.get("patientId"));
  if (!Number.isInteger(patientId) || patientId <= 0) throw new ValidationError([{ field: "patientId", message: "choose a patient" }]);
  const from = query.get("from") ?? "", to = query.get("to") ?? "";
  if ((from && !isDate(from)) || (to && !isDate(to))) throw new ValidationError([{ field: "from", message: "dates look like 2026-11-07" }]);
  if (from && to && from > to) throw new ValidationError([{ field: "from", message: "the start can't be after the end" }]);
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const patient = (await patientsRepo.getRow(patientId)) as PatientRow;
  assertOwnedByHospital(patient, actor, "Patient");
  const scoped = { unpaged: true, filters: [{ column: "patient_id", op: "eq" as const, value: patientId }] };

  const bills = ((await billsRepo.listRows(scopeToHospital(scoped, actor))).rows as BillRow[]).filter((b) => inRange(b.bill_date)).sort((a, b) => a.bill_date.localeCompare(b.bill_date) || a.id - b.id);
  const itemsByBill = new Map<number, BillItemRow[]>();
  for (const b of bills) {
    const { rows } = await billItemsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "bill_id", op: "eq" as const, value: b.id }] }, actor));
    itemsByBill.set(b.id, (rows as BillItemRow[]).sort((x, y) => x.id - y.id));
  }

  const counted = bills.filter((b) => b.status !== "Refunded");
  const sections: CombinedBillSection[] = [];
  const known = new Set(SECTIONS.map((s) => s.type));
  const groups = [...SECTIONS, ...[...new Set(counted.map((b) => b.type))].filter((t) => !known.has(t)).map((t) => ({ type: t, title: t }))];
  for (const g of groups) {
    const lines: CombinedBillSection["lines"] = [];
    let subtotal = 0;
    for (const b of counted.filter((x) => x.type === g.type)) {
      const items = itemsByBill.get(b.id) ?? [];
      if (items.length) {
        for (const it of items) {
          const rate = Number(it.unit_price), qty = Number(it.quantity), net = Number(it.amount);
          lines.push({ name: it.name, date: b.bill_date, quantity: qty, rate, amount: net, billNumber: b.bill_number });
          subtotal += net;
        }
      } else {
        // A bill raised as a single amount, with no lines: show it as one line.
        lines.push({ name: `${g.title} — ${b.bill_number}`, date: b.bill_date, quantity: 1, rate: Number(b.amount), amount: Number(b.amount), billNumber: b.bill_number });
        subtotal += Number(b.amount);
      }
    }
    if (lines.length) sections.push({ type: g.type, title: g.title, lines, subtotal: r2(subtotal) });
  }

  const gross = r2(counted.reduce((s, b) => s + Number(b.amount), 0));
  const discount = r2(counted.reduce((s, b) => s + Number(b.discount), 0));
  const gst = r2(counted.reduce((s, b) => s + Number(b.gst), 0));
  const total = r2(counted.reduce((s, b) => s + Number(b.total), 0));
  const paid = r2(counted.filter((b) => b.status === "Paid").reduce((s, b) => s + Number(b.total), 0));

  const admissions = ((await ipdRepo.listRows(scopeToHospital(scoped, actor))).rows as IpdAdmissionRow[]).filter((a) => inRange(a.admission_date)).sort((a, b) => b.admission_date.localeCompare(a.admission_date));
  const adm = admissions[0];

  const rxs = ((await prescriptionsRepo.listRows(scopeToHospital(scoped, actor))).rows as PrescriptionRow[]).filter((r) => inRange(r.prescribed_date)).sort((a, b) => a.prescribed_date.localeCompare(b.prescribed_date));
  const prescriptions: CombinedBillDTO["prescriptions"] = [];
  for (const r of rxs) {
    const { rows } = await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq" as const, value: r.id }] } as never);
    prescriptions.push({ rxNumber: r.rx_number, date: r.prescribed_date, doctor: r.doctor, diagnosis: r.diagnosis, medicines: (rows as PrescriptionItemRow[]).map((m) => [m.medicine_name, m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")) });
  }

  return {
    patient: { id: patient.id, name: patient.name, code: patient.patient_code, age: patient.age, gender: patient.gender, phone: patient.phone, address: [patient.address, patient.city, patient.state, patient.pincode].filter(Boolean).join(", ") },
    period: { from: from || null, to: to || null },
    admission: adm ? { admissionNo: adm.admission_no ?? "", admittedOn: adm.admission_date, ward: adm.ward, bed: adm.bed, doctor: adm.doctor, diagnosis: adm.diagnosis, status: adm.status } : null,
    sections,
    prescriptions,
    totals: { gross, discount, gst, total, paid, due: r2(Math.max(0, total - paid)) },
    billCount: counted.length,
    refundedCount: bills.length - counted.length,
  };
}

/** A preview of the statement; nothing is saved. */
export const combinedBill = assemble;

const INVOICE_PREFIX = "CB-";

const toHistory = (r: CombinedBillRow): CombinedBillHistoryDTO => ({
  id: r.id, invoiceNo: r.invoice_no, patientId: r.patient_id, patientName: r.patient_name, periodFrom: r.period_from ?? null, periodTo: r.period_to ?? null,
  billCount: Number(r.bill_count), total: Number(r.total), paid: Number(r.paid), due: Number(r.due), createdAt: r.created_at, createdBy: r.created_by ?? "",
});

const parseSnapshot = (v: unknown): CombinedBillDTO => (typeof v === "string" ? JSON.parse(v) : v) as CombinedBillDTO;

/** Issue the combined bill: build the statement, give it the next invoice number and keep a copy in the history. */
export async function issueCombinedBill(input: unknown, actor: Session): Promise<CombinedBillDTO> {
  const b = (input ?? {}) as Record<string, unknown>;
  const q = new URLSearchParams();
  for (const k of ["patientId", "from", "to"] as const) if (b[k] !== undefined && b[k] !== null && b[k] !== "") q.set(k, String(b[k]));
  const bill = await assemble(q, actor);
  if (bill.sections.length === 0) throw new ValidationError([{ field: "patientId", message: "this patient has no bills in that period" }]);
  const existing = (await combinedBillsRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows.map((r) => (r as CombinedBillRow).invoice_no);
  const invoiceNo = nextCode(existing, INVOICE_PREFIX, 8);
  const row = (await combinedBillsRepo.create({
    hospital_id: actor.hospitalId, invoice_no: invoiceNo, patient_id: bill.patient.id, patient_name: bill.patient.name,
    period_from: bill.period.from, period_to: bill.period.to, bill_count: bill.billCount,
    gross: bill.totals.gross, discount: bill.totals.discount, gst: bill.totals.gst, total: bill.totals.total, paid: bill.totals.paid, due: bill.totals.due,
    snapshot: { ...bill, invoiceNo }, created_by: actor.name,
  } as never)) as CombinedBillRow;
  await audit(actor, "create", "combined_bill", row.id, { invoiceNo, patientId: bill.patient.id, total: bill.totals.total });
  return { ...bill, id: row.id, invoiceNo, createdAt: row.created_at, createdBy: actor.name };
}

/** Every combined bill issued, newest first; `q` matches the invoice number or the patient's name. */
export async function combinedBillHistory(query: URLSearchParams, actor: Session): Promise<CombinedBillHistoryDTO[]> {
  const q = (query.get("q") ?? "").trim().toLowerCase();
  const patientId = Number(query.get("patientId"));
  const rows = (await combinedBillsRepo.listRows(scopeToHospital({ unpaged: true }, actor))).rows as CombinedBillRow[];
  return rows
    .filter((r) => (!patientId || r.patient_id === patientId) && (!q || r.invoice_no.toLowerCase().includes(q) || r.patient_name.toLowerCase().includes(q)))
    .sort((a, b) => b.id - a.id)
    .map(toHistory);
}

/** One issued combined bill, exactly as it was issued. */
export async function getCombinedBill(id: number, actor: Session): Promise<CombinedBillDTO> {
  const row = (await combinedBillsRepo.getRow(id)) as CombinedBillRow | null;
  if (!row) throw new NotFoundError("Combined bill");
  assertOwnedByHospital(row, actor, "Combined bill");
  return { ...parseSnapshot(row.snapshot), id: row.id, invoiceNo: row.invoice_no, createdAt: row.created_at, createdBy: row.created_by ?? "" };
}
