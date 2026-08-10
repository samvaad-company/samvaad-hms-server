/**
 * Prescriptions service — issuing prescriptions with line items and dispensing
 * them, which decrements pharmacy inventory (cross-module wiring).
 */
import {
  prescriptionsRepo,
  prescriptionItemsRepo,
  patientsRepo,
  doctorsRepo,
  pharmacyRepo,
} from "@/server/repositories";
import { toPrescriptionDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type PrescriptionRow, type PrescriptionItemRow } from "@/server/db/tables";
import { NotFoundError, ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { computePharmacyStatus, displayDate } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

interface ItemInput {
  medicineId?: number;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

const headerSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  patientAge: { type: "number", required: false, min: 0, max: 200, default: 0 },
  doctorId: { type: "number", required: false },
  doctor: { type: "string", required: false, max: 120, default: "" },
  diagnosis: { type: "string", required: true, min: 2, max: 240 },
  status: { type: "enum", required: false, values: ["Dispensed", "Pending", "Draft"], default: "Draft" },
} as const;

export const RX_LIST_CONFIG = {
  searchColumns: ["rx_number", "patient_name", "doctor", "diagnosis"],
  filterable: ["status", "doctor", "patient_id", "doctor_id"],
  sortable: ["prescribed_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listPrescriptions(options: QueryOptions) {
  return prescriptionsRepo.list(options);
}

async function loadItems(prescriptionId: number): Promise<PrescriptionItemRow[]> {
  const res = await prescriptionItemsRepo.listRows({
    filters: [{ column: "prescription_id", op: "eq", value: prescriptionId }],
    unpaged: true,
  });
  return res.rows;
}

export async function getPrescription(id: number) {
  const row = await prescriptionsRepo.getRow(id);
  if (!row) throw new NotFoundError("Prescription");
  const items = await loadItems(id);
  return toPrescriptionDTO(row, items);
}

export async function createPrescription(input: unknown, actor: Session) {
  const data = validate(headerSchema, input);
  const rawItems = Array.isArray((input as { items?: unknown }).items)
    ? ((input as { items: ItemInput[] }).items)
    : [];

  let patientName = data.patientName;
  let patientAge = data.patientAge ?? 0;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) {
      patientName = p.name;
      patientAge = p.age;
    }
  }
  let doctorName = data.doctor ?? "";
  if (data.doctorId) {
    const d = await doctorsRepo.getRow(data.doctorId);
    if (d) doctorName = d.name;
  }

  const all = await prescriptionsRepo.listRows({ unpaged: true });
  const seq = all.rows.length + 1;
  const rxNumber = `RX-${displayDate().replace(/\s/g, "")}-${String(seq).padStart(3, "0")}`;

  const header = await prescriptionsRepo.create({
    rx_number: rxNumber,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    patient_age: patientAge,
    doctor_id: data.doctorId ?? null,
    doctor: doctorName,
    diagnosis: data.diagnosis,
    medicine_count: rawItems.length,
    prescribed_date: displayDate(),
    status: data.status,
  });

  const items: PrescriptionItemRow[] = [];
  for (const it of rawItems) {
    if (!it.medicineName) continue;
    const created = await prescriptionItemsRepo.create({
      prescription_id: header.id,
      medicine_id: it.medicineId ?? null,
      medicine_name: it.medicineName,
      dosage: it.dosage ?? "",
      frequency: it.frequency ?? "",
      duration: it.duration ?? "",
      instructions: it.instructions ?? null,
    });
    items.push(created as PrescriptionItemRow);
  }

  await audit(actor, "create", "prescription", header.id, { rxNumber, items: items.length });
  return toPrescriptionDTO(header as PrescriptionRow, items);
}

export async function updatePrescription(id: number, input: unknown, actor: Session) {
  const existing = await prescriptionsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Prescription");
  const data = validatePartial(headerSchema, input);
  const patch: Record<string, unknown> = {};
  if ("diagnosis" in data) patch.diagnosis = data.diagnosis;
  if ("status" in data) patch.status = data.status;
  const row = await prescriptionsRepo.update(id, patch);
  await audit(actor, "update", "prescription", id, patch);
  const items = await loadItems(id);
  return toPrescriptionDTO(row as PrescriptionRow, items);
}

