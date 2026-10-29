/**
 * Setup masters: one generic store behind every list in Setup → Masters (services, rate plans, payers, registration lists,
 * facility…), plus hospital identity, branches and the Settings sections. What each kind holds is described in
 * setup-registry.ts; this file does the shared work — validation, unique codes, links between masters, delete protection —
 * and the few operations a plain create/update can't express (rate-plan prices, contract rules, CSV import).
 */
import { setupRecordsRepo, hospitalsRepo, wardsRepo } from "@/repositories";
import { type SetupRecordRow } from "@/db/tables";
import { BadRequestError, ConflictError, NotFoundError, ValidationError, type FieldError } from "@/lib/errors";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { REGISTRY, hasCode, type Field, type KindDef } from "@/services/setup-registry";
import { seedSetupDefaults, defaultConfig, ID_FORMAT_DEFAULTS, BED_CHARGE_CLASS } from "@/services/setup-defaults";
import { CONFIG_KEYS, RATE_SCOPES, SETUP_KINDS, maskProblem, type ConfigKey, type RateScope, type SetupKind, type SetupRecordDTO } from "@shared/types/setup";

export const isKind = (k: string): k is SetupKind => (SETUP_KINDS as readonly string[]).includes(k);
export const isConfigKey = (k: string): k is ConfigKey => (CONFIG_KEYS as readonly string[]).includes(k);

/** Masters other screens pick from (patient registration, billing…): any signed-in user may read them. */
export const PUBLIC_READ = new Set<SetupKind>([
  "service_group", "service", "patient_category", "visit_purpose", "arrival_status", "income_group", "specialty", "ward_class",
  "consulting_room", "facility_area", "collection_center", "payer_class", "payment_mode", "referral_source", "org_unit"
]);

const toDto = (r: SetupRecordRow): SetupRecordDTO => ({
  id: r.id, kind: r.kind as SetupKind, code: r.code ?? "", name: r.name, active: r.active !== false, sortOrder: Number(r.sort_order ?? 0),
  data: (r.data ?? {}) as Record<string, unknown>, createdAt: r.created_at, updatedAt: r.updated_at,
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ── Reading ──────────────────────────────────────────────────────────────────

/** A new hospital starts with a sensible catalogue; this seeds it the first time anything in Setup is read. */
function ensureDefaults(actor: Session): Promise<void> {
  const hospitalId = requireHospitalId(actor);
  return singleFlight(`setup-defaults:${hospitalId}`, async () => {
    const existing = await setupRecordsRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return syncSeededDefaults(hospitalId, actor);
    const hospital = await hospitalsRepo.getRow(hospitalId);
    await seedSetupDefaults(hospitalId, hospital, async (row) => (await setupRecordsRepo.create(row as never)) as SetupRecordRow);
  });
}

const defaultsSynced = new Set<number>();

/**
 * Catching a hospital seeded earlier up with what was added since, without touching anything it edited:
 *  - ID formats nobody edited move to today's starting mask (for documents the HMS issues, the format it has always used);
 *  - the bed-charge services learn which ward class they price a bed in.
 */
async function syncSeededDefaults(hospitalId: number, actor: Session): Promise<void> {
  if (defaultsSynced.has(hospitalId)) return;
  for (const row of await allOfKind("id_format", actor)) {
    const def = ID_FORMAT_DEFAULTS.find((d) => d.code === row.code);
    const data = (row.data ?? {}) as Record<string, unknown>;
    if (!def || data.custom === true || data.defaultMask === def.mask) continue;
    await setupRecordsRepo.update(row.id, { data: { ...data, mask: def.mask, defaultMask: def.mask, prefix: def.prefix, reset: def.reset } } as never);
  }
  const classes = await allOfKind("ward_class", actor);
  for (const row of await allOfKind("service", actor)) {
    const data = (row.data ?? {}) as Record<string, unknown>;
    const cls = BED_CHARGE_CLASS[row.code ?? ""] && classes.find((c) => c.code === BED_CHARGE_CLASS[row.code ?? ""]);
    if (cls && !("wardClassId" in data)) await setupRecordsRepo.update(row.id, { data: { ...data, wardClassId: cls.id } } as never);
  }
  defaultsSynced.add(hospitalId);
}

async function allOfKind(kind: string, actor: Session): Promise<SetupRecordRow[]> {
  const { rows } = await setupRecordsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "kind", op: "eq", value: kind }] }, actor));
  return rows as SetupRecordRow[];
}

function ordered(kind: SetupKind, rows: SetupRecordRow[]): SetupRecordRow[] {
  const def = REGISTRY[kind];
  const by = def.sort ?? "order";
  return [...rows].sort((a, b) => {
    if (by === "name") return a.name.localeCompare(b.name);
    if (by === "code") return (a.code ?? "").localeCompare(b.code ?? "");
    return (Number(a.sort_order) - Number(b.sort_order)) || (a.id - b.id);
  });
}

