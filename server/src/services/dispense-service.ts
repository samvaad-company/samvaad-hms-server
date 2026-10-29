/**
 * The dispensing counter. A pharmacist picks medicines from stock (or loads a patient's prescription), chooses how it is billed
 * and dispenses; the stock comes out of specific batches, earliest expiry first, and expired batches are never used. A sale can
 * be returned later: usable stock goes back into the exact batch it came from, damaged or expired stock is written off, and a
 * billed return mints a credit note.
 *
 * Stock is kept per batch, but other screens (purchase receiving, over-the-counter sales, prescription dispensing) still move
 * the item's total `stock` directly. Before touching an item, the batches are reconciled to that total, so the two never drift.
 */
import {
  pharmacyRepo, pharmacyBatchesRepo, pharmacyDispensesRepo, pharmacyDispenseLinesRepo, pharmacyReturnsRepo,
  patientsRepo, prescriptionsRepo, prescriptionItemsRepo, ipdRepo, billsRepo,
} from "@/repositories";
import { TABLES, type BillRow, type PharmacyBatchRow, type PharmacyDispenseLineRow, type PharmacyDispenseRow, type PharmacyItemRow, type PharmacyReturnRow } from "@/db/tables";
import { transactional } from "@/db/unit-of-work";
import { BadRequestError, ConflictError, NotFoundError, ValidationError, type FieldError } from "@/lib/errors";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { computePharmacyStatus, isoDate, nextCode } from "@/services/helpers";
import { audit } from "@/services/audit";
import { createBill, updateBill } from "@/services/billing-service";
import { medicineKey, unitsFor } from "@/services/prescriptions-service";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import type { DispenseBilling, DispenseDTO, DispenseLineDTO, DispenseReturnDTO, DispenseRxDTO, DispenseStockDTO, ReturnCondition } from "@shared/types/api";
import { nextNumber } from "@/services/id-service";

const BILLINGS: readonly DispenseBilling[] = ["none", "separate", "patient"];
const CONDITIONS: readonly ReturnCondition[] = ["Usable", "Damaged", "Expired"];
const MAX_LINES = 60;
const MAX_QTY = 100_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const money = (n: number) => Math.round(n * 100) / 100;

// ── Batches ──────────────────────────────────────────────────────────────────

async function batchesOf(itemId: number, actor: Session): Promise<PharmacyBatchRow[]> {
  const { rows } = await pharmacyBatchesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "item_id", op: "eq", value: itemId }] }, actor));
  return rows as PharmacyBatchRow[];
}

/** Earliest expiry first; a batch with no expiry goes last. */
const byExpiry = (a: PharmacyBatchRow, b: PharmacyBatchRow) => ((a.expiry_date || "9999") < (b.expiry_date || "9999") ? -1 : (a.expiry_date || "9999") > (b.expiry_date || "9999") ? 1 : a.id - b.id);

/**
 * Make the item's batches add up to its stock. Stock added elsewhere becomes a new batch (with the item's own expiry); stock
 * taken away elsewhere is written off the earliest-expiring batches. Call while holding the item's lock.
 */
async function syncBatches(item: PharmacyItemRow, actor: Session): Promise<PharmacyBatchRow[]> {
  let rows = (await batchesOf(item.id, actor)).sort(byExpiry);
  const sum = rows.reduce((n, b) => n + Number(b.quantity), 0);
  const stock = Math.max(0, Number(item.stock));
  if (sum < stock) {
    await pharmacyBatchesRepo.create({
      hospital_id: requireHospitalId(actor), item_id: item.id, batch_no: rows.length === 0 ? "OPENING" : `ADJ-${rows.length + 1}`,
      expiry_date: isoDate(item.expiry_date), quantity: stock - sum,
    } as never);
    rows = (await batchesOf(item.id, actor)).sort(byExpiry);
  } else if (sum > stock) {
    let excess = sum - stock;
    for (const b of rows) {
      if (excess <= 0) break;
      const cut = Math.min(excess, Number(b.quantity));
      if (cut > 0) { await pharmacyBatchesRepo.update(b.id, { quantity: Number(b.quantity) - cut } as never); excess -= cut; }
    }
    rows = (await batchesOf(item.id, actor)).sort(byExpiry);
  }
  return rows;
}

