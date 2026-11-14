/**
 * The H1 register: every Schedule H1 drug the pharmacy gave to a patient — from a counter dispense or a sale — with who it was
 * for, the prescriber, the quantity and when. A line is in the register when its medicine is marked H1 in the inventory or the
 * pharmacist ticked "H1" on it. It can be filtered by dates, by patient and by a search word.
 */
import { billsRepo, patientsRepo, pharmacyDispenseLinesRepo, pharmacyDispensesRepo, pharmacySaleItemsRepo, pharmacySalesRepo, prescriptionsRepo } from "@/repositories";
import { type PharmacyDispenseRow, type PharmacySaleRow } from "@/db/tables";
import { ValidationError } from "@/lib/errors";
import { localDate, localTime } from "@/lib/clock";
import { type Session } from "@/auth/session";
import { scopeToHospital } from "@/services/hospital-scope";
import type { H1RegisterDTO, H1RegisterEntryDTO } from "@shared/types/api";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ENTRIES = 5000;

export interface H1Query { from?: string; to?: string; patientId?: number; search?: string }

export async function h1Register(q: H1Query, actor: Session): Promise<H1RegisterDTO> {
  const errors: { field: string; message: string }[] = [];
  if (q.from && !ISO.test(q.from)) errors.push({ field: "from", message: "from must be a date like 2026-11-14" });
  if (q.to && !ISO.test(q.to)) errors.push({ field: "to", message: "to must be a date like 2026-11-14" });
  if (q.from && q.to && ISO.test(q.from) && ISO.test(q.to) && q.from > q.to) errors.push({ field: "to", message: "the end date is before the start date" });
  if (errors.length) throw new ValidationError(errors);

  const flagged = [{ column: "is_h1", op: "eq" as const, value: true }];
  const [{ rows: dLines }, { rows: sItems }] = await Promise.all([
    pharmacyDispenseLinesRepo.listRows(scopeToHospital({ unpaged: true, filters: flagged }, actor)),
    pharmacySaleItemsRepo.listRows({ unpaged: true, filters: flagged }),
  ]);

  const [{ rows: dispenses }, { rows: sales }, { rows: patients }, { rows: rxs }, { rows: bills }] = await Promise.all([
    pharmacyDispensesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    pharmacySalesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    patientsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    prescriptionsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    billsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const dById = new Map((dispenses as PharmacyDispenseRow[]).map((d) => [d.id, d]));
  const sById = new Map((sales as PharmacySaleRow[]).map((s) => [s.id, s]));
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const rxByNumber = new Map(rxs.map((r) => [r.rx_number, r]));
  const rxById = new Map(rxs.map((r) => [r.id, r]));
  const billById = new Map(bills.map((b) => [b.id, b]));

  const entries: H1RegisterEntryDTO[] = [];
  const person = (patientId: number | null) => {
    const p = patientId ? patientById.get(patientId) : undefined;
    return { patientAge: p ? Number(p.age) : null, patientPhone: p?.phone ?? "", patientAddress: [p?.address, p?.city, p?.state, p?.pincode].filter(Boolean).join(", ") };
  };

  for (const l of dLines) {
    const d = dById.get(l.dispense_id);
    if (!d) continue; // another hospital's, or a dispense that is gone
    const at = new Date(d.created_at);
    const rx = (d.prescription_id ? rxById.get(d.prescription_id) : undefined) ?? (d.rx_number ? rxByNumber.get(d.rx_number) : undefined);
    entries.push({
      key: `dispense:${l.id}`, source: "Dispense", date: localDate(at), time: localTime(at), patientId: d.patient_id ?? null, patientName: d.patient_name, ...person(d.patient_id ?? null),
      prescriber: rx?.doctor ?? "", rxNumber: d.rx_number ?? "", medicineName: l.medicine_name, quantity: l.quantity, returnedQty: l.returned_qty ?? 0, batchNo: l.batch_no ?? "",
      reference: d.dispense_no, billNumber: d.bill_number ?? "", givenBy: d.dispensed_by ?? "",
    });
  }
  for (const i of sItems) {
    const s = sById.get(i.sale_id);
    if (!s) continue;
    const at = new Date(s.created_at);
    const rx = s.rx_number ? rxByNumber.get(s.rx_number) : undefined;
    entries.push({
      key: `sale:${i.id}`, source: "Sale", date: localDate(at), time: localTime(at), patientId: s.patient_id ?? null, patientName: s.patient_name, ...person(s.patient_id ?? null),
      prescriber: rx?.doctor ?? "", rxNumber: s.rx_number ?? "", medicineName: i.medicine_name, quantity: i.quantity, returnedQty: 0, batchNo: "",
      reference: s.sale_number, billNumber: s.bill_id ? billById.get(s.bill_id)?.bill_number ?? "" : "", givenBy: "",
    });
  }

  const term = (q.search ?? "").trim().toLowerCase();
  const shown = entries
    .filter((e) => (!q.from || e.date >= q.from) && (!q.to || e.date <= q.to))
    .filter((e) => !q.patientId || e.patientId === q.patientId)
    .filter((e) => !term || `${e.patientName} ${e.medicineName} ${e.rxNumber} ${e.reference} ${e.prescriber}`.toLowerCase().includes(term))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.key.localeCompare(a.key))
    .slice(0, MAX_ENTRIES);

  const patientKeys = new Set(shown.map((e) => (e.patientId != null ? `id:${e.patientId}` : `name:${e.patientName.toLowerCase()}`)));
  return { entries: shown, summary: { entries: shown.length, patients: patientKeys.size, units: shown.reduce((n, e) => n + Math.max(0, e.quantity - e.returnedQty), 0) } };
}
