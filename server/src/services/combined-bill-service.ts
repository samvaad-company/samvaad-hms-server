/**
 * The combined bill: everything one patient was charged, on one statement. Bills are grouped by what they were for (IPD, consultation,
 * pharmacy, lab, radiology, …), each group lists its lines with date, quantity, rate and amount and a subtotal, and the prescriptions
 * written in the period are listed beneath (they carry no charge). Nothing is stored: it is assembled from the patient's bills.
 */
import { billsRepo, billItemsRepo, ipdRepo, patientsRepo, prescriptionsRepo, prescriptionItemsRepo } from "@/repositories";
import type { BillItemRow, BillRow, IpdAdmissionRow, PatientRow, PrescriptionItemRow, PrescriptionRow } from "@/db/tables";
import { ValidationError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { r2 } from "@shared/types/billing";
import type { CombinedBillDTO, CombinedBillSection } from "@shared/types/api";

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

export async function combinedBill(query: URLSearchParams, actor: Session): Promise<CombinedBillDTO> {
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