const inDate = (b: PharmacyBatchRow, today: string) => !b.expiry_date || b.expiry_date >= today;

/** Fit-to-dispense units of an item, per batch, soonest to expire first. */
function usable(batches: PharmacyBatchRow[], today: string): PharmacyBatchRow[] {
  return batches.filter((b) => Number(b.quantity) > 0 && inDate(b, today)).sort(byExpiry);
}

// ── Reading ──────────────────────────────────────────────────────────────────

const toStockDto = (i: PharmacyItemRow, available: number, nextExpiry: string): DispenseStockDTO => ({
  itemId: i.id, name: i.name, category: i.category, available, unitPrice: Number(i.unit_price ?? 0), nextExpiry,
});

/** Medicines matching a search (name or category), with what is in date on the shelf. An empty search lists the first few. */
export async function searchStock(q: string | null, actor: Session): Promise<DispenseStockDTO[]> {
  const today = localDate();
  const { rows } = await pharmacyRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const needle = (q ?? "").trim().toLowerCase();
  const out: { dto: DispenseStockDTO; rank: number }[] = [];
  for (const i of rows as PharmacyItemRow[]) {
    const name = i.name.toLowerCase();
    if (needle && !name.includes(needle) && !(i.category ?? "").toLowerCase().includes(needle)) continue;
    if (Number(i.stock) <= 0) continue;
    const expiry = isoDate(i.expiry_date);
    if (expiry && expiry < today) continue;
    out.push({ dto: toStockDto(i, Number(i.stock), expiry), rank: name.startsWith(needle) ? 0 : 1 });
  }
  return out.sort((a, b) => a.rank - b.rank || a.dto.name.localeCompare(b.dto.name)).slice(0, 8).map((x) => x.dto);
}

/**
 * The stock item a prescribed medicine most likely means. Stock is often named "Brand 250mg (Generic)" while a prescription says
 * "Generic 250mg" or the brand, so compare the names with strengths and forms stripped, and the generic inside the brackets.
 * Items in date and on the shelf win over ones that aren't.
 */
function matchStock(name: string, stock: PharmacyItemRow[], today: string): PharmacyItemRow | undefined {
  const want = medicineKey(name);
  if (!want) return undefined;
  const fit = (i: PharmacyItemRow) => Number(i.stock) > 0 && !(isoDate(i.expiry_date) !== "" && isoDate(i.expiry_date) < today);
  const scored = stock.map((i) => {
    if (i.name === name) return { i, score: 4 };
    const full = medicineKey(i.name);
    const generic = medicineKey((/\(([^)]*)\)/.exec(i.name)?.[1]) ?? "");
    const brand = medicineKey(i.name.replace(/\([^)]*\)/g, " "));
    if (full === want || brand === want) return { i, score: 3 };
    if (generic && generic === want) return { i, score: 2 };
    if (` ${full} `.includes(` ${want} `)) return { i, score: 1 };
    return { i, score: 0 };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || Number(fit(b.i)) - Number(fit(a.i)));
  const best = scored[0];
  if (!best) return undefined;
  // Among equally good matches, take one that can actually be dispensed.
  return scored.find((x) => x.score === best.score && fit(x.i))?.i ?? best.i;
}

