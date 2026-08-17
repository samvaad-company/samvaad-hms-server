/**
 * Wards service — ward inventory management for the beds board.
 * Wards are managed under the "beds" RBAC resource.
 */
import { wardsRepo, bedsRepo } from "@/server/repositories";
import { type WardRow } from "@/server/db/tables";
import { ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

const schema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  capacity: { type: "number", required: false, min: 0, default: 0 },
} as const;

function toWardDTO(w: WardRow) {
  return { id: w.id, name: w.name, capacity: Number(w.capacity ?? 0) };
}

export async function listWards(actor: Session) {
  const { rows } = await wardsRepo.listRows(
    scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor),
  );
  return rows.map(toWardDTO);
}

export async function createWard(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const existing = await wardsRepo.findRow([
    { column: "name", op: "eq", value: data.name },
    { column: "hospital_id", op: "eq", value: actor.hospitalId },
  ]);
  if (existing) throw new ConflictError(`Ward "${data.name}" already exists`);
  const row = await wardsRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    capacity: data.capacity ?? 0,
  });
  await audit(actor, "create", "ward", row.id);
  return toWardDTO(row as WardRow);
}

export async function updateWard(id: number, input: unknown, actor: Session) {
  const existing = await wardsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ward");
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data && data.name) {
    const dupe = await wardsRepo.findRow([
      { column: "name", op: "eq", value: data.name },
      { column: "hospital_id", op: "eq", value: actor.hospitalId },
    ]);
    if (dupe && dupe.id !== id) {
      throw new ConflictError(`Ward "${data.name}" already exists`);
    }
    patch.name = data.name;
  }
  if ("capacity" in data) patch.capacity = data.capacity;
  const row = await wardsRepo.update(id, patch);

  // Renaming a ward cascades to its beds' denormalized ward label.
  if (patch.name && patch.name !== existing.name) {
    const { rows: beds } = await bedsRepo.listRows({
      unpaged: true,
      filters: [{ column: "ward_id", op: "eq", value: id }],
    });
    for (const bed of beds) {
      await bedsRepo.update(bed.id, { ward: patch.name });
    }
  }

  await audit(actor, "update", "ward", id, patch);
  return toWardDTO(row as WardRow);
}

export async function deleteWard(id: number, actor: Session) {
  const existing = await wardsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ward");
  const { rows: beds } = await bedsRepo.listRows({
    unpaged: true,
    filters: [{ column: "ward_id", op: "eq", value: id }],
  });
  if (beds.length > 0) {
    throw new ConflictError(
      `Ward "${existing.name}" still has ${beds.length} bed(s) — remove them first`,
    );
  }
  await wardsRepo.remove(id);
  await audit(actor, "delete", "ward", id);
}
