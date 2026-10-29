/**
 * MRD file tracking — where every physical patient file is, who has it and when it is due back.
 *
 *   Available ──checkout──▶ Checked out ──return──▶ Available
 *       │  └──────dispatch (a request)──▶ In transit ──return──▶ Available
 *       └──archive──▶ Archived ──retrieve──▶ Available
 *
 * One file per patient (F/2026/00017), kept in a named location (a rack, an archive room, a nurse station, a
 * doctor's cabin). Every move is written to the file's movement trail. Two people reaching for the same file at
 * once are handled one after the other, so the second is told who has it instead of silently taking it.
 */
import {
  mrdLocationsRepo,
  mrdFilesRepo,
  mrdFileRequestsRepo,
  mrdFileMovementsRepo,
  patientsRepo,
  ipdRepo,
  departmentsRepo,
  doctorsRepo,
} from "@/repositories";
import { toMrdLocationDTO, toMrdFileDTO, toMrdFileMovementDTO, toMrdFileRequestDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { transactional, type UnitOfWork } from "@/db/unit-of-work";
import { TABLES, type MrdFileRow, type MrdFileRequestRow, type MrdLocationRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { localDate } from "@/lib/clock";
import { withKeyLocks, singleFlight } from "@/lib/key-lock";
import { defaultLocationPlan, rackFor } from "@/services/mrd-defaults";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import { MRD_LOCATION_KINDS, type MrdFileSummaryDTO } from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

const yy = (iso: string) => iso.slice(2, 4);

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Today's file-room date and the instant, together, so a move and its trail line agree. */
const stampNow = () => ({ today: localDate(), at: new Date().toISOString() });

// ── Locations ────────────────────────────────────────────────────────────────

const locationSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  kind: { type: "enum", required: false, values: MRD_LOCATION_KINDS, default: "MRD rack" },
  code: { type: "string", required: false, max: 20, default: "" },
  active: { type: "boolean", required: false, default: true },
} as const;

/**
 * A hospital that has never used file tracking starts with the places a file normally lives: three racks by UHID range,
 * two archive rooms, the OT file counter, a nurse station per department and a cabin per doctor. They are ordinary
 * locations afterwards — rename, switch off or add as needed. One adoption at a time per hospital.
 */
export function ensureLocations(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`mrd-locations:${hospitalId}`, async () => {
    const existing = await mrdLocationsRepo.listRows(scopeToHospital({ pageSize: 1 }, actor));
    if (existing.total > 0) return;
    const [{ rows: departments }, { rows: doctors }] = await Promise.all([
      departmentsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor)),
      doctorsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "name", direction: "asc" }] }, actor)),
    ]);
    const plan = defaultLocationPlan(departments.map((d) => d.name), doctors.map((d) => d.name));
    for (const p of plan) await mrdLocationsRepo.create({ hospital_id: hospitalId, ...p, active: true });
  });
}

export async function listLocations(actor: Session) {
  await ensureLocations(actor);
  const [{ rows }, { rows: files }] = await Promise.all([
    mrdLocationsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor)),
    mrdFilesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const counts = new Map<number, number>();
  for (const f of files) if (f.location_id != null) counts.set(f.location_id, (counts.get(f.location_id) ?? 0) + 1);
  return rows.map((r) => toMrdLocationDTO(r, counts.get(r.id) ?? 0));
}

