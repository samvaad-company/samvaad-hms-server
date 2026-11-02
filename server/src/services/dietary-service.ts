/**
 * Dietary & kitchen: what each admitted patient is fed, the kitchen's sheet for a ward on a day, and the canteen.
 *
 *   Diets    The kinds of diet the hospital serves, each with the meals it covers and the standing instructions for the kitchen.
 *   Orders   One live order per admitted patient (a new order replaces the old one). Discharging ends it; moving bed updates it.
 *   Sheet    "Generate" writes a line per ordered meal for the ward on that day — running it again only adds what's missing.
 *            Draft ──dispatch──▶ Dispatched ──confirm receipt──▶ Received. A dispatched sheet is closed to new lines.
 *   Kitchen  The production plan: how many of each diet at each meal, across every ward.
 *   Canteen  A menu with prices and the day's sales to staff, attendants and visitors.
 */
import { canteenItemsRepo, canteenSalesRepo, dietOrdersRepo, dietSheetLinesRepo, dietSheetsRepo, dietTypesRepo, hospitalsRepo, ipdRepo, wardsRepo } from "@/repositories";
import type { CanteenItemRow, CanteenSaleRow, DietOrderRow, DietSheetLineRow, DietSheetRow, DietTypeRow, IpdAdmissionRow, WardRow } from "@/db/tables";
import { validate } from "@/lib/validation";
import { ConflictError, ValidationError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks", "Supplements"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const r2 = (n: number): number => Math.round(n * 100) / 100;
const mealList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((m): m is string => (MEALS as readonly string[]).includes(String(m))) : []);
/** The meals named in a request body, or undefined when it names none (the validator has no list type). */
const rawMeals = (body: unknown): string[] | undefined => {
  const v = (body as { meals?: unknown } | null)?.meals;
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((m) => !(MEALS as readonly string[]).includes(String(m)))) throw new ValidationError([{ field: "meals", message: `Meals must be from ${MEALS.join(", ")}` }]);
  return [...new Set(v.map(String))];
};
const dateOf = (v: string | undefined | null): string => {
  if (v && !ISO.test(v)) throw new ValidationError([{ field: "date", message: "Dates must look like 2026-10-30" }]);
  return v || localDate();
};

// ─── Diets ───────────────────────────────────────────────────────────────────

export interface DietTypeDTO { id: number; name: string; instructions: string; meals: string[]; active: boolean; inUse: number }

const DEFAULT_DIETS: [string, string[], string][] = [
  ["Normal Regular Diet", ["Breakfast", "Lunch", "Dinner"], "Encourage oral fluids; no restrictions."],
  ["High Protein Diet", ["Breakfast", "Lunch", "Dinner"], "Encourage oral fluids; high-protein supplement with each meal."],
  ["Diabetic Diet", ["Breakfast", "Lunch", "Dinner", "Snacks"], "No added sugar; fixed carbohydrate portions; small frequent meals."],
  ["Renal Diet", ["Breakfast", "Lunch", "Dinner"], "Low salt, low potassium, low phosphorus; fluid as advised by the doctor."],
  ["Low Salt (Cardiac) Diet", ["Breakfast", "Lunch", "Dinner"], "Less than 2 g sodium a day; no pickles, papad or processed food."],
  ["Soft Diet", ["Breakfast", "Lunch", "Dinner", "Snacks"], "Soft, easily chewed food; no fried or spicy items."],
  ["Liquid Diet", ["Breakfast", "Lunch", "Dinner", "Snacks", "Supplements"], "Clear and full liquids only, small amounts every two hours."],
  ["Nil by mouth (NPO)", [], "Nothing by mouth — kitchen to send no meals."],
];

async function seedDiets(actor: Session): Promise<DietTypeRow[]> {
  const hospitalId = requireHospitalId(actor);
  return withKeyLocks([`diet-types:${hospitalId}`], async () => {
    const existing = await all<DietTypeRow>(dietTypesRepo, actor);
    if (existing.length) return existing;
    const out: DietTypeRow[] = [];
    for (const [name, meals, instructions] of DEFAULT_DIETS) out.push(await dietTypesRepo.create({ hospital_id: hospitalId, name, instructions, meals, active: true }));
    return out;
  });
}

