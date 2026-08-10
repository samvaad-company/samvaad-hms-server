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

/**
 * Dispense a prescription: mark it Dispensed and decrement pharmacy stock for
 * each line item matched by medicine name. Recomputes pharmacy stock status.
 */
export async function dispensePrescription(id: number, actor: Session) {
  const rx = await prescriptionsRepo.getRow(id);
  if (!rx) throw new NotFoundError("Prescription");
  if (rx.status === "Dispensed") {
    throw new ConflictError("Prescription is already dispensed");
  }

  const items = await loadItems(id);
  const adjustments: { name: string; from: number; to: number }[] = [];

  for (const item of items) {
    const match = await pharmacyRepo.findRow([
      { column: "name", op: "eq", value: item.medicine_name },
    ]);
    if (!match) continue;
    const newStock = Math.max(0, match.stock - 1);
    await pharmacyRepo.update(match.id, {
      stock: newStock,
      status: computePharmacyStatus(newStock, match.min_stock, match.expiry_date),
    });
    adjustments.push({ name: match.name, from: match.stock, to: newStock });
  }

  const row = await prescriptionsRepo.update(id, { status: "Dispensed" });
  await audit(actor, "dispense", "prescription", id, { adjustments });
  return toPrescriptionDTO(row as PrescriptionRow, items);
}

export async function deletePrescription(id: number, actor: Session) {
  const items = await loadItems(id);
  for (const it of items) await prescriptionItemsRepo.remove(it.id);
  const ok = await prescriptionsRepo.remove(id);
  if (!ok) throw new NotFoundError("Prescription");
  await audit(actor, "delete", "prescription", id);
}