/** Comparable form of a medicine name: lowercase, no strength or packaging. */
function medicineKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|%)\b/g, " ") // strip strength
    .replace(/\b(tablet|tab|capsule|cap|syrup|injection|inj|drops?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Units to dispense for a line item, from its frequency and duration.
 * "1-0-1" (or "twice daily") over "5 days" → 2 × 5 = 10 units.
 * Falls back to 1 when the text can't be parsed.
 */
export function unitsFor(frequency: string, duration: string): number {
  const freqText = (frequency ?? "").toLowerCase();
  let perDay = 0;

  const dashed = freqText.match(/\d\s*-\s*\d\s*-\s*\d(\s*-\s*\d)?/);
  if (dashed) {
    perDay = dashed[0].split("-").reduce((sum, n) => sum + (Number(n.trim()) || 0), 0);
  } else if (/(once|1\s*(time|x)|od\b)/.test(freqText)) perDay = 1;
  else if (/(twice|2\s*(times|x)|bd\b|bid\b)/.test(freqText)) perDay = 2;
  else if (/(thrice|3\s*(times|x)|tds\b|tid\b)/.test(freqText)) perDay = 3;
  else if (/(4\s*(times|x)|qds\b|qid\b)/.test(freqText)) perDay = 4;

  const days = Number((duration ?? "").match(/\d+/)?.[0] ?? 0);
  const total = perDay * days;
  return total > 0 ? total : 1;
}

/**
 * Dispense a prescription: mark it Dispensed and decrement pharmacy stock for
 * each line item. Matching is by exact name first, then by a normalized key so
 * "Metformin 1000mg" still finds the "Metformin 500mg" stock line. Quantities
 * come from the frequency × duration rather than assuming a single unit.
 *
 * Anything that could not be matched or was short-stocked is returned so the
 * pharmacist sees it instead of the update silently doing nothing.
 */
export async function dispensePrescription(id: number, actor: Session) {
  const rx = await prescriptionsRepo.getRow(id);
  if (!rx) throw new NotFoundError("Prescription");
  if (rx.status === "Dispensed") {
    throw new ConflictError("Prescription is already dispensed");
  }

  const items = await loadItems(id);
  const adjustments: { name: string; units: number; from: number; to: number }[] = [];
  const unmatched: string[] = [];
  const shortStocked: { name: string; needed: number; available: number }[] = [];

  // Load stock once so fuzzy matching doesn't need a query per candidate.
  const { rows: stock } = await pharmacyRepo.listRows({ unpaged: true });
  const byKey = new Map<string, (typeof stock)[number]>();
  for (const s of stock) {
    const k = medicineKey(s.name);
    if (!byKey.has(k)) byKey.set(k, s);
  }

  for (const item of items) {
    const match =
      stock.find((s) => s.name === item.medicine_name) ??
      byKey.get(medicineKey(item.medicine_name));

    if (!match) {
      unmatched.push(item.medicine_name);
      continue;
    }

    const units = unitsFor(item.frequency, item.duration);
    if (match.stock < units) {
      shortStocked.push({ name: match.name, needed: units, available: match.stock });
    }
    const newStock = Math.max(0, match.stock - units);
    await pharmacyRepo.update(match.id, {
      stock: newStock,
      status: computePharmacyStatus(newStock, match.min_stock, match.expiry_date),
    });
    // Keep the in-memory copy in sync for repeated medicines on one Rx.
    match.stock = newStock;
    adjustments.push({ name: match.name, units, from: match.stock + units, to: newStock });
  }

  const row = await prescriptionsRepo.update(id, { status: "Dispensed" });
  await audit(actor, "dispense", "prescription", id, { adjustments, unmatched, shortStocked });

  return {
    ...toPrescriptionDTO(row as PrescriptionRow, items),
    dispense: { adjustments, unmatched, shortStocked },
  };
}

export async function deletePrescription(id: number, actor: Session) {
  const items = await loadItems(id);
  for (const it of items) await prescriptionItemsRepo.remove(it.id);
  const ok = await prescriptionsRepo.remove(id);
  if (!ok) throw new NotFoundError("Prescription");
  await audit(actor, "delete", "prescription", id);
}
