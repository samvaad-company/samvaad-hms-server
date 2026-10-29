/**
 * CSSD — central sterile services. Instrument sets go round a loop and are only ever issued when sterile:
 *
 *   register ─▶ Dirty ──pack──▶ Packed ──start cycle──▶ In cycle ──pass──▶ Sterile ──issue──▶ Issued ──return──▶ Dirty
 *                  ▲                                         │                │ (past its date: "Expired sterility")
 *                  └──────────── fail ───────────────────────┘                └──reprocess──▶ Packed
 *
 * A passed cycle can be quarantined (recalled): its sets that are still on the shelf go back to Dirty, and any already
 * out are flagged to investigate when they come back. A chamber runs one cycle at a time, a set is in one cycle or one
 * issue at a time, and two people reaching for the same set are handled one after the other.
 *
 * How long a set stays sterile comes from the method × packaging table (defaults in `types/cssd.ts`, changeable in
 * Settings). Issuing a set to a patient posts its usage charge as a pending OPD / IPD bill.
 */
import {
  cssdSetsRepo, cssdCyclesRepo, cssdIssuesRepo, cssdSterilizersRepo, cssdSettingsRepo,
  departmentsRepo, patientsRepo, ipdRepo, otRepo,
} from "@/repositories";
import { transactional } from "@/db/unit-of-work";
import { TABLES, type CssdCycleRow, type CssdIssueRow, type CssdSetRow, type CssdSettingsRow, type CssdSterilizerRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { createBill } from "@/services/billing-service";
import { addDays } from "@/services/mrd-files-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import {
  DEFAULT_CYCLE, DEFAULT_ISSUE_HOURS, DEFAULT_SHELF_LIFE, DEFAULT_STERILIZERS, PACKAGING, SET_TYPES, STERILIZATION_METHODS,
  type Packaging, type SterilizationMethod,
} from "@shared/types/cssd";
import type { CssdCaseDTO, CssdCycleDTO, CssdIssueDTO, CssdSetDTO, CssdSetStatus, CssdShelfLifeDTO, CssdSterilizerDTO, CssdSummaryDTO } from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

const yy = (iso: string) => iso.slice(2, 4);
const setKey = (id: number) => `cssd-set:${id}`;
const daysBetween = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

// ── DTOs ─────────────────────────────────────────────────────────────────────

function toSetDto(r: CssdSetRow, today: string): CssdSetDTO {
  const sterile = r.status === "Sterile" && !!r.sterile_until;
  const left = sterile ? daysBetween(today, r.sterile_until!) : null;
  const status: CssdSetStatus = sterile && left! < 0 ? "Expired sterility" : (r.status as CssdSetStatus);
  return {
    id: r.id, setNo: r.set_no, name: r.name, type: r.type, departmentId: r.department_id ?? null, departmentName: r.department_name ?? "",
    instruments: r.instruments ?? [], usageCharge: Number(r.usage_charge ?? 0), status, packaging: r.packaging ?? null,
    sterileUntil: r.sterile_until ?? null, daysLeft: left, timesProcessed: Number(r.times_processed ?? 0),
  };
}

function toCycleDto(r: CssdCycleRow, setNos: string[]): CssdCycleDTO {
  return {
    id: r.id, cycleNo: r.cycle_no, sterilizerId: r.sterilizer_id, sterilizerName: r.sterilizer_name, method: r.method, startedAt: r.started_at,
    load: (r.set_ids ?? []).length, setNos, tempC: r.temp_c, pressurePsi: r.pressure_psi, exposureMin: r.exposure_min,
    indicator: r.indicator as CssdCycleDTO["indicator"], status: r.status as CssdCycleDTO["status"], startedBy: r.started_by,
    resultBy: r.result_by ?? null, resultAt: r.result_at ?? null, note: r.note ?? "",
  };
}