async function assertLocationNameFree(name: string, actor: Session, exceptId?: number) {
  const { rows } = await mrdLocationsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  if (rows.some((r) => r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    throw new ConflictError(`A location called "${name}" already exists`);
  }
}

export async function createLocation(input: unknown, actor: Session) {
  const data = validate(locationSchema, input);
  await assertLocationNameFree(data.name, actor);
  const row = await mrdLocationsRepo.create({ hospital_id: requireHospitalId(actor), name: data.name, kind: data.kind, code: data.code, active: data.active });
  await audit(actor, "create", "mrd-location", row.id);
  return toMrdLocationDTO(row as MrdLocationRow);
}

export async function updateLocation(id: number, input: unknown, actor: Session) {
  const existing = await mrdLocationsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Location");
  const data = validatePartial(locationSchema, input);
  const patch: Record<string, unknown> = {};
  for (const k of ["kind", "code", "active"] as const) if (k in data) patch[k] = data[k];
  if ("name" in data && data.name !== existing.name) {
    await assertLocationNameFree(data.name as string, actor, id);
    patch.name = data.name;
  }
  const row = await mrdLocationsRepo.update(id, patch);
  // Files and requests carry the location's name for display, so a rename follows them.
  if (patch.name) {
    const [{ rows: files }, { rows: requests }] = await Promise.all([
      mrdFilesRepo.listRows({ unpaged: true, filters: [{ column: "location_id", op: "eq", value: id }] }),
      mrdFileRequestsRepo.listRows({ unpaged: true, filters: [{ column: "destination_id", op: "eq", value: id }] }),
    ]);
    await Promise.all([
      ...files.map((f) => mrdFilesRepo.update(f.id, { location_name: patch.name })),
      ...requests.map((r) => mrdFileRequestsRepo.update(r.id, { destination_name: patch.name })),
    ]);
  }
  await audit(actor, "update", "mrd-location", id, patch);
  return toMrdLocationDTO(row as MrdLocationRow);
}

async function ownedLocation(id: number, actor: Session, label = "Location"): Promise<MrdLocationRow> {
  const row = await mrdLocationsRepo.getRow(id);
  assertOwnedByHospital(row, actor, label);
  return row as MrdLocationRow;
}

/** A place a file can be sent to: it must exist, be switched on, and not be an archive room (archiving is its own step). */
async function destination(id: number, actor: Session, opts: { archive?: boolean } = {}): Promise<MrdLocationRow> {
  const loc = await ownedLocation(id, actor);
  if (!loc.active) throw new ConflictError(`${loc.name} is switched off`);
  const isArchive = loc.kind === "Archive room";
  if (opts.archive && !isArchive) throw new ValidationError([{ field: "locationId", message: "choose an archive room" }]);
  if (!opts.archive && isArchive) throw new ValidationError([{ field: "locationId", message: "an archive room is for archiving — use Archive" }]);
  return loc;
}

async function firstActive(kind: string, actor: Session): Promise<MrdLocationRow | null> {
  const { rows } = await mrdLocationsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
  return (rows.find((r) => r.kind === kind && r.active) as MrdLocationRow | undefined) ?? null;
}

// ── Files ────────────────────────────────────────────────────────────────────

/**
 * Every patient has a file. Patients registered since the last visit get one now, in the rack their UHID belongs to,
 * and a file whose patient has since been admitted becomes an IPD file. One pass at a time per hospital.
 */
export function ensureFiles(actor: Session): Promise<void> {
  const hospitalId = actor.hospitalId;
  if (hospitalId == null) return Promise.resolve();
  return singleFlight(`mrd-files:${hospitalId}`, async () => {
    await ensureLocations(actor);
    const [patientCount, fileCount] = await Promise.all([
      patientsRepo.count(scopeToHospital({}, actor)),
      mrdFilesRepo.count(scopeToHospital({}, actor)),
    ]);
    const { rows: admissions } = await ipdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const admitted = new Set(admissions.map((a) => a.patient_id).filter((x): x is number => x != null));
    const { rows: files } = await mrdFilesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    for (const f of files) if (f.file_type !== "IPD" && admitted.has(f.patient_id)) await mrdFilesRepo.update(f.id, { file_type: "IPD" });
    if (fileCount >= patientCount) return;

    const have = new Set(files.map((f) => f.patient_id));
    const { rows: patients } = await patientsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
    const { rows: locations } = await mrdLocationsRepo.listRows(scopeToHospital({ unpaged: true, sort: [{ column: "id", direction: "asc" }] }, actor));
    const racks = locations.filter((l) => l.kind === "MRD rack" && l.active) as MrdLocationRow[];
    const { today, at } = stampNow();
    const codes = files.map((f) => f.file_no);
    for (const p of patients) {
      if (have.has(p.id)) continue;
      const rack = rackFor(p.patient_code, racks);
      const fileNo = await nextNumber("mrd_file", actor, codes, { prefix: `F/${yy(today)}/`, pad: 5 });
      codes.push(fileNo);
      const row = await mrdFilesRepo.create({
        hospital_id: hospitalId,
        file_no: fileNo,
        patient_id: p.id,
        patient_name: p.name,
        patient_code: p.patient_code,
        file_type: admitted.has(p.id) ? "IPD" : "OPD",
        status: "Available",
        location_id: rack?.id ?? null,
        location_name: rack?.name ?? "",
        home_location_id: rack?.id ?? null,
        holder_name: null,
        due_on: null,
        checked_out_at: null,
        archived_on: null,
      });
      await mrdFileMovementsRepo.create({
        hospital_id: hospitalId, file_id: row.id, file_no: fileNo, action: "Created", from_location: "", to_location: rack?.name ?? "",
        holder_name: null, due_on: null, note: "File opened", by_name: actor.name, at,
      });
    }
  });
}

export const FILES_LIST_CONFIG = {
  searchColumns: ["file_no", "patient_name", "patient_code"],
  filterable: ["status", "file_type", "location_id", "patient_id"],
  sortable: ["updated_at", "file_no", "due_on", "id"],
  defaultSort: [{ column: "updated_at" as const, direction: "desc" as const }],
};

export async function listFiles(options: QueryOptions, actor: Session) {
  await ensureFiles(actor);
  const today = localDate();
  const { rows, total } = await mrdFilesRepo.listRows(scopeToHospital(options, actor));
  return { rows: rows.map((r) => toMrdFileDTO(r as MrdFileRow, today)), total };
}

async function ownedFile(id: number, actor: Session): Promise<MrdFileRow> {
  const row = await mrdFilesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "File");
  return row as MrdFileRow;
}

