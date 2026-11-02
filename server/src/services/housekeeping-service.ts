/**
 * Housekeeping: the cleaning board, room readiness and the linen ledger.
 *
 *   Tasks   Pending ──start──▶ In progress ──complete──▶ Completed ──verify──▶ Verified (leaves the board)
 *           (a Pending job can also be completed straight away). Three kinds: a routine clean of each ward every day (raised here
 *           the first time the board is opened that day), a bed turnaround raised automatically when a patient is discharged,
 *           and ad hoc jobs raised by hand.
 *   Rooms   A bed is Ready when it is free and nothing is open against it; Cleaning while a job is open; To verify once the job is
 *           done but not yet signed off.
 *   Linen   An append-only ledger: new stock → store → wards → soiled hold → laundry → store. Every balance is the sum of the
 *           ledger, and a movement that would take more than there is, is refused.
 */
import { bedsRepo, hkLinenCategoriesRepo, hkLinenMovesRepo, hkTasksRepo, staffRepo, wardsRepo } from "@/repositories";
import type { BedRow, HkLinenCategoryRow, HkLinenMoveRow, HkTaskRow, StaffRow, WardRow } from "@/db/tables";
import { validate } from "@/lib/validation";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface HkTaskDTO {
  id: number; kind: string; source: string; title: string; ward: string; location: string; assignee: string; notes: string;
  status: string; date: string; startedAt: string | null; completedAt: string | null; completionNotes: string; verifiedBy: string;
}
const toTask = (r: HkTaskRow): HkTaskDTO => ({
  id: r.id, kind: r.kind, source: r.source, title: r.title, ward: r.ward, location: r.location, assignee: r.assignee, notes: r.notes, status: r.status, date: r.task_date,
  startedAt: r.started_at, completedAt: r.completed_at, completionNotes: r.completion_notes, verifiedBy: r.verified_by,
});

const OPEN = ["Pending", "In progress"];
const bedLabel = (b: Pick<BedRow, "ward" | "bed_number">): string => `${b.ward} · Bed ${b.bed_number}`;

/** One routine clean per ward per day, raised the first time anyone looks at the board that day. */
async function ensureRoutine(actor: Session): Promise<void> {
  const hospitalId = requireHospitalId(actor);
  const today = localDate();
  await withKeyLocks([`hk-routine:${hospitalId}`], async () => {
    const [wards, tasks] = await Promise.all([all<WardRow>(wardsRepo, actor), all<HkTaskRow>(hkTasksRepo, actor)]);
    const done = new Set(tasks.filter((t) => t.kind === "Routine clean" && t.task_date === today).map((t) => t.ward_id));
    for (const w of wards) {
      if (done.has(w.id)) continue;
      await hkTasksRepo.create({
        hospital_id: hospitalId, kind: "Routine clean", source: "Scheduled", title: w.name, ward_id: w.id, ward: w.name, bed_id: null, location: "", assignee: "",
        notes: "Routine cleaning of corridors, washrooms and nursing station.", status: "Pending", task_date: today, started_at: null, completed_at: null,
        completion_notes: "", verified_by: "", verified_at: null, created_by: "system",
      });
    }
  });
}

/** Called when a patient is discharged: the bed needs a terminal clean before the next admission. Never blocks the discharge. */
export async function raiseBedTurnaround(bed: { id: number; hospitalId: number; ward: string; wardId: number | null; label: string; patient?: string }): Promise<void> {
  try {
    const open = (await hkTasksRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: bed.hospitalId }, { column: "bed_id", op: "eq", value: bed.id }] })).rows
      .some((t) => t.status !== "Verified");
    if (open) return;
    await hkTasksRepo.create({
      hospital_id: bed.hospitalId, kind: "Bed turnaround", source: "Discharge", title: bed.label, ward_id: bed.wardId, ward: bed.ward, bed_id: bed.id, location: "", assignee: "",
      notes: "Terminal cleaning of discharged bed before next admission - strip linen, disinfect, restock and make the bed.", status: "Pending", task_date: localDate(),
      started_at: null, completed_at: null, completion_notes: "", verified_by: "", verified_at: null, created_by: "system",
    });
  } catch { /* housekeeping must never stop a discharge */ }
}

