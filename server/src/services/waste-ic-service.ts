/**
 * Waste & infection control.
 *
 *   Collection  Biomedical waste weighed into the colour-coded bins on each ward (white sharps, red contaminated recyclables,
 *               yellow anatomical / soiled, blue glass / metallic).
 *   Disposal    Loads handed to the authorised treatment vendor, with the manifest number. A load can't be larger than what has been
 *               collected and not yet disposed of, per colour.
 *   Infection   Healthcare-associated infections noticed on a ward (Open until resolved), and hand-hygiene audits by ward.
 *   Dashboard   The period's waste by colour, ward and day, what is still waiting for disposal, infections by type and hand-hygiene compliance.
 *   Register    The collection and disposal entries for a period, laid out for printing.
 */
import { handHygieneAuditsRepo, hospitalsRepo, icEventsRepo, wardsRepo, wasteCollectionsRepo, wasteDisposalsRepo } from "@/repositories";
import type { HandHygieneAuditRow, IcEventRow, WardRow, WasteCollectionRow, WasteDisposalRow } from "@/db/tables";
import { validate } from "@/lib/validation";
import { ConflictError, ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate, localMinutes, hhmm } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

export const WASTE_CATEGORIES = {
  white: "White (sharps)",
  red: "Red (contaminated recyclable)",
  yellow: "Yellow (anatomical / soiled)",
  blue: "Blue (glass / metallic)",
} as const;
export type WasteCategory = keyof typeof WASTE_CATEGORIES;
const CATEGORY_KEYS = Object.keys(WASTE_CATEGORIES);
export const INFECTION_TYPES = ["CAUTI", "CLABSI", "SSI", "VAP", "MRSA", "C. difficile", "Respiratory", "Gastro-intestinal", "Other"] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

/** A date from a request: ISO, and never in the future. */
function pastDate(v: string | undefined | null, field: string): string {
  const today = localDate();
  if (!v) return today;
  if (!ISO.test(v)) throw new ValidationError([{ field, message: "Dates must look like 2026-10-30" }]);
  if (v > today) throw new ValidationError([{ field, message: "That date hasn't happened yet" }]);
  return v;
}

async function ward(wardId: number | null | undefined, actor: Session): Promise<WardRow | null> {
  if (wardId == null) return null;
  const w = await wardsRepo.getRow(wardId);
  assertOwnedByHospital(w, actor, "Ward");
  return w;
}

// ─── Collection ──────────────────────────────────────────────────────────────

export interface WasteCollectionDTO { id: number; date: string; time: string; wardId: number | null; ward: string; category: string; categoryLabel: string; quantityKg: number; bags: number; notes: string; by: string }
const toCollection = (r: WasteCollectionRow): WasteCollectionDTO => ({ id: r.id, date: r.collected_on, time: r.collected_time, wardId: r.ward_id, ward: r.ward, category: r.category, categoryLabel: WASTE_CATEGORIES[r.category as WasteCategory] ?? r.category, quantityKg: Number(r.quantity_kg), bags: r.bags, notes: r.notes, by: r.created_by });

export async function listCollections(f: { from?: string; to?: string; wardId?: number; category?: string; limit?: number }, actor: Session): Promise<{ rows: WasteCollectionDTO[]; total: number; kg: number; bags: number }> {
  requireHospitalId(actor);
  const rows = (await all<WasteCollectionRow>(wasteCollectionsRepo, actor))
    .filter((r) => (!f.from || r.collected_on >= f.from) && (!f.to || r.collected_on <= f.to) && (f.wardId == null || r.ward_id === f.wardId) && (!f.category || r.category === f.category))
    .sort((a, b) => b.collected_on.localeCompare(a.collected_on) || b.collected_time.localeCompare(a.collected_time) || b.id - a.id);
  return { rows: rows.slice(0, Math.min(Math.max(f.limit ?? 500, 1), 2000)).map(toCollection), total: rows.length, kg: r2(rows.reduce((n, r) => n + Number(r.quantity_kg), 0)), bags: rows.reduce((n, r) => n + r.bags, 0) };
}