export async function getFile(id: number, actor: Session) {
  return toMrdFileDTO(await ownedFile(id, actor), localDate());
}

const dto = (r: unknown) => toMrdFileDTO(r as MrdFileRow, localDate());

/** Open a file for a patient who somehow has none (the normal route is automatic). */
export async function createFile(input: unknown, actor: Session) {
  const { patientId } = validate({ patientId: { type: "number", required: true, min: 1 } } as const, input);
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  await ensureFiles(actor);
  const { rows } = await mrdFilesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] }, actor));
  if (!rows[0]) throw new ConflictError("This patient's file could not be opened");
  return dto(rows[0]);
}

type MoveFields = Partial<MrdFileRow> & { status: string };

/** Write the new state of a file and its trail line together. */
async function moveFile(
  uow: UnitOfWork,
  file: MrdFileRow,
  patch: MoveFields,
  trail: { action: string; to: string; holder?: string | null; dueOn?: string | null; note?: string },
  actor: Session,
  at: string,
) {
  const updated = await uow.update<MrdFileRow>(TABLES.mrdFiles, file.id, patch);
  await uow.insert(TABLES.mrdFileMovements, {
    hospital_id: file.hospital_id,
    file_id: file.id,
    file_no: file.file_no,
    action: trail.action,
    from_location: file.location_name ?? "",
    to_location: trail.to,
    holder_name: trail.holder ?? null,
    due_on: trail.dueOn ?? null,
    note: trail.note ?? "",
    by_name: actor.name,
    at,
  });
  return updated as MrdFileRow;
}

const noteField = { type: "string", required: false, max: 200, default: "" } as const;

const checkoutSchema = {
  holder: { type: "string", required: true, min: 2, max: 80 },
  locationId: { type: "number", required: true, min: 1 },
  dueOn: { type: "date", required: true },
  note: noteField,
} as const;

/** Hand an available file to someone, to be back by a date. */
export async function checkoutFile(id: number, input: unknown, actor: Session) {
  await ownedFile(id, actor);
  const data = validate(checkoutSchema, input);
  const { today, at } = stampNow();
  if (data.dueOn < today) throw new ValidationError([{ field: "dueOn", message: "can't be in the past" }]);
  const where = await destination(data.locationId, actor);
  const updated = await withKeyLocks([`file:${id}`], async () => {
    const file = await ownedFile(id, actor);
    if (file.status !== "Available") throw new ConflictError(`${file.file_no} is ${file.status.toLowerCase()}${file.holder_name ? ` with ${file.holder_name}` : ""} — it can only be checked out when it is available`);
    return transactional("mrd.checkout", (uow) =>
      moveFile(uow, file,
        { status: "Checked out", location_id: where.id, location_name: where.name, holder_name: data.holder, due_on: data.dueOn, checked_out_at: at },
        { action: "Checked out", to: where.name, holder: data.holder, dueOn: data.dueOn, note: data.note }, actor, at));
  });
  await audit(actor, "checkout", "mrd-file", id, { holder: data.holder, locationId: data.locationId, dueOn: data.dueOn });
  return dto(updated);
}