/** A patient's prescriptions that haven't been dispensed, with each medicine matched to stock and a quantity from frequency × duration. */
export async function patientRx(patientId: number, actor: Session): Promise<DispenseRxDTO[]> {
  const patient = await patientsRepo.getRow(patientId);
  assertOwnedByHospital(patient, actor, "Patient");
  const today = localDate();
  const [{ rows: rxs }, { rows: stock }] = await Promise.all([
    prescriptionsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }], sort: [{ column: "id", direction: "desc" }] }, actor)),
    pharmacyRepo.listRows(scopeToHospital({ unpaged: true }, actor)),
  ]);
  const out: DispenseRxDTO[] = [];
  for (const rx of rxs) {
    if (rx.status === "Dispensed") continue;
    const { rows: items } = await prescriptionItemsRepo.listRows({ unpaged: true, filters: [{ column: "prescription_id", op: "eq", value: rx.id }] });
    out.push({
      prescriptionId: rx.id, rxNumber: rx.rx_number, doctor: rx.doctor, diagnosis: rx.diagnosis, date: isoDate(rx.prescribed_date),
      lines: items.map((it) => {
        const match = matchStock(it.medicine_name, stock as PharmacyItemRow[], today);
        const expired = match ? (isoDate(match.expiry_date) !== "" && isoDate(match.expiry_date) < today) : true;
        return {
          medicineName: it.medicine_name, dosage: it.dosage, frequency: it.frequency, duration: it.duration, quantity: unitsFor(it.frequency, it.duration),
          itemId: match ? match.id : null, itemName: match?.name ?? "", available: match && !expired ? Math.max(0, Number(match.stock)) : 0, unitPrice: Number(match?.unit_price ?? 0),
        };
      }),
    });
  }
  return out;
}

async function linesOf(dispenseId: number, actor: Session): Promise<PharmacyDispenseLineRow[]> {
  const { rows } = await pharmacyDispenseLinesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "dispense_id", op: "eq", value: dispenseId }] }, actor));
  return (rows as PharmacyDispenseLineRow[]).sort((a, b) => a.id - b.id);
}
async function returnsOf(dispenseId: number, actor: Session): Promise<PharmacyReturnRow[]> {
  const { rows } = await pharmacyReturnsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "dispense_id", op: "eq", value: dispenseId }] }, actor));
  return (rows as PharmacyReturnRow[]).sort((a, b) => a.id - b.id);
}

const billLabel = (d: PharmacyDispenseRow): string => {
  if (d.billing === "none") return "Not billed";
  if (d.billing === "patient") return d.admission_no ? `On stay ${d.admission_no}` : d.bill_number ? `Added to bill ${d.bill_number}` : "Billing pending";
  return d.bill_number ? `Billed ${d.bill_number}` : "Billing pending";
};

function toDto(d: PharmacyDispenseRow, lines: PharmacyDispenseLineRow[], returns: PharmacyReturnRow[]): DispenseDTO {
  const names = [...new Set(lines.map((l) => l.medicine_name))];
  return {
    id: d.id, dispenseNo: d.dispense_no, patientId: d.patient_id, patientName: d.patient_name, walkInNote: d.walk_in_note ?? "", rxNumber: d.rx_number ?? "",
    billing: d.billing as DispenseBilling, billLabel: billLabel(d), billNumber: d.bill_number ?? null, admissionNo: d.admission_no ?? null, subtotal: Number(d.subtotal),
    status: d.status as DispenseDTO["status"], dispensedBy: d.dispensed_by, at: d.created_at,
    summary: names.length > 1 ? `${names[0]} +${names.length - 1} more` : names[0] ?? "",
    lines: lines.map((l): DispenseLineDTO => ({ id: l.id, itemId: l.item_id, medicineName: l.medicine_name, batchNo: l.batch_no, expiryDate: l.expiry_date ?? "", quantity: l.quantity, returnedQty: l.returned_qty, returnable: l.quantity - l.returned_qty, unitPrice: Number(l.unit_price), lineTotal: Number(l.line_total) })),
    returns: returns.map((r): DispenseReturnDTO => ({ id: r.id, lineId: r.line_id, medicineName: r.medicine_name, batchNo: r.batch_no, quantity: r.quantity, condition: r.condition as ReturnCondition, creditNoteNo: r.credit_note_no ?? "", creditValue: Number(r.credit_value), reason: r.reason ?? "", returnedBy: r.returned_by, at: r.created_at })),
  };
}

