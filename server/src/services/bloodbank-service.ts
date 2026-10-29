/**
 * Blood bank — donors and the units of blood and components collected from them.
 *
 * A unit is one bag (or one component) tracked from collection to transfusion or discard:
 *   collected → Quarantined → (all five serology tests negative) → Available → Cross-matched → Issued
 * Any reactive serology result discards the unit, and every component made from the same donation. Whole blood can
 * be processed into PRBC, platelets and plasma; each keeps its own shelf life. Cross-matching and issue are in
 * bloodbank-flow-service.ts, the printed registers in bloodbank-registers.ts.
 *
 * Donor ID proofs are PHI: only the type and the last four characters are ever stored.
 */
import { bloodDonorsRepo, bloodUnitsRepo, bloodCrossmatchesRepo } from "@/repositories";
import { toBloodDonorDTO, toBloodUnitDTO, DONATION_GAP_DAYS } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES, type BloodDonorRow, type BloodUnitRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import {
  BLOOD_GROUPS,
  COMPONENT_RULES,
  COMPONENT_LIST,
  DISCARD_REASONS,
  SEPARABLE,
  withUnitLocks,
} from "@/services/bloodbank-rules";
import {
  DONOR_ID_PROOFS,
  SEROLOGY_TESTS,
  type BloodComponent,
  type BloodStockSummaryDTO,
  type SerologyDTO,
} from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const yy = (iso: string) => iso.slice(2, 4);

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

// ── Donors ───────────────────────────────────────────────────────────────────

const donorSchema = {
  name: { type: "string", required: true, min: 2, max: 120 },
  gender: { type: "enum", required: true, values: ["Male", "Female", "Other"] },
  bloodGroup: { type: "enum", required: true, values: BLOOD_GROUPS },
  dob: { type: "string", required: true, pattern: ISO_DAY },
  phone: { type: "string", required: true, min: 7, max: 20, pattern: /^[+\d][\d\s-]{5,18}$/ },
  idProofType: { type: "enum", required: false, values: DONOR_ID_PROOFS },
  // Four characters at most: the full number must never reach the server's storage.
  idProofLast4: { type: "string", required: false, pattern: /^[A-Za-z0-9]{4}$/ },
} as const;