export async function logCollection(body: unknown, actor: Session): Promise<WasteCollectionDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    collectedOn: { type: "string", required: false }, collectedTime: { type: "string", required: false, pattern: TIME },
    wardId: { type: "number", required: true }, category: { type: "enum", required: true, values: CATEGORY_KEYS },
    quantityKg: { type: "number", required: true, min: 0.01, max: 1000 }, bags: { type: "number", required: false, min: 0, max: 1000, default: 1 },
    notes: { type: "string", required: false, max: 300, default: "" },
  } as const, body);
  const bags = data.bags ?? 1;
  if (!Number.isInteger(bags)) throw new ValidationError([{ field: "bags", message: "Enter a whole number of bags" }]);
  const w = await ward(data.wardId, actor);
  const row = await wasteCollectionsRepo.create({
    hospital_id: hospitalId, collected_on: pastDate(data.collectedOn, "collectedOn"), collected_time: data.collectedTime || hhmm(localMinutes()), ward_id: w!.id, ward: w!.name,
    category: data.category, quantity_kg: r2(data.quantityKg), bags, notes: data.notes ?? "", created_by: actor.name,
  });
  await audit(actor, "create", "waste-collection", row.id, { name: `${WASTE_CATEGORIES[data.category as WasteCategory]} · ${w!.name} · ${r2(data.quantityKg)} kg` });
  return toCollection(row);
}

export async function deleteCollection(id: number, actor: Session): Promise<void> {
  const row = await wasteCollectionsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Collection entry");
  await wasteCollectionsRepo.remove(id);
  await audit(actor, "delete", "waste-collection", id, { name: `${WASTE_CATEGORIES[row.category as WasteCategory]} · ${row.ward} · ${row.quantity_kg} kg on ${row.collected_on}` });
}

// ─── Disposal ────────────────────────────────────────────────────────────────

export interface WasteDisposalDTO { id: number; date: string; category: string; categoryLabel: string; quantityKg: number; vendor: string; manifestNo: string; vehicle: string; notes: string; by: string }
const toDisposal = (r: WasteDisposalRow): WasteDisposalDTO => ({ id: r.id, date: r.disposed_on, category: r.category, categoryLabel: WASTE_CATEGORIES[r.category as WasteCategory] ?? r.category, quantityKg: Number(r.quantity_kg), vendor: r.vendor, manifestNo: r.manifest_no, vehicle: r.vehicle, notes: r.notes, by: r.created_by });

/** Collected and not yet disposed of, by colour. */
async function pendingByCategory(actor: Session): Promise<Record<string, number>> {
  const [collected, disposed] = await Promise.all([all<WasteCollectionRow>(wasteCollectionsRepo, actor), all<WasteDisposalRow>(wasteDisposalsRepo, actor)]);
  return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, r2(collected.filter((c) => c.category === k).reduce((n, c) => n + Number(c.quantity_kg), 0) - disposed.filter((d) => d.category === k).reduce((n, d) => n + Number(d.quantity_kg), 0))]));
}

export interface DisposalListDTO { rows: WasteDisposalDTO[]; pending: { category: string; label: string; kg: number }[]; vendors: string[] }
export async function listDisposals(actor: Session): Promise<DisposalListDTO> {
  requireHospitalId(actor);
  const [rows, pending] = await Promise.all([all<WasteDisposalRow>(wasteDisposalsRepo, actor), pendingByCategory(actor)]);
  rows.sort((a, b) => b.disposed_on.localeCompare(a.disposed_on) || b.id - a.id);
  return {
    rows: rows.slice(0, 500).map(toDisposal),
    pending: CATEGORY_KEYS.map((k) => ({ category: k, label: WASTE_CATEGORIES[k as WasteCategory], kg: pending[k] })),
    vendors: [...new Set(rows.map((r) => r.vendor).filter(Boolean))],
  };
}