export async function listSetup(kind: SetupKind, actor: Session, opts: { activeOnly?: boolean } = {}): Promise<SetupRecordDTO[]> {
  await ensureDefaults(actor);
  const rows = ordered(kind, await allOfKind(kind, actor));
  return (opts.activeOnly ? rows.filter((r) => r.active !== false) : rows).map(toDto);
}

async function owned(kind: SetupKind, id: number, actor: Session): Promise<SetupRecordRow> {
  const row = await setupRecordsRepo.getRow(id);
  assertOwnedByHospital(row, actor, REGISTRY[kind].label);
  if (!row || row.kind !== kind) throw new NotFoundError(REGISTRY[kind].label);
  return row;
}

export async function getSetup(kind: SetupKind, id: number, actor: Session): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  return toDto(await owned(kind, id, actor));
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Turn one submitted value into its stored form, or say what is wrong with it. `undefined` means "leave it out". */
function parseField(name: string, f: Field, raw: unknown): { value?: unknown; error?: string } {
  const empty = raw === undefined || raw === null || raw === "";
  if (empty) {
    if (f.required) return { error: `${name} is required` };
    if (f.t === "n" || f.t === "id") return { value: f.nullable ? null : f.def ?? (f.t === "n" ? 0 : null) };
    if (f.t === "d") return { value: null };
    if (f.t === "b") return { value: !!f.def };
    return { value: f.def ?? (f.t === "s" ? "" : undefined) };
  }
  switch (f.t) {
    case "s": {
      const s = String(raw).trim();
      if (f.max && s.length > f.max) return { error: `${name} must be at most ${f.max} characters` };
      return { value: s };
    }
    case "n": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) return { error: `${name} must be a number` };
      if (f.min !== undefined && n < f.min) return { error: `${name} must be at least ${f.min}` };
      if (f.max !== undefined && n > f.max) return { error: `${name} must be at most ${f.max}` };
      return { value: Math.round(n * 100) / 100 };
    }
    case "b": {
      if (typeof raw === "boolean") return { value: raw };
      if (raw === "true" || raw === 1) return { value: true };
      if (raw === "false" || raw === 0) return { value: false };
      return { error: `${name} must be yes or no` };
    }
    case "e": {
      const s = String(raw).trim();
      if (!f.values?.includes(s)) return { error: `${name} must be one of: ${f.values?.join(", ")}` };
      return { value: s };
    }
    case "d": {
      const s = String(raw).trim();
      if (!DATE.test(s) || Number.isNaN(new Date(`${s}T00:00:00Z`).getTime())) return { error: `${name} must be a date like 2026-04-01` };
      return { value: s };
    }
    case "id": {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) return { error: `${name} is not valid` };
      return { value: n };
    }
    default:
      return { error: `${name} can't be set here` };
  }
}

const humanise = (key: string) => key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/ Id$/, "");

async function checkRefs(def: KindDef, data: Record<string, unknown>, actor: Session, errors: FieldError[]) {
  for (const [key, f] of Object.entries(def.fields)) {
    if (f.t !== "id" || !f.ref || data[key] == null) continue;
    const target = await setupRecordsRepo.getRow(Number(data[key]));
    if (!target || target.hospital_id !== actor.hospitalId || target.kind !== f.ref) errors.push({ field: key, message: `${humanise(key)} no longer exists` });
  }
}

const NAME_RULE = (def: KindDef) => ({ min: def.nameMin ?? 1, max: 160 });

interface Parsed { name?: string; code?: string; active?: boolean; data: Record<string, unknown> }

/** Validate a create (everything required is enforced) or an update (only what was sent). */
async function parseInput(kind: SetupKind, input: unknown, actor: Session, mode: "create" | "update"): Promise<Parsed> {
  const def = REGISTRY[kind];
  const body = isRecord(input) ? input : {};
  const errors: FieldError[] = [];
  const out: Parsed = { data: {} };

  if (mode === "create" || "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const rule = NAME_RULE(def);
    if (name.length < rule.min) errors.push({ field: "name", message: "name is required" });
    else if (name.length > rule.max) errors.push({ field: "name", message: `name must be at most ${rule.max} characters` });
    else out.name = name;
  }
  if (def.code && (mode === "create" || "code" in body)) {
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code && def.code === "required") errors.push({ field: "code", message: "code is required" });
    else if (code && !/^[A-Z0-9._\-/ ]{1,30}$/.test(code)) errors.push({ field: "code", message: "code can use letters, digits and . _ - / (30 characters at most)" });
    else out.code = code;
  }
  if (mode === "create" || "active" in body) {
    const r = parseField("active", { t: "b", def: true }, body.active);
    if (r.error) errors.push({ field: "active", message: r.error }); else out.active = r.value as boolean;
  }
  for (const [key, f] of Object.entries(def.fields)) {
    if (f.managed) continue;
    if (mode === "update" && !(key in body)) continue;
    const r = parseField(humanise(key), f, body[key]);
    if (r.error) errors.push({ field: key, message: r.error });
    else if (r.value !== undefined) out.data[key] = r.value;
  }
  parseLists(kind, body, out.data, errors);
  if (errors.length === 0) await checkRefs(def, out.data, actor, errors);
  if (errors.length) throw new ValidationError(errors);
  return out;
}

