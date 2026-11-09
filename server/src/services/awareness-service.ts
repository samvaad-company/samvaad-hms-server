/**
 * Awareness programmes. A hospital's staff write a programme (health camp, webinar, vaccination drive…), save it as a draft or publish it.
 * Once published it is offered to the patient portal: in its awareness section, as a notification for each patient it reaches, and, if
 * the portal has given a webhook address, pushed to it the moment it is published or cancelled.
 *
 * A programme reaches every patient on the portal (audience "all") or only the posting hospital's own patients (audience "hospital").
 * The portal asks on behalf of one patient at a time and is only ever shown what that patient may see.
 */
import { createHmac } from "node:crypto";
import { awarenessEventsRepo, awarenessReadsRepo, hospitalsRepo, patientsRepo } from "@/repositories";
import type { AwarenessEventRow, AwarenessReadRow, HospitalRow, PatientRow } from "@/db/tables";
import { ConflictError, NotFoundError, ValidationError, type FieldError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { localDate } from "@/lib/clock";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { audit } from "@/services/audit";
import {
  AWARENESS_AUDIENCES, AWARENESS_CATEGORIES, AWARENESS_MODES,
  type AwarenessDTO, type AwarenessWebhookPayload, type PortalAwarenessDTO, type PortalAwarenessListDTO, type PortalNotificationDTO, type PortalNotificationListDTO,
} from "@shared/types/awareness";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isUrl = (s: string) => { try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };
const IMAGE_DATA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 450_000;
/** Notifications cover what was posted in the last this many days. */
const NOTIFY_DAYS = 45;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v).trim());

// ── Hospital side ───────────────────────────────────────────────────────────────────────────────────────────────────────────

interface Parsed { fields: Partial<AwarenessEventRow>; publish: boolean }

/** Check and clean what the form sent. `partial`: only the fields that were sent. */
function parse(input: unknown, partial: boolean): Parsed {
  const b = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const has = (k: string) => b[k] !== undefined;
  const out: Partial<AwarenessEventRow> = {};
  const need = (k: string) => !partial || has(k);

  if (need("title")) { const v = str(b.title); if (v.length < 3 || v.length > 140) errors.push({ field: "title", message: "give it a title of 3 to 140 characters" }); else out.title = v; }
  if (need("category")) { const v = str(b.category) || "Other"; if (!(AWARENESS_CATEGORIES as readonly string[]).includes(v)) errors.push({ field: "category", message: `choose one of: ${AWARENESS_CATEGORIES.join(", ")}` }); else out.category = v; }
  if (need("summary")) { const v = str(b.summary); if (v.length < 10 || v.length > 300) errors.push({ field: "summary", message: "write a short summary of 10 to 300 characters" }); else out.summary = v; }
  if (has("details")) { const v = str(b.details); if (v.length > 5000) errors.push({ field: "details", message: "the details are too long (5000 characters at most)" }); else out.details = v; } else if (!partial) out.details = "";
  if (has("eventDate")) { const v = str(b.eventDate); if (v && !isDate(v)) errors.push({ field: "eventDate", message: "use a date like 2026-12-01" }); else out.event_date = v; } else if (!partial) out.event_date = "";
  if (has("eventTime")) { const v = str(b.eventTime); if (v && !isTime(v)) errors.push({ field: "eventTime", message: "use a time like 10:30" }); else out.event_time = v; } else if (!partial) out.event_time = "";
  if (has("endDate")) { const v = str(b.endDate); if (v && !isDate(v)) errors.push({ field: "endDate", message: "use a date like 2026-12-03" }); else out.end_date = v; } else if (!partial) out.end_date = "";
  if (has("mode") || !partial) { const v = str(b.mode) || "In person"; if (!(AWARENESS_MODES as readonly string[]).includes(v)) errors.push({ field: "mode", message: "choose In person or Online" }); else out.mode = v; }
  if (has("venue")) { const v = str(b.venue); if (v.length > 200) errors.push({ field: "venue", message: "the venue is too long" }); else out.venue = v; } else if (!partial) out.venue = "";
  if (has("link")) { const v = str(b.link); if (v && (!isUrl(v) || v.length > 500)) errors.push({ field: "link", message: "use a full web address starting with https://" }); else out.link = v; } else if (!partial) out.link = "";
  if (has("contact")) { const v = str(b.contact); if (v.length > 120) errors.push({ field: "contact", message: "the contact is too long" }); else out.contact = v; } else if (!partial) out.contact = "";
  if (has("audience") || !partial) { const v = str(b.audience) || "all"; if (!(AWARENESS_AUDIENCES as readonly string[]).includes(v)) errors.push({ field: "audience", message: "choose all patients or this hospital's patients" }); else out.audience = v; }
  if (has("image")) {
    const v = typeof b.image === "string" ? b.image.trim() : "";
    if (v && !(isUrl(v) && v.startsWith("https://") && v.length <= 500) && !(IMAGE_DATA.test(v) && v.length <= MAX_IMAGE)) errors.push({ field: "image", message: "use an https picture link, or a PNG, JPEG or WebP under about 300 KB" });
    else out.image = v;
  } else if (!partial) out.image = "";

  // Cross checks, using what is being saved.
  const date = out.event_date, end = out.end_date;
  if (date && end && end < date) errors.push({ field: "endDate", message: "the end can't be before the start" });
  if (out.mode === "Online" && has("link") && !out.link) { /* a link is encouraged for online programmes but not required */ }

  if (errors.length) throw new ValidationError(errors);
  return { fields: out, publish: b.publish === true };
}