function toIssueDto(r: CssdIssueRow, now = Date.now()): CssdIssueDTO {
  return {
    id: r.id, issueNo: r.issue_no ?? null, setId: r.set_id, setNo: r.set_no, setName: r.set_name, patientId: r.patient_id ?? null,
    patientName: r.patient_name ?? "", departmentName: r.department_name ?? "", caseLabel: r.case_label ?? "", status: r.status as CssdIssueDTO["status"],
    requestedAt: r.requested_at, requestedBy: r.requested_by ?? "", issuedAt: r.issued_at ?? null, expectedBack: r.expected_back ?? null,
    overdue: r.status === "Issued" && !!r.expected_back && new Date(r.expected_back).getTime() < now,
    returnedAt: r.returned_at ?? null, investigate: !!r.investigate, returnNote: r.return_note ?? "", charge: Number(r.charge ?? 0), billNumber: r.bill_number ?? null,
  };
}

const toSterilizerDto = (r: CssdSterilizerRow, running: Set<number>): CssdSterilizerDTO =>
  ({ id: r.id, name: r.name, method: r.method, location: r.location ?? "", active: r.active !== false, running: running.has(r.id) });

// ── Sterilizers ──────────────────────────────────────────────────────────────

/** A hospital that has never used CSSD starts with the usual six chambers; they are ordinary rows afterwards. */
function ensureSterilizers(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`cssd-sterilizers:${hospitalId}`, async () => {
    const existing = await cssdSterilizersRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    for (const s of DEFAULT_STERILIZERS) await cssdSterilizersRepo.create({ hospital_id: hospitalId, ...s, active: true });
  });
}

async function runningSterilizers(actor: Session): Promise<Set<number>> {
  const { rows } = await cssdCyclesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Running" }] }, actor));
  return new Set(rows.map((r) => r.sterilizer_id));
}

export async function listSterilizers(actor: Session): Promise<CssdSterilizerDTO[]> {
  await ensureSterilizers(actor);
  const [{ rows }, running] = await Promise.all([
    cssdSterilizersRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor)),
    runningSterilizers(actor),
  ]);
  return rows.map((r) => toSterilizerDto(r, running));
}

const sterilizerSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  method: { type: "enum", required: true, values: STERILIZATION_METHODS },
  location: { type: "string", required: false, max: 80, default: "" },
  active: { type: "boolean", required: false, default: true },
} as const;

async function assertSterilizerNameFree(name: string, actor: Session, exceptId?: number) {
  const { rows } = await cssdSterilizersRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  if (rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase())) throw new ConflictError(`A sterilizer called "${name}" already exists`);
}

export async function createSterilizer(input: unknown, actor: Session) {
  const data = validate(sterilizerSchema, input);
  await ensureSterilizers(actor);
  await assertSterilizerNameFree(data.name, actor);
  const row = await cssdSterilizersRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, method: data.method, location: data.location, active: data.active });
  await audit(actor, "create", "cssd-sterilizer", row.id);
  return toSterilizerDto(row as CssdSterilizerRow, new Set());
}

export async function updateSterilizer(id: number, input: unknown, actor: Session) {
  const existing = await cssdSterilizersRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Sterilizer");
  const data = validatePartial(sterilizerSchema, input);
  const patch: Record<string, unknown> = {};
  for (const k of ["method", "location", "active"] as const) if (k in data) patch[k] = data[k];
  if ("name" in data && data.name !== existing!.name) { await assertSterilizerNameFree(data.name as string, actor, id); patch.name = data.name; }
  const row = await withKeyLocks([`cssd-sterilizer:${id}`], async () => {
    const running = await runningSterilizers(actor);
    if (running.has(id) && ("method" in patch || patch.active === false)) throw new ConflictError(`${existing!.name} is running a cycle — record its result first`);
    return cssdSterilizersRepo.update(id, patch);
  });
  await audit(actor, "update", "cssd-sterilizer", id, patch);
  return toSterilizerDto(row as CssdSterilizerRow, await runningSterilizers(actor));
}

// ── Settings: how long a set stays sterile ───────────────────────────────────

async function settingsRow(actor: Session): Promise<CssdSettingsRow | null> {
  const { rows } = await cssdSettingsRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
  return (rows[0] as CssdSettingsRow | undefined) ?? null;
}