export async function listDiets(actor: Session): Promise<DietTypeDTO[]> {
  const [diets, orders] = await Promise.all([seedDiets(actor), all<DietOrderRow>(dietOrdersRepo, actor)]);
  return diets.sort((a, b) => a.id - b.id).map((d) => ({ id: d.id, name: d.name, instructions: d.instructions, meals: mealList(d.meals), active: d.active, inUse: orders.filter((o) => o.status === "Active" && o.diet_type_id === d.id).length }));
}

const dietSchema = {
  name: { type: "string", required: true, min: 2, max: 80 },
  instructions: { type: "string", required: false, max: 500, default: "" },
  active: { type: "boolean", required: false },
} as const;

export async function addDiet(body: unknown, actor: Session): Promise<DietTypeDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate(dietSchema, body);
  const name = data.name.trim();
  if ((await all<DietTypeRow>(dietTypesRepo, actor)).some((d) => d.name.toLowerCase() === name.toLowerCase())) throw new ConflictError(`There is already a diet called ${name}`);
  const row = await dietTypesRepo.create({ hospital_id: hospitalId, name, instructions: data.instructions ?? "", meals: rawMeals(body) ?? ["Breakfast", "Lunch", "Dinner"], active: true });
  await audit(actor, "create", "dietary-diet", row.id, { name });
  return { id: row.id, name: row.name, instructions: row.instructions, meals: row.meals, active: true, inUse: 0 };
}

export async function updateDiet(id: number, body: unknown, actor: Session): Promise<DietTypeDTO> {
  const row = await dietTypesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Diet");
  const data = validate({ ...dietSchema, name: { type: "string", required: false, min: 2, max: 80 } } as const, body);
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if ((await all<DietTypeRow>(dietTypesRepo, actor)).some((d) => d.id !== id && d.name.toLowerCase() === name.toLowerCase())) throw new ConflictError(`There is already a diet called ${name}`);
    patch.name = name;
  }
  if (data.instructions !== undefined) patch.instructions = data.instructions;
  const meals = rawMeals(body);
  if (meals !== undefined) patch.meals = meals;
  if (data.active !== undefined) patch.active = data.active;
  await dietTypesRepo.update(id, patch);
  await audit(actor, "update", "dietary-diet", id, { name: String(patch.name ?? row.name) });
  return (await listDiets(actor)).find((d) => d.id === id)!;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export interface DietOrderDTO {
  id: number; admissionId: number; patient: string; patientCode: string; wardId: number | null; ward: string; bed: string; diet: string; dietTypeId: number | null;
  meals: string[]; instructions: string; status: string; startDate: string; stoppedOn: string | null;
}
const toOrder = (o: DietOrderRow): DietOrderDTO => ({ id: o.id, admissionId: o.admission_id, patient: o.patient_name, patientCode: o.patient_code, wardId: o.ward_id, ward: o.ward, bed: o.bed, diet: o.diet_name, dietTypeId: o.diet_type_id, meals: mealList(o.meals), instructions: o.instructions, status: o.status, startDate: o.start_date, stoppedOn: o.stopped_on });

export async function listOrders(f: { wardId?: number; status?: string }, actor: Session): Promise<DietOrderDTO[]> {
  requireHospitalId(actor);
  return (await all<DietOrderRow>(dietOrdersRepo, actor))
    .filter((o) => (f.wardId == null || o.ward_id === f.wardId) && (!f.status || o.status === f.status))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "Active" ? -1 : 1) || a.ward.localeCompare(b.ward) || a.bed.localeCompare(b.bed, undefined, { numeric: true }) || b.id - a.id)
    .map(toOrder);
}