async function readCounts(hospitalId: number): Promise<Map<number, number>> {
  const { rows } = await awarenessReadsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never);
  const m = new Map<number, number>();
  for (const r of rows as AwarenessReadRow[]) m.set(r.event_id, (m.get(r.event_id) ?? 0) + 1);
  return m;
}

const toDto = (r: AwarenessEventRow, reads: number): AwarenessDTO => ({
  id: r.id, hospitalId: r.hospital_id, hospitalName: r.hospital_name, title: r.title, category: r.category as AwarenessDTO["category"], summary: r.summary, details: r.details,
  eventDate: r.event_date, eventTime: r.event_time, endDate: r.end_date, mode: r.mode as AwarenessDTO["mode"], venue: r.venue, link: r.link, contact: r.contact,
  audience: r.audience as AwarenessDTO["audience"], image: r.image, status: r.status as AwarenessDTO["status"], publishedAt: r.published_at, cancelledAt: r.cancelled_at,
  createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at, reads,
});

async function load(id: number, actor: Session): Promise<AwarenessEventRow> {
  const row = (await awarenessEventsRepo.getRow(id)) as AwarenessEventRow | null;
  assertOwnedByHospital(row, actor, "Awareness programme");
  return row as AwarenessEventRow;
}

export async function listAwareness(query: URLSearchParams, actor: Session): Promise<AwarenessDTO[]> {
  const hid = requireHospitalId(actor);
  const { rows } = await awarenessEventsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const status = query.get("status"), category = query.get("category"), q = (query.get("search") ?? "").toLowerCase().trim();
  const counts = await readCounts(hid);
  return (rows as AwarenessEventRow[])
    .filter((r) => (!status || r.status === status) && (!category || r.category === category) && (!q || `${r.title} ${r.summary} ${r.venue}`.toLowerCase().includes(q)))
    .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at) || b.id - a.id)
    .map((r) => toDto(r, counts.get(r.id) ?? 0));
}

export async function getAwareness(id: number, actor: Session): Promise<AwarenessDTO> {
  const row = await load(id, actor);
  return toDto(row, (await readCounts(row.hospital_id)).get(id) ?? 0);
}