export async function getShelfLife(actor: Session): Promise<CssdShelfLifeDTO> {
  const overrides = (await settingsRow(actor))?.shelf_life ?? {};
  const days: CssdShelfLifeDTO["days"] = {};
  const overridden: CssdShelfLifeDTO["overridden"] = {};
  for (const m of STERILIZATION_METHODS) {
    days[m] = {}; overridden[m] = {};
    for (const p of PACKAGING) {
      const o = overrides[m]?.[p];
      days[m][p] = typeof o === "number" ? o : DEFAULT_SHELF_LIFE[m][p];
      overridden[m][p] = typeof o === "number";
    }
  }
  return { days, overridden };
}

/** { method, packaging, days } sets one cell; `days: null` (or blank) puts it back to the default. */
export async function setShelfLife(input: unknown, actor: Session): Promise<CssdShelfLifeDTO> {
  const body = (input ?? {}) as Record<string, unknown>;
  const { method, packaging } = validate({ method: { type: "enum", required: true, values: STERILIZATION_METHODS }, packaging: { type: "enum", required: true, values: PACKAGING } } as const, body);
  const blank = body.days == null || body.days === "";
  const n = Number(body.days);
  if (!blank && !(Number.isInteger(n) && n >= 1 && n <= 3650)) throw new ValidationError([{ field: "days", message: "must be a whole number of days, 1 to 3650" }]);
  await withKeyLocks([`cssd-settings:${requireHospitalId(actor)}`], async () => {
    const row = await settingsRow(actor);
    const next: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(row?.shelf_life ?? {}));
    next[method] = next[method] ?? {};
    if (blank) delete next[method][packaging]; else next[method][packaging] = n;
    if (Object.keys(next[method]).length === 0) delete next[method];
    if (row) await cssdSettingsRepo.update(row.id, { shelf_life: next });
    else await cssdSettingsRepo.create({ hospital_id: requireHospitalId(actor), shelf_life: next });
  });
  await audit(actor, "update", "cssd-settings", 0, { method, packaging, days: blank ? null : n });
  return getShelfLife(actor);
}

// ── Sets ─────────────────────────────────────────────────────────────────────

export async function listSets(actor: Session): Promise<CssdSetDTO[]> {
  const today = localDate();
  const { rows } = await cssdSetsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "set_no", direction: "asc" }] }, actor));
  return (rows as CssdSetRow[]).map((r) => toSetDto(r, today));
}

async function ownedSet(id: number, actor: Session): Promise<CssdSetRow> {
  const row = await cssdSetsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Set");
  return row as CssdSetRow;
}

/** "Forceps x 4" per line → [{ name: "Forceps", qty: 4 }]; a line with no count is one. */
export function parseInstruments(raw: unknown): { name: string; qty: number }[] {
  if (raw == null || raw === "") return [];
  const lines = (Array.isArray(raw) ? raw.map(String) : String(raw).split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 120) throw new ValidationError([{ field: "instruments", message: "at most 120 lines" }]);
  return lines.map((line) => {
    const m = /^(.*?)\s*[x×*]\s*(\d{1,3})$/i.exec(line);
    const name = (m ? m[1] : line).trim().slice(0, 80);
    const qty = m ? Number(m[2]) : 1;
    if (!name) throw new ValidationError([{ field: "instruments", message: `"${line}" has no instrument name` }]);
    if (qty < 1) throw new ValidationError([{ field: "instruments", message: `"${line}" needs a count of at least 1` }]);
    return { name, qty };
  });
}

const setSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  type: { type: "enum", required: false, values: SET_TYPES, default: "Surgical" },
  departmentId: { type: "number", required: false, min: 1 },
  usageCharge: { type: "number", required: false, min: 0, max: 1_000_000, default: 0 },
} as const;

/** Register a new instrument set. Its lifetime number (CS-00009) is minted here and it starts Dirty. */
export async function registerSet(input: unknown, actor: Session): Promise<CssdSetDTO> {
  const data = validate(setSchema, input);
  const instruments = parseInstruments((input as Record<string, unknown> | null)?.instruments);
  let departmentName = "";
  if (data.departmentId != null) {
    const dept = await departmentsRepo.getRow(data.departmentId);
    assertOwnedByHospital(dept, actor, "Department");
    departmentName = dept!.name;
  }
  const hospitalId = requireHospitalId(actor);
  const row = await withKeyLocks([`cssd-numbers:${hospitalId}`], async () => {
    const { rows } = await cssdSetsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    return cssdSetsRepo.create({
      hospital_id: hospitalId, set_no: nextCode(rows.map((r) => r.set_no), "CS-", 5), name: data.name, type: data.type,
      department_id: data.departmentId ?? null, department_name: departmentName, instruments, usage_charge: data.usageCharge,
      status: "Dirty", packaging: null, sterile_until: null, last_cycle_id: null, times_processed: 0,
    });
  });
  await audit(actor, "register", "cssd-set", row.id, { setNo: (row as CssdSetRow).set_no });
  return toSetDto(row as CssdSetRow, localDate());
}