export async function createOrder(body: unknown, actor: Session): Promise<DietOrderDTO> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({ admissionId: { type: "number", required: true }, dietTypeId: { type: "number", required: true }, instructions: { type: "string", required: false, max: 500 } } as const, body);
  const admission = await ipdRepo.getRow(data.admissionId);
  assertOwnedByHospital(admission, actor, "Admission");
  if (admission.status === "Discharged") throw new ConflictError("That patient has been discharged");
  const diet = await dietTypesRepo.getRow(data.dietTypeId);
  assertOwnedByHospital(diet, actor, "Diet");
  if (!diet.active) throw new ConflictError(`${diet.name} isn't being served at the moment`);
  const meals = rawMeals(body) ?? mealList(diet.meals);
  return withKeyLocks([`diet-orders:${hospitalId}:${admission.id}`], async () => {
    const today = localDate();
    for (const o of (await all<DietOrderRow>(dietOrdersRepo, actor)).filter((x) => x.admission_id === admission.id && x.status === "Active")) await dietOrdersRepo.update(o.id, { status: "Stopped", stopped_on: today });
    const row = await dietOrdersRepo.create({
      hospital_id: hospitalId, admission_id: admission.id, patient_id: admission.patient_id, patient_name: admission.patient_name, patient_code: admission.patient_code, ward_id: admission.ward_id, ward: admission.ward,
      bed_id: admission.bed_id, bed: admission.bed, diet_type_id: diet.id, diet_name: diet.name, meals, instructions: data.instructions !== undefined ? data.instructions : diet.instructions,
      status: "Active", start_date: today, stopped_on: null, created_by: actor.name,
    });
    await audit(actor, "create", "dietary-order", row.id, { name: `${admission.patient_name} · ${diet.name}` });
    return toOrder(row);
  });
}

export async function stopOrder(id: number, actor: Session): Promise<DietOrderDTO> {
  const row = await dietOrdersRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Diet order");
  if (row.status !== "Active") throw new ConflictError("That order has already been stopped");
  const updated = await dietOrdersRepo.update(id, { status: "Stopped", stopped_on: localDate() });
  await audit(actor, "update", "dietary-order", id, { name: `Stopped · ${row.patient_name}` });
  return toOrder(updated as DietOrderRow);
}

/** A patient left: their diet order ends. Never blocks the discharge. */
export async function endOrdersForAdmission(admissionId: number, hospitalId: number): Promise<void> {
  try {
    const rows = (await dietOrdersRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "admission_id", op: "eq", value: admissionId }] })).rows;
    for (const o of rows) if (o.status === "Active") await dietOrdersRepo.update(o.id, { status: "Stopped", stopped_on: localDate() });
  } catch { /* dietary must never stop a discharge */ }
}

/** A patient moved bed: the kitchen has to find them in the new one. */
export async function moveOrdersForAdmission(a: Pick<IpdAdmissionRow, "id" | "hospital_id" | "ward_id" | "ward" | "bed_id" | "bed">): Promise<void> {
  try {
    const rows = (await dietOrdersRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: a.hospital_id }, { column: "admission_id", op: "eq", value: a.id }] })).rows;
    for (const o of rows) if (o.status === "Active") await dietOrdersRepo.update(o.id, { ward_id: a.ward_id, ward: a.ward, bed_id: a.bed_id, bed: a.bed });
  } catch { /* best effort */ }
}

// ─── Board and sheet ─────────────────────────────────────────────────────────

export interface DietSheetDTO { id: number; status: string; lines: number; dispatchedAt: string | null; dispatchedBy: string; receivedAt: string | null; receivedBy: string }
export interface DietBoardDTO {
  date: string;
  wards: { id: number; name: string }[];
  wardId: number | null;
  orders: (DietOrderDTO & { onSheet: string[] })[];
  sheet: DietSheetDTO | null;
}
const toSheet = (s: DietSheetRow, lines: number): DietSheetDTO => ({ id: s.id, status: s.status, lines, dispatchedAt: s.dispatched_at, dispatchedBy: s.dispatched_by, receivedAt: s.received_at, receivedBy: s.received_by });

async function sheetFor(date: string, wardId: number, actor: Session): Promise<DietSheetRow | null> {
  return (await all<DietSheetRow>(dietSheetsRepo, actor)).find((s) => s.sheet_date === date && s.ward_id === wardId) ?? null;
}
async function wardOf(wardId: number, actor: Session): Promise<WardRow> {
  const w = await wardsRepo.getRow(wardId);
  assertOwnedByHospital(w, actor, "Ward");
  return w;
}
const liveOrders = async (wardId: number, date: string, actor: Session) =>
  (await all<DietOrderRow>(dietOrdersRepo, actor)).filter((o) => o.ward_id === wardId && o.status === "Active" && o.start_date <= date)
    .sort((a, b) => a.bed.localeCompare(b.bed, undefined, { numeric: true }) || a.id - b.id);

