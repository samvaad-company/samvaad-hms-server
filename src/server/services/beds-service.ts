/**
 * Beds service — ward bed inventory, occupancy, and status management.
 */
import { bedsRepo, wardsRepo } from "@/server/repositories";
import { toBedDTO } from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import { type BedRow } from "@/server/db/tables";
import { NotFoundError, ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";

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

export async function listBeds(options: QueryOptions) {
  return bedsRepo.list(options);
}

/** Beds grouped by ward, with occupancy summary — drives the wards board. */
export async function listBedsByWard() {
  const [beds, wards] = await Promise.all([
    bedsRepo.listRows({ unpaged: true, sort: [{ column: "bed_number", direction: "asc" }] }),
    wardsRepo.listRows({ unpaged: true }),
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
      beds: wardBeds.map(toBedDTO),
    };
  });
}

export async function getBed(id: number) {
  const b = await bedsRepo.get(id);
  if (!b) throw new NotFoundError("Bed");
  return b;
}

export async function createBed(input: unknown, actor: Session) {
  const data = validate(schema, input);
  let wardId: number | null = data.wardId ?? null;
  if (!wardId) {
    const ward = await wardsRepo.findRow([{ column: "name", op: "eq", value: data.ward }]);
    wardId = ward?.id ?? null;
  }
  const row = await bedsRepo.create({
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
  if (!existing) throw new NotFoundError("Bed");
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
  const ok = await bedsRepo.remove(id);
  if (!ok) throw new NotFoundError("Bed");
  await audit(actor, "delete", "bed", id);
}