export async function logDisposal(body: unknown, actor: Session): Promise<WasteDisposalDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    disposedOn: { type: "string", required: false }, category: { type: "enum", required: true, values: CATEGORY_KEYS }, quantityKg: { type: "number", required: true, min: 0.01, max: 100000 },
    vendor: { type: "string", required: true, min: 2, max: 120 }, manifestNo: { type: "string", required: false, max: 60, default: "" }, vehicle: { type: "string", required: false, max: 40, default: "" },
    notes: { type: "string", required: false, max: 300, default: "" },
  } as const, body);
  return withKeyLocks([`waste-disposal:${hospitalId}`], async () => {
    const pending = (await pendingByCategory(actor))[data.category];
    if (r2(data.quantityKg) > pending) throw new ConflictError(`Only ${pending} kg of ${WASTE_CATEGORIES[data.category as WasteCategory].toLowerCase()} waste is waiting for disposal — can't send ${r2(data.quantityKg)} kg`);
    const row = await wasteDisposalsRepo.create({
      hospital_id: hospitalId, disposed_on: pastDate(data.disposedOn, "disposedOn"), category: data.category, quantity_kg: r2(data.quantityKg), vendor: data.vendor.trim(),
      manifest_no: (data.manifestNo ?? "").trim(), vehicle: (data.vehicle ?? "").trim(), notes: data.notes ?? "", created_by: actor.name,
    });
    await audit(actor, "create", "waste-disposal", row.id, { name: `${WASTE_CATEGORIES[data.category as WasteCategory]} · ${row.quantity_kg} kg to ${row.vendor}` });
    return toDisposal(row);
  });
}

export async function deleteDisposal(id: number, actor: Session): Promise<void> {
  const row = await wasteDisposalsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Disposal entry");
  await wasteDisposalsRepo.remove(id);
  await audit(actor, "delete", "waste-disposal", id, { name: `${WASTE_CATEGORIES[row.category as WasteCategory]} · ${row.quantity_kg} kg on ${row.disposed_on}` });
}

// ─── Infection control ───────────────────────────────────────────────────────

export interface IcEventDTO { id: number; date: string; wardId: number | null; ward: string; patient: string; patientCode: string; type: string; organism: string; deviceProcedure: string; status: string; resolvedOn: string | null; notes: string; by: string }
const toEvent = (r: IcEventRow): IcEventDTO => ({ id: r.id, date: r.event_date, wardId: r.ward_id, ward: r.ward, patient: r.patient_name, patientCode: r.patient_code, type: r.infection_type, organism: r.organism, deviceProcedure: r.device_procedure, status: r.status, resolvedOn: r.resolved_on, notes: r.notes, by: r.created_by });
export interface HandHygieneDTO { id: number; date: string; wardId: number | null; ward: string; observed: number; compliant: number; pct: number; auditor: string; notes: string }
const toAudit = (r: HandHygieneAuditRow): HandHygieneDTO => ({ id: r.id, date: r.audit_date, wardId: r.ward_id, ward: r.ward, observed: r.observed, compliant: r.compliant, pct: Math.round((r.compliant / r.observed) * 100), auditor: r.auditor, notes: r.notes });

export interface InfectionControlDTO { events: IcEventDTO[]; audits: HandHygieneDTO[]; types: string[]; open: number }
export async function getInfectionControl(actor: Session): Promise<InfectionControlDTO> {
  requireHospitalId(actor);
  const [events, audits] = await Promise.all([all<IcEventRow>(icEventsRepo, actor), all<HandHygieneAuditRow>(handHygieneAuditsRepo, actor)]);
  return {
    events: events.sort((a, b) => (a.status === b.status ? 0 : a.status === "Open" ? -1 : 1) || b.event_date.localeCompare(a.event_date) || b.id - a.id).slice(0, 300).map(toEvent),
    audits: audits.sort((a, b) => b.audit_date.localeCompare(a.audit_date) || b.id - a.id).slice(0, 300).map(toAudit),
    types: [...INFECTION_TYPES], open: events.filter((e) => e.status === "Open").length,
  };
}