export async function createAwareness(input: unknown, actor: Session): Promise<AwarenessDTO> {
  const hid = requireHospitalId(actor);
  const { fields, publish } = parse(input, false);
  const hospital = (await hospitalsRepo.getRow(hid)) as HospitalRow | null;
  const now = new Date().toISOString();
  const row = (await awarenessEventsRepo.create({
    hospital_id: hid, hospital_name: hospital?.name ?? "", status: publish ? "Published" : "Draft", published_at: publish ? now : null, cancelled_at: null, created_by: actor.name,
    ...(fields as Required<Pick<AwarenessEventRow, "title" | "category" | "summary" | "details" | "event_date" | "event_time" | "end_date" | "mode" | "venue" | "link" | "contact" | "audience" | "image">>),
  })) as AwarenessEventRow;
  await audit(actor, publish ? "awareness.publish" : "awareness.create", "awareness", row.id, { title: row.title });
  if (publish) void notifyPortal("awareness.published", row, hospital);
  return toDto(row, 0);
}

/** Edit a programme in any state; saving a published one changes what the portal shows but does not notify again. */
export async function updateAwareness(id: number, input: unknown, actor: Session): Promise<AwarenessDTO> {
  const row = await load(id, actor);
  const { fields } = parse(input, true);
  const next = { ...row, ...fields };
  if (next.event_date && next.end_date && next.end_date < next.event_date) throw new ValidationError([{ field: "endDate", message: "the end can't be before the start" }]);
  const updated = (await awarenessEventsRepo.update(id, fields)) as AwarenessEventRow;
  await audit(actor, "awareness.update", "awareness", id);
  return toDto(updated, (await readCounts(row.hospital_id)).get(id) ?? 0);
}

/** Draft or Cancelled -> Published. This is what notifies patients. */
export async function publishAwareness(id: number, actor: Session): Promise<AwarenessDTO> {
  const row = await load(id, actor);
  if (row.status === "Published") throw new ConflictError("This programme is already published.");
  const updated = (await awarenessEventsRepo.update(id, { status: "Published", published_at: new Date().toISOString(), cancelled_at: null })) as AwarenessEventRow;
  await audit(actor, "awareness.publish", "awareness", id);
  void notifyPortal("awareness.published", updated, (await hospitalsRepo.getRow(row.hospital_id)) as HospitalRow | null);
  return toDto(updated, 0);
}

/** Published -> Cancelled: patients who saw it are told it is off. A draft is simply deleted instead. */
export async function cancelAwareness(id: number, actor: Session): Promise<AwarenessDTO> {
  const row = await load(id, actor);
  if (row.status !== "Published") throw new ConflictError(row.status === "Draft" ? "A draft has not been published: delete it instead." : "This programme is already cancelled.");
  const updated = (await awarenessEventsRepo.update(id, { status: "Cancelled", cancelled_at: new Date().toISOString() })) as AwarenessEventRow;
  await audit(actor, "awareness.cancel", "awareness", id);
  void notifyPortal("awareness.cancelled", updated, (await hospitalsRepo.getRow(row.hospital_id)) as HospitalRow | null);
  return toDto(updated, (await readCounts(row.hospital_id)).get(id) ?? 0);
}

export async function removeAwareness(id: number, actor: Session): Promise<{ id: number }> {
  const row = await load(id, actor);
  const { rows } = await awarenessReadsRepo.listRows({ unpaged: true, filters: [{ column: "event_id", op: "eq", value: row.id }] } as never);
  for (const r of rows as AwarenessReadRow[]) await awarenessReadsRepo.remove(r.id);
  await awarenessEventsRepo.remove(id);
  await audit(actor, "awareness.delete", "awareness", id, { title: row.title });
  return { id };
}