/** The latest dispenses, newest first. */
export async function listDispenses(limit: number, actor: Session): Promise<DispenseDTO[]> {
  const { rows } = await pharmacyDispensesRepo.listRows(scopeToHospital({ pageSize: Math.min(Math.max(limit, 1), 100), page: 1, sort: [{ column: "id", direction: "desc" }] }, actor));
  return Promise.all((rows as PharmacyDispenseRow[]).map(async (d) => toDto(d, await linesOf(d.id, actor), await returnsOf(d.id, actor))));
}

export async function getDispense(id: number, actor: Session): Promise<DispenseDTO> {
  const d = await pharmacyDispensesRepo.getRow(id);
  assertOwnedByHospital(d, actor, "Dispense");
  return toDto(d as PharmacyDispenseRow, await linesOf(id, actor), await returnsOf(id, actor));
}

// ── Dispensing ───────────────────────────────────────────────────────────────

interface Request { itemId: number; quantity: number; unitPrice: number | null }

function parseRequest(input: unknown): { lines: Request[]; billing: DispenseBilling; patientId: number | null; walkInNote: string; prescriptionId: number | null } {
  const body = isRecord(input) ? input : {};
  const errors: FieldError[] = [];
  const billing = String(body.billing ?? "none") as DispenseBilling;
  if (!BILLINGS.includes(billing)) errors.push({ field: "billing", message: `billing must be one of: ${BILLINGS.join(", ")}` });
  const patientId = body.patientId === undefined || body.patientId === null || body.patientId === "" ? null : Number(body.patientId);
  if (patientId !== null && (!Number.isInteger(patientId) || patientId <= 0)) errors.push({ field: "patientId", message: "patientId is not valid" });
  const prescriptionId = body.prescriptionId === undefined || body.prescriptionId === null || body.prescriptionId === "" ? null : Number(body.prescriptionId);
  if (prescriptionId !== null && (!Number.isInteger(prescriptionId) || prescriptionId <= 0)) errors.push({ field: "prescriptionId", message: "prescriptionId is not valid" });
  const walkInNote = typeof body.walkInNote === "string" ? body.walkInNote.trim().slice(0, 120) : "";
  if (!Array.isArray(body.lines) || body.lines.length === 0) errors.push({ field: "lines", message: "add at least one medicine" });
  else if (body.lines.length > MAX_LINES) errors.push({ field: "lines", message: `dispense at most ${MAX_LINES} medicines at a time` });
  const merged = new Map<number, Request>();
  for (const [i, raw] of (Array.isArray(body.lines) ? body.lines : []).entries()) {
    const l = isRecord(raw) ? raw : {};
    const itemId = Number(l.itemId), quantity = Number(l.quantity);
    const price = l.unitPrice === undefined || l.unitPrice === null || l.unitPrice === "" ? null : Number(l.unitPrice);
    if (!Number.isInteger(itemId) || itemId <= 0) { errors.push({ field: `lines[${i}]`, message: "pick a medicine" }); continue; }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QTY) { errors.push({ field: `lines[${i}]`, message: "quantity must be a whole number of units" }); continue; }
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10_000_000)) { errors.push({ field: `lines[${i}]`, message: "price must be a number from 0" }); continue; }
    const prev = merged.get(itemId);
    merged.set(itemId, prev ? { ...prev, quantity: prev.quantity + quantity, unitPrice: prev.unitPrice ?? price } : { itemId, quantity, unitPrice: price });
  }
  if (errors.length) throw new ValidationError(errors);
  if (billing !== "none" && patientId === null) throw new ValidationError([{ field: "billing", message: "pick a patient to bill — or choose No bill for a walk-in" }]);
  return { lines: [...merged.values()], billing, patientId, walkInNote, prescriptionId };
}