const createSchema = {
  wardId: { type: "number", required: false },
  bedId: { type: "number", required: false },
  location: { type: "string", required: false, max: 120, default: "" },
  assignee: { type: "string", required: false, max: 120, default: "" },
  notes: { type: "string", required: false, max: 1000, default: "" },
} as const;

export async function createTask(body: unknown, actor: Session): Promise<HkTaskDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate(createSchema, body);
  let ward = ""; let wardId: number | null = null; let bed: BedRow | null = null;
  if (data.bedId != null) {
    bed = await bedsRepo.getRow(data.bedId);
    assertOwnedByHospital(bed, actor, "Bed");
    ward = bed.ward; wardId = bed.ward_id;
  } else if (data.wardId != null) {
    const w = await wardsRepo.getRow(data.wardId);
    assertOwnedByHospital(w, actor, "Ward");
    ward = w.name; wardId = w.id;
  }
  const location = (data.location ?? "").trim();
  if (!ward && !location) throw new ValidationError([{ field: "location", message: "Say where: pick a ward or bed, or name a location" }]);
  const row = await hkTasksRepo.create({
    hospital_id: hospitalId, kind: "Ad hoc", source: "Manual", title: bed ? bedLabel(bed) : location || ward, ward_id: wardId, ward, bed_id: bed?.id ?? null, location,
    assignee: (data.assignee ?? "").trim(), notes: data.notes ?? "", status: "Pending", task_date: localDate(), started_at: null, completed_at: null,
    completion_notes: "", verified_by: "", verified_at: null, created_by: actor.name,
  });
  await audit(actor, "create", "housekeeping-task", row.id, { name: row.title });
  return toTask(row);
}

async function load(id: number, actor: Session): Promise<HkTaskRow> {
  const row = await hkTasksRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Task");
  return row;
}

async function move(id: number, actor: Session, from: string[], patch: Partial<HkTaskRow>, verb: string): Promise<HkTaskDTO> {
  const row = await load(id, actor);
  if (!from.includes(row.status)) throw new ConflictError(`That task is ${row.status.toLowerCase()} — it can't be ${verb} now`);
  const updated = await hkTasksRepo.update(id, patch as Record<string, unknown>);
  await audit(actor, verb, "housekeeping-task", id, { name: row.title });
  return toTask(updated as HkTaskRow);
}

export const startTask = (id: number, actor: Session) => move(id, actor, ["Pending"], { status: "In progress", started_at: new Date().toISOString() }, "started");

export async function assignTask(id: number, body: unknown, actor: Session): Promise<HkTaskDTO> {
  const { assignee } = validate({ assignee: { type: "string", required: true, min: 1, max: 120 } } as const, body);
  return move(id, actor, OPEN.concat("Completed"), { assignee: assignee.trim() }, "assigned");
}

export async function completeTask(id: number, body: unknown, actor: Session): Promise<HkTaskDTO> {
  const { notes } = validate({ notes: { type: "string", required: false, max: 1000, default: "" } } as const, body ?? {});
  return move(id, actor, OPEN, { status: "Completed", completed_at: new Date().toISOString(), completion_notes: notes ?? "" }, "completed");
}

export async function verifyTask(id: number, body: unknown, actor: Session): Promise<HkTaskDTO> {
  const { notes } = validate({ notes: { type: "string", required: false, max: 1000, default: "" } } as const, body ?? {});
  const row = await load(id, actor);
  const extra = (notes ?? "").trim();
  return move(id, actor, ["Completed"], { status: "Verified", verified_by: actor.name, verified_at: new Date().toISOString(), ...(extra ? { completion_notes: [row.completion_notes, extra].filter(Boolean).join(" · ") } : {}) }, "verified");
}

// ─── Board and room readiness ────────────────────────────────────────────────

export interface HkRoomDTO { id: number; ward: string; wardId: number | null; label: string; number: string; state: "Ready" | "Occupied" | "Cleaning" | "To verify" | "Unavailable"; patient: string; taskId: number | null }
export interface HkBoardDTO {
  counts: { pending: number; cleaning: number; toVerify: number; ready: number; beds: number };
  tasks: HkTaskDTO[];
  rooms: HkRoomDTO[];
  wards: { id: number; name: string }[];
  beds: { id: number; wardId: number | null; label: string }[];
  staff: { id: number; name: string; role: string }[];
}