/** Wrap a dirty (cleaned) set: it is then Packed and waits for a cycle. */
export async function packSet(id: number, input: unknown, actor: Session): Promise<CssdSetDTO> {
  await ownedSet(id, actor);
  const { packaging } = validate({ packaging: { type: "enum", required: true, values: PACKAGING } } as const, input);
  const row = await withKeyLocks([setKey(id)], async () => {
    const s = await ownedSet(id, actor);
    if (s.status !== "Dirty") throw new ConflictError(`${s.set_no} is ${toSetDto(s, localDate()).status.toLowerCase()} — only a dirty set is packed`);
    return cssdSetsRepo.update(id, { status: "Packed", packaging });
  });
  await audit(actor, "pack", "cssd-set", id, { packaging });
  return toSetDto(row as CssdSetRow, localDate());
}

/** A set whose sterility has run out goes back to Packed to go through another cycle (same packaging). */
export async function reprocessSet(id: number, actor: Session): Promise<CssdSetDTO> {
  await ownedSet(id, actor);
  const today = localDate();
  const row = await withKeyLocks([setKey(id)], async () => {
    const s = await ownedSet(id, actor);
    if (toSetDto(s, today).status !== "Expired sterility") throw new ConflictError(`${s.set_no} hasn't expired — only a set past its sterility date is reprocessed`);
    return cssdSetsRepo.update(id, { status: "Packed", sterile_until: null });
  });
  await audit(actor, "reprocess", "cssd-set", id);
  return toSetDto(row as CssdSetRow, today);
}

// ── Cycles ───────────────────────────────────────────────────────────────────

const CYCLE_RANK: Record<string, number> = { Running: 0, Passed: 1, Failed: 1, Quarantined: 1 };

export async function listCycles(actor: Session): Promise<CssdCycleDTO[]> {
  const [{ rows }, { rows: sets }] = await Promise.all([
    cssdCyclesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "started_at", direction: "desc" }] }, actor)),
    cssdSetsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const no = new Map(sets.map((s) => [s.id, s.set_no]));
  return (rows as CssdCycleRow[])
    .sort((a, b) => (CYCLE_RANK[a.status] - CYCLE_RANK[b.status]) || (a.started_at < b.started_at ? 1 : -1))
    .map((r) => toCycleDto(r, (r.set_ids ?? []).map((id) => no.get(id) ?? `#${id}`)));
}

const cycleSchema = {
  sterilizerId: { type: "number", required: true, min: 1 },
  tempC: { type: "number", required: false, min: 30, max: 200, default: DEFAULT_CYCLE.tempC },
  pressurePsi: { type: "number", required: false, min: 0, max: 80, default: DEFAULT_CYCLE.pressurePsi },
  exposureMin: { type: "number", required: false, min: 1, max: 960, default: DEFAULT_CYCLE.exposureMin },
} as const;

