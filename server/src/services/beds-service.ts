/**
 * Beds service — ward bed inventory, occupancy, and status management.
 */
import {
  bedsRepo,
  wardsRepo,
  patientsRepo,
  ipdRepo,
  bedTransfersRepo,
} from "@/repositories";
import { toBedDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type BedRow, type BedTransferRow } from "@/db/tables";
import { ConflictError, BadRequestError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { displayDate } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { bedRatesByWard } from "@/services/wards-service";

const schema = {
  bedNumber: { type: "string", required: true, max: 20 },
  ward: { type: "string", required: true, max: 80 },
  wardId: { type: "number", required: false },
  status: {
    type: "enum",
    required: false,
    values: ["Available", "Occupied", "Reserved", "Maintenance"],
    default: "Available",
  },
} as const;

export const BEDS_LIST_CONFIG = {
  searchColumns: ["bed_number", "ward", "patient_name", "patient_code"],
  filterable: ["status", "ward"],
  sortable: ["ward", "bed_number"],
  defaultSort: [
    { column: "ward" as const, direction: "asc" as const },
    { column: "bed_number" as const, direction: "asc" as const },
  ],
};

export async function listBeds(options: QueryOptions, actor: Session) {
  const [res, rates] = await Promise.all([bedsRepo.list(scopeToHospital(options, actor)), bedRatesByWard(actor)]);
  return { ...res, rows: res.rows.map((b) => ({ ...b, dailyRate: rates.get(b.ward) ?? 0 })) };
}

/** Beds grouped by ward, with occupancy summary — drives the wards board. */
export async function listBedsByWard(actor: Session) {
  const [beds, wards, rates] = await Promise.all([
    bedsRepo.listRows(
      scopeToHospital(
        { unpaged: true, sort: [{ column: "bed_number", direction: "asc" }] },
        actor,
      ),
    ),
    wardsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    bedRatesByWard(actor),
  ]);

  const groups = new Map<string, BedRow[]>();
  for (const bed of beds.rows) {
    if (!groups.has(bed.ward)) groups.set(bed.ward, []);
    groups.get(bed.ward)!.push(bed);
  }

  return Array.from(groups.entries()).map(([ward, wardBeds]) => {
    const counts = { Available: 0, Occupied: 0, Reserved: 0, Maintenance: 0 };
    for (const b of wardBeds) counts[b.status as keyof typeof counts]++;
    return {
      ward,
      wardId: wards.rows.find((w) => w.name === ward)?.id ?? null,
      total: wardBeds.length,
      counts,
      beds: wardBeds.map((b) => ({ ...toBedDTO(b), dailyRate: rates.get(ward) ?? 0 })),
    };
  });
}

export async function getBed(id: number, actor: Session) {
  const row = await bedsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Bed");
  return toBedDTO(row);
}

export async function createBed(input: unknown, actor: Session) {
  const data = validate(schema, input);
  let wardId: number | null = data.wardId ?? null;
  if (!wardId) {
    const ward = await wardsRepo.findRow([
      { column: "name", op: "eq", value: data.ward },
      { column: "hospital_id", op: "eq", value: actor.hospitalId },
    ]);
    wardId = ward?.id ?? null;
  }
  const row = await bedsRepo.create({
    hospital_id: actor.hospitalId,
    bed_number: data.bedNumber,
    ward_id: wardId,
    ward: data.ward,
    patient_id: null,
    patient_name: null,
    patient_code: null,
    status: data.status,
  });
  await audit(actor, "create", "bed", row.id);
  return toBedDTO(row as BedRow);
}

export async function updateBed(id: number, input: unknown, actor: Session) {
  const existing = await bedsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bed");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("bedNumber" in data) patch.bed_number = data.bedNumber;
  if ("ward" in data) patch.ward = data.ward;
  if ("status" in data) {
    patch.status = data.status;
    // Freeing a bed clears its occupant.
    if (data.status === "Available") {
      if (existing.status === "Occupied") {
        throw new ConflictError(
          "Discharge the patient before marking an occupied bed available",
        );
      }
      patch.patient_id = null;
      patch.patient_name = null;
      patch.patient_code = null;
    }
  }
  const row = await bedsRepo.update(id, patch);
  await audit(actor, "update", "bed", id, patch);
  return toBedDTO(row as BedRow);
}

export async function deleteBed(id: number, actor: Session) {
  const existing = await bedsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Bed");
  if (existing.status === "Occupied") {
    throw new ConflictError("Discharge the patient before deleting an occupied bed");
  }
  await bedsRepo.remove(id);
  await audit(actor, "delete", "bed", id);
}

// ─── Occupancy operations ────────────────────────────────────────────────────

const assignSchema = {
  patientId: { type: "number", required: false, min: 1 },
  patientName: { type: "string", required: false, max: 120 },
} as const;

/** Active (non-discharged) IPD admission occupying a bed, if any. */
async function activeAdmissionForBed(bedId: number) {
  return ipdRepo.findRow([
    { column: "bed_id", op: "eq", value: bedId },
    { column: "status", op: "neq", value: "Discharged" },
  ]);
}

/** Put a patient in a free bed directly from the beds board. */
export async function assignBed(id: number, input: unknown, actor: Session) {
  const bed = await bedsRepo.getRow(id);
  assertOwnedByHospital(bed, actor, "Bed");
  if (bed.status === "Occupied") {
    throw new ConflictError(`Bed ${bed.bed_number} is already occupied`);
  }
  if (bed.status === "Maintenance") {
    throw new ConflictError(`Bed ${bed.bed_number} is under maintenance`);
  }

  const data = validate(assignSchema, input);
  let patientId: number | null = null;
  let patientName = data.patientName?.trim() ?? "";
  let patientCode = "";
  if (data.patientId) {
    const p = await patientsRepo.getRow(data.patientId);
    assertOwnedByHospital(p, actor, "Patient");
    patientId = p.id;
    patientName = p.name;
    patientCode = p.patient_code;
  }
  if (!patientName) {
    throw new BadRequestError("Select a patient or enter a patient name");
  }

  const row = await bedsRepo.update(id, {
    status: "Occupied",
    patient_id: patientId,
    patient_name: patientName,
    patient_code: patientCode || null,
  });
  await audit(actor, "assign", "bed", id, { patientId, patientName });
  return toBedDTO(row as BedRow);
}

/** Free an occupied bed; discharges the linked IPD admission if one exists. */
export async function releaseBed(id: number, actor: Session) {
  const bed = await bedsRepo.getRow(id);
  assertOwnedByHospital(bed, actor, "Bed");
  if (bed.status !== "Occupied") {
    throw new ConflictError(`Bed ${bed.bed_number} is not occupied`);
  }

  const admission = await activeAdmissionForBed(id);
  if (admission) {
    await ipdRepo.update(admission.id, { status: "Discharged" });
  }

  const row = await bedsRepo.update(id, {
    status: "Available",
    patient_id: null,
    patient_name: null,
    patient_code: null,
  });
  await audit(actor, "release", "bed", id, {
    dischargedAdmission: admission?.id ?? null,
  });
  return toBedDTO(row as BedRow);
}

const transferSchema = {
  toBedId: { type: "number", required: true, min: 1 },
  reason: { type: "string", required: false, max: 240, default: "" },
} as const;

/** Move a bed's occupant to another free bed, logging the transfer. */
export async function transferBedOccupant(id: number, input: unknown, actor: Session) {
  const data = validate(transferSchema, input);
  const source = await bedsRepo.getRow(id);
  assertOwnedByHospital(source, actor, "Bed");
  if (source.status !== "Occupied") {
    throw new ConflictError(`Bed ${source.bed_number} has no occupant to transfer`);
  }
  if (data.toBedId === id) {
    throw new BadRequestError("Patient is already in that bed");
  }
  const target = await bedsRepo.getRow(data.toBedId);
  assertOwnedByHospital(target, actor, "Target bed");
  if (target.status === "Occupied") {
    throw new ConflictError(`Bed ${target.bed_number} is already occupied`);
  }
  if (target.status === "Maintenance") {
    throw new ConflictError(`Bed ${target.bed_number} is under maintenance`);
  }

  await bedsRepo.update(target.id, {
    status: "Occupied",
    patient_id: source.patient_id,
    patient_name: source.patient_name,
    patient_code: source.patient_code,
  });
  await bedsRepo.update(source.id, {
    status: "Available",
    patient_id: null,
    patient_name: null,
    patient_code: null,
  });

  // Keep the IPD admission pointing at the right bed.
  const admission = await activeAdmissionForBed(id);
  if (admission) {
    await ipdRepo.update(admission.id, {
      bed_id: target.id,
      bed: target.bed_number,
      ward: target.ward,
      ward_id: target.ward_id,
    });
  }

  await bedTransfersRepo.create({
    hospital_id: actor.hospitalId,
    patient_name: source.patient_name ?? "Unknown",
    from_label: `${source.ward} · ${source.bed_number}`,
    to_label: `${target.ward} · ${target.bed_number}`,
    transfer_date: displayDate(),
    reason: data.reason ?? "",
    status: "Completed",
  });

  await audit(actor, "transfer", "bed", id, { to: target.id });
  return toBedDTO((await bedsRepo.getRow(target.id)) as BedRow);
}

export async function listBedTransfers(actor: Session) {
  const { rows } = await bedTransfersRepo.listRows(
    scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "desc" }] }, actor),
  );
  return rows.map((t: BedTransferRow) => ({
    id: t.id,
    patientName: t.patient_name,
    from: t.from_label,
    to: t.to_label,
    date: t.transfer_date,
    reason: t.reason,
    status: t.status,
  }));
}
