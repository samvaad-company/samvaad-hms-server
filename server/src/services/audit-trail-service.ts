/**
 * The audit trail screen: the hospital's recorded changes, newest first, filterable, with the hash chain checked as it loads.
 * Entries are written by `audit()` wherever the system changes something; this only reads them (and records an export).
 */
import { auditRepo } from "@/repositories";
import type { AuditLogRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { GENESIS_HASH, audit, chainHash, type ChainLink } from "@/services/audit";
import { localDate } from "@/lib/clock";

export interface AuditEntryDTO {
  id: number;
  at: string;
  action: string;
  actionLabel: string;
  summary: string;
  actor: string;
  module: string;
  entity: string;
  entityId: string;
  /** What else was recorded with the entry, as label → value. */
  details: { label: string; value: string }[];
}

export interface AuditFilters { q?: string; module?: string; action?: string; actor?: string; from?: string; to?: string; page?: number; pageSize?: number }

export interface AuditPageDTO {
  rows: AuditEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
  modules: string[];
  actions: { value: string; label: string }[];
  actors: string[];
  chain: ChainCheckDTO;
}

export interface ChainCheckDTO {
  checkedOn: string;
  /** Entries that are part of the chain. */
  entries: number;
  /** Older entries written before the chain existed — shown, but not covered by it. */
  unchained: number;
  intact: boolean;
  /** The first entry (#) at which the chain no longer holds. */
  brokenAt: number | null;
}

/** Entity → the area of the app it belongs to. */
const MODULES: [RegExp, string][] = [
  [/^patient/, "Patients"], [/^appointment|^teleconsult|^schedule/, "Appointments"], [/^opd|^ipd|^ot$|^nurs|^checklist|^followup|^bed|^ward|^blood|^cssd|^ambulance|^record/, "Clinical"],
  [/^prescription/, "Prescriptions"], [/^bill|^payout|^finance|^tpa|^payer/, "Billing"], [/^document|^consent|^signature|^mrd|^file/, "Documents"],
  [/^lab|^radiology/, "Lab"], [/^audit/, "Audit"], [/^pharmacy|^inventory|^medicine/, "Pharmacy"], [/^setup|^hospital|^branch|^plan/, "Setup"],
  [/^housekeeping/, "Housekeeping"], [/^diet|^canteen/, "Dietary"], [/^waste|^ic-|^hand-hygiene/, "Waste & IC"], [/^enquir/, "Enquiries"], [/^staff|^hr|^attendance|^payroll|^profile|^user/, "Staff"],
];
const moduleOf = (entity: string): string => MODULES.find(([re]) => re.test(entity))?.[1] ?? "Other";

const ACTION_LABELS: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted", export: "Exported", import: "Imported", connect: "Connected", disconnect: "Disconnected", close: "Closed", convert: "Converted", contact: "Contacted" };
const actionLabel = (a: string): string => ACTION_LABELS[a] ?? (a ? a[0].toUpperCase() + a.slice(1).replace(/[-_]/g, " ") : "Updated");

const entityLabel = (e: string): string => e.replace(/^setup-(config-)?/, "setup · ").replace(/[-_]/g, " ");

const stripChain = (meta: unknown): Record<string, unknown> => {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const { _chain, ...rest } = meta as Record<string, unknown>;
  void _chain;
  return rest;
};

const show = (v: unknown): string => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function toEntry(r: AuditLogRow): AuditEntryDTO {
  const meta = stripChain(r.meta);
  const subject = show(meta.name ?? meta.title ?? "");
  const said = typeof meta.summary === "string" ? meta.summary : "";
  return {
    id: r.id, at: r.created_at, action: r.action, actionLabel: actionLabel(r.action),
    summary: said || `${actionLabel(r.action)} ${entityLabel(r.entity)}${subject ? ` · ${subject}` : r.entity_id ? ` · #${r.entity_id}` : ""}`,
    actor: r.actor_name, module: moduleOf(r.entity), entity: r.entity, entityId: r.entity_id,
    details: [{ label: "Record", value: `${entityLabel(r.entity)} · ${r.entity_id}` }, ...Object.entries(meta).filter(([k, v]) => k !== "summary" && v !== "" && v != null).map(([label, v]) => ({ label, value: show(v) }))],
  };
}

const allRows = async (actor: Session): Promise<AuditLogRow[]> =>
  (await auditRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "desc" }] }, actor))).rows;

/** Walk the chain oldest → newest: each entry must point at the one before it and hash to what it recorded. */
export function checkChain(rows: AuditLogRow[]): ChainCheckDTO {
  const ordered = [...rows].sort((a, b) => a.id - b.id);
  let prev = GENESIS_HASH;
  let started = false;
  let entries = 0; let unchained = 0; let brokenAt: number | null = null;
  for (const r of ordered) {
    const link = (r.meta as { _chain?: ChainLink } | null)?._chain;
    if (!link) { if (!started) unchained++; else if (brokenAt === null) brokenAt = r.id; continue; }
    // The first chained entry may follow older, unchained ones; after that every link must continue the one before.
    const expectedPrev = started ? prev : link.prev;
    const ok = link.prev === expectedPrev && link.hash === chainHash(link.prev, { actor_id: r.actor_id, actor_name: r.actor_name, action: r.action, entity: r.entity, entity_id: r.entity_id, meta: (r.meta ?? {}) as Record<string, unknown> });
    if (!ok && brokenAt === null) brokenAt = r.id;
    started = true; prev = link.hash; entries++;
  }
  return { checkedOn: localDate(), entries, unchained, intact: brokenAt === null, brokenAt };
}

export async function verifyChain(actor: Session): Promise<ChainCheckDTO> {
  requireHospitalId(actor);
  return checkChain(await allRows(actor));
}

function applyFilters(rows: AuditLogRow[], f: AuditFilters): AuditLogRow[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.module && moduleOf(r.entity) !== f.module) return false;
    if (f.action && r.action !== f.action) return false;
    if (f.actor && r.actor_name !== f.actor) return false;
    const day = localDate(new Date(r.created_at));
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (q) {
      const e = toEntry(r);
      if (![e.summary, r.entity, r.entity_id, r.actor_name, ...e.details.map((d) => d.value)].some((s) => s.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

export async function listAudit(f: AuditFilters, actor: Session): Promise<AuditPageDTO> {
  requireHospitalId(actor);
  const rows = await allRows(actor);
  const filtered = applyFilters(rows, f);
  const pageSize = Math.min(Math.max(Number(f.pageSize) || 50, 1), 5000);
  const page = Math.max(Number(f.page) || 1, 1);
  const actions = [...new Set(rows.map((r) => r.action))].sort();
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize).map(toEntry), total: filtered.length, page, pageSize,
    modules: [...new Set(rows.map((r) => moduleOf(r.entity)))].sort(),
    actions: actions.map((value) => ({ value, label: actionLabel(value) })),
    actors: [...new Set(rows.map((r) => r.actor_name))].sort(),
    chain: checkChain(rows),
  };
}

/** Exporting the trail is itself something the trail records. */
export async function recordExport(format: "csv" | "pdf", count: number, actor: Session): Promise<void> {
  requireHospitalId(actor);
  await audit(actor, "export", "audit", format, { summary: `Exported ${count} audit entries as ${format.toUpperCase()}` });
}