export async function getBoard(q: { date?: string; wardId?: number }, actor: Session): Promise<DietBoardDTO> {
  requireHospitalId(actor);
  const date = dateOf(q.date);
  const wards = (await all<WardRow>(wardsRepo, actor)).sort((a, b) => a.id - b.id);
  const wardId = q.wardId ?? wards[0]?.id ?? null;
  if (wardId === null) return { date, wards: [], wardId: null, orders: [], sheet: null };
  await wardOf(wardId, actor);
  const [orders, sheet] = await Promise.all([liveOrders(wardId, date, actor), sheetFor(date, wardId, actor)]);
  const lines = sheet ? (await all<DietSheetLineRow>(dietSheetLinesRepo, actor)).filter((l) => l.sheet_id === sheet.id) : [];
  return {
    date, wards: wards.map((w) => ({ id: w.id, name: w.name })), wardId,
    orders: orders.map((o) => ({ ...toOrder(o), onSheet: lines.filter((l) => l.order_id === o.id).map((l) => l.meal) })),
    sheet: sheet ? toSheet(sheet, lines.length) : null,
  };
}

/** Write the sheet's lines for the ward and day. Safe to run again: only the meals not yet on the sheet are added. */
export async function generateSheet(body: unknown, actor: Session): Promise<{ added: number; existing: number; sheet: DietSheetDTO }> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({ date: { type: "string", required: false, pattern: ISO }, wardId: { type: "number", required: true } } as const, body);
  const date = dateOf(data.date);
  const ward = await wardOf(data.wardId, actor);
  return withKeyLocks([`diet-sheet:${hospitalId}:${date}:${ward.id}`], async () => {
    let sheet = await sheetFor(date, ward.id, actor);
    if (sheet && sheet.status !== "Draft") throw new ConflictError(`The sheet for ${ward.name} on ${date} has already been ${sheet.status.toLowerCase()}`);
    if (!sheet) sheet = await dietSheetsRepo.create({ hospital_id: hospitalId, sheet_date: date, ward_id: ward.id, ward: ward.name, status: "Draft", generated_by: actor.name, dispatched_at: null, dispatched_by: "", received_at: null, received_by: "" });
    const have = new Set((await all<DietSheetLineRow>(dietSheetLinesRepo, actor)).filter((l) => l.sheet_id === sheet!.id).map((l) => `${l.order_id}|${l.meal}`));
    let added = 0; let existing = 0;
    for (const o of await liveOrders(ward.id, date, actor)) {
      for (const meal of mealList(o.meals)) {
        if (have.has(`${o.id}|${meal}`)) { existing++; continue; }
        await dietSheetLinesRepo.create({ hospital_id: hospitalId, sheet_id: sheet.id, order_id: o.id, meal, patient_name: o.patient_name, patient_code: o.patient_code, bed: o.bed, diet_name: o.diet_name, instructions: o.instructions });
        added++;
      }
    }
    await audit(actor, "create", "dietary-sheet", sheet.id, { summary: `Generated diet sheet for ${date} (${added} added, ${existing} already present)` });
    return { added, existing, sheet: toSheet(sheet, existing + added) };
  });
}

async function advance(body: unknown, actor: Session, from: string, to: string, patch: (now: string) => Partial<DietSheetRow>, verb: string): Promise<DietSheetDTO> {
  const data = validate({ date: { type: "string", required: false, pattern: ISO }, wardId: { type: "number", required: true } } as const, body);
  const date = dateOf(data.date);
  await wardOf(data.wardId, actor);
  const sheet = await sheetFor(date, data.wardId, actor);
  if (!sheet) throw new ConflictError(`There's no sheet for ${date} yet — generate it first`);
  if (sheet.status !== from) throw new ConflictError(`That sheet is ${sheet.status.toLowerCase()}, so it can't be ${verb} now`);
  const lines = (await all<DietSheetLineRow>(dietSheetLinesRepo, actor)).filter((l) => l.sheet_id === sheet.id).length;
  if (from === "Draft" && lines === 0) throw new ConflictError("The sheet has no meals on it — there's nothing to send");
  const updated = await dietSheetsRepo.update(sheet.id, { status: to, ...patch(new Date().toISOString()) });
  await audit(actor, "update", "dietary-sheet", sheet.id, { summary: `${verb[0].toUpperCase()}${verb.slice(1)} the diet sheet for ${sheet.ward} on ${date}` });
  return toSheet(updated as DietSheetRow, lines);
}
export const dispatchSheet = (body: unknown, actor: Session) => advance(body, actor, "Draft", "Dispatched", (now) => ({ dispatched_at: now, dispatched_by: actor.name }), "dispatched");
export const receiveSheet = (body: unknown, actor: Session) => advance(body, actor, "Dispatched", "Received", (now) => ({ received_at: now, received_by: actor.name }), "received");