export const DONORS_LIST_CONFIG = {
  searchColumns: ["name", "phone", "donor_no", "blood_group"],
  filterable: ["status", "blood_group", "gender"],
  sortable: ["name", "last_donation_date", "created_at", "id"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listDonors(options: QueryOptions, actor: Session) {
  return bloodDonorsRepo.list(scopeToHospital(options, actor));
}

export async function getDonor(id: number, actor: Session) {
  const row = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Donor");
  return toBloodDonorDTO(row);
}

function checkDonorAge(dob: string, today: string) {
  const age = Math.floor(daysBetween(dob, today) / 365.25);
  if (Number.isNaN(age) || age < 18) throw new ValidationError([{ field: "dob", message: "a donor must be at least 18" }]);
  if (age > 65) throw new ValidationError([{ field: "dob", message: "a donor must be 65 or under" }]);
  return age;
}

function checkIdProof(type: string | undefined, last4: string | undefined) {
  if (Boolean(type) !== Boolean(last4)) {
    throw new ValidationError([{ field: type ? "idProofLast4" : "idProofType", message: "give both the ID type and its last 4 characters, or neither" }]);
  }
}

export async function registerDonor(input: unknown, actor: Session) {
  const data = validate(donorSchema, input);
  const hospitalId = requireHospitalId(actor);
  const today = localDate();
  const age = checkDonorAge(data.dob, today);
  checkIdProof(data.idProofType, data.idProofLast4);
  const { rows } = await bloodDonorsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const row = await bloodDonorsRepo.create({
    hospital_id: hospitalId,
    donor_no: await nextNumber("blood_donor", actor, rows.map((r) => r.donor_no ?? ""), { prefix: `BD/${yy(today)}/`, pad: 5 }),
    name: data.name,
    age,
    gender: data.gender,
    blood_group: data.bloodGroup,
    phone: data.phone,
    dob: data.dob,
    id_proof_type: data.idProofType ?? "",
    id_proof_last4: data.idProofLast4 ?? "",
    last_donation_date: "",
    total_donations: 0,
    status: "Eligible",
    deferral_reason: "",
    deferred_until: null,
  });
  await audit(actor, "register", "blood-donor", row.id);
  return toBloodDonorDTO(row as BloodDonorRow);
}

export async function updateDonor(id: number, input: unknown, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  const data = validatePartial(donorSchema, input);
  const patch: Record<string, unknown> = {};
  if ("name" in data) patch.name = data.name;
  if ("gender" in data) patch.gender = data.gender;
  if ("phone" in data) patch.phone = data.phone;
  if ("dob" in data) { patch.dob = data.dob; patch.age = checkDonorAge(data.dob as string, localDate()); }
  if ("bloodGroup" in data && data.bloodGroup !== existing.blood_group) {
    const { total } = await bloodUnitsRepo.listRows(scopeToHospital({ pageSize: 1, filters: [{ column: "donor_id", op: "eq", value: id }] }, actor));
    if (total > 0) throw new ConflictError("This donor already has units on record, so their blood group can't be changed");
    patch.blood_group = data.bloodGroup;
  }
  const raw = (input ?? {}) as Record<string, unknown>;
  if ("idProofType" in raw || "idProofLast4" in raw) {
    const type = "idProofType" in raw ? data.idProofType : (existing.id_proof_type || undefined);
    const last4 = "idProofLast4" in raw ? data.idProofLast4 : (existing.id_proof_last4 || undefined);
    checkIdProof(type, last4);
    patch.id_proof_type = type ?? "";
    patch.id_proof_last4 = last4 ?? "";
    patch.aadhaar_number = ""; // any old full number is dropped the moment the proof is re-entered the safe way
  }
  const row = await bloodDonorsRepo.update(id, patch);
  await audit(actor, "update", "blood-donor", id, { fields: Object.keys(patch) });
  return toBloodDonorDTO(row as BloodDonorRow);
}

const deferSchema = {
  reason: { type: "string", required: true, min: 3, max: 300 },
  until: { type: "string", required: false, pattern: ISO_DAY },
} as const;

/** Stop a donor donating — for a stated reason, until a date or until someone lifts it. */
export async function deferDonor(id: number, input: unknown, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  const data = validate(deferSchema, input);
  if (data.until && data.until <= localDate()) throw new ValidationError([{ field: "until", message: "must be a future date" }]);
  const row = await bloodDonorsRepo.update(id, { status: "Deferred", deferral_reason: data.reason, deferred_until: data.until ?? null });
  await audit(actor, "defer", "blood-donor", id, { reason: data.reason, until: data.until ?? null });
  return toBloodDonorDTO(row as BloodDonorRow);
}

export async function liftDonorDeferral(id: number, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  const row = await bloodDonorsRepo.update(id, { status: "Eligible", deferral_reason: "", deferred_until: null });
  await audit(actor, "lift-deferral", "blood-donor", id);
  return toBloodDonorDTO(row as BloodDonorRow);
}

export async function deleteDonor(id: number, actor: Session) {
  const existing = await bloodDonorsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Donor");
  const { total } = await bloodUnitsRepo.listRows(scopeToHospital({ pageSize: 1, filters: [{ column: "donor_id", op: "eq", value: id }] }, actor));
  if (total > 0) throw new ConflictError("This donor has units on record (traceability), so they can't be deleted");
  await bloodDonorsRepo.remove(id);
  await audit(actor, "delete", "blood-donor", id);
}

// ── Units ────────────────────────────────────────────────────────────────────

const collectSchema = {
  source: { type: "enum", required: false, values: ["Donation", "Purchased"], default: "Donation" },
  donorId: { type: "number", required: false, min: 1 },
  supplier: { type: "string", required: false, max: 120, default: "" },
  bloodGroup: { type: "enum", required: true, values: BLOOD_GROUPS },
  component: { type: "enum", required: false, values: COMPONENT_LIST, default: "Whole blood" },
  volumeMl: { type: "number", required: false, min: 5, max: 1000 },
  bagNo: { type: "string", required: false, max: 40, default: "" },
} as const;

export const UNITS_LIST_CONFIG = {
  searchColumns: ["unit_no", "blood_group", "component", "bag_no", "donor_no"],
  filterable: ["status", "blood_group", "component", "source"],
  sortable: ["id", "collected_on", "expiry_on"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listUnits(options: QueryOptions, actor: Session) {
  return bloodUnitsRepo.list(scopeToHospital(options, actor));
}

export async function getUnit(id: number, actor: Session) {
  const row = await bloodUnitsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Unit");
  return toBloodUnitDTO(row);
}

async function nextUnitNo(actor: Session, date: string): Promise<string> {
  const { rows } = await bloodUnitsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  return nextCode(rows.map((r) => r.unit_no), `BU/${yy(date)}/`, 5);
}

const emptySerology = (): SerologyDTO => ({ hiv: "", hbsag: "", hcv: "", malaria: "", syphilis: "" });

/** Collect a unit from a donor, or receive a purchased one. It starts in quarantine until all five tests are clear. */
export async function collectUnit(input: unknown, actor: Session) {
  const data = validate(collectSchema, input);
  const hospitalId = requireHospitalId(actor);
  const today = localDate();
  const component = data.component as BloodComponent;
  const rules = COMPONENT_RULES[component];

  let donor: BloodDonorRow | null = null;
  if (data.source === "Donation") {
    if (!data.donorId) throw new ValidationError([{ field: "donorId", message: "pick the donor" }]);
    donor = await bloodDonorsRepo.getRow(data.donorId);
    assertOwnedByHospital(donor, actor, "Donor");
    const d = toBloodDonorDTO(donor);
    if (d.status === "Deferred") throw new ConflictError(`${d.name} is deferred${d.deferralReason ? ` (${d.deferralReason})` : ""} and can't donate`);
    if (d.nextEligibleOn && d.nextEligibleOn > today) {
      const gap = String(donor.gender).toLowerCase() === "female" ? DONATION_GAP_DAYS.female : DONATION_GAP_DAYS.male;
      throw new ConflictError(`${d.name} gave blood on ${d.lastDonationDate}; donors wait ${gap} days — next eligible ${d.nextEligibleOn}`);
    }
    if (donor.blood_group !== data.bloodGroup) {
      throw new ValidationError([{ field: "bloodGroup", message: `doesn't match the donor's recorded group (${donor.blood_group})` }]);
    }
  } else if (!data.supplier?.trim()) {
    throw new ValidationError([{ field: "supplier", message: "say where the purchased unit came from" }]);
  }
  if (data.bagNo) {
    const { total } = await bloodUnitsRepo.listRows(scopeToHospital({ pageSize: 1, filters: [{ column: "bag_no", op: "eq", value: data.bagNo }] }, actor));
    if (total > 0) throw new ConflictError(`Bag number ${data.bagNo} is already on record`);
  }

  const unitNo = await nextUnitNo(actor, today);
  const created = await transactional("bloodbank.collect", async (uow) => {
    const row = await uow.insert<BloodUnitRow>(TABLES.bloodUnits, {
      hospital_id: hospitalId,
      unit_no: unitNo,
      source: data.source,
      donor_id: donor?.id ?? null,
      donor_no: donor ? toBloodDonorDTO(donor).donorNo : "",
      supplier: data.supplier ?? "",
      bag_no: data.bagNo,
      blood_group: data.bloodGroup,
      component,
      volume_ml: data.volumeMl ?? rules.defaultVolumeMl,
      collected_on: today,
      expiry_on: addDays(today, rules.shelfDays),
      serology: emptySerology(),
      serology_by: null,
      serology_on: null,
      status: "Quarantined",
      root_unit_id: null,
      parent_unit_id: null,
      left_on: null,
      discard_reason: "",
      discarded_by: null,
      created_by: actor.name,
    });
    const withRoot = await uow.update<BloodUnitRow>(TABLES.bloodUnits, row.id, { root_unit_id: row.id });
    if (donor) {
      await uow.update(TABLES.bloodDonors, donor.id, { total_donations: Number(donor.total_donations ?? 0) + 1, last_donation_date: today });
    }
    return withRoot;
  });
  if (!created) throw new ConflictError("The unit could not be recorded");
  await audit(actor, "collect", "blood-unit", created.id, { unitNo, source: data.source });
  return toBloodUnitDTO(created as BloodUnitRow);
}

const serologySchema = Object.fromEntries(
  SEROLOGY_TESTS.map((t) => [t.key, { type: "enum", required: true, values: ["Negative", "Reactive"] }]),
) as Record<(typeof SEROLOGY_TESTS)[number]["key"], { type: "enum"; required: true; values: string[] }>;

/**
 * Record the five mandatory tests for a unit in quarantine. All negative → available. Any reactive → the unit is
 * discarded, and so is every other quarantined unit from the same donation (its components).
 */
export async function recordSerology(id: number, input: unknown, actor: Session) {
  const unit = await bloodUnitsRepo.getRow(id);
  assertOwnedByHospital(unit, actor, "Unit");
  const data = validate(serologySchema, input) as unknown as SerologyDTO;
  const result = await withUnitLocks([id], async () => {
    const fresh = await bloodUnitsRepo.getRow(id);
    if (!fresh || fresh.status !== "Quarantined") throw new ConflictError("Only a unit in quarantine can have serology recorded");
    const root = fresh.root_unit_id ?? fresh.id;
    const { rows } = await bloodUnitsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "root_unit_id", op: "eq", value: root }] }, actor));
    const group = rows.filter((r) => r.status === "Quarantined");
    const reactive = SEROLOGY_TESTS.filter((t) => data[t.key] === "Reactive").map((t) => t.label);
    const today = localDate();
    await transactional("bloodbank.serology", async (uow) => {
      for (const u of group) {
        await uow.update(TABLES.bloodUnits, u.id, reactive.length
          ? { serology: data, serology_by: actor.name, serology_on: today, status: "Discarded", left_on: today, discard_reason: `Reactive serology: ${reactive.join(", ")}`, discarded_by: actor.name }
          : { serology: data, serology_by: actor.name, serology_on: today, status: "Available" });
      }
    });
    return { reactive, count: group.length };
  });
  await audit(actor, "serology", "blood-unit", id, { reactive: result.reactive, units: result.count });
  return getUnit(id, actor);
}