/** Close the open dispatched request for a file, if there is one. */
async function closeOpenRequest(uow: UnitOfWork, fileId: number, actor: Session, at: string) {
  const { rows } = await mrdFileRequestsRepo.listRows({ unpaged: true, filters: [{ column: "file_id", op: "eq", value: fileId }] });
  for (const r of rows) if (r.status === "Dispatched") await uow.update(TABLES.mrdFileRequests, r.id, { status: "Returned", returned_at: at, returned_by: actor.name });
}

const returnSchema = { locationId: { type: "number", required: false, min: 1 }, note: noteField } as const;

async function doReturn(file: MrdFileRow, locationId: number | undefined, note: string, actor: Session) {
  const { at } = stampNow();
  const target = locationId
    ? await destination(locationId, actor)
    : (file.home_location_id ? await ownedLocation(file.home_location_id, actor).catch(() => null) : null) ?? (await firstActive("MRD rack", actor));
  if (!target) throw new ConflictError("There is no MRD rack to return the file to — add a location first");
  return transactional("mrd.return", async (uow) => {
    const row = await moveFile(uow, file,
      { status: "Available", location_id: target.id, location_name: target.name, holder_name: null, due_on: null, checked_out_at: null },
      { action: "Returned", to: target.name, holder: file.holder_name, note }, actor, at);
    await closeOpenRequest(uow, file.id, actor, at);
    return row;
  });
}

/** Bring a checked-out or in-transit file back to a rack (its home rack unless told otherwise). */
export async function returnFile(id: number, input: unknown, actor: Session) {
  await ownedFile(id, actor);
  const data = validate(returnSchema, input ?? {});
  const updated = await withKeyLocks([`file:${id}`], async () => {
    const file = await ownedFile(id, actor);
    if (file.status !== "Checked out" && file.status !== "In transit") throw new ConflictError(`${file.file_no} is ${file.status.toLowerCase()} — only a file that is out can be returned`);
    return doReturn(file, data.locationId, data.note, actor);
  });
  await audit(actor, "return", "mrd-file", id);
  return dto(updated);
}

/** Move an available file into an archive room (default: the first one). */
export async function archiveFile(id: number, input: unknown, actor: Session) {
  await ownedFile(id, actor);
  const data = validate(returnSchema, input ?? {});
  const { today, at } = stampNow();
  const updated = await withKeyLocks([`file:${id}`], async () => {
    const file = await ownedFile(id, actor);
    if (file.status !== "Available") throw new ConflictError(`${file.file_no} is ${file.status.toLowerCase()} — bring it back before archiving`);
    const target = data.locationId ? await destination(data.locationId, actor, { archive: true }) : await firstActive("Archive room", actor);
    if (!target) throw new ConflictError("There is no archive room — add one under Locations first");
    return transactional("mrd.archive", (uow) =>
      moveFile(uow, file, { status: "Archived", location_id: target.id, location_name: target.name, archived_on: today },
        { action: "Archived", to: target.name, note: data.note }, actor, at));
  });
  await audit(actor, "archive", "mrd-file", id);
  return dto(updated);
}

/** Take an archived file out of the archive room, back to its home rack. */
export async function retrieveFile(id: number, input: unknown, actor: Session) {
  await ownedFile(id, actor);
  const data = validate(returnSchema, input ?? {});
  const { at } = stampNow();
  const updated = await withKeyLocks([`file:${id}`], async () => {
    const file = await ownedFile(id, actor);
    if (file.status !== "Archived") throw new ConflictError(`${file.file_no} is not in the archive`);
    const target = data.locationId
      ? await destination(data.locationId, actor)
      : (file.home_location_id ? await ownedLocation(file.home_location_id, actor).catch(() => null) : null) ?? (await firstActive("MRD rack", actor));
    if (!target) throw new ConflictError("There is no MRD rack to put the file on — add a location first");
    return transactional("mrd.retrieve", (uow) =>
      moveFile(uow, file, { status: "Available", location_id: target.id, location_name: target.name, archived_on: null },
        { action: "Retrieved", to: target.name, note: data.note }, actor, at));
  });
  await audit(actor, "retrieve", "mrd-file", id);
  return dto(updated);
}