export interface DietPrintDTO { hospital: string; ward: string; date: string; status: string; rows: { meal: string; patient: string; code: string; bed: string; diet: string; instructions: string }[] }
/** The kitchen sheet as it is printed: grouped by meal, each patient on their own line. */
export async function getSheetPrint(q: { date?: string; wardId?: number }, actor: Session): Promise<DietPrintDTO> {
  const hospitalId = requireHospitalId(actor);
  const date = dateOf(q.date);
  if (q.wardId == null) throw new ValidationError([{ field: "wardId", message: "Pick a ward" }]);
  const ward = await wardOf(q.wardId, actor);
  const sheet = await sheetFor(date, ward.id, actor);
  if (!sheet) throw new ConflictError(`There's no sheet for ${date} yet — generate it first`);
  const order = (m: string) => MEALS.indexOf(m as (typeof MEALS)[number]);
  const lines = (await all<DietSheetLineRow>(dietSheetLinesRepo, actor)).filter((l) => l.sheet_id === sheet.id)
    .sort((a, b) => order(a.meal) - order(b.meal) || a.bed.localeCompare(b.bed, undefined, { numeric: true }));
  const hospital = await hospitalsRepo.getRow(hospitalId);
  return { hospital: hospital?.name ?? "", ward: ward.name, date, status: sheet.status, rows: lines.map((l) => ({ meal: l.meal, patient: l.patient_name, code: l.patient_code, bed: l.bed, diet: l.diet_name, instructions: l.instructions })) };
}

// ─── Kitchen ─────────────────────────────────────────────────────────────────

export interface KitchenDTO {
  date: string;
  meals: string[];
  diets: ({ diet: string; total: number } & Record<string, number | string>)[];
  totals: Record<string, number>;
  wards: { ward: string; patients: number; meals: number; sheet: string }[];
  patients: number;
}
/** How many of each diet at each meal across every ward, and how far each ward's sheet has got. */
export async function getKitchen(q: { date?: string }, actor: Session): Promise<KitchenDTO> {
  requireHospitalId(actor);
  const date = dateOf(q.date);
  const [orders, wards, sheets] = await Promise.all([all<DietOrderRow>(dietOrdersRepo, actor), all<WardRow>(wardsRepo, actor), all<DietSheetRow>(dietSheetsRepo, actor)]);
  const live = orders.filter((o) => o.status === "Active" && o.start_date <= date);
  const byDiet = new Map<string, DietOrderRow[]>();
  for (const o of live) (byDiet.get(o.diet_name) ?? byDiet.set(o.diet_name, []).get(o.diet_name)!).push(o);
  const meals = [...MEALS];
  const diets = [...byDiet].map(([diet, list]) => {
    const row: KitchenDTO["diets"][number] = { diet, total: 0 };
    for (const m of meals) { row[m] = list.filter((o) => mealList(o.meals).includes(m)).length; row.total += row[m] as number; }
    return row;
  }).sort((a, b) => b.total - a.total);
  const totals: Record<string, number> = {};
  for (const m of meals) totals[m] = diets.reduce((n, d) => n + (d[m] as number), 0);
  return {
    date, meals, diets, totals, patients: live.length,
    wards: wards.sort((a, b) => a.id - b.id).map((w) => {
      const mine = live.filter((o) => o.ward_id === w.id);
      return { ward: w.name, patients: mine.length, meals: mine.reduce((n, o) => n + mealList(o.meals).length, 0), sheet: sheets.find((s) => s.sheet_date === date && s.ward_id === w.id)?.status ?? "Not generated" };
    }).filter((w) => w.patients > 0 || w.sheet !== "Not generated"),
  };
}