export async function logInfection(body: unknown, actor: Session): Promise<IcEventDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    eventDate: { type: "string", required: false }, wardId: { type: "number", required: false }, patientName: { type: "string", required: false, max: 120, default: "" }, patientCode: { type: "string", required: false, max: 40, default: "" },
    infectionType: { type: "enum", required: true, values: [...INFECTION_TYPES] }, organism: { type: "string", required: false, max: 120, default: "" },
    deviceProcedure: { type: "string", required: false, max: 120, default: "" }, notes: { type: "string", required: false, max: 500, default: "" },
  } as const, body);
  const w = await ward(data.wardId, actor);
  const row = await icEventsRepo.create({
    hospital_id: hospitalId, event_date: pastDate(data.eventDate, "eventDate"), ward_id: w?.id ?? null, ward: w?.name ?? "", patient_name: (data.patientName ?? "").trim(), patient_code: (data.patientCode ?? "").trim(),
    infection_type: data.infectionType, organism: (data.organism ?? "").trim(), device_procedure: (data.deviceProcedure ?? "").trim(), status: "Open", resolved_on: null, notes: data.notes ?? "", created_by: actor.name,
  });
  await audit(actor, "create", "ic-event", row.id, { name: `${data.infectionType}${w ? ` · ${w.name}` : ""}` });
  return toEvent(row);
}

export async function resolveInfection(id: number, actor: Session): Promise<IcEventDTO> {
  const row = await icEventsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Infection event");
  if (row.status === "Resolved") throw new ConflictError("That case is already resolved");
  const updated = await icEventsRepo.update(id, { status: "Resolved", resolved_on: localDate() });
  await audit(actor, "update", "ic-event", id, { name: `Resolved · ${row.infection_type}` });
  return toEvent(updated as IcEventRow);
}

export async function logHandHygiene(body: unknown, actor: Session): Promise<HandHygieneDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    auditDate: { type: "string", required: false }, wardId: { type: "number", required: true }, observed: { type: "number", required: true, min: 1, max: 10000 },
    compliant: { type: "number", required: true, min: 0, max: 10000 }, notes: { type: "string", required: false, max: 300, default: "" },
  } as const, body);
  if (!Number.isInteger(data.observed) || !Number.isInteger(data.compliant)) throw new ValidationError([{ field: "observed", message: "Counts must be whole numbers" }]);
  if (data.compliant > data.observed) throw new ValidationError([{ field: "compliant", message: "More compliant than observed — check the counts" }]);
  const w = await ward(data.wardId, actor);
  const row = await handHygieneAuditsRepo.create({ hospital_id: hospitalId, audit_date: pastDate(data.auditDate, "auditDate"), ward_id: w!.id, ward: w!.name, observed: data.observed, compliant: data.compliant, auditor: actor.name, notes: data.notes ?? "" });
  await audit(actor, "create", "hand-hygiene-audit", row.id, { name: `${w!.name} · ${data.compliant}/${data.observed}` });
  return toAudit(row);
}

// ─── Dashboard and register ──────────────────────────────────────────────────

export interface WasteDashboardDTO {
  days: number; from: string; to: string;
  waste: { kg: number; bags: number; entries: number; byCategory: { category: string; label: string; kg: number; bags: number; pending: number }[]; byWard: { ward: string; kg: number }[]; series: { date: string; kg: number }[]; disposedKg: number };
  infection: { events: number; open: number; resolved: number; byType: { type: string; count: number }[]; byWard: { ward: string; count: number }[] };
  handHygiene: { audits: number; observed: number; compliant: number; pct: number | null; byWard: { ward: string; observed: number; pct: number }[] };
}

