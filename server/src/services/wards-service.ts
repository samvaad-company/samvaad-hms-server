/**
 * Wards service — ward inventory management for the beds board.
 * Wards are managed under the "beds" RBAC resource.
 */
import { wardsRepo, bedsRepo } from "@/repositories";
import { type WardRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";
import { assertMasterId, effectivePrice, listSetup } from "@/services/setup-service";
import { pickPlan } from "@/services/billing-catalog-service";
import { localDate } from "@/lib/clock";

const schema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  capacity: { type: "number", required: false, min: 0, default: 0 },
  dailyRate: { type: "number", required: false, min: 0, default: 0 },
} as const;

/** Facility areas a ward can sit in. */
const WARD_AREA_TYPES = ["Ward", "ICU", "Emergency", "Other"];

interface WardContext {
  classes: Map<number, string>;
  areas: Map<number, string>;
  /** Catalogue bed-charge price per ward class, from the hospital's default rate plan. */
  catalogue: Map<number, { price: number; service: string }>;
}

async function wardContext(actor: Session): Promise<WardContext> {
  const [classes, areas, services, plans] = await Promise.all([listSetup("ward_class", actor), listSetup("facility_area", actor), listSetup("service", actor, { activeOnly: true }), listSetup("rate_plan", actor)]);
  const plan = pickPlan(plans, null, localDate());
  const catalogue = new Map<number, { price: number; service: string }>();
  for (const svc of services) {
    const cls = svc.data.wardClassId;
    if (cls == null || catalogue.has(Number(cls))) continue;
    catalogue.set(Number(cls), { price: plan ? effectivePrice(plan, plans, svc, "general") : Number(svc.data.price ?? 0), service: svc.name });
  }
  return { classes: new Map(classes.map((c) => [c.id, c.name])), areas: new Map(areas.map((a) => [a.id, a.name])), catalogue };
}

/** A ward's bed rate: the rate set on the ward, else the catalogue's bed charge for its class. */
function bedRate(w: WardRow, ctx: WardContext): { rate: number; source: "ward" | "catalogue" | "none"; service: string } {
  const own = Number(w.daily_rate ?? 0);
  if (own > 0) return { rate: own, source: "ward", service: "" };
  const hit = w.ward_class_id != null ? ctx.catalogue.get(Number(w.ward_class_id)) : undefined;
  return hit && hit.price > 0 ? { rate: hit.price, source: "catalogue", service: hit.service } : { rate: 0, source: "none", service: "" };
}

function toWardDTO(w: WardRow, ctx: WardContext) {
  const rate = bedRate(w, ctx);
  return {
    id: w.id, name: w.name, capacity: Number(w.capacity ?? 0), dailyRate: rate.rate, ownRate: Number(w.daily_rate ?? 0), rateSource: rate.source, rateService: rate.service,
    wardClassId: w.ward_class_id ?? null, wardClass: w.ward_class_id != null ? ctx.classes.get(Number(w.ward_class_id)) ?? "" : "",
    facilityAreaId: w.facility_area_id ?? null, facilityArea: w.facility_area_id != null ? ctx.areas.get(Number(w.facility_area_id)) ?? "" : "",
  };
}

/** ₹/day by ward name (what the bed cards show), for the beds service. */
export async function bedRatesByWard(actor: Session): Promise<Map<string, number>> {
  const [{ rows }, ctx] = await Promise.all([wardsRepo.listRows(scopeToHospital({ unpaged: true }, actor)), wardContext(actor)]);
  return new Map((rows as WardRow[]).map((w) => [w.name, bedRate(w, ctx).rate]));
}

/** The class and area a ward is filed under, from the submitted ids (null or blank clears one). */
async function placement(input: unknown, existing: WardRow | null, actor: Session): Promise<Record<string, number | null>> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  for (const [key, column, kind] of [["wardClassId", "ward_class_id", "ward_class"], ["facilityAreaId", "facility_area_id", "facility_area"]] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === null || v === "" || v === 0) { out[column] = null; continue; }
    const id = Number(v);
    if (!Number.isInteger(id) || id < 1) throw new ValidationError([{ field: key, message: "pick one from the list" }]);
    const rec = await assertMasterId(kind, id, actor, key, existing?.[column] ?? null);
    if (kind === "facility_area" && !WARD_AREA_TYPES.includes(String(rec.data.type)) && existing?.facility_area_id !== id) {
      throw new ValidationError([{ field: key, message: `${rec.name} is a ${String(rec.data.type).toLowerCase()} area — pick a ward, ICU or emergency area` }]);
    }
    out[column] = id;
  }
  return out;
}

export async function listWards(actor: Session) {
  const [{ rows }, ctx] = await Promise.all([
    wardsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor)),
    wardContext(actor),
  ]);
  return (rows as WardRow[]).map((w) => toWardDTO(w, ctx));
}

export async function createWard(input: unknown, actor: Session) {
  const data = validate(schema, input);
  const existing = await wardsRepo.findRow([
    { column: "name", op: "eq", value: data.name },
    { column: "hospital_id", op: "eq", value: actor.hospitalId },
  ]);
  if (existing) throw new ConflictError(`Ward "${data.name}" already exists`);
  const where = await placement(input, null, actor);
  const row = await wardsRepo.create({
    hospital_id: actor.hospitalId,
    name: data.name,
    capacity: data.capacity ?? 0,
    daily_rate: data.dailyRate ?? 0,
    ward_class_id: where.ward_class_id ?? null,
    facility_area_id: where.facility_area_id ?? null,
  });
  await audit(actor, "create", "ward", row.id);
  return toWardDTO(row as WardRow, await wardContext(actor));
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
  if ("dailyRate" in data) patch.daily_rate = data.dailyRate;
  Object.assign(patch, await placement(input, existing as WardRow, actor));
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
  return toWardDTO(row as WardRow, await wardContext(actor));
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