/** The list-valued fields of clinical forms and protocols (the designer and the steps editor save these with the rest). */
function parseLists(kind: SetupKind, body: Record<string, unknown>, data: Record<string, unknown>, errors: FieldError[]) {
  const list = (key: string, max: number): unknown[] | null => {
    if (!(key in body)) return null;
    const v = body[key];
    if (!Array.isArray(v)) { errors.push({ field: key, message: `${humanise(key)} must be a list` }); return null; }
    if (v.length > max) { errors.push({ field: key, message: `${humanise(key)} can have at most ${max} entries` }); return null; }
    return v;
  };
  if (kind === "clinical_form") {
    const fields = list("fields", 200);
    if (fields) {
      const types = ["Short text", "Long text", "Number", "Date", "Yes / No", "Choice", "Multiple choice", "Section heading"];
      data.fields = fields.map((raw, i) => {
        const f = isRecord(raw) ? raw : {};
        const label = typeof f.label === "string" ? f.label.trim().slice(0, 160) : "";
        if (!label) errors.push({ field: `fields[${i}]`, message: "every field needs a label" });
        const type = types.includes(String(f.type)) ? String(f.type) : "Short text";
        const options = Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim().slice(0, 80)).slice(0, 30) : [];
        if ((type === "Choice" || type === "Multiple choice") && options.length < 2) errors.push({ field: `fields[${i}]`, message: `"${label || "A choice field"}" needs at least two options` });
        return { id: typeof f.id === "string" && f.id ? f.id.slice(0, 20) : `f${i + 1}`, label, type, required: f.required === true, options };
      });
    }
    const assigned = list("assignedDepartments", 100);
    if (assigned) data.assignedDepartments = assigned.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  }
  if (kind === "protocol") {
    const steps = list("steps", 50);
    if (steps) data.steps = steps.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim().slice(0, 300));
  }
}

// ── Kind-specific rules ──────────────────────────────────────────────────────

function kindChecks(kind: SetupKind, name: string, data: Record<string, unknown>, id?: number): void {
  const bad = (field: string, message: string): never => { throw new ValidationError([{ field, message }]); };
  if (kind === "rate_plan") {
    if (data.basePlanId != null && data.basePlanId === id) bad("basePlanId", "A plan can't be based on itself");
    if (data.effectiveFrom && data.effectiveTo && String(data.effectiveTo) < String(data.effectiveFrom)) bad("effectiveTo", "can't be before the start date");
  }
  if (kind === "contract" && data.validFrom && data.validTo && String(data.validTo) < String(data.validFrom)) bad("validTo", "can't be before the start date");
  if (kind === "dual_sponsor_rule" && data.primaryContractId != null && data.primaryContractId === data.secondaryContractId) bad("secondaryContractId", "must be a different contract");
  if (kind === "id_format") {
    const problem = maskProblem(String(data.mask ?? ""));
    if (problem) bad("mask", problem);
  }
  if (kind === "income_group" && data.maxIncome != null && Number(data.maxIncome) < Number(data.minIncome ?? 0)) bad("maxIncome", "can't be below the minimum");
  if (kind === "payout_rule") {
    if (data.valueKind === "percent" && Number(data.value) > 100) bad("value", "A percentage can't be over 100");
    if (data.scope === "A single service" && data.serviceId == null) bad("serviceId", "pick the service this rule is for");
    if (data.effectiveFrom && data.effectiveTo && String(data.effectiveTo) < String(data.effectiveFrom)) bad("effectiveTo", "can't be before the start date");
  }
  if (kind === "branch") {
    for (const f of ["opens", "closes"]) if (data[f] != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(data[f]))) bad(f, "must be a time like 09:00");
    if (data.gstin && !/^[0-9A-Z]{15}$/.test(String(data.gstin).toUpperCase())) bad("gstin", "must be 15 letters and digits");
  }
  if (kind === "bank_account" && data.accountLast4 && !/^\d{4}$/.test(String(data.accountLast4))) bad("accountLast4", "must be the last 4 digits");
  if (name.length === 0) bad("name", "name is required");
}

async function assertUnique(kind: SetupKind, rows: SetupRecordRow[], p: Parsed, selfId?: number) {
  const def = REGISTRY[kind];
  if (p.code && def.code) {
    const clash = rows.find((r) => r.id !== selfId && (r.code ?? "").toUpperCase() === p.code);
    if (clash) throw new ConflictError(`${def.label} code ${p.code} is already used by ${clash.name}`);
  }
  if (p.name && def.uniqueName) {
    const clash = rows.find((r) => r.id !== selfId && r.name.toLowerCase() === p.name!.toLowerCase());
    if (clash) throw new ConflictError(`There is already a ${def.label.toLowerCase()} named ${clash.name}`);
  }
}