/** Dispense: draw the stock from batches (earliest expiry first), record the sale and raise the bill the pharmacist chose. */
export async function createDispense(input: unknown, actor: Session): Promise<DispenseDTO> {
  const hospitalId = requireHospitalId(actor);
  const req = parseRequest(input);
  const today = localDate();

  let patientName = "Walk-in";
  if (req.patientId !== null) {
    const p = await patientsRepo.getRow(req.patientId);
    assertOwnedByHospital(p, actor, "Patient");
    patientName = p!.name;
  }
  let rxNumber = "";
  if (req.prescriptionId !== null) {
    const rx = await prescriptionsRepo.getRow(req.prescriptionId);
    assertOwnedByHospital(rx, actor, "Prescription");
    if (req.patientId === null || rx!.patient_id !== req.patientId) throw new ValidationError([{ field: "prescriptionId", message: "that prescription belongs to a different patient" }]);
    if (rx!.status === "Dispensed") throw new ConflictError(`${rx!.rx_number} has already been dispensed`);
    rxNumber = rx!.rx_number;
  }

  const lockKeys = req.lines.map((l) => `pharmacy-stock:${hospitalId}:${l.itemId}`);
  const result = await withKeyLocks(lockKeys, async () => {
    // Work out every draw first; nothing changes unless every medicine can be filled.
    const plan: { item: PharmacyItemRow; draws: { batch: PharmacyBatchRow; take: number }[]; price: number }[] = [];
    for (const l of req.lines) {
      const item = await pharmacyRepo.getRow(l.itemId);
      if (!item || item.hospital_id !== hospitalId) throw new ValidationError([{ field: "lines", message: "one of those medicines is not in this pharmacy" }]);
      const batches = usable(await syncBatches(item as PharmacyItemRow, actor), today);
      const have = batches.reduce((n, b) => n + Number(b.quantity), 0);
      if (have < l.quantity) throw new ConflictError(have === 0 ? `${item.name} has no stock in date` : `Only ${have} ${have === 1 ? "unit" : "units"} of ${item.name} in date (asked for ${l.quantity})`);
      let need = l.quantity;
      const draws: { batch: PharmacyBatchRow; take: number }[] = [];
      for (const b of batches) { if (need <= 0) break; const take = Math.min(need, Number(b.quantity)); draws.push({ batch: b, take }); need -= take; }
      plan.push({ item: item as PharmacyItemRow, draws, price: money(l.unitPrice ?? Number(item.unit_price ?? 0)) });
    }
    const subtotal = money(plan.reduce((n, p) => n + p.price * p.draws.reduce((m, d) => m + d.take, 0), 0));

    const { rows: existing } = await pharmacyDispensesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const dispenseNo = nextCode((existing as PharmacyDispenseRow[]).map((r) => r.dispense_no), `DSP/${today.slice(2, 4)}/`, 5);
    const id = await transactional("pharmacy.dispense", async (uow) => {
      const d = await uow.insert<PharmacyDispenseRow>(TABLES.pharmacyDispenses, {
        hospital_id: hospitalId, dispense_no: dispenseNo, patient_id: req.patientId, patient_name: patientName, walk_in_note: req.walkInNote, prescription_id: req.prescriptionId,
        rx_number: rxNumber, billing: req.billing, bill_id: null, bill_number: null, admission_id: null, admission_no: null, subtotal, status: "Dispensed", dispensed_by: actor.name,
      });
      for (const p of plan) {
        let drawn = 0;
        for (const { batch, take } of p.draws) {
          await uow.update(TABLES.pharmacyBatches, batch.id, { quantity: Number(batch.quantity) - take });
          await uow.insert(TABLES.pharmacyDispenseLines, {
            hospital_id: hospitalId, dispense_id: d.id, item_id: p.item.id, medicine_name: p.item.name, batch_id: batch.id, batch_no: batch.batch_no, expiry_date: batch.expiry_date ?? "",
            quantity: take, returned_qty: 0, unit_price: p.price, line_total: money(take * p.price),
          });
          drawn += take;
        }
        const left = Number(p.item.stock) - drawn;
        const patch: Record<string, unknown> = { stock: left, status: computePharmacyStatus(left, Number(p.item.min_stock), p.item.expiry_date) };
        if (!(Number(p.item.unit_price ?? 0) > 0) && p.price > 0) patch.unit_price = p.price; // the first price entered becomes the item's price
        await uow.update(TABLES.pharmacyItems, p.item.id, patch);
      }
      if (req.prescriptionId !== null) await uow.update(TABLES.prescriptions, req.prescriptionId, { status: "Dispensed" });
      return d.id;
    });
    return id;
  });

  // The bill. A billing hiccup never undoes a dispense that has already moved stock; it is reported instead.
  let warning: string | undefined;
  const dispense = (await pharmacyDispensesRepo.getRow(result)) as PharmacyDispenseRow;
  if (req.billing !== "none" && req.patientId !== null && Number(dispense.subtotal) > 0) {
    try {
      const { rows: stays } = await ipdRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: req.patientId }] }, actor));
      const stay = stays.find((a) => a.status !== "Discharged");
      let billId: number, billNumber: string;
      if (req.billing === "separate") {
        const b = await createBill({ patientId: req.patientId, patientName, type: "Pharmacy", amount: Number(dispense.subtotal), status: "Pending" }, actor);
        billId = b.id; billNumber = b.billNumber;
      } else {
        const type = stay ? "IPD" : "OPD";
        const { rows: open } = await billsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: req.patientId }, { column: "status", op: "eq", value: "Pending" }, { column: "type", op: "eq", value: type }], sort: [{ column: "id", direction: "desc" }] }, actor));
        const current = (open as BillRow[])[0];
        const b = current ? await updateBill(current.id, { amount: Number(current.amount) + Number(dispense.subtotal) }, actor) : await createBill({ patientId: req.patientId, patientName, type, amount: Number(dispense.subtotal), status: "Pending" }, actor);
        billId = b.id; billNumber = b.billNumber;
      }
      await pharmacyDispensesRepo.update(result, { bill_id: billId, bill_number: billNumber, admission_id: req.billing === "patient" && stay ? stay.id : null, admission_no: req.billing === "patient" && stay ? stay.admission_no ?? null : null } as never);
    } catch (e) {
      warning = `The medicines were dispensed, but the bill could not be raised${e instanceof Error ? ` (${e.message})` : ""}. Raise it from Billing.`;
    }
  }
  await audit(actor, "dispense", "pharmacy-dispense", result, { dispenseNo: dispense.dispense_no, billing: req.billing, total: Number(dispense.subtotal) });
  return { ...(await getDispense(result, actor)), ...(warning ? { billingWarning: warning } : {}) };
}