/** Load packed sets into a chamber and start a cycle. One cycle runs in a chamber at a time. */
export async function startCycle(input: unknown, actor: Session): Promise<CssdCycleDTO> {
  const data = validate(cycleSchema, input);
  const raw = (input as Record<string, unknown> | null)?.setIds;
  const setIds = [...new Set((Array.isArray(raw) ? raw : []).map(Number))];
  if (setIds.length === 0 || setIds.length > 60 || setIds.some((n) => !Number.isInteger(n) || n < 1)) throw new ValidationError([{ field: "setIds", message: "load between 1 and 60 packed sets" }]);
  await ensureSterilizers(actor);
  const sterilizer = await cssdSterilizersRepo.getRow(data.sterilizerId);
  assertOwnedByHospital(sterilizer, actor, "Sterilizer");
  if (!sterilizer!.active) throw new ConflictError(`${sterilizer!.name} is switched off`);
  const hospitalId = requireHospitalId(actor);
  const { today, at } = { today: localDate(), at: new Date().toISOString() };

  const created = await withKeyLocks([`cssd-sterilizer:${sterilizer!.id}`, `cssd-numbers:${hospitalId}`, ...setIds.map(setKey)], async () => {
    const { rows: running } = await cssdCyclesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "sterilizer_id", op: "eq", value: sterilizer!.id }, { column: "status", op: "eq", value: "Running" }] }, actor));
    if (running[0]) throw new ConflictError(`${sterilizer!.name} is already running cycle ${running[0].cycle_no}`);
    const sets: CssdSetRow[] = [];
    for (const id of setIds) {
      const s = await ownedSet(id, actor);
      if (s.status !== "Packed") throw new ConflictError(`${s.set_no} is ${toSetDto(s, today).status.toLowerCase()} — only packed sets can be loaded`);
      sets.push(s);
    }
    const { rows: all } = await cssdCyclesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const cycleNo = await nextNumber("cssd_cycle", actor, all.map((r) => r.cycle_no), { prefix: `CC/${yy(today)}/`, pad: 5 });
    return transactional("cssd.cycle-start", async (uow) => {
      const cycle = await uow.insert<CssdCycleRow>(TABLES.cssdCycles, {
        hospital_id: hospitalId, cycle_no: cycleNo, sterilizer_id: sterilizer!.id, sterilizer_name: sterilizer!.name, method: sterilizer!.method,
        started_at: at, started_by: actor.name, set_ids: sets.map((s) => s.id), temp_c: data.tempC, pressure_psi: data.pressurePsi, exposure_min: data.exposureMin,
        indicator: "pending", status: "Running", result_by: null, result_at: null, note: "",
      });
      for (const s of sets) await uow.update(TABLES.cssdSets, s.id, { status: "In cycle", last_cycle_id: cycle.id });
      return { cycle, sets };
    });
  });
  await audit(actor, "start-cycle", "cssd-cycle", created.cycle.id, { cycleNo: created.cycle.cycle_no, load: created.sets.length });
  return toCycleDto(created.cycle as CssdCycleRow, created.sets.map((s) => s.set_no));
}

async function ownedCycle(id: number, actor: Session): Promise<CssdCycleRow> {
  const row = await cssdCyclesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Cycle");
  return row as CssdCycleRow;
}

async function shelfDays(method: string, packaging: string | null, actor: Session): Promise<number> {
  const life = await getShelfLife(actor);
  return life.days[method]?.[packaging ?? "Pouched"] ?? 30;
}

/** Enter the indicator result. A pass makes the load Sterile until its shelf-life date; a fail sends it back to Dirty. */
export async function recordResult(id: number, input: unknown, actor: Session): Promise<CssdCycleDTO> {
  const first = await ownedCycle(id, actor);
  const { indicator, note } = validate({ indicator: { type: "enum", required: true, values: ["pass", "fail"] }, note: { type: "string", required: false, max: 200, default: "" } } as const, input);
  const today = localDate();
  const result = await withKeyLocks([`cssd-cycle:${id}`, ...(first.set_ids ?? []).map(setKey)], async () => {
    const c = await ownedCycle(id, actor);
    if (c.status !== "Running") throw new ConflictError(`Cycle ${c.cycle_no} is already ${c.status.toLowerCase()}`);
    const sets = (await Promise.all((c.set_ids ?? []).map((sid) => cssdSetsRepo.getRow(sid)))).filter((s): s is CssdSetRow => !!s && s.status === "In cycle" && s.last_cycle_id === c.id);
    const lives = new Map<number, number>();
    if (indicator === "pass") for (const s of sets) lives.set(s.id, await shelfDays(c.method, s.packaging, actor));
    return transactional("cssd.cycle-result", async (uow) => {
      const row = await uow.update<CssdCycleRow>(TABLES.cssdCycles, id, { indicator, status: indicator === "pass" ? "Passed" : "Failed", result_by: actor.name, result_at: new Date().toISOString(), note });
      for (const s of sets) {
        await uow.update(TABLES.cssdSets, s.id, indicator === "pass"
          ? { status: "Sterile", sterile_until: addDays(today, lives.get(s.id) ?? 30), times_processed: Number(s.times_processed ?? 0) + 1 }
          : { status: "Dirty", packaging: null, sterile_until: null });
      }
      return { row: row as CssdCycleRow, sets };
    });
  });
  await audit(actor, "cycle-result", "cssd-cycle", id, { indicator });
  return toCycleDto(result.row, result.sets.map((s) => s.set_no));
}