/** The next CON-0001 style code for a kind with minted codes. */
function nextAutoCode(kind: SetupKind, rows: SetupRecordRow[]): string {
  const prefix = REGISTRY[kind].codeAuto!;
  const top = rows.reduce((n, r) => Math.max(n, Number(String(r.code ?? "").slice(prefix.length)) || 0), 0);
  return `${prefix}${String(top + 1).padStart(4, "0")}`;
}

/** Keep one record flagged (a default plan, the primary branch): flagging one clears it elsewhere. */
async function enforceOneOf(kind: SetupKind, rows: SetupRecordRow[], keepId: number, field: string) {
  for (const r of rows) {
    if (r.id !== keepId && (r.data ?? {})[field] === true) await setupRecordsRepo.update(r.id, { data: { ...r.data, [field]: false } } as never);
  }
}

/**
 * A value typed or picked on another screen (a patient's category, a visit purpose…) must be one of the hospital's active entries
 * in that master. Returns the entry's own spelling. A value the record already holds (`current`) is accepted as it is, so editing
 * an older record that predates the master never fails over a field the user didn't touch. Blank stays blank.
 */
export async function canonicalMaster(kind: SetupKind, value: unknown, actor: Session, field: string, current?: unknown): Promise<string> {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (typeof current === "string" && current.trim().toLowerCase() === text.toLowerCase()) return current.trim();
  await ensureDefaults(actor);
  const rows = (await allOfKind(kind, actor)).filter((r) => r.active !== false);
  const hit = rows.find((r) => r.name.toLowerCase() === text.toLowerCase() || (r.code && r.code.toLowerCase() === text.toLowerCase()));
  if (hit) return hit.name;
  throw new ValidationError([{ field, message: `"${text}" isn't one of the hospital's ${REGISTRY[kind].label.toLowerCase()}s — pick one from the list (Setup → Masters)` }]);
}

/**
 * A master entry picked by id (a ward's class, a ward's area): it must be this hospital's entry of that kind and still active.
 * An entry the record already points at (`current`) is accepted as it is. Returns the entry.
 */
export async function assertMasterId(kind: SetupKind, id: number, actor: Session, field: string, current?: number | null): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  const row = (await allOfKind(kind, actor)).find((r) => r.id === id);
  if (!row || (row.active === false && current !== id)) throw new ValidationError([{ field, message: `pick one of the hospital's ${REGISTRY[kind].label.toLowerCase()}s (Setup → Masters)` }]);
  return toDto(row);
}

// ── Create, update, delete ───────────────────────────────────────────────────

export async function createSetup(kind: SetupKind, input: unknown, actor: Session): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  const def = REGISTRY[kind];
  const hospitalId = requireHospitalId(actor);
  const p = await parseInput(kind, input, actor, "create");
  const data: Record<string, unknown> = { ...p.data };
  for (const [k, f] of Object.entries(def.fields)) if (f.managed && !(k in data)) data[k] = k === "prices" ? { general: {}, package: {}, tpa: {} } : [];
  const row = await withKeyLocks([`setup:${hospitalId}:${kind}`], async () => {
    const rows = await allOfKind(kind, actor);
    if (def.codeAuto) p.code = nextAutoCode(kind, rows);
    if (kind === "id_format") data.defaultMask = data.mask;
    kindChecks(kind, p.name ?? "", data);
    await assertUnique(kind, rows, p);
    const created = (await setupRecordsRepo.create({
      hospital_id: hospitalId, kind, code: p.code ?? "", name: p.name!, active: p.active ?? true,
      sort_order: rows.reduce((n, r) => Math.max(n, Number(r.sort_order ?? 0)), 0) + 1, data,
    } as never)) as SetupRecordRow;
    if (def.oneOf && data[def.oneOf] === true) await enforceOneOf(kind, rows, created.id, def.oneOf);
    return created;
  });
  await audit(actor, "create", `setup-${kind}`, row.id, { name: row.name });
  return toDto(row);
}