/** Separate a whole blood unit into components; the parent is closed and each product gets its own unit and shelf life. */
export async function processUnit(id: number, input: unknown, actor: Session) {
  const raw = (input ?? {}) as { components?: unknown };
  const wanted = (Array.isArray(raw.components) ? raw.components : ["PRBC", "Platelets", "Plasma"]).map(String);
  if (wanted.length === 0 || !wanted.every((c) => c in SEPARABLE)) {
    throw new ValidationError([{ field: "components", message: `choose from ${Object.keys(SEPARABLE).join(", ")}` }]);
  }
  const unit = await bloodUnitsRepo.getRow(id);
  assertOwnedByHospital(unit, actor, "Unit");
  const today = localDate();
  const kids = await withUnitLocks([id], async () => {
    const parent = await bloodUnitsRepo.getRow(id);
    if (!parent) throw new ConflictError("Unit not found");
    if (parent.component !== "Whole blood") throw new ConflictError("Only whole blood can be processed into components");
    if (parent.status !== "Quarantined" && parent.status !== "Available") throw new ConflictError(`A ${parent.status.toLowerCase()} unit can't be processed`);
    if (parent.expiry_on < today) throw new ConflictError("This unit has expired and can't be processed");
    const { rows: existing } = await bloodUnitsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    let counter = existing.map((r) => r.unit_no);
    const made: BloodUnitRow[] = [];
    await transactional("bloodbank.process", async (uow) => {
      for (const component of wanted) {
        const unitNo = nextCode(counter, `BU/${yy(today)}/`, 5);
        counter = [...counter, unitNo];
        const rules = COMPONENT_RULES[component as BloodComponent];
        made.push(await uow.insert<BloodUnitRow>(TABLES.bloodUnits, {
          hospital_id: parent.hospital_id,
          unit_no: unitNo,
          source: parent.source,
          donor_id: parent.donor_id,
          donor_no: parent.donor_no,
          supplier: parent.supplier,
          bag_no: "",
          blood_group: parent.blood_group,
          component,
          volume_ml: SEPARABLE[component](Number(parent.volume_ml)),
          collected_on: parent.collected_on,
          expiry_on: addDays(parent.collected_on, rules.shelfDays),
          serology: parent.serology,
          serology_by: parent.serology_by,
          serology_on: parent.serology_on,
          // A product made from a cleared unit is usable at once; from one still in quarantine, it waits too.
          status: parent.status,
          root_unit_id: parent.root_unit_id ?? parent.id,
          parent_unit_id: parent.id,
          left_on: null,
          discard_reason: "",
          discarded_by: null,
          created_by: actor.name,
        }));
      }
      await uow.update(TABLES.bloodUnits, parent.id, { status: "Processed", left_on: today });
    });
    return made;
  });
  await audit(actor, "process", "blood-unit", id, { into: wanted });
  return kids.map((k) => toBloodUnitDTO(k));
}