/** Re-shelve an available file somewhere else (a different rack, the OT counter…). */
export async function relocateFile(id: number, input: unknown, actor: Session) {
  await ownedFile(id, actor);
  const data = validate({ locationId: { type: "number", required: true, min: 1 }, note: noteField } as const, input);
  const { at } = stampNow();
  const where = await destination(data.locationId, actor);
  const updated = await withKeyLocks([`file:${id}`], async () => {
    const file = await ownedFile(id, actor);
    if (file.status !== "Available") throw new ConflictError(`${file.file_no} is ${file.status.toLowerCase()} — only an available file can be moved`);
    if (file.location_id === where.id) throw new ConflictError(`${file.file_no} is already at ${where.name}`);
    return transactional("mrd.move", (uow) =>
      moveFile(uow, file, { status: "Available", location_id: where.id, location_name: where.name },
        { action: "Moved", to: where.name, note: data.note }, actor, at));
  });
  await audit(actor, "move", "mrd-file", id, { locationId: data.locationId });
  return dto(updated);
}

/** The file's trail, newest first. */
export async function fileHistory(id: number, actor: Session) {
  await ownedFile(id, actor);
  const { rows } = await mrdFileMovementsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "file_id", op: "eq", value: id }] }, actor));
  return rows.map(toMrdFileMovementDTO).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id - a.id));
}

// ── Requests ─────────────────────────────────────────────────────────────────

export const REQUESTS_LIST_CONFIG = {
  searchColumns: ["file_no", "patient_name", "requested_for"],
  filterable: ["status", "urgency", "file_id"],
  sortable: ["requested_at", "requested_on", "id"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listRequests(options: QueryOptions, actor: Session) {
  await ensureFiles(actor);
  return mrdFileRequestsRepo.list(scopeToHospital(options, actor));
}

async function ownedRequest(id: number, actor: Session): Promise<MrdFileRequestRow> {
  const row = await mrdFileRequestsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Request");
  return row as MrdFileRequestRow;
}

const requestSchema = {
  fileId: { type: "number", required: true, min: 1 },
  urgency: { type: "enum", required: false, values: ["Routine", "Urgent"], default: "Routine" },
  requestedFor: { type: "string", required: false, max: 80, default: "" },
  destinationId: { type: "number", required: false, min: 1 },
  note: noteField,
} as const;

/** A ward or doctor asks MRD for a file. One open request per file. */
export async function createRequest(input: unknown, actor: Session) {
  const data = validate(requestSchema, input);
  const file = await ownedFile(data.fileId, actor);
  const where = data.destinationId ? await destination(data.destinationId, actor) : null;
  const created = await withKeyLocks([`file:${file.id}`], async () => {
    const { rows } = await mrdFileRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "file_id", op: "eq", value: file.id }] }, actor));
    const open = rows.find((r) => r.status === "Pending" || r.status === "Dispatched");
    if (open) throw new ConflictError(`${file.file_no} already has a ${open.status.toLowerCase()} request for ${open.requested_for || open.requested_by}`);
    const { today, at } = stampNow();
    return mrdFileRequestsRepo.create({
      hospital_id: requireHospitalId(actor),
      file_id: file.id,
      file_no: file.file_no,
      patient_id: file.patient_id,
      patient_name: file.patient_name,
      urgency: data.urgency,
      status: "Pending",
      requested_on: today,
      requested_by: actor.name,
      requested_for: data.requestedFor || actor.name,
      destination_id: where?.id ?? null,
      destination_name: where?.name ?? "",
      note: data.note,
      dispatched_at: null, dispatched_by: null, returned_at: null, returned_by: null, cancelled_at: null,
      created_at: at,
    });
  });
  await audit(actor, "request", "mrd-file-request", created.id, { fileId: file.id });
  return toMrdFileRequestDTO(created as MrdFileRequestRow);
}