// ── Patient portal side ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** The programme as a patient sees it. */
function portalShape(r: AwarenessEventRow, hospital: { id: number; name: string; city: string }, isNew: boolean, withDetails: boolean): PortalAwarenessDTO {
  const today = localDate();
  const start = r.event_date, end = r.end_date || r.event_date;
  const state: PortalAwarenessDTO["state"] = !start ? "info" : today < start ? "upcoming" : today > end ? "past" : "ongoing";
  return {
    id: r.id, title: r.title, category: r.category as PortalAwarenessDTO["category"], summary: r.summary, details: withDetails ? r.details : "", eventDate: r.event_date, eventTime: r.event_time, endDate: r.end_date,
    mode: r.mode as PortalAwarenessDTO["mode"], venue: r.venue, link: r.link, contact: r.contact, image: r.image, status: r.status === "Cancelled" ? "Cancelled" : "Published", state,
    publishedAt: r.published_at ?? r.created_at, hospital, isNew,
  };
}

async function patientOf(patientId: number): Promise<PatientRow> {
  const p = (await patientsRepo.getRow(patientId)) as PatientRow | null;
  if (!p) throw new NotFoundError("Patient");
  return p;
}

/** Everything a patient may see: published (or since cancelled) programmes from every hospital that posted for all patients, and their own hospital's. */
async function visibleTo(patient: PatientRow): Promise<{ events: AwarenessEventRow[]; hospitals: Map<number, { id: number; name: string; city: string }>; read: Set<number> }> {
  const { rows } = await awarenessEventsRepo.listRows({ unpaged: true } as never);
  const events = (rows as AwarenessEventRow[]).filter((e) => (e.status === "Published" || (e.status === "Cancelled" && e.published_at)) && (e.audience === "all" || e.hospital_id === patient.hospital_id));
  const hospitals = new Map<number, { id: number; name: string; city: string }>();
  for (const id of new Set(events.map((e) => e.hospital_id))) {
    const h = (await hospitalsRepo.getRow(id)) as HospitalRow | null;
    hospitals.set(id, { id, name: h?.name ?? "", city: h?.city ?? "" });
  }
  const { rows: reads } = await awarenessReadsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }] } as never);
  return { events, hospitals, read: new Set((reads as AwarenessReadRow[]).map((r) => r.event_id)) };
}

/** `?patientId=&scope=upcoming|past|all&category=&search=&page=&pageSize=`: newest first. */
export async function portalList(patientId: number, query: URLSearchParams): Promise<PortalAwarenessListDTO> {
  const patient = await patientOf(patientId);
  const { events, hospitals, read } = await visibleTo(patient);
  const scope = query.get("scope") ?? "all", category = query.get("category"), q = (query.get("search") ?? "").toLowerCase().trim();
  const pageSize = Math.min(50, Math.max(1, Number(query.get("pageSize")) || 20)), page = Math.max(1, Number(query.get("page")) || 1);
  const shaped = events
    .sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at) || b.id - a.id)
    .map((e) => portalShape(e, hospitals.get(e.hospital_id)!, !read.has(e.id), false))
    .filter((e) => (scope === "upcoming" ? e.state === "upcoming" || e.state === "ongoing" || e.state === "info" : scope === "past" ? e.state === "past" : true))
    .filter((e) => (!category || e.category === category) && (!q || `${e.title} ${e.summary} ${e.hospital.name}`.toLowerCase().includes(q)));
  return { items: shaped.slice((page - 1) * pageSize, page * pageSize), total: shaped.length, unread: shaped.filter((e) => e.isNew).length, page, pageSize, categories: AWARENESS_CATEGORIES };
}

async function markOneRead(patient: PatientRow, eventId: number): Promise<void> {
  const { rows } = await awarenessReadsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }, { column: "event_id", op: "eq", value: eventId }] } as never);
  if ((rows as AwarenessReadRow[]).length === 0) await awarenessReadsRepo.create({ hospital_id: patient.hospital_id, patient_id: patient.id, event_id: eventId, read_at: new Date().toISOString() });
}