export async function updateSetup(kind: SetupKind, id: number, input: unknown, actor: Session): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  const def = REGISTRY[kind];
  const hospitalId = requireHospitalId(actor);
  await owned(kind, id, actor);
  const p = await parseInput(kind, input, actor, "update");
  const row = await withKeyLocks([`setup:${hospitalId}:${kind}`], async () => {
    const rows = await allOfKind(kind, actor);
    const current = rows.find((r) => r.id === id);
    if (!current) throw new NotFoundError(def.label);
    const data = { ...(current.data ?? {}), ...p.data };
    if (kind === "id_format" && "mask" in p.data && p.data.mask !== current.data?.defaultMask) data.custom = true;
    if (kind === "clinical_form" && "status" in p.data && p.data.status === "Published" && current.data?.status !== "Published") data.version = Number(current.data?.version ?? 0) + 1;
    kindChecks(kind, p.name ?? current.name, data, id);
    if ((p.name || p.code) && !(p.name === current.name && (p.code ?? current.code) === current.code)) await assertUnique(kind, rows, { ...p, name: p.name ?? current.name, code: p.code ?? current.code }, id);
    const patch: Record<string, unknown> = { data };
    if (p.name !== undefined) patch.name = p.name;
    if (p.code !== undefined && !def.codeAuto) patch.code = p.code;
    if (p.active !== undefined) patch.active = p.active;
    const updated = (await setupRecordsRepo.update(id, patch as never)) as SetupRecordRow;
    if (def.oneOf && data[def.oneOf] === true) await enforceOneOf(kind, rows, id, def.oneOf);
    return updated;
  });
  await audit(actor, "update", `setup-${kind}`, id, { name: row.name });
  return toDto(row);
}

export async function deleteSetup(kind: SetupKind, id: number, actor: Session): Promise<void> {
  await ensureDefaults(actor);
  const def = REGISTRY[kind];
  const hospitalId = requireHospitalId(actor);
  const row = await owned(kind, id, actor);
  await withKeyLocks([`setup:${hospitalId}:${kind}`], async () => {
    if (kind === "branch" && row.data?.isPrimary === true) throw new ConflictError("The primary branch can't be deleted — make another branch primary first");
    if (kind === "rate_plan" && row.data?.isDefault === true) throw new ConflictError("The default rate plan can't be deleted — make another plan the default first");
    for (const u of def.usedBy ?? []) {
      const users = (await allOfKind(u.kind, actor)).filter((r) => (r.data ?? {})[u.field] === id && !(u.kind === kind && r.id === id));
      if (users.length) throw new ConflictError(`${row.name} is used by ${users.length} ${u.what} — change or remove those first`);
    }
    if (kind === "ward_class" || kind === "facility_area") {
      const column = kind === "ward_class" ? "ward_class_id" : "facility_area_id";
      const { rows: wards } = await wardsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
      const users = wards.filter((w) => (w as unknown as Record<string, unknown>)[column] === id);
      if (users.length) throw new ConflictError(`${row.name} is used by ${users.length} ward${users.length === 1 ? "" : "s"} — change or remove those first`);
    }
    await setupRecordsRepo.remove(id);
  });
  await audit(actor, "delete", `setup-${kind}`, id, { name: row.name });
}

// ── Rate-plan prices ─────────────────────────────────────────────────────────

type PriceMap = Record<string, Record<string, number>>;

/** A plan's price for a service in one scope: its own entry, else its base plan's, else the service's list price. */
type PriceRec = { id: number; data?: Record<string, unknown> | null };
export function effectivePrice(plan: PriceRec, plans: PriceRec[], service: PriceRec, scope: RateScope, depth = 0): number {
  const own = ((plan.data?.prices as PriceMap | undefined) ?? {})[scope]?.[String(service.id)];
  if (own != null) return own;
  const baseId = plan.data?.basePlanId;
  const base = baseId != null ? plans.find((p) => p.id === Number(baseId)) : undefined;
  if (base && depth < 5) return effectivePrice(base, plans, service, scope, depth + 1);
  return Number(service.data?.price ?? 0);
}

/** Set or clear prices: `changes` is [{ serviceId, price }] (a null price removes the plan's own price). */
export async function setRatePrices(id: number, input: unknown, actor: Session): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  const hospitalId = requireHospitalId(actor);
  const body = isRecord(input) ? input : {};
  const scope = String(body.scope ?? "general") as RateScope;
  if (!RATE_SCOPES.includes(scope)) throw new ValidationError([{ field: "scope", message: `must be one of: ${RATE_SCOPES.join(", ")}` }]);
  if (!Array.isArray(body.changes) || body.changes.length === 0) throw new ValidationError([{ field: "changes", message: "give at least one price" }]);
  if (body.changes.length > 500) throw new ValidationError([{ field: "changes", message: "change at most 500 prices at a time" }]);
  await owned("rate_plan", id, actor);
  const services = new Map((await allOfKind("service", actor)).map((s) => [s.id, s]));
  const changes: { serviceId: number; price: number | null }[] = [];
  const errors: FieldError[] = [];
  for (const [i, c] of (body.changes as unknown[]).entries()) {
    const ch = isRecord(c) ? c : {};
    const serviceId = Number(ch.serviceId);
    const price = ch.price === null || ch.price === "" ? null : Number(ch.price);
    if (!services.has(serviceId)) errors.push({ field: `changes[${i}]`, message: "that service doesn't exist" });
    else if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100_000_000)) errors.push({ field: `changes[${i}]`, message: "price must be a number from 0" });
    else changes.push({ serviceId, price: price === null ? null : Math.round(price * 100) / 100 });
  }
  if (errors.length) throw new ValidationError(errors);

  const row = await withKeyLocks([`setup-plan:${hospitalId}:${id}`], async () => {
    const plan = await owned("rate_plan", id, actor);
    const prices: PriceMap = { general: {}, package: {}, tpa: {}, ...((plan.data?.prices as PriceMap | undefined) ?? {}) };
    prices[scope] = { ...(prices[scope] ?? {}) };
    const history = [...(((plan.data?.history as unknown[]) ?? []) as Record<string, unknown>[])];
    const at = new Date().toISOString();
    for (const c of changes) {
      const key = String(c.serviceId);
      const before = prices[scope][key] ?? null;
      if (before === c.price) continue;
      if (c.price === null) delete prices[scope][key]; else prices[scope][key] = c.price;
      history.unshift({ at, by: actor.name, scope, serviceId: c.serviceId, service: services.get(c.serviceId)!.name, from: before, to: c.price });
    }
    return (await setupRecordsRepo.update(id, { data: { ...plan.data, prices, history: history.slice(0, 300) } } as never)) as SetupRecordRow;
  });
  await audit(actor, "prices", "setup-rate_plan", id, { scope, count: changes.length });
  return toDto(row);
}