// ── Returns ──────────────────────────────────────────────────────────────────

/** Take dispensed lines back. Usable units re-enter the batch they came from; damaged or expired ones are written off. A billed dispense mints a credit note. */
export async function returnDispense(id: number, input: unknown, actor: Session): Promise<DispenseDTO> {
  const hospitalId = requireHospitalId(actor);
  const body = isRecord(input) ? input : {};
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!Array.isArray(body.lines) || body.lines.length === 0) throw new ValidationError([{ field: "lines", message: "pick at least one line to return" }]);
  const wanted = new Map<number, { quantity: number; condition: ReturnCondition }>();
  const errors: FieldError[] = [];
  for (const [i, raw] of (body.lines as unknown[]).entries()) {
    const l = isRecord(raw) ? raw : {};
    const lineId = Number(l.lineId), quantity = Number(l.quantity), condition = String(l.condition ?? "Usable") as ReturnCondition;
    if (!Number.isInteger(lineId) || lineId <= 0) errors.push({ field: `lines[${i}]`, message: "pick a line" });
    else if (!Number.isInteger(quantity) || quantity <= 0) errors.push({ field: `lines[${i}]`, message: "quantity must be a whole number of units" });
    else if (!CONDITIONS.includes(condition)) errors.push({ field: `lines[${i}]`, message: `condition must be one of: ${CONDITIONS.join(", ")}` });
    else if (wanted.has(lineId)) errors.push({ field: `lines[${i}]`, message: "that line is listed twice" });
    else wanted.set(lineId, { quantity, condition });
  }
  if (errors.length) throw new ValidationError(errors);

  const first = await pharmacyDispensesRepo.getRow(id);
  assertOwnedByHospital(first, actor, "Dispense");
  const dispense = first as PharmacyDispenseRow;
  const itemIds = [...new Set((await linesOf(id, actor)).filter((l) => wanted.has(l.id)).map((l) => l.item_id))];

  await withKeyLocks([`pharmacy-dispense:${hospitalId}:${id}`, ...itemIds.map((n) => `pharmacy-stock:${hospitalId}:${n}`)], async () => {
    const lines = await linesOf(id, actor);
    const picked = [...wanted].map(([lineId, w]) => {
      const line = lines.find((l) => l.id === lineId);
      if (!line) throw new NotFoundError("Dispensed line");
      const left = line.quantity - line.returned_qty;
      if (w.quantity > left) throw new ConflictError(left === 0 ? `${line.medicine_name} (${line.batch_no}) has already been returned in full` : `Only ${left} of ${line.medicine_name} (${line.batch_no}) can still be returned`);
      return { line, ...w };
    });
    const billed = dispense.billing !== "none" && dispense.bill_id !== null;
    const { rows: allReturns } = await pharmacyReturnsRepo.listRows(scopeToHospital({ unpaged: true }, actor));
    const creditNos = (allReturns as PharmacyReturnRow[]).map((r) => r.credit_note_no ?? "");
    const yy = localDate().slice(2, 4);
    const credits: number[] = [];
    await transactional("pharmacy.return", async (uow) => {
      for (const p of picked) {
        if (p.condition === "Usable") {
          const batch = p.line.batch_id !== null ? await pharmacyBatchesRepo.getRow(p.line.batch_id) : null;
          if (batch) await uow.update(TABLES.pharmacyBatches, batch.id, { quantity: Number(batch.quantity) + p.quantity });
          else await uow.insert(TABLES.pharmacyBatches, { hospital_id: hospitalId, item_id: p.line.item_id, batch_no: p.line.batch_no, expiry_date: p.line.expiry_date ?? "", quantity: p.quantity });
          const item = await pharmacyRepo.getRow(p.line.item_id);
          if (item) {
            const stock = Number(item.stock) + p.quantity;
            await uow.update(TABLES.pharmacyItems, item.id, { stock, status: computePharmacyStatus(stock, Number(item.min_stock), item.expiry_date) });
          }
        }
        await uow.update(TABLES.pharmacyDispenseLines, p.line.id, { returned_qty: p.line.returned_qty + p.quantity });
        const value = money(p.quantity * Number(p.line.unit_price));
        let creditNo = "";
        if (billed && value > 0) { creditNo = await nextNumber("credit_note", actor, creditNos, { prefix: `CN/${yy}/`, pad: 5 }); creditNos.push(creditNo); credits.push(value); }
        await uow.insert(TABLES.pharmacyReturns, {
          hospital_id: hospitalId, dispense_id: id, line_id: p.line.id, medicine_name: p.line.medicine_name, batch_no: p.line.batch_no, quantity: p.quantity, condition: p.condition,
          credit_note_no: creditNo, credit_value: billed ? value : 0, reason, returned_by: actor.name,
        });
      }
      const after = lines.map((l) => ({ q: l.quantity, r: l.returned_qty + (wanted.get(l.id)?.quantity ?? 0) }));
      const status = after.every((a) => a.r >= a.q) ? "Returned" : "Part returned";
      await uow.update(TABLES.pharmacyDispenses, id, { status });
    });
    // The credit note is a Refunded pharmacy entry in Billing; a hiccup there never undoes the stock movement.
    const total = money(credits.reduce((n, c) => n + c, 0));
    if (total > 0 && dispense.patient_id !== null) {
      try { await createBill({ patientId: dispense.patient_id, patientName: dispense.patient_name, type: "Pharmacy", amount: total, status: "Refunded" }, actor); } catch { /* the credit note number is on the return; Billing can record it by hand */ }
    }
  });
  await audit(actor, "return", "pharmacy-dispense", id, { lines: wanted.size });
  return getDispense(id, actor);
}