/** One programme in full. Opening it marks it read for this patient. */
export async function portalGet(patientId: number, id: number): Promise<PortalAwarenessDTO> {
  const patient = await patientOf(patientId);
  const { events, hospitals, read } = await visibleTo(patient);
  const e = events.find((x) => x.id === id);
  if (!e) throw new NotFoundError("Awareness programme");
  const wasNew = !read.has(id);
  if (wasNew) await markOneRead(patient, id);
  return portalShape(e, hospitals.get(e.hospital_id)!, wasNew, true);
}

/** What to show under the portal's bell: programmes posted (or cancelled) in the last 45 days, newest first. */
export async function portalNotifications(patientId: number): Promise<PortalNotificationListDTO> {
  const patient = await patientOf(patientId);
  const { events, hospitals, read } = await visibleTo(patient);
  const since = Date.now() - NOTIFY_DAYS * 86_400_000;
  const items: PortalNotificationDTO[] = [];
  for (const e of events) {
    const cancelled = e.status === "Cancelled";
    const at = (cancelled ? e.cancelled_at : e.published_at) ?? e.published_at ?? e.created_at;
    if (new Date(at).getTime() < since) continue;
    const hospital = hospitals.get(e.hospital_id)!.name;
    items.push({
      id: e.id, kind: cancelled ? "awareness_cancelled" : "awareness_published", title: cancelled ? `Cancelled: ${e.title}` : e.title,
      body: cancelled ? `${hospital} has cancelled this programme.` : `${hospital}: ${e.summary}`, eventId: e.id, hospitalName: hospital, category: e.category as PortalNotificationDTO["category"], createdAt: at, read: read.has(e.id),
    });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return { unread: items.filter((n) => !n.read).length, items: items.slice(0, 50) };
}

/** `{ patientId, ids: [programme ids] }` or `{ patientId, all: true }`. */
export async function portalMarkRead(patientId: number, input: unknown): Promise<PortalNotificationListDTO> {
  const patient = await patientOf(patientId);
  const b = (typeof input === "object" && input !== null ? input : {}) as { ids?: unknown; all?: unknown };
  const { events, read } = await visibleTo(patient);
  const wanted = b.all === true ? events.map((e) => e.id) : Array.isArray(b.ids) ? b.ids.map(Number).filter((n) => events.some((e) => e.id === n)) : [];
  for (const id of wanted) if (!read.has(id)) await markOneRead(patient, id);
  return portalNotifications(patientId);
}

// ── Push to the portal ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Tell the portal straight away. Needs PORTAL_WEBHOOK_URL; the body is signed with PORTAL_API_KEY (header `x-hms-signature: sha256=<hex hmac of the body>`)
 * so the portal can check it came from the HMS. Failing to reach the portal never fails the post: the portal also polls.
 */
export async function notifyPortal(type: AwarenessWebhookPayload["type"], row: AwarenessEventRow, hospital: HospitalRow | null): Promise<void> {
  const url = process.env.PORTAL_WEBHOOK_URL, key = process.env.PORTAL_API_KEY;
  if (!url || !key) return;
  try {
    const shaped = portalShape(row, { id: row.hospital_id, name: hospital?.name ?? row.hospital_name, city: hospital?.city ?? "" }, true, true);
    const { isNew: _drop, ...awareness } = shaped;
    const body = JSON.stringify({ type, occurredAt: new Date().toISOString(), awareness: { ...awareness, audience: row.audience, hospitalId: row.hospital_id } });
    const signature = createHmac("sha256", key).update(body).digest("hex");
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-hms-event": type, "x-hms-signature": `sha256=${signature}` }, body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) logger.warn("awareness.webhook_rejected", { status: res.status, type, id: row.id });
  } catch (e) {
    logger.warn("awareness.webhook_failed", { type, id: row.id, error: e instanceof Error ? e.message : String(e) });
  }
}
