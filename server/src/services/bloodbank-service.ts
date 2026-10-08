/**
 * Blood bank service — donor registry, group-wise stock, and issue workflow.
 * Issuing blood decrements matching stock and raises a "Blood" bill.
 */
import {
  bloodDonorsRepo,
  bloodStockRepo,
  bloodIssuesRepo,
  patientsRepo,
} from "@/repositories";
import { createBill } from "@/services/billing-service";
import {
  toBloodDonorDTO,
  toBloodIssueDTO,
  toBloodStockDTO,
} from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES } from "@/db/tables";
import {
  type BloodDonorRow,
  type BloodIssueRow,
  type BloodStockRow,
} from "@/db/tables";
import { ConflictError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { optionalAadhaarRule } from "@/lib/field-rules";
import { displayDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
const COMPONENTS = ["Whole Blood", "Plasma", "Platelets", "RBC"] as const;

// ── Donors ──────────────────────────────────────────────────────────────────

const donorSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  age: { type: "number", required: true, min: 18, max: 65 },
  gender: { type: "enum", required: true, values: ["Male", "Female"] },
  bloodGroup: { type: "enum", required: true, values: BLOOD_GROUPS },
  phone: { type: "string", required: true, min: 7, max: 20 },
  aadhaarNumber: optionalAadhaarRule,
  lastDonationDate: { type: "string", required: false, max: 40, default: "" },
  totalDonations: { type: "number", required: false, min: 0, default: 0 },
  status: { type: "enum", required: false, values: ["Eligible", "Deferred"], default: "Eligible" },
} as const;

export const DONORS_LIST_CONFIG = {
  searchColumns: ["name", "phone", "blood_group"],
  filterable: ["status", "blood_group"],
  sortable: ["name", "last_donation_date", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listDonors(options: QueryOptions, actor: Session) {
  return bloodDonorsRepo.list(scopeToHospital(options, actor));
}

export async function getDonor(id: number, actor: Session) {
  const row = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Donor");
  return toBloodDonorDTO(row);
}

export async function createDonor(input: unknown, actor: Session) {
  const data = validate(donorSchema, input);
  const row = await bloodDonorsRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    age: data.age,
    gender: data.gender,
    blood_group: data.bloodGroup,
    phone: data.phone,
    aadhaar_number: data.aadhaarNumber ?? "",
    last_donation_date: data.lastDonationDate,
    total_donations: data.totalDonations,
    status: data.status,
  });
  await audit(actor, "create", "blood-donor", row.id);
  return toBloodDonorDTO(row as BloodDonorRow);
}

export async function updateDonor(id: number, input: unknown, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  const data = validatePartial(donorSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("age" in data) patch.age = data.age;
  if ("gender" in data) patch.gender = data.gender;
  if ("bloodGroup" in data) patch.blood_group = data.bloodGroup;
  if ("phone" in data) patch.phone = data.phone;
  if ("aadhaarNumber" in data) patch.aadhaar_number = data.aadhaarNumber;
  if ("lastDonationDate" in data) patch.last_donation_date = data.lastDonationDate;
  if ("totalDonations" in data) patch.total_donations = data.totalDonations;
  if ("status" in data) patch.status = data.status;
  const row = await bloodDonorsRepo.update(id, patch);
  await audit(actor, "update", "blood-donor", id, patch);
  return toBloodDonorDTO(row as BloodDonorRow);
}

export async function deleteDonor(id: number, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  await bloodDonorsRepo.remove(id);
  await audit(actor, "delete", "blood-donor", id);
}

/** Record a donation: bumps stock and the donor's history. */
export async function recordDonation(donorId: number, actor: Session) {
  const donor = await bloodDonorsRepo.getRow(donorId);
  assertOwnedByHospital(donor, actor, "Donor");
  await adjustStock(donor.blood_group, "Whole Blood", 1, actor);
  const row = await bloodDonorsRepo.update(donorId, {
    last_donation_date: displayDate(),
    total_donations: donor.total_donations + 1,
  });
  await audit(actor, "donate", "blood-donor", donorId);
  return toBloodDonorDTO(row as BloodDonorRow);
}

// ── Stock ───────────────────────────────────────────────────────────────────

export const STOCK_LIST_CONFIG = {
  searchColumns: ["blood_group", "component"],
  filterable: ["blood_group", "component"],
  sortable: ["blood_group", "units"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listStock(options: QueryOptions, actor: Session) {
  return bloodStockRepo.list(scopeToHospital(options, actor));
}

async function findStockRow(bloodGroup: string, component: string, actor: Session) {
  return bloodStockRepo.findRow([
    { column: "blood_group", op: "eq", value: bloodGroup },
    { column: "component", op: "eq", value: component },
    { column: "hospital_id", op: "eq", value: actor.hospitalId },
  ]);
}

/** Add (or subtract, with a negative delta) units for a group + component. */
async function adjustStock(bloodGroup: string, component: string, delta: number, actor: Session) {
  const existing = await findStockRow(bloodGroup, component, actor);
  if (existing) {
    const units = existing.units + delta;
    if (units < 0) {
      throw new ConflictError(
        `Insufficient ${component} stock for ${bloodGroup} (${existing.units} unit(s) left)`,
      );
    }
    return bloodStockRepo.update(existing.id, { units });
  }
  if (delta < 0) {
    throw new ConflictError(`No ${component} stock for ${bloodGroup}`);
  }
  return bloodStockRepo.create({
    hospital_id: actor.hospitalId,
    blood_group: bloodGroup,
    component,
    units: delta,
  });
}

const stockSchema = {
  bloodGroup: { type: "enum", required: true, values: BLOOD_GROUPS },
  component: { type: "enum", required: true, values: COMPONENTS },
  units: { type: "number", required: true, min: 1, max: 500 },
} as const;

/** Direct stock top-up (e.g. from an external blood bank). */
export async function addStock(input: unknown, actor: Session) {
  const data = validate(stockSchema, input);
  const row = await adjustStock(data.bloodGroup, data.component, data.units, actor);
  await audit(actor, "restock", "blood-stock", row?.id ?? 0, data);
  return toBloodStockDTO(row as BloodStockRow);
}

// ── Issues ──────────────────────────────────────────────────────────────────

const issueSchema = {
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: true, min: 2, max: 120 },
  bloodGroup: { type: "enum", required: true, values: BLOOD_GROUPS },
  component: { type: "enum", required: true, values: COMPONENTS },
  units: { type: "number", required: true, min: 1, max: 20 },
  doctor: { type: "string", required: false, max: 120, default: "" },
  amount: { type: "number", required: false, min: 0, default: 0 },
} as const;

export const ISSUES_LIST_CONFIG = {
  searchColumns: ["patient_name", "blood_group", "component"],
  filterable: ["status", "blood_group", "component"],
  sortable: ["issue_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listIssues(options: QueryOptions, actor: Session) {
  return bloodIssuesRepo.list(scopeToHospital(options, actor));
}

export async function createIssue(input: unknown, actor: Session) {
  const data = validate(issueSchema, input);
  let patientName = data.patientName;
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    if (p) patientName = p.name;
  }

  // Find the stock line first so the decrement and the issue record can be
  // written as one unit — units must never leave stock without a record.
  const stockLine = await bloodStockRepo.findRow([
    { column: "blood_group", op: "eq", value: data.bloodGroup },
    { column: "component", op: "eq", value: data.component },
    { column: "hospital_id", op: "eq", value: actor.hospitalId },
  ]);
  if (!stockLine || stockLine.units < data.units) {
    throw new ConflictError(
      `Only ${stockLine?.units ?? 0} unit(s) of ${data.component} (${data.bloodGroup}) in stock`,
    );
  }

  const row = await transactional("bloodbank.issue", async (uow) => {
    await uow.update(TABLES.bloodStock, stockLine.id, {
      units: stockLine.units - data.units,
    });
    return uow.insert<BloodIssueRow>(TABLES.bloodIssues, {
      hospital_id: actor.hospitalId,
      patient_id: data.patientId ?? null,
      patient_name: patientName,
      blood_group: data.bloodGroup,
      component: data.component,
      units: data.units,
      doctor: data.doctor,
      issue_date: displayDate(),
      amount: data.amount,
      status: "Issued",
    });
  });

  if ((data.amount ?? 0) > 0) {
    await createBill(
      {
        patientId: data.patientId,
        patientName,
        type: "Blood",
        amount: data.amount,
        status: "Pending",
      },
      actor,
    );
  }

  await audit(actor, "issue", "blood-issue", row.id, {
    bloodGroup: data.bloodGroup,
    component: data.component,
    units: data.units,
  });
  return toBloodIssueDTO(row as BloodIssueRow);
}

export async function updateIssue(id: number, input: unknown, actor: Session) {
  const existing = await bloodIssuesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Blood issue");
  const schema = {
    status: { type: "enum", required: false, values: ["Issued", "Pending", "Cancelled"] },
  } as const;
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  // Cancelling an issue returns the units to stock.
  if (data.status === "Cancelled" && existing.status !== "Cancelled") {
    await adjustStock(existing.blood_group, existing.component, existing.units, actor);
  }
  if ("status" in data) patch.status = data.status;
  const row = await bloodIssuesRepo.update(id, patch);
  await audit(actor, "update", "blood-issue", id, patch);
  return toBloodIssueDTO(row as BloodIssueRow);
}

export async function deleteIssue(id: number, actor: Session) {
  const existing = await bloodIssuesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Blood issue");
  await bloodIssuesRepo.remove(id);
  await audit(actor, "delete", "blood-issue", id);
}