export async function getDashboard(rawDays: number, actor: Session): Promise<WasteDashboardDTO> {
  requireHospitalId(actor);
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
  const to = localDate();
  const from = addDays(to, -(days - 1));
  const [collections, disposals, events, audits, pending] = await Promise.all([
    all<WasteCollectionRow>(wasteCollectionsRepo, actor), all<WasteDisposalRow>(wasteDisposalsRepo, actor), all<IcEventRow>(icEventsRepo, actor), all<HandHygieneAuditRow>(handHygieneAuditsRepo, actor), pendingByCategory(actor),
  ]);
  const inRange = <T>(rows: T[], day: (r: T) => string) => rows.filter((r) => day(r) >= from && day(r) <= to);
  const c = inRange(collections, (r) => r.collected_on);
  const kg = (rows: WasteCollectionRow[]) => r2(rows.reduce((n, r) => n + Number(r.quantity_kg), 0));
  const wardKg = new Map<string, number>(); for (const r of c) wardKg.set(r.ward, (wardKg.get(r.ward) ?? 0) + Number(r.quantity_kg));
  const e = inRange(events, (r) => r.event_date);
  const byType = new Map<string, number>(); const evWard = new Map<string, number>();
  for (const r of e) { byType.set(r.infection_type, (byType.get(r.infection_type) ?? 0) + 1); if (r.ward) evWard.set(r.ward, (evWard.get(r.ward) ?? 0) + 1); }
  const a = inRange(audits, (r) => r.audit_date);
  const observed = a.reduce((n, r) => n + r.observed, 0); const compliant = a.reduce((n, r) => n + r.compliant, 0);
  const hhWard = new Map<string, { o: number; c: number }>(); for (const r of a) { const g = hhWard.get(r.ward) ?? { o: 0, c: 0 }; g.o += r.observed; g.c += r.compliant; hhWard.set(r.ward, g); }
  return {
    days, from, to,
    waste: {
      kg: kg(c), bags: c.reduce((n, r) => n + r.bags, 0), entries: c.length,
      byCategory: CATEGORY_KEYS.map((k) => ({ category: k, label: WASTE_CATEGORIES[k as WasteCategory], kg: kg(c.filter((r) => r.category === k)), bags: c.filter((r) => r.category === k).reduce((n, r) => n + r.bags, 0), pending: pending[k] })),
      byWard: [...wardKg].map(([w, v]) => ({ ward: w, kg: r2(v) })).sort((x, y) => y.kg - x.kg).slice(0, 8),
      series: Array.from({ length: days }, (_, i) => { const d = addDays(from, i); return { date: d, kg: kg(c.filter((r) => r.collected_on === d)) }; }),
      disposedKg: r2(inRange(disposals, (r) => r.disposed_on).reduce((n, r) => n + Number(r.quantity_kg), 0)),
    },
    infection: { events: e.length, open: events.filter((r) => r.status === "Open").length, resolved: e.filter((r) => r.status === "Resolved").length, byType: [...byType].map(([type, count]) => ({ type, count })).sort((x, y) => y.count - x.count), byWard: [...evWard].map(([w, count]) => ({ ward: w, count })).sort((x, y) => y.count - x.count) },
    handHygiene: { audits: a.length, observed, compliant, pct: observed ? Math.round((compliant / observed) * 100) : null, byWard: [...hhWard].map(([w, g]) => ({ ward: w, observed: g.o, pct: Math.round((g.c / g.o) * 100) })).sort((x, y) => x.pct - y.pct) },
  };
}

export interface WasteRegisterDTO {
  hospital: string; from: string; to: string;
  collections: WasteCollectionDTO[]; disposals: WasteDisposalDTO[];
  totals: { category: string; label: string; collectedKg: number; disposedKg: number }[];
}
/** The period's collection and disposal entries, oldest first, for the statutory register. */
export async function getRegister(q: { from?: string; to?: string }, actor: Session): Promise<WasteRegisterDTO> {
  const hospitalId = requireHospitalId(actor);
  const to = q.to || localDate();
  const from = q.from || `${to.slice(0, 8)}01`;
  if (!ISO.test(from) || !ISO.test(to)) throw new ValidationError([{ field: "from", message: "Dates must look like 2026-10-30" }]);
  const [collections, disposals, hospital] = await Promise.all([all<WasteCollectionRow>(wasteCollectionsRepo, actor), all<WasteDisposalRow>(wasteDisposalsRepo, actor), hospitalsRepo.getRow(hospitalId)]);
  const c = collections.filter((r) => r.collected_on >= from && r.collected_on <= to).sort((a, b) => a.collected_on.localeCompare(b.collected_on) || a.collected_time.localeCompare(b.collected_time) || a.id - b.id);
  const d = disposals.filter((r) => r.disposed_on >= from && r.disposed_on <= to).sort((a, b) => a.disposed_on.localeCompare(b.disposed_on) || a.id - b.id);
  return {
    hospital: hospital?.name ?? "", from, to, collections: c.map(toCollection), disposals: d.map(toDisposal),
    totals: CATEGORY_KEYS.map((k) => ({ category: k, label: WASTE_CATEGORIES[k as WasteCategory], collectedKg: r2(c.filter((r) => r.category === k).reduce((n, r) => n + Number(r.quantity_kg), 0)), disposedKg: r2(d.filter((r) => r.category === k).reduce((n, r) => n + Number(r.quantity_kg), 0)) })),
  };
}