export async function getBoard(actor: Session): Promise<HkBoardDTO> {
  requireHospitalId(actor);
  await ensureRoutine(actor);
  const [tasks, beds, wards, staff] = await Promise.all([all<HkTaskRow>(hkTasksRepo, actor), all<BedRow>(bedsRepo, actor), all<WardRow>(wardsRepo, actor), all<StaffRow>(staffRepo, actor)]);
  const live = tasks.filter((t) => t.status !== "Verified");
  const byBed = new Map<number, HkTaskRow>();
  for (const t of live) if (t.bed_id != null) { const seen = byBed.get(t.bed_id); if (!seen || t.id > seen.id) byBed.set(t.bed_id, t); }
  const rooms: HkRoomDTO[] = beds.map((b) => {
    const t = byBed.get(b.id);
    const state: HkRoomDTO["state"] = b.status === "Occupied" ? "Occupied" : t && OPEN.includes(t.status) ? "Cleaning" : t ? "To verify" : b.status === "Available" ? "Ready" : "Unavailable";
    return { id: b.id, ward: b.ward, wardId: b.ward_id, label: bedLabel(b), number: b.bed_number, state, patient: b.patient_name ?? "", taskId: t?.id ?? null };
  }).sort((a, b) => a.ward.localeCompare(b.ward) || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const order = (t: HkTaskRow) => t.task_date;
  return {
    counts: { pending: live.filter((t) => t.status === "Pending").length, cleaning: live.filter((t) => t.status === "In progress").length, toVerify: live.filter((t) => t.status === "Completed").length, ready: rooms.filter((r) => r.state === "Ready").length, beds: rooms.length },
    tasks: live.sort((a, b) => order(b).localeCompare(order(a)) || b.id - a.id).map(toTask),
    rooms,
    wards: wards.map((w) => ({ id: w.id, name: w.name })),
    beds: beds.map((b) => ({ id: b.id, wardId: b.ward_id, label: bedLabel(b) })),
    staff: staff.filter((s) => s.status !== "Inactive").map((s) => ({ id: s.id, name: s.name, role: s.role })),
  };
}

/** Send a free bed for cleaning by hand (it isn't being turned around after a discharge). */
export async function cleanBed(bedId: number, actor: Session): Promise<HkTaskDTO> {
  const bed = await bedsRepo.getRow(bedId);
  assertOwnedByHospital(bed, actor, "Bed");
  if (bed.status === "Occupied") throw new ConflictError("That bed has a patient in it");
  const open = (await all<HkTaskRow>(hkTasksRepo, actor)).find((t) => t.bed_id === bed.id && t.status !== "Verified");
  if (open) throw new ConflictError("That bed already has a cleaning job open");
  const row = await hkTasksRepo.create({
    hospital_id: requireHospitalId(actor), kind: "Bed turnaround", source: "Manual", title: bedLabel(bed), ward_id: bed.ward_id, ward: bed.ward, bed_id: bed.id, location: "", assignee: "",
    notes: "Bed sent for cleaning.", status: "Pending", task_date: localDate(), started_at: null, completed_at: null, completion_notes: "", verified_by: "", verified_at: null, created_by: actor.name,
  });
  await audit(actor, "create", "housekeeping-task", row.id, { name: row.title });
  return toTask(row);
}

// ─── Linen ───────────────────────────────────────────────────────────────────

export const LINEN_KINDS = {
  new_stock: { label: "New stock in", from: "", to: "store", hint: "Outside → Linen store" },
  collect_soiled: { label: "Collect soiled", from: "ward", to: "soiled", hint: "Ward → Soiled hold" },
  send_laundry: { label: "Send to laundry", from: "soiled", to: "laundry", hint: "Soiled hold → Laundry" },
  receive_clean: { label: "Receive clean", from: "laundry", to: "store", hint: "Laundry → Linen store" },
  issue_ward: { label: "Issue to ward", from: "store", to: "ward", hint: "Linen store → Ward" },
  discard: { label: "Discard / condemn", from: "soiled", to: "", hint: "Soiled hold → discarded" },
} as const;
export type LinenKind = keyof typeof LINEN_KINDS;

const DEFAULT_LINEN: [string, number][] = [["Bed Sheet", 200], ["Pillow Cover", 150], ["Blanket", 80], ["Draw Sheet", 120], ["Patient Gown", 100], ["OT Drape", 60], ["Towel", 90], ["Mackintosh", 40]];

export interface HkLinenCategoryDTO { id: number; name: string; unit: string; reorderAt: number; store: number; wards: number; soiled: number; laundry: number; total: number; low: boolean }
export interface HkLinenMoveDTO { id: number; kind: string; label: string; category: string; quantity: number; from: string; to: string; fromBalance: number | null; toBalance: number | null; notes: string; at: string; by: string }
export interface HkLinenDTO { categories: HkLinenCategoryDTO[]; moves: HkLinenMoveDTO[]; wards: { id: number; name: string }[]; kinds: { kind: string; label: string; hint: string; needsWard: boolean }[] }

type Balances = { store: number; ward: number; soiled: number; laundry: number; byWard: Map<number, number> };
const balancesOf = (moves: HkLinenMoveRow[]): Balances => {
  const b: Balances = { store: 0, ward: 0, soiled: 0, laundry: 0, byWard: new Map() };
  const apply = (bucket: string, delta: number, wardId: number | null) => {
    if (bucket === "store" || bucket === "soiled" || bucket === "laundry") b[bucket] += delta;
    else if (bucket === "ward") { b.ward += delta; if (wardId != null) b.byWard.set(wardId, (b.byWard.get(wardId) ?? 0) + delta); }
  };
  for (const m of moves) { apply(m.from_bucket, -m.quantity, m.ward_id); apply(m.to_bucket, m.quantity, m.ward_id); }
  return b;
};

async function seedLinen(actor: Session): Promise<HkLinenCategoryRow[]> {
  const hospitalId = requireHospitalId(actor);
  return withKeyLocks([`hk-linen:${hospitalId}`], async () => {
    const existing = await all<HkLinenCategoryRow>(hkLinenCategoriesRepo, actor);
    if (existing.length) return existing;
    const out: HkLinenCategoryRow[] = [];
    for (const [name, reorder] of DEFAULT_LINEN) out.push(await hkLinenCategoriesRepo.create({ hospital_id: hospitalId, name, unit: "piece", reorder_at: reorder }));
    return out;
  });
}

export async function getLinen(actor: Session): Promise<HkLinenDTO> {
  requireHospitalId(actor);
  const categories = await seedLinen(actor);
  const [moves, wards] = await Promise.all([all<HkLinenMoveRow>(hkLinenMovesRepo, actor), all<WardRow>(wardsRepo, actor)]);
  const label = (bucket: string, ward: string) => (bucket === "ward" ? ward || "Ward" : bucket === "store" ? "Linen store" : bucket === "soiled" ? "Soiled hold" : bucket === "laundry" ? "Laundry" : "—");
  return {
    categories: categories.sort((a, b) => a.id - b.id).map((c) => {
      const b = balancesOf(moves.filter((m) => m.category_id === c.id));
      return { id: c.id, name: c.name, unit: c.unit, reorderAt: c.reorder_at, store: b.store, wards: b.ward, soiled: b.soiled, laundry: b.laundry, total: b.store + b.ward + b.soiled + b.laundry, low: c.reorder_at > 0 && b.store < c.reorder_at };
    }),
    moves: moves.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 60).map((m) => ({
      id: m.id, kind: m.kind, label: LINEN_KINDS[m.kind as LinenKind]?.label ?? m.kind, category: m.category, quantity: m.quantity, from: label(m.from_bucket, m.ward), to: label(m.to_bucket, m.ward),
      fromBalance: m.from_balance, toBalance: m.to_balance, notes: m.notes, at: m.created_at, by: m.created_by,
    })),
    wards: wards.map((w) => ({ id: w.id, name: w.name })),
    kinds: (Object.entries(LINEN_KINDS) as [LinenKind, (typeof LINEN_KINDS)[LinenKind]][]).map(([kind, k]) => ({ kind, label: k.label, hint: k.hint, needsWard: k.from === "ward" || k.to === "ward" })),
  };
}