/** Recall a passed cycle: its sets still on the shelf go back to Dirty; any already issued are flagged to investigate on return. */
export async function quarantineCycle(id: number, input: unknown, actor: Session): Promise<CssdCycleDTO> {
  const first = await ownedCycle(id, actor);
  const { reason } = validate({ reason: { type: "string", required: true, min: 3, max: 200 } } as const, input);
  const result = await withKeyLocks([`cssd-cycle:${id}`, ...(first.set_ids ?? []).map(setKey)], async () => {
    const c = await ownedCycle(id, actor);
    if (c.status !== "Passed") throw new ConflictError(`Only a passed cycle can be quarantined — ${c.cycle_no} is ${c.status.toLowerCase()}`);
    const sets = (await Promise.all((c.set_ids ?? []).map((sid) => cssdSetsRepo.getRow(sid)))).filter((s): s is CssdSetRow => !!s && s.last_cycle_id === c.id);
    const { rows: issues } = await cssdIssuesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "status", op: "eq", value: "Issued" }] }, actor));
    return transactional("cssd.cycle-quarantine", async (uow) => {
      const row = await uow.update<CssdCycleRow>(TABLES.cssdCycles, id, { status: "Quarantined", note: reason });
      for (const s of sets) {
        if (s.status === "Sterile") await uow.update(TABLES.cssdSets, s.id, { status: "Dirty", packaging: null, sterile_until: null });
        if (s.status === "Issued") for (const i of issues.filter((x) => x.set_id === s.id)) await uow.update(TABLES.cssdIssues, i.id, { investigate: true, return_note: `Cycle ${c.cycle_no} was quarantined: ${reason}` });
      }
      return { row: row as CssdCycleRow, sets };
    });
  });
  await audit(actor, "quarantine", "cssd-cycle", id, { reason });
  return toCycleDto(result.row, result.sets.map((s) => s.set_no));
}

// ── Requests, issues, returns ────────────────────────────────────────────────

const ISSUE_RANK: Record<string, number> = { Requested: 0, Issued: 1, Returned: 2, Cancelled: 3 };

export async function listIssues(actor: Session): Promise<CssdIssueDTO[]> {
  const { rows } = await cssdIssuesRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "desc" }] }, actor));
  const now = Date.now();
  return (rows as CssdIssueRow[]).sort((a, b) => (ISSUE_RANK[a.status] - ISSUE_RANK[b.status]) || b.id - a.id).map((r) => toIssueDto(r, now));
}

async function ownedIssue(id: number, actor: Session): Promise<CssdIssueRow> {
  const row = await cssdIssuesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Request");
  return row as CssdIssueRow;
}

const requestSchema = {
  setId: { type: "number", required: true, min: 1 },
  departmentId: { type: "number", required: false, min: 1 },
  caseId: { type: "number", required: false, min: 1 },
  patientId: { type: "number", required: false, min: 1 },
} as const;