// ─── Canteen ─────────────────────────────────────────────────────────────────

export const BUYER_TYPES = ["Staff", "Attendant", "Visitor", "Patient"] as const;
export interface CanteenDTO {
  date: string;
  items: { id: number; name: string; price: number; active: boolean; soldToday: number }[];
  sales: { id: number; item: string; quantity: number; unitPrice: number; total: number; buyerType: string; buyer: string; at: string; by: string }[];
  totals: { sales: number; quantity: number; amount: number };
}

export async function getCanteen(q: { date?: string }, actor: Session): Promise<CanteenDTO> {
  requireHospitalId(actor);
  const date = dateOf(q.date);
  const [items, sales] = await Promise.all([all<CanteenItemRow>(canteenItemsRepo, actor), all<CanteenSaleRow>(canteenSalesRepo, actor)]);
  const today = sales.filter((s) => s.sale_date === date).sort((a, b) => b.id - a.id);
  return {
    date,
    items: items.sort((a, b) => a.id - b.id).map((i) => ({ id: i.id, name: i.name, price: Number(i.price), active: i.active, soldToday: today.filter((s) => s.item_id === i.id).reduce((n, s) => n + s.quantity, 0) })),
    sales: today.map((s) => ({ id: s.id, item: s.item, quantity: s.quantity, unitPrice: Number(s.unit_price), total: Number(s.total), buyerType: s.buyer_type, buyer: s.buyer, at: s.created_at, by: s.created_by })),
    totals: { sales: today.length, quantity: today.reduce((n, s) => n + s.quantity, 0), amount: r2(today.reduce((n, s) => n + Number(s.total), 0)) },
  };
}

export async function addCanteenItem(body: unknown, actor: Session): Promise<CanteenItemRow> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({ name: { type: "string", required: true, min: 2, max: 80 }, price: { type: "number", required: true, min: 0, max: 100000 } } as const, body);
  const name = data.name.trim();
  if ((await all<CanteenItemRow>(canteenItemsRepo, actor)).some((i) => i.name.toLowerCase() === name.toLowerCase())) throw new ConflictError(`There is already a canteen item called ${name}`);
  const row = await canteenItemsRepo.create({ hospital_id: hospitalId, name, price: r2(data.price), active: true });
  await audit(actor, "create", "canteen-item", row.id, { name });
  return row;
}

export async function updateCanteenItem(id: number, body: unknown, actor: Session): Promise<CanteenItemRow> {
  const row = await canteenItemsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Canteen item");
  const data = validate({ price: { type: "number", required: false, min: 0, max: 100000 }, active: { type: "boolean", required: false } } as const, body);
  const patch: Record<string, unknown> = {};
  if (data.price !== undefined) patch.price = r2(data.price);
  if (data.active !== undefined) patch.active = data.active;
  const updated = await canteenItemsRepo.update(id, patch);
  await audit(actor, "update", "canteen-item", id, { name: row.name });
  return updated as CanteenItemRow;
}

export async function recordSale(body: unknown, actor: Session): Promise<CanteenSaleRow> {
  const hospitalId = requireHospitalId(actor);
  const data = validate({
    itemId: { type: "number", required: true }, quantity: { type: "number", required: true, min: 1, max: 1000 },
    buyerType: { type: "enum", required: false, values: [...BUYER_TYPES], default: "Staff" }, buyer: { type: "string", required: false, max: 120, default: "" },
  } as const, body);
  if (!Number.isInteger(data.quantity)) throw new ValidationError([{ field: "quantity", message: "Enter a whole number" }]);
  const item = await canteenItemsRepo.getRow(data.itemId);
  assertOwnedByHospital(item, actor, "Canteen item");
  if (!item.active) throw new ConflictError(`${item.name} isn't on the menu at the moment`);
  const row = await canteenSalesRepo.create({
    hospital_id: hospitalId, item_id: item.id, item: item.name, quantity: data.quantity, unit_price: Number(item.price), total: r2(Number(item.price) * data.quantity),
    buyer_type: data.buyerType ?? "Staff", buyer: (data.buyer ?? "").trim(), sale_date: localDate(), created_by: actor.name,
  });
  await audit(actor, "create", "canteen-sale", row.id, { name: `${item.name} ×${data.quantity}` });
  return row;
}
