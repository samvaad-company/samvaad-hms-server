/**
 * Platform billing — a platform admin invoicing hospital tenants for their
 * Samvaad HMS subscription/usage. Distinct from `billing-service.ts`, which
 * is a hospital's own patient-facing billing; this is platform → hospital.
 */
import { platformBillsRepo, hospitalsRepo } from "@/repositories";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { nextCode, displayDate, computeBillTotals } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { type PlatformBillRow } from "@/db/tables";

function requirePlatformAdmin(actor: Session): void {
  if (actor.role !== "Platform Admin") {
    throw new ForbiddenError("Only a platform admin can manage platform billing");
  }
}

function toBillDTO(row: PlatformBillRow) {
  return {
    id: row.id,
    billNumber: row.bill_number,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
    period: row.period,
    amount: row.amount,
    gst: row.gst,
    total: row.total,
    status: row.status,
    issuedDate: row.issued_date,
    dueDate: row.due_date,
    notes: row.notes,
  };
}

export async function listPlatformBills(actor: Session) {
  requirePlatformAdmin(actor);
  const { rows } = await platformBillsRepo.listRows({ unpaged: true });
  return rows
    .sort((a, b) => b.id - a.id)
    .map(toBillDTO);
}

export async function getPlatformBill(id: number, actor: Session) {
  requirePlatformAdmin(actor);
  const row = await platformBillsRepo.getRow(id);
  if (!row) throw new NotFoundError("Platform bill");
  return toBillDTO(row);
}

const createSchema = {
  hospitalId: { type: "number", required: true },
  period: { type: "string", required: true, min: 2, max: 40 },
  amount: { type: "number", required: true, min: 0 },
  dueDate: { type: "string", required: false, max: 20, default: "" },
  notes: { type: "string", required: false, max: 400, default: "" },
} as const;

export async function createPlatformBill(input: unknown, actor: Session) {
  requirePlatformAdmin(actor);
  const data = validate(createSchema, input);

  const hospital = await hospitalsRepo.getRow(data.hospitalId);
  if (!hospital) throw new NotFoundError("Hospital");

  const { rows: existing } = await platformBillsRepo.listRows({ unpaged: true });
  const billNumber = nextCode(existing.map((r) => r.bill_number), "PB-", 5);
  const { gst, total } = computeBillTotals(data.amount, 0, "Subscription");

  const row = await platformBillsRepo.create({
    bill_number: billNumber,
    hospital_id: hospital.id,
    hospital_name: hospital.name,
    period: data.period,
    amount: data.amount,
    gst,
    total,
    status: "Pending",
    issued_date: displayDate(),
    due_date: data.dueDate ?? "",
    notes: data.notes ?? "",
  });

  await audit(actor, "create", "platform-bill", row.id, { billNumber, hospitalId: hospital.id });
  return toBillDTO(row as PlatformBillRow);
}

const updateSchema = {
  status: { type: "enum", required: false, values: ["Pending", "Paid", "Overdue"] },
  notes: { type: "string", required: false, max: 400 },
} as const;

export async function updatePlatformBill(id: number, input: unknown, actor: Session) {
  requirePlatformAdmin(actor);
  const existing = await platformBillsRepo.getRow(id);
  if (!existing) throw new NotFoundError("Platform bill");
  const data = validatePartial(updateSchema, input);
  const patch: Record<string, unknown> = {};
  if ("status" in data) patch.status = data.status;
  if ("notes" in data) patch.notes = data.notes;

  const row = await platformBillsRepo.update(id, patch);
  await audit(actor, "update", "platform-bill", id, patch);
  return toBillDTO(row as PlatformBillRow);
}

export async function deletePlatformBill(id: number, actor: Session) {
  requirePlatformAdmin(actor);
  const ok = await platformBillsRepo.remove(id);
  if (!ok) throw new NotFoundError("Platform bill");
  await audit(actor, "delete", "platform-bill", id);
}