/** Ask CSSD for a set. A set has at most one live request / issue; it is fulfilled (issued) once it is sterile. */
export async function requestSet(input: unknown, actor: Session): Promise<CssdIssueDTO> {
  const data = validate(requestSchema, input);
  const set = await ownedSet(data.setId, actor);
  let departmentName = "";
  if (data.departmentId != null) { const d = await departmentsRepo.getRow(data.departmentId); assertOwnedByHospital(d, actor, "Department"); departmentName = d!.name; }
  let patientId: number | null = null, patientName = "", caseLabel = "", caseId: number | null = null;
  if (data.caseId != null) {
    const c = await otRepo.getRow(data.caseId);
    assertOwnedByHospital(c, actor, "Surgical case");
    caseId = c!.id; patientId = c!.patient_id ?? null; patientName = c!.patient_name;
    caseLabel = `${c!.surgery_name || c!.procedure} · ${c!.scheduled_date}`;
  } else if (data.patientId != null) {
    const p = await patientsRepo.getRow(data.patientId);
    assertOwnedByHospital(p, actor, "Patient");
    patientId = p!.id; patientName = p!.name;
  }
  const created = await withKeyLocks([setKey(set.id), `cssd-numbers:${set.hospital_id}`], async () => {
    const { rows: live } = await cssdIssuesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "set_id", op: "eq", value: set.id }] }, actor));
    const open = live.find((i) => i.status === "Requested" || i.status === "Issued");
    if (open) throw new ConflictError(`${set.set_no} already has a ${open.status === "Issued" ? `live issue${open.patient_name ? ` to ${open.patient_name}` : ""}` : `request${open.patient_name ? ` for ${open.patient_name}` : ""}`}`);
    return cssdIssuesRepo.create({
      hospital_id: requireHospitalId(actor), issue_no: null, set_id: set.id, set_no: set.set_no, set_name: set.name, patient_id: patientId, patient_name: patientName,
      department_name: departmentName || set.department_name, case_id: caseId, case_label: caseLabel, status: "Requested", requested_at: new Date().toISOString(), requested_by: actor.name,
      issued_at: null, issued_by: null, expected_back: null, returned_at: null, returned_by: null, investigate: false, return_note: "", charge: Number(set.usage_charge ?? 0), bill_number: null,
    });
  });
  await audit(actor, "request", "cssd-issue", created.id, { setNo: set.set_no });
  return toIssueDto(created as CssdIssueRow);
}

/** Fulfil a request: the set must be sterile and in date. The issue number is minted and the usage charge posts to the patient's bill. */
export async function issueSet(id: number, input: unknown, actor: Session): Promise<CssdIssueDTO> {
  const first = await ownedIssue(id, actor);
  const { hours } = validate({ hours: { type: "number", required: false, min: 1, max: 168, default: DEFAULT_ISSUE_HOURS } } as const, input ?? {});
  const today = localDate();
  const now = new Date();
  const issued = await withKeyLocks([setKey(first.set_id), `cssd-issue:${id}`, `cssd-numbers:${first.hospital_id}`], async () => {
    const issue = await ownedIssue(id, actor);
    if (issue.status !== "Requested") throw new ConflictError(`This request is already ${issue.status.toLowerCase()}`);
    const set = await ownedSet(issue.set_id, actor);
    const view = toSetDto(set, today);
    if (view.status === "Expired sterility") throw new ConflictError(`${set.set_no} expired on ${set.sterile_until} — reprocess it before issue`);
    if (view.status !== "Sterile") throw new ConflictError(`${set.set_no} is ${view.status.toLowerCase()} — it must be sterile to issue`);
    const { rows } = await cssdIssuesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const issueNo = nextCode(rows.map((r) => r.issue_no ?? ""), `CI/${yy(today)}/`, 5);
    return transactional("cssd.issue", async (uow) => {
      await uow.update(TABLES.cssdSets, set.id, { status: "Issued" });
      return uow.update<CssdIssueRow>(TABLES.cssdIssues, id, {
        status: "Issued", issue_no: issueNo, issued_at: now.toISOString(), issued_by: actor.name,
        expected_back: new Date(now.getTime() + hours * 3_600_000).toISOString(), charge: Number(set.usage_charge ?? 0),
      });
    });
  });
  let row = issued as CssdIssueRow;
  // The usage fee goes on the patient's bill: pending, as IPD when they are admitted and OPD otherwise. A billing hiccup never undoes an issue.
  if (row.patient_id != null && Number(row.charge) > 0) {
    try {
      const { rows: stays } = await ipdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
      const admitted = stays.some((a) => a.patient_id === row.patient_id && a.status !== "Discharged");
      const bill = await createBill({ patientId: row.patient_id, patientName: row.patient_name, type: admitted ? "IPD" : "OPD", amount: Number(row.charge), status: "Pending" }, actor);
      row = (await cssdIssuesRepo.update(id, { bill_number: bill.billNumber })) as CssdIssueRow;
    } catch { /* the charge stays on the issue; billing can raise it by hand */ }
  }
  await audit(actor, "issue", "cssd-issue", id, { issueNo: row.issue_no, setNo: row.set_no });
  return toIssueDto(row);
}

