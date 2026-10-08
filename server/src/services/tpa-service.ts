/**
 * TPA service — insurance company (Third Party Administrator) master and
 * cashless claim tracking against bills.
 */
import { tpasRepo, tpaClaimsRepo, patientsRepo } from "@/repositories";
import { toTpaDTO, toTpaClaimDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type TpaRow, type TpaClaimRow } from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { displayDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

// ── TPA master ──────────────────────────────────────────────────────────────

const tpaSchema = {
  name: { type: "string", required: true, min: 2, max: 160 },
  code: { type: "string", required: false, max: 40, default: "" },
  contactPerson: { type: "string", required: false, max: 120, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  email: { type: "string", required: false, max: 160, default: "" },
  address: { type: "string", required: false, max: 240, default: "" },
  status: { type: "enum", required: false, values: ["Active", "Inactive"], default: "Active" },
} as const;

export const TPA_LIST_CONFIG = {
  searchColumns: ["name", "code", "contact_person", "phone"],
  filterable: ["status"],
  sortable: ["name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listTpas(options: QueryOptions, actor: Session) {
  return tpasRepo.list(scopeToHospital(options, actor));
}

export async function getTpa(id: number, actor: Session) {
  const row = await tpasRepo.getRow(id);
  assertOwnedByHospital(row, actor, "TPA");
  return toTpaDTO(row);
}

export async function createTpa(input: unknown, actor: Session) {
  const data = validate(tpaSchema, input);
  const row = await tpasRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    code: data.code,
    contact_person: data.contactPerson,
    phone: data.phone,
    email: data.email,
    address: data.address,
    status: data.status,
  });
  await audit(actor, "create", "tpa", row.id);
  return toTpaDTO(row as TpaRow);
}

export async function updateTpa(id: number, input: unknown, actor: Session) {
  const existing = await tpasRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "TPA");
  const data = validatePartial(tpaSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("code" in data) patch.code = data.code;
  if ("contactPerson" in data) patch.contact_person = data.contactPerson;
  if ("phone" in data) patch.phone = data.phone;
  if ("email" in data) patch.email = data.email;
  if ("address" in data) patch.address = data.address;
  if ("status" in data) patch.status = data.status;
  const row = await tpasRepo.update(id, patch);
  await audit(actor, "update", "tpa", id, patch);
  return toTpaDTO(row as TpaRow);
}

export async function deleteTpa(id: number, actor: Session) {
  const existing = await tpasRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "TPA");
  await tpasRepo.remove(id);
  await audit(actor, "delete", "tpa", id);
}

// ── Claims ──────────────────────────────────────────────────────────────────

const claimSchema = {
  tpaId: { type: "number", required: true },
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  billNumber: { type: "string", required: false, max: 40, default: "" },
  claimAmount: { type: "number", required: true, min: 0 },
  approvedAmount: { type: "number", required: false, min: 0, default: 0 },
  status: {
    type: "enum",
    required: false,
    values: ["Submitted", "In Review", "Approved", "Rejected", "Settled"],
    default: "Submitted",
  },
} as const;

export const CLAIMS_LIST_CONFIG = {
  searchColumns: ["patient_name", "tpa_name", "bill_number"],
  filterable: ["status", "tpa_name"],
  sortable: ["claim_date", "claim_amount", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listClaims(options: QueryOptions, actor: Session) {
  return tpaClaimsRepo.list(scopeToHospital(options, actor));
}

export async function createClaim(input: unknown, actor: Session) {
  const data = validate(claimSchema, input);
  const tpa = await tpasRepo.getRow(data.tpaId);
  assertOwnedByHospital(tpa, actor, "TPA");
  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }
  const row = await tpaClaimsRepo.create({
    hospital_id: actor.hospitalId,
    tpa_id: data.tpaId,
    tpa_name: tpa.name,
    patient_id: data.patientId ?? null,
    patient_name: patientName,
    bill_number: data.billNumber,
    claim_amount: data.claimAmount,
    approved_amount: data.approvedAmount,
    claim_date: displayDate(),
    status: data.status,
  });
  await audit(actor, "create", "tpa-claim", row.id);
  return toTpaClaimDTO(row as TpaClaimRow);
}

export async function updateClaim(id: number, input: unknown, actor: Session) {
  const existing = await tpaClaimsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Claim");
  const data = validatePartial(claimSchema, input);
  const patch: Record<string, unknown> = {};
  if ("claimAmount" in data) patch.claim_amount = data.claimAmount;
  if ("approvedAmount" in data) patch.approved_amount = data.approvedAmount;
  if ("billNumber" in data) patch.bill_number = data.billNumber;
  if ("status" in data) patch.status = data.status;
  const row = await tpaClaimsRepo.update(id, patch);
  await audit(actor, "update", "tpa-claim", id, patch);
  return toTpaClaimDTO(row as TpaClaimRow);
}

export async function deleteClaim(id: number, actor: Session) {
  const existing = await tpaClaimsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Claim");
  await tpaClaimsRepo.remove(id);
  await audit(actor, "delete", "tpa-claim", id);
}
