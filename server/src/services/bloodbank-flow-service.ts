/**
 * Blood bank — from a patient's request to the transfusion.
 *
 *   request cross-match ──▶ (unit held) ──▶ result: compatible | incompatible ──▶ issue ──▶ transfused | returned
 *
 * Requesting a cross-match reserves the unit: two requests for the same unit at once resolve to exactly one winner,
 * and the loser is told which cross-match holds it. An incompatible result, a cancel or a discard releases it.
 * Issuing needs a compatible result and a unit that is still in date.
 */
import { bloodUnitsRepo, bloodCrossmatchesRepo, bloodTransfusionsRepo, patientsRepo } from "@/repositories";
import { toBloodCrossmatchDTO, toBloodTransfusionDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional } from "@/db/unit-of-work";
import { TABLES, type BloodCrossmatchRow, type BloodTransfusionRow, type BloodUnitRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { abCompatible, RESTOCK_WINDOW_MIN, withUnitLocks } from "@/services/bloodbank-rules";

const yy = (iso: string) => iso.slice(2, 4);

// ── Cross-match ──────────────────────────────────────────────────────────────

export const CROSSMATCH_LIST_CONFIG = {
  searchColumns: ["xm_no", "patient_name", "patient_code", "unit_no"],
  filterable: ["status", "result", "patient_id"],
  sortable: ["requested_at", "id"],
  defaultSort: [{ column: "requested_at" as const, direction: "desc" as const }],
};

export async function listCrossmatches(options: QueryOptions, actor: Session) {
  return bloodCrossmatchesRepo.list(scopeToHospital(options, actor));
}

async function ownedXm(id: number, actor: Session): Promise<BloodCrossmatchRow> {
  const row = await bloodCrossmatchesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Cross-match");
  return row as BloodCrossmatchRow;
}

const requestSchema = {
  patientId: { type: "number", required: true, min: 1 },
  unitId: { type: "number", required: true, min: 1 },
} as const;

/** Reserve a unit for a patient and open the cross-match. */
export async function requestCrossmatch(input: unknown, actor: Session) {
  const data = validate(requestSchema, input);
  const hospitalId = requireHospitalId(actor);
  const patient = await patientsRepo.getRow(data.patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const unitRow = await bloodUnitsRepo.getRow(data.unitId);
  assertOwnedByHospital(unitRow, actor, "Unit");

  const created = await withUnitLocks([data.unitId], async () => {
    // Read again under the lock: whoever got here first has already changed the unit.
    const unit = await bloodUnitsRepo.getRow(data.unitId);
    if (!unit) throw new ConflictError("Unit not found");
    if (unit.status === "Cross-matched") {
      const { rows } = await bloodCrossmatchesRepo.listRows({ unpaged: true, filters: [{ column: "unit_id", op: "eq", value: unit.id }] });
      const holder = rows.find((x) => x.status === "requested" || x.status === "resulted");
      throw new ConflictError(`${unit.unit_no} is already held by cross-match ${holder?.xm_no ?? ""}${holder ? ` for ${holder.patient_name}` : ""}`.trim());
    }
    if (unit.status !== "Available") throw new ConflictError(`${unit.unit_no} is ${unit.status.toLowerCase()} — only an available unit can be cross-matched`);
    const today = localDate();
    if (unit.expiry_on < today) throw new ConflictError(`${unit.unit_no} expired on ${unit.expiry_on}`);
    const serologyDone = Object.values(unit.serology ?? {}).length === 5 && Object.values(unit.serology).every((v) => v === "Negative");
    if (!serologyDone) throw new ConflictError(`${unit.unit_no} hasn't cleared all five serology tests`);
    const fit = abCompatible(patient.blood_group, unit.blood_group, unit.component);
    if (!fit.ok) throw new ConflictError(fit.reason);

    const { rows } = await bloodCrossmatchesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const xmNo = nextCode(rows.map((r) => r.xm_no), `XM/${yy(today)}/`, 5);
    return transactional("bloodbank.crossmatch", async (uow) => {
      await uow.update(TABLES.bloodUnits, unit.id, { status: "Cross-matched" });
      return uow.insert<BloodCrossmatchRow>(TABLES.bloodCrossmatches, {
        hospital_id: hospitalId,
        xm_no: xmNo,
        patient_id: patient.id,
        patient_name: patient.name,
        patient_code: patient.patient_code,
        unit_id: unit.id,
        unit_no: unit.unit_no,
        unit_group: unit.blood_group,
        unit_component: unit.component,
        requested_at: new Date().toISOString(),
        requested_by: actor.name,
        result: "pending",
        result_by: null,
        result_at: null,
        status: "requested",
      });
    });
  });
  await audit(actor, "crossmatch-request", "blood-crossmatch", created.id, { unitId: data.unitId, patientId: data.patientId });
  return toBloodCrossmatchDTO(created as BloodCrossmatchRow);
}

/** Put a held unit back on the shelf, unless something else has since taken it. */
async function releaseUnit(unitId: number, uow: { update: (t: string, id: number, v: Record<string, unknown>) => Promise<unknown> }) {
  const unit = await bloodUnitsRepo.getRow(unitId);
  if (unit && unit.status === "Cross-matched") await uow.update(TABLES.bloodUnits, unitId, { status: "Available" });
}

/** Enter the result of the laboratory cross-match test. An incompatible result frees the unit at once. */
export async function recordCrossmatchResult(id: number, input: unknown, actor: Session) {
  const xm = await ownedXm(id, actor);
  const { result } = validate({ result: { type: "enum", required: true, values: ["compatible", "incompatible"] } } as const, input);
  const updated = await withUnitLocks([xm.unit_id], async () => {
    const fresh = await ownedXm(id, actor);
    if (fresh.status !== "requested") throw new ConflictError(`This cross-match is already ${fresh.status}`);
    return transactional("bloodbank.crossmatch-result", async (uow) => {
      if (result === "incompatible") await releaseUnit(fresh.unit_id, uow);
      return uow.update<BloodCrossmatchRow>(TABLES.bloodCrossmatches, id, { result, status: "resulted", result_by: actor.name, result_at: new Date().toISOString() });
    });
  });
  await audit(actor, "crossmatch-result", "blood-crossmatch", id, { result });
  return toBloodCrossmatchDTO(updated as BloodCrossmatchRow);
}

export async function cancelCrossmatch(id: number, actor: Session) {
  const xm = await ownedXm(id, actor);
  const updated = await withUnitLocks([xm.unit_id], async () => {
    const fresh = await ownedXm(id, actor);
    if (fresh.status !== "requested" && fresh.status !== "resulted") throw new ConflictError(`A ${fresh.status} cross-match can't be cancelled`);
    return transactional("bloodbank.crossmatch-cancel", async (uow) => {
      await releaseUnit(fresh.unit_id, uow);
      return uow.update<BloodCrossmatchRow>(TABLES.bloodCrossmatches, id, { status: "cancelled" });
    });
  });
  await audit(actor, "crossmatch-cancel", "blood-crossmatch", id);
  return toBloodCrossmatchDTO(updated as BloodCrossmatchRow);
}

/** Hand the cross-matched unit over: the unit leaves stock and a transfusion record is opened. */
export async function issueFromCrossmatch(id: number, actor: Session) {
  const xm = await ownedXm(id, actor);
  const today = localDate();
  const created = await withUnitLocks([xm.unit_id], async () => {
    const fresh = await ownedXm(id, actor);
    if (fresh.status === "issued") throw new ConflictError("This unit has already been issued");
    if (fresh.status !== "resulted" || fresh.result !== "compatible") throw new ConflictError("A compatible cross-match result is required before issuing");
    const unit = await bloodUnitsRepo.getRow(fresh.unit_id);
    if (!unit || unit.status !== "Cross-matched") throw new ConflictError("The unit is no longer held for this cross-match");
    if (unit.expiry_on < today) throw new ConflictError(`${unit.unit_no} has expired (${unit.expiry_on}) — cancel this cross-match and choose another unit`);
    const { rows } = await bloodTransfusionsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const issueNo = nextCode(rows.map((r) => r.issue_no), `BI/${yy(today)}/`, 5);
    return transactional("bloodbank.issue", async (uow) => {
      await uow.update(TABLES.bloodUnits, unit.id, { status: "Issued", left_on: today });
      await uow.update(TABLES.bloodCrossmatches, id, { status: "issued" });
      return uow.insert<BloodTransfusionRow>(TABLES.bloodTransfusions, {
        hospital_id: fresh.hospital_id,
        issue_no: issueNo,
        crossmatch_id: id,
        patient_id: fresh.patient_id,
        patient_name: fresh.patient_name,
        patient_code: fresh.patient_code,
        unit_id: unit.id,
        unit_no: unit.unit_no,
        unit_group: unit.blood_group,
        unit_component: unit.component,
        issued_at: new Date().toISOString(),
        issued_by: actor.name,
        transfused_at: null,
        transfused_by: null,
        disposition: "",
        returned_at: null,
        reactions: [],
      });
    });
  });
  await audit(actor, "issue", "blood-transfusion", created.id, { crossmatchId: id });
  return toBloodTransfusionDTO(created as BloodTransfusionRow);
}

// ── Issues and transfusions ──────────────────────────────────────────────────

export const TRANSFUSION_LIST_CONFIG = {
  searchColumns: ["issue_no", "patient_name", "patient_code", "unit_no"],
  filterable: ["patient_id", "unit_id"],
  sortable: ["issued_at", "id"],
  defaultSort: [{ column: "issued_at" as const, direction: "desc" as const }],
};

export async function listTransfusions(options: QueryOptions, actor: Session) {
  return bloodTransfusionsRepo.list(scopeToHospital(options, actor));
}

async function ownedIssue(id: number, actor: Session): Promise<BloodTransfusionRow> {
  const row = await bloodTransfusionsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Issue");
  return row as BloodTransfusionRow;
}

const isOpen = (t: BloodTransfusionRow) => !t.transfused_at && !t.disposition;

export async function markTransfused(id: number, actor: Session) {
  const issue = await ownedIssue(id, actor);
  if (!isOpen(issue)) throw new ConflictError(issue.transfused_at ? "This transfusion is already recorded as done" : "This unit was returned");
  const row = await bloodTransfusionsRepo.update(id, { transfused_at: new Date().toISOString(), transfused_by: actor.name });
  await audit(actor, "transfused", "blood-transfusion", id);
  return toBloodTransfusionDTO(row as BloodTransfusionRow);
}

/**
 * A unit that came back unused. If it is back inside the cold-chain window and the caller says it is intact it may go
 * back on the shelf; otherwise it is discarded as wastage.
 */
export async function returnIssuedUnit(id: number, input: unknown, actor: Session) {
  const issue = await ownedIssue(id, actor);
  const { restock } = validate({ restock: { type: "boolean", required: false, default: false } } as const, input);
  const minutes = (Date.now() - new Date(issue.issued_at).getTime()) / 60_000;
  if (restock && minutes > RESTOCK_WINDOW_MIN) {
    throw new ConflictError(`It left the blood bank ${Math.round(minutes)} minutes ago — beyond the ${RESTOCK_WINDOW_MIN}-minute window, so it must be discarded`);
  }
  const today = localDate();
  const row = await withUnitLocks([issue.unit_id], async () => {
    const fresh = await ownedIssue(id, actor);
    if (!isOpen(fresh)) throw new ConflictError(fresh.transfused_at ? "This unit was already transfused" : "This unit was already returned");
    return transactional("bloodbank.return", async (uow) => {
      await uow.update<BloodUnitRow>(
        TABLES.bloodUnits,
        fresh.unit_id,
        restock
          ? { status: "Available", left_on: null }
          : { status: "Discarded", left_on: today, discard_reason: "Returned unused — outside window", discarded_by: actor.name },
      );
      return uow.update<BloodTransfusionRow>(TABLES.bloodTransfusions, id, {
        disposition: restock ? "returned · restock" : "returned · wasted",
        returned_at: new Date().toISOString(),
      });
    });
  });
  await audit(actor, "return", "blood-transfusion", id, { restock });
  return toBloodTransfusionDTO(row as BloodTransfusionRow);
}

export const REACTION_KINDS = [
  "Febrile non-haemolytic",
  "Allergic / urticarial",
  "Acute haemolytic",
  "Delayed haemolytic",
  "TRALI",
  "TACO (circulatory overload)",
  "Bacterial contamination",
  "Anaphylaxis",
  "Other",
] as const;

const reactionSchema = {
  kind: { type: "enum", required: true, values: REACTION_KINDS },
  severity: { type: "enum", required: true, values: ["Mild", "Moderate", "Severe"] },
  note: { type: "string", required: false, max: 500, default: "" },
} as const;

/** Record a transfusion reaction against an issue. It stays on the record whatever happened to the unit. */
export async function recordReaction(id: number, input: unknown, actor: Session) {
  const issue = await ownedIssue(id, actor);
  const data = validate(reactionSchema, input);
  if (data.kind === "Other" && !data.note.trim()) throw new ValidationError([{ field: "note", message: "describe the reaction" }]);
  const reaction = { at: new Date().toISOString(), by: actor.name, kind: data.kind, severity: data.severity, note: data.note.trim() };
  const row = await bloodTransfusionsRepo.update(id, { reactions: [...(issue.reactions ?? []), reaction] });
  await audit(actor, "reaction", "blood-transfusion", id, { kind: data.kind, severity: data.severity });
  return toBloodTransfusionDTO(row as BloodTransfusionRow);
}