export async function cancelRequest(id: number, actor: Session): Promise<CssdIssueDTO> {
  const first = await ownedIssue(id, actor);
  const row = await withKeyLocks([`cssd-issue:${id}`, setKey(first.set_id)], async () => {
    const i = await ownedIssue(id, actor);
    if (i.status !== "Requested") throw new ConflictError(`A ${i.status.toLowerCase()} request can't be cancelled`);
    return cssdIssuesRepo.update(id, { status: "Cancelled" });
  });
  await audit(actor, "cancel", "cssd-issue", id);
  return toIssueDto(row as CssdIssueRow);
}

/** The set comes back: it is Dirty again. Say if something needs looking into (missing or damaged instruments). */
export async function returnSet(id: number, input: unknown, actor: Session): Promise<CssdIssueDTO> {
  const first = await ownedIssue(id, actor);
  const data = validate({ investigate: { type: "boolean", required: false, default: false }, note: { type: "string", required: false, max: 200, default: "" } } as const, input ?? {});
  if (data.investigate && data.note.trim().length < 3) throw new ValidationError([{ field: "note", message: "say what needs investigating" }]);
  const row = await withKeyLocks([setKey(first.set_id), `cssd-issue:${id}`], async () => {
    const i = await ownedIssue(id, actor);
    if (i.status !== "Issued") throw new ConflictError(`This set is ${i.status.toLowerCase()} — only an issued set can be returned`);
    return transactional("cssd.return", async (uow) => {
      await uow.update(TABLES.cssdSets, i.set_id, { status: "Dirty", packaging: null, sterile_until: null });
      return uow.update<CssdIssueRow>(TABLES.cssdIssues, id, {
        status: "Returned", returned_at: new Date().toISOString(), returned_by: actor.name,
        investigate: data.investigate || !!i.investigate, return_note: data.note.trim() || i.return_note || "",
      });
    });
  });
  await audit(actor, "return", "cssd-issue", id, { investigate: data.investigate });
  return toIssueDto(row as CssdIssueRow);
}

// ── Board header ─────────────────────────────────────────────────────────────

export async function cssdSummary(actor: Session): Promise<CssdSummaryDTO> {
  const today = localDate();
  const [{ rows: sets }, { rows: issues }] = await Promise.all([
    cssdSetsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    cssdIssuesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const views = (sets as CssdSetRow[]).map((s) => toSetDto(s, today));
  const n = (st: CssdSetStatus) => views.filter((v) => v.status === st).length;
  const now = Date.now();
  return {
    sterile: n("Sterile"), inCycle: n("In cycle"), packed: n("Packed"), dirty: n("Dirty"), issuedOut: n("Issued"),
    requests: issues.filter((i) => i.status === "Requested").length,
    expiring7d: views.filter((v) => v.status === "Sterile" && v.daysLeft != null && v.daysLeft <= 7).length,
    expired: n("Expired sterility"),
    overdueSets: (issues as CssdIssueRow[]).filter((i) => toIssueDto(i, now).overdue).map((i) => i.set_no),
  };
}

/** Booked surgeries a set can be requested for. */
export async function cssdCases(actor: Session): Promise<CssdCaseDTO[]> {
  const from = addDays(localDate(), -1);
  const { rows } = await otRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "scheduled_date", direction: "asc" }] }, actor));
  return rows
    .filter((r) => r.scheduled_date >= from && r.status !== "Cancelled" && r.status !== "Completed")
    .slice(0, 100)
    .map((r) => ({ id: r.id, patientId: r.patient_id ?? null, patientName: r.patient_name, procedure: r.surgery_name || r.procedure, scheduledDate: r.scheduled_date, room: r.ot_room }));
}


/** The departments a set can belong to or be requested by. */
export async function cssdDepartments(actor: Session): Promise<{ id: number; name: string }[]> {
  const { rows } = await departmentsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor));
  return rows.map((d) => ({ id: d.id, name: d.name }));
}