// ── Contract rules (copay, exclusions, limits, DRG) ──────────────────────────

const RULE_BUCKETS = { copay: "copay", exclusion: "exclusions", limit: "limits", drg: "drg" } as const;
type RuleKind = keyof typeof RULE_BUCKETS;

function parseRule(kind: RuleKind, raw: unknown): Record<string, unknown> {
  const r = isRecord(raw) ? raw : {};
  const num = (k: string, max = 1_000_000_000): number | null => {
    if (r[k] === undefined || r[k] === null || r[k] === "") return null;
    const n = Number(r[k]);
    if (!Number.isFinite(n) || n < 0 || n > max) throw new ValidationError([{ field: k, message: `${humanise(k)} must be a number from 0 to ${max}` }]);
    return Math.round(n * 100) / 100;
  };
  const text = (k: string, max: number, required = false): string => {
    const s = typeof r[k] === "string" ? (r[k] as string).trim() : "";
    if (required && !s) throw new ValidationError([{ field: k, message: `${humanise(k)} is required` }]);
    if (s.length > max) throw new ValidationError([{ field: k, message: `${humanise(k)} must be at most ${max} characters` }]);
    return s;
  };
  if (kind === "copay") {
    const rule = { appliesTo: text("appliesTo", 80) || "Whole contract (default rule)", groupId: r.groupId == null || r.groupId === "" ? null : Number(r.groupId), copayPercent: num("copayPercent", 100), deductible: num("deductible"), copayMin: num("copayMin"), copayMax: num("copayMax"), annualLimit: num("annualLimit"), encounterLimit: num("encounterLimit"), episodicLimit: num("episodicLimit") };
    if (rule.copayMin != null && rule.copayMax != null && rule.copayMax < rule.copayMin) throw new ValidationError([{ field: "copayMax", message: "can't be below the minimum" }]);
    return rule;
  }
  if (kind === "exclusion") return { target: text("target", 160, true), reason: text("reason", 200) };
  if (kind === "limit") return { target: text("target", 160, true), limitAmount: num("limitAmount"), limitCount: num("limitCount", 100000), per: text("per", 30) || "contract" };
  return { diagnosis: text("diagnosis", 160, true), code: text("code", 30), packageAmount: num("packageAmount"), perDiemAmount: num("perDiemAmount"), maxDays: num("maxDays", 365) };
}

export async function addContractRule(id: number, input: unknown, actor: Session): Promise<SetupRecordDTO> {
  const hospitalId = requireHospitalId(actor);
  const body = isRecord(input) ? input : {};
  const kind = String(body.kind ?? "") as RuleKind;
  if (!(kind in RULE_BUCKETS)) throw new ValidationError([{ field: "kind", message: `must be one of: ${Object.keys(RULE_BUCKETS).join(", ")}` }]);
  const rule = parseRule(kind, body.rule);
  await ensureDefaults(actor);
  await owned("contract", id, actor);
  const row = await withKeyLocks([`setup-contract:${hospitalId}:${id}`], async () => {
    const c = await owned("contract", id, actor);
    const bucket = RULE_BUCKETS[kind];
    const list = [...(((c.data?.[bucket] as unknown[]) ?? []) as Record<string, unknown>[])];
    if (list.length >= 100) throw new ConflictError("A contract can hold at most 100 rules of one kind");
    list.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...rule });
    return (await setupRecordsRepo.update(id, { data: { ...c.data, [bucket]: list } } as never)) as SetupRecordRow;
  });
  await audit(actor, "rule-add", "setup-contract", id, { kind });
  return toDto(row);
}