/** Send the file out against a request: it goes In transit to the destination, held by whoever asked. */
export async function dispatchRequest(id: number, input: unknown, actor: Session) {
  const req0 = await ownedRequest(id, actor);
  const data = validate({ dueOn: { type: "date", required: false }, note: noteField } as const, input ?? {});
  const { today, at } = stampNow();
  const result = await withKeyLocks([`file:${req0.file_id}`, `request:${id}`], async () => {
    const req = await ownedRequest(id, actor);
    if (req.status !== "Pending") throw new ConflictError(`This request is already ${req.status.toLowerCase()}`);
    const file = await ownedFile(req.file_id, actor);
    if (file.status === "Archived") throw new ConflictError(`${file.file_no} is in the archive — retrieve it first`);
    if (file.status !== "Available") throw new ConflictError(`${file.file_no} is ${file.status.toLowerCase()}${file.holder_name ? ` with ${file.holder_name}` : ""} — it can only be dispatched when it is available`);
    const due = data.dueOn ?? addDays(today, req.urgency === "Urgent" ? 2 : 7);
    if (due < today) throw new ValidationError([{ field: "dueOn", message: "can't be in the past" }]);
    const dest = req.destination_id ? await ownedLocation(req.destination_id, actor).catch(() => null) : null;
    const holder = req.requested_for || req.requested_by;
    return transactional("mrd.dispatch", async (uow) => {
      await moveFile(uow, file,
        { status: "In transit", location_id: dest?.id ?? file.location_id, location_name: dest?.name ?? file.location_name, holder_name: holder, due_on: due, checked_out_at: at },
        { action: "Dispatched", to: dest?.name ?? file.location_name, holder, dueOn: due, note: data.note || `Request by ${req.requested_by}` }, actor, at);
      return uow.update<MrdFileRequestRow>(TABLES.mrdFileRequests, id, { status: "Dispatched", dispatched_at: at, dispatched_by: actor.name });
    });
  });
  await audit(actor, "dispatch", "mrd-file-request", id);
  return toMrdFileRequestDTO(result as MrdFileRequestRow);
}

/** The requester has sent the file back: the request closes and the file returns to its rack. */
export async function markRequestReturned(id: number, actor: Session) {
  const req0 = await ownedRequest(id, actor);
  const result = await withKeyLocks([`file:${req0.file_id}`, `request:${id}`], async () => {
    const req = await ownedRequest(id, actor);
    if (req.status !== "Dispatched") throw new ConflictError(`This request is ${req.status.toLowerCase()} — only a dispatched one can be marked returned`);
    const file = await ownedFile(req.file_id, actor);
    if (file.status === "Checked out" || file.status === "In transit") await doReturn(file, undefined, `Request ${req.id} returned`, actor);
    else await mrdFileRequestsRepo.update(id, { status: "Returned", returned_at: new Date().toISOString(), returned_by: actor.name });
    return ownedRequest(id, actor);
  });
  await audit(actor, "request-returned", "mrd-file-request", id);
  return toMrdFileRequestDTO(result as MrdFileRequestRow);
}

export async function cancelRequest(id: number, actor: Session) {
  const req0 = await ownedRequest(id, actor);
  const result = await withKeyLocks([`request:${id}`, `file:${req0.file_id}`], async () => {
    const req = await ownedRequest(id, actor);
    if (req.status !== "Pending") throw new ConflictError(`A ${req.status.toLowerCase()} request can't be cancelled`);
    return mrdFileRequestsRepo.update(id, { status: "Cancelled", cancelled_at: new Date().toISOString() });
  });
  await audit(actor, "cancel", "mrd-file-request", id);
  return toMrdFileRequestDTO(result as MrdFileRequestRow);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function fileSummary(actor: Session): Promise<MrdFileSummaryDTO> {
  await ensureFiles(actor);
  const today = localDate();
  const [{ rows: files }, { rows: requests }] = await Promise.all([
    mrdFilesRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
    mrdFileRequestsRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const count = (s: string) => files.filter((f) => f.status === s).length;
  return {
    available: count("Available"),
    checkedOut: count("Checked out"),
    inTransit: count("In transit"),
    overdue: files.filter((f) => (f.status === "Checked out" || f.status === "In transit") && f.due_on && f.due_on < today).length,
    pendingRequests: requests.filter((r) => r.status === "Pending").length,
    archived: count("Archived"),
  };
}