export async function addLinenCategory(body: unknown, actor: Session): Promise<HkLinenCategoryRow> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({ name: { type: "string", required: true, min: 2, max: 60 }, unit: { type: "string", required: false, max: 20, default: "piece" }, reorderAt: { type: "number", required: false, min: 0, max: 1_000_000, default: 0 } } as const, body);
  const name = data.name.trim();
  const dupe = (await all<HkLinenCategoryRow>(hkLinenCategoriesRepo, actor)).some((c) => c.name.toLowerCase() === name.toLowerCase());
  if (dupe) throw new ConflictError(`There is already a linen category called ${name}`);
  const row = await hkLinenCategoriesRepo.create({ hospital_id: hospitalId, name, unit: (data.unit ?? "piece").trim() || "piece", reorder_at: Math.trunc(data.reorderAt ?? 0) });
  await audit(actor, "create", "housekeeping-linen-category", row.id, { name });
  return row;
}

export async function recordLinenMove(body: unknown, actor: Session): Promise<HkLinenMoveDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    kind: { type: "enum", required: true, values: Object.keys(LINEN_KINDS) },
    categoryId: { type: "number", required: true },
    quantity: { type: "number", required: true, min: 1, max: 1_000_000 },
    wardId: { type: "number", required: false },
    notes: { type: "string", required: false, max: 300, default: "" },
  } as const, body);
  const kind = LINEN_KINDS[data.kind as LinenKind];
  const quantity = data.quantity;
  if (!Number.isInteger(quantity) || quantity < 1) throw new ValidationError([{ field: "quantity", message: "Enter a whole number of 1 or more" }]);
  return withKeyLocks([`hk-linen:${hospitalId}`], async () => {
    const category = await hkLinenCategoriesRepo.getRow(data.categoryId);
    assertOwnedByHospital(category, actor, "Linen category");
    let ward: WardRow | null = null;
    if (kind.from === "ward" || kind.to === "ward") {
      if (data.wardId == null) throw new ValidationError([{ field: "wardId", message: "Pick the ward" }]);
      ward = await wardsRepo.getRow(data.wardId);
      assertOwnedByHospital(ward, actor, "Ward");
    }
    const before = balancesOf((await all<HkLinenMoveRow>(hkLinenMovesRepo, actor)).filter((m) => m.category_id === category.id));
    const have = kind.from === "" ? Infinity : kind.from === "ward" ? before.byWard.get(ward!.id) ?? 0 : before[kind.from];
    if (quantity > have) throw new ConflictError(`Only ${have} ${category.name} ${kind.from === "ward" ? `in ${ward!.name}` : kind.from === "store" ? "in the linen store" : kind.from === "soiled" ? "in the soiled hold" : "at the laundry"} — can't move ${quantity}`);
    const draft = { hospital_id: hospitalId, category_id: category.id, category: category.name, kind: data.kind, quantity, from_bucket: kind.from, to_bucket: kind.to, ward_id: ward?.id ?? null, ward: ward?.name ?? "", notes: (data.notes ?? "").trim(), created_by: actor.name };
    const after = balancesOf([{ ...draft, id: 0, created_at: "", updated_at: "", from_balance: null, to_balance: null } as HkLinenMoveRow, ...(await all<HkLinenMoveRow>(hkLinenMovesRepo, actor)).filter((m) => m.category_id === category.id)]);
    const at = (bucket: string): number | null => (bucket === "" ? null : bucket === "ward" ? after.ward : after[bucket as "store" | "soiled" | "laundry"]);
    const row = await hkLinenMovesRepo.create({ ...draft, from_balance: at(kind.from), to_balance: at(kind.to) });
    await audit(actor, "create", "housekeeping-linen", row.id, { name: `${kind.label} · ${category.name} ×${quantity}` });
    const label = (bucket: string) => (bucket === "ward" ? ward!.name : bucket === "store" ? "Linen store" : bucket === "soiled" ? "Soiled hold" : bucket === "laundry" ? "Laundry" : "—");
    return { id: row.id, kind: row.kind, label: kind.label, category: row.category, quantity, from: label(kind.from), to: label(kind.to), fromBalance: row.from_balance, toBalance: row.to_balance, notes: row.notes, at: row.created_at, by: row.created_by };
  });
}

void NotFoundError;