const discardSchema = {
  reason: { type: "enum", required: true, values: DISCARD_REASONS },
  note: { type: "string", required: false, max: 300, default: "" },
} as const;

/** Take a unit out of stock for a recorded reason. A cross-matched unit also releases its cross-match. */
export async function discardUnit(id: number, input: unknown, actor: Session) {
  const unit = await bloodUnitsRepo.getRow(id);
  assertOwnedByHospital(unit, actor, "Unit");
  const data = validate(discardSchema, input);
  if (data.reason === "Other" && !data.note.trim()) throw new ValidationError([{ field: "note", message: "say why" }]);
  const today = localDate();
  await withUnitLocks([id], async () => {
    const fresh = await bloodUnitsRepo.getRow(id);
    if (!fresh) throw new ConflictError("Unit not found");
    if (!["Quarantined", "Available", "Cross-matched"].includes(fresh.status)) throw new ConflictError(`A ${fresh.status.toLowerCase()} unit can't be discarded`);
    await transactional("bloodbank.discard", async (uow) => {
      if (fresh.status === "Cross-matched") {
        const { rows } = await bloodCrossmatchesRepo.listRows({ unpaged: true, filters: [{ column: "unit_id", op: "eq", value: id }] });
        for (const xm of rows.filter((x) => x.status === "requested" || x.status === "resulted")) {
          await uow.update(TABLES.bloodCrossmatches, xm.id, { status: "cancelled" });
        }
      }
      await uow.update(TABLES.bloodUnits, id, {
        status: "Discarded",
        left_on: today,
        discard_reason: data.note.trim() ? `${data.reason}: ${data.note.trim()}` : data.reason,
        discarded_by: actor.name,
      });
    });
  });
  await audit(actor, "discard", "blood-unit", id, { reason: data.reason });
  return getUnit(id, actor);
}

// ── Stock ────────────────────────────────────────────────────────────────────

/** Usable units per ABO × Rh group, with how many expire inside a week. */
export async function stockSummary(actor: Session): Promise<BloodStockSummaryDTO> {
  const { rows } = await bloodUnitsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const today = localDate();
  const groups = BLOOD_GROUPS.map((bloodGroup) => ({ bloodGroup, available: 0, expiringSoon: 0, byComponent: {} as Record<string, number> }));
  const by = new Map(groups.map((g) => [g.bloodGroup as string, g]));
  let quarantined = 0;
  let expiredInStock = 0;
  for (const r of rows) {
    if (r.status === "Quarantined") quarantined++;
    if (r.status !== "Available") continue;
    if (r.expiry_on < today) { expiredInStock++; continue; }
    const g = by.get(r.blood_group);
    if (!g) continue;
    g.available++;
    if (daysBetween(today, r.expiry_on) <= 7) g.expiringSoon++;
    g.byComponent[r.component] = (g.byComponent[r.component] ?? 0) + 1;
  }
  return { groups, quarantined, expiredInStock };
}