export async function removeContractRule(id: number, kind: string, ruleId: string, actor: Session): Promise<SetupRecordDTO> {
  const hospitalId = requireHospitalId(actor);
  if (!(kind in RULE_BUCKETS)) throw new BadRequestError(`kind must be one of: ${Object.keys(RULE_BUCKETS).join(", ")}`);
  await ensureDefaults(actor);
  await owned("contract", id, actor);
  const row = await withKeyLocks([`setup-contract:${hospitalId}:${id}`], async () => {
    const c = await owned("contract", id, actor);
    const bucket = RULE_BUCKETS[kind as RuleKind];
    const list = ((c.data?.[bucket] as Record<string, unknown>[]) ?? []);
    if (!list.some((r) => r.id === ruleId)) throw new NotFoundError("Rule");
    return (await setupRecordsRepo.update(id, { data: { ...c.data, [bucket]: list.filter((r) => r.id !== ruleId) } } as never)) as SetupRecordRow;
  });
  await audit(actor, "rule-remove", "setup-contract", id, { kind, ruleId });
  return toDto(row);
}

// ── Package content (inclusions, exclusions, ordering rules) ─────────────────

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);

/** Replace a package's inclusions, exclusions and ordering rules together (the editor saves them as one). */
export async function savePackageContent(id: number, input: unknown, actor: Session): Promise<SetupRecordDTO> {
  await ensureDefaults(actor);
  const hospitalId = requireHospitalId(actor);
  await owned("package", id, actor);
  const body = isRecord(input) ? input : {};
  const arr = (v: unknown, label: string): Record<string, unknown>[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) throw new ValidationError([{ field: label, message: "must be a list" }]);
    if (v.length > 200) throw new ValidationError([{ field: label, message: "has too many entries (200 at most)" }]);
    return v.map((x) => (isRecord(x) ? x : {}));
  };
  const inclusions = arr(body.inclusions, "inclusions").map((i) => ({
    kind: ["service", "item", "category"].includes(String(i.kind)) ? String(i.kind) : "service", refId: i.refId == null ? null : Number(i.refId),
    name: clean(i.name, 160), category: clean(i.category, 80), qty: numOrNull(i.qty) ?? 1, rate: numOrNull(i.rate), maxQty: numOrNull(i.maxQty), maxAmount: numOrNull(i.maxAmount),
  })).filter((i) => i.name);
  const exclusions = arr(body.exclusions, "exclusions").map((i) => ({ kind: i.kind === "category" ? "category" : "service", refId: i.refId == null ? null : Number(i.refId), name: clean(i.name, 160) })).filter((i) => i.name);
  const orderingRules = arr(body.orderingRules, "orderingRules").map((i) => ({
    minAge: numOrNull(i.minAge), maxAge: numOrNull(i.maxAge), gender: ["Any", "Male", "Female"].includes(String(i.gender)) ? String(i.gender) : "Any",
    patientCategoryId: i.patientCategoryId == null || i.patientCategoryId === "" ? null : Number(i.patientCategoryId), centerId: i.centerId == null || i.centerId === "" ? null : Number(i.centerId),
  }));
  const row = await withKeyLocks([`setup-package:${hospitalId}:${id}`], async () => {
    const pkg = await owned("package", id, actor);
    return (await setupRecordsRepo.update(id, { data: { ...pkg.data, inclusions, exclusions, orderingRules } } as never)) as SetupRecordRow;
  });
  await audit(actor, "content", "setup-package", id);
  return toDto(row);
}

// ── Service CSV import ───────────────────────────────────────────────────────

/** Create or update services by code. Rows with a problem are reported and the rest still go in. */
export async function importServices(input: unknown, actor: Session): Promise<{ created: number; updated: number; failed: { row: number; message: string }[] }> {
  await ensureDefaults(actor);
  const hospitalId = requireHospitalId(actor);
  const body = isRecord(input) ? input : {};
  if (!Array.isArray(body.rows) || body.rows.length === 0) throw new ValidationError([{ field: "rows", message: "give at least one row" }]);
  if (body.rows.length > 1000) throw new ValidationError([{ field: "rows", message: "import at most 1000 rows at a time" }]);
  const groups = await allOfKind("service_group", actor);
  const out = { created: 0, updated: 0, failed: [] as { row: number; message: string }[] };
  for (const [i, raw] of (body.rows as unknown[]).entries()) {
    const r = isRecord(raw) ? raw : {};
    try {
      const groupName = typeof r.group === "string" ? r.group.trim().toLowerCase() : "";
      const group = groupName ? groups.find((g) => g.name.toLowerCase() === groupName || (g.code ?? "").toLowerCase() === groupName) : undefined;
      if (groupName && !group) throw new ValidationError([{ field: "group", message: `no service group called "${r.group}"` }]);
      const payload = { name: r.name, code: r.code, price: r.price, unit: r.unit, shortName: r.shortName, hsnSac: r.hsnSac, cghsCode: r.cghsCode, socCode: r.socCode, gstApplies: r.gstApplies, groupId: group?.id ?? null };
      const code = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
      const existing = code ? (await allOfKind("service", actor)).find((s) => (s.code ?? "").toUpperCase() === code) : undefined;
      if (existing) { await updateSetup("service", existing.id, { ...payload, name: payload.name ?? existing.name }, actor); out.updated++; }
      else { await createSetup("service", payload, actor); out.created++; }
    } catch (e) {
      const message = e instanceof ValidationError ? ((e.details as { fields: FieldError[] }).fields ?? []).map((f) => f.message).join("; ") : e instanceof Error ? e.message : "could not be imported";
      out.failed.push({ row: i + 1, message });
    }
  }
  await audit(actor, "import", "setup-service", hospitalId, { created: out.created, updated: out.updated, failed: out.failed.length });
  return out;
}

// ── Configuration singletons ─────────────────────────────────────────────────

async function configRow(key: ConfigKey, actor: Session): Promise<SetupRecordRow | undefined> {
  const { rows } = await setupRecordsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "kind", op: "eq", value: `config:${key}` }] }, actor));
  return (rows as SetupRecordRow[])[0];
}

export async function getConfig(key: ConfigKey, actor: Session): Promise<Record<string, unknown>> {
  await ensureDefaults(actor);
  const hospital = await hospitalsRepo.getRow(requireHospitalId(actor));
  const stored = await configRow(key, actor);
  return { ...defaultConfig(key, hospital), ...((stored?.data as Record<string, unknown> | undefined) ?? {}) };
}

/** Merge the submitted fields over what is stored. Each key only accepts the fields it already has a default for. */
export async function updateConfig(key: ConfigKey, input: unknown, actor: Session): Promise<Record<string, unknown>> {
  await ensureDefaults(actor);
  const hospitalId = requireHospitalId(actor);
  const hospital = await hospitalsRepo.getRow(hospitalId);
  const defaults = defaultConfig(key, hospital);
  const body = isRecord(input) ? input : {};
  const errors: FieldError[] = [];
  const patch: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(body)) {
    if (!(field in defaults)) { errors.push({ field, message: `${field} isn't a setting here` }); continue; }
    const model = defaults[field];
    if (typeof model === "boolean") { if (typeof value !== "boolean") errors.push({ field, message: `${humanise(field)} must be yes or no` }); else patch[field] = value; }
    else if (typeof model === "number") {
      const n = value === null || value === "" ? null : Number(value);
      if (n !== null && (!Number.isFinite(n) || n < 0 || n > 10_000_000)) errors.push({ field, message: `${humanise(field)} must be a number` });
      else patch[field] = n ?? model;
    } else if (typeof model === "string") {
      const s = value === null || value === undefined ? "" : String(value).trim();
      if (s.length > 500) errors.push({ field, message: `${humanise(field)} is too long` }); else patch[field] = s;
    } else if (Array.isArray(model)) {
      if (!Array.isArray(value) || value.length > 100 || value.some((v) => typeof v !== "string" || v.length > 200)) errors.push({ field, message: `${humanise(field)} must be a short list of text` });
      else patch[field] = value;
    } else if (isRecord(model)) {
      if (!isRecord(value) || Object.keys(value).length > 200) errors.push({ field, message: `${humanise(field)} is not valid` });
      else patch[field] = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, v === null || v === "" ? null : typeof v === "boolean" ? v : Number.isFinite(Number(v)) ? Number(v) : String(v).slice(0, 200)]));
    }
  }
  if (key === "hospital") {
    if (patch.fyStartMonth !== undefined && (Number(patch.fyStartMonth) < 1 || Number(patch.fyStartMonth) > 12)) errors.push({ field: "fyStartMonth", message: "must be a month from 1 to 12" });
    if (patch.gstin && !/^[0-9A-Z]{15}$/.test(String(patch.gstin).toUpperCase())) errors.push({ field: "gstin", message: "GSTIN must be 15 letters and digits" });
    if (patch.name !== undefined && String(patch.name).length < 2) errors.push({ field: "name", message: "Hospital name is required" });
  }
  if (errors.length) throw new ValidationError(errors);
  if (typeof patch.gstin === "string") patch.gstin = patch.gstin.toUpperCase();
  await withKeyLocks([`setup-config:${hospitalId}:${key}`], async () => {
    const existing = await configRow(key, actor);
    if (existing) await setupRecordsRepo.update(existing.id, { data: { ...existing.data, ...patch } } as never);
    else await setupRecordsRepo.create({ hospital_id: hospitalId, kind: `config:${key}`, code: "", name: key, active: true, sort_order: 0, data: patch } as never);
  });
  await audit(actor, "update", `setup-config-${key}`, hospitalId, { fields: Object.keys(patch) });
  return getConfig(key, actor);
}
