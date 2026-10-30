/**
 * Ambulance — the vehicle fleet and the dispatch of calls.
 *
 *   Call    Queued ──dispatch──▶ Dispatched (en route to pickup) ──at scene──▶ At scene ──transport──▶ Transporting ──▶ Completed
 *           A call with a vehicle starts at Dispatched; one opened without a vehicle waits as Queued until it is given one. Any open
 *           call can be Cancelled, and one with a vehicle can be completed from any step. Each step is timed, for the dashboard.
 *   Vehicle Available ⇄ On Call (shown as "Dispatched") while it has an open call; Maintenance (shown as "Off road") is set by hand.
 *   Billing Completing a call with a fare raises an "Ambulance" bill.
 */
import { ambulancesRepo, ambulanceCallsRepo, hospitalsRepo, patientsRepo } from "@/repositories";
import { createBill } from "@/services/billing-service";
import { nextNumber } from "@/services/id-service";
import { toAmbulanceDTO, toAmbulanceCallDTO } from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import { type AmbulanceRow, type AmbulanceCallRow } from "@/db/tables";
import { ConflictError, ValidationError } from "@/lib/errors";
import { validate, validatePartial } from "@/lib/validation";
import { withKeyLocks } from "@/lib/key-lock";
import { localDate } from "@/lib/clock";
import { displayDate, displayTime } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital, requireHospitalId } from "@/services/hospital-scope";
import type { AmbulanceDashboardDTO } from "@shared/types/api";

export const CALL_TYPES = ["Emergency pickup", "Inter-hospital transfer", "Discharge drop", "Scheduled pickup", "Mortuary transfer"] as const;
export const VEHICLE_TYPES = ["Basic Life Support (BLS)", "Advanced Life Support (ALS)", "Neonatal", "Patient transport", "Mortuary van"] as const;
/** A call that still has work to do. */
export const OPEN_CALL = ["Queued", "Dispatched", "At scene", "Transporting"];
const WITH_VEHICLE = ["Dispatched", "At scene", "Transporting"];

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

// ── Vehicles ────────────────────────────────────────────────────────────────

const vehicleSchema = {
  vehicleNumber: { type: "string", required: true, min: 4, max: 20 },
  code: { type: "string", required: false, max: 20, default: "" },
  vehicleType: { type: "enum", required: false, values: [...VEHICLE_TYPES] },
  model: { type: "string", required: false, max: 80, default: "" },
  driverName: { type: "string", required: false, max: 120, default: "" },
  driverPhone: { type: "string", required: false, max: 20, default: "" },
  status: { type: "enum", required: false, values: ["Available", "On Call", "Maintenance"], default: "Available" },
} as const;

export const VEHICLES_LIST_CONFIG = {
  searchColumns: ["vehicle_number", "model", "driver_name", "code"],
  filterable: ["status"],
  sortable: ["vehicle_number", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listVehicles(options: QueryOptions, actor: Session) {
  return ambulancesRepo.list(scopeToHospital(options, actor));
}

export async function getVehicle(id: number, actor: Session) {
  const row = await ambulancesRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Ambulance");
  return toAmbulanceDTO(row as AmbulanceRow);
}

/** The board code for a vehicle that wasn't given one: AMB-01, AMB-02 … the first not already taken. */
function freeCode(taken: Set<string>): string {
  for (let n = taken.size + 1; ; n++) { const c = `AMB-${String(n).padStart(2, "0")}`; if (!taken.has(c.toLowerCase())) return c; }
}

export async function createVehicle(input: unknown, actor: Session) {
  const data = validate(vehicleSchema, input);
  const existing = await all<AmbulanceRow>(ambulancesRepo, actor);
  const taken = new Set(existing.map((v) => (v.code || `AMB-${String(v.id).padStart(2, "0")}`).toLowerCase()));
  const code = (data.code ?? "").trim() || freeCode(taken);
  if (taken.has(code.toLowerCase())) throw new ConflictError(`There is already an ambulance coded ${code}`);
  const row = await ambulancesRepo.create({
    hospital_id: actor.hospitalId,
    vehicle_number: data.vehicleNumber,
    code,
    vehicle_type: data.vehicleType ?? VEHICLE_TYPES[0],
    model: data.model,
    driver_name: data.driverName,
    driver_phone: data.driverPhone,
    status: data.status,
  });
  await audit(actor, "create", "ambulance", row.id);
  return toAmbulanceDTO(row as AmbulanceRow);
}

export async function updateVehicle(id: number, input: unknown, actor: Session) {
  const existing = await ambulancesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ambulance");
  const data = validatePartial(vehicleSchema, input);
  const patch: Record<string, unknown> = {};
  if ("vehicleNumber" in data) patch.vehicle_number = data.vehicleNumber;
  if ("model" in data) patch.model = data.model;
  if ("driverName" in data) patch.driver_name = data.driverName;
  if ("driverPhone" in data) patch.driver_phone = data.driverPhone;
  if ("vehicleType" in data) patch.vehicle_type = data.vehicleType;
  if ("code" in data && data.code) {
    const clash = (await all<AmbulanceRow>(ambulancesRepo, actor)).some((v) => v.id !== id && (v.code || "").toLowerCase() === data.code!.toLowerCase());
    if (clash) throw new ConflictError(`There is already an ambulance coded ${data.code}`);
    patch.code = data.code;
  }
  if ("status" in data) {
    // A vehicle on an open call can't be put off road or marked free from under it.
    if (data.status !== existing.status && existing.status === "On Call") {
      const open = (await all<AmbulanceCallRow>(ambulanceCallsRepo, actor)).some((c) => c.ambulance_id === id && WITH_VEHICLE.includes(c.status));
      if (open) throw new ConflictError("That ambulance is on a call — complete or cancel the call first");
    }
    patch.status = data.status;
  }
  const row = await ambulancesRepo.update(id, patch);
  await audit(actor, "update", "ambulance", id, patch);
  return toAmbulanceDTO(row as AmbulanceRow);
}

export async function deleteVehicle(id: number, actor: Session) {
  const existing = await ambulancesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ambulance");
  const open = (await all<AmbulanceCallRow>(ambulanceCallsRepo, actor)).some((c) => c.ambulance_id === id && WITH_VEHICLE.includes(c.status));
  if (open) throw new ConflictError("That ambulance is on a call — complete or cancel the call first");
  await ambulancesRepo.remove(id);
  await audit(actor, "delete", "ambulance", id);
}

// ── Calls ───────────────────────────────────────────────────────────────────

const callSchema = {
  callType: { type: "enum", required: false, values: [...CALL_TYPES], default: "Emergency pickup" },
  patientId: { type: "number", required: false },
  patientName: { type: "string", required: false, max: 120, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  pickupLocation: { type: "string", required: true, min: 2, max: 240 },
  dropLocation: { type: "string", required: false, max: 240, default: "" },
  ambulanceId: { type: "number", required: false },
  amount: { type: "number", required: false, min: 0, default: 0 },
} as const;

export const CALLS_LIST_CONFIG = {
  searchColumns: ["patient_name", "vehicle_number", "driver_name", "pickup_location", "call_no"],
  filterable: ["status", "call_type"],
  sortable: ["call_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "desc" as const }],
};

export async function listCalls(options: QueryOptions, actor: Session) {
  return ambulanceCallsRepo.list(scopeToHospital(options, actor));
}

/** Put a vehicle on a call: it must be free. */
async function takeVehicle(ambulanceId: number, actor: Session): Promise<AmbulanceRow> {
  const v = await ambulancesRepo.getRow(ambulanceId);
  assertOwnedByHospital(v, actor, "Ambulance");
  if (v.status !== "Available") throw new ConflictError(`Ambulance ${v.code || v.vehicle_number} is ${v.status === "On Call" ? "on another call" : "off the road"}`);
  await ambulancesRepo.update(v.id, { status: "On Call" });
  return v;
}

export async function createCall(input: unknown, actor: Session) {
  const hospitalId = requireHospitalId(actor);
  const data = validate(callSchema, input);
  return withKeyLocks([`ambulance:${hospitalId}`], async () => {
    let patientName = (data.patientName ?? "").trim();
    let patientId: number | null = null;
    let phone = data.phone ?? "";
    if (data.patientId != null) {
      const p = await patientsRepo.getRow(data.patientId);
      assertOwnedByHospital(p, actor, "Patient");
      patientId = p.id; patientName = p.name; phone = phone || p.phone;
    }
    if (!patientName) patientName = "Unidentified";
    const vehicle = data.ambulanceId != null ? await takeVehicle(data.ambulanceId, actor) : null;
    // A pickup with no stated destination is taken to this hospital.
    const hospital = await hospitalsRepo.getRow(hospitalId);
    const drop = (data.dropLocation ?? "").trim() || (data.callType === "Emergency pickup" || !data.callType ? hospital?.name ?? "" : "");

    const yy = localDate().slice(2, 4);
    const callNo = await nextNumber("ambulance_call", actor, (await all<AmbulanceCallRow>(ambulanceCallsRepo, actor)).map((c) => c.call_no ?? ""), { prefix: `AMB/${yy}/`, pad: 5 });
    const now = new Date().toISOString();
    const row = await ambulanceCallsRepo.create({
      hospital_id: hospitalId, call_no: callNo, call_type: data.callType, patient_id: patientId, patient_name: patientName, phone,
      pickup_location: data.pickupLocation, drop_location: drop, ambulance_id: vehicle?.id ?? null, vehicle_number: vehicle?.vehicle_number ?? "", driver_name: vehicle?.driver_name ?? "",
      call_date: displayDate(), call_time: displayTime(), amount: data.amount, status: vehicle ? "Dispatched" : "Queued", dispatched_at: vehicle ? now : null, at_scene_at: null, closed_at: null,
    });
    await audit(actor, "dispatch", "ambulance-call", row.id, { name: `${callNo} · ${data.callType}${vehicle ? ` · ${vehicle.code || vehicle.vehicle_number}` : " · queued"}` });
    return toAmbulanceCallDTO(row as AmbulanceCallRow);
  });
}

async function load(id: number, actor: Session): Promise<AmbulanceCallRow> {
  const row = await ambulanceCallsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Ambulance call");
  return row;
}
const must = (row: AmbulanceCallRow, from: string[], verb: string) => {
  if (!from.includes(row.status)) throw new ConflictError(`That call is ${row.status.toLowerCase()} — it can't be ${verb} now`);
};
const done = async (id: number, patch: Record<string, unknown>, verb: string, row: AmbulanceCallRow, actor: Session) => {
  const updated = await ambulanceCallsRepo.update(id, patch);
  await audit(actor, "update", "ambulance-call", id, { name: `${row.call_no || `Call #${id}`} · ${verb}` });
  return toAmbulanceCallDTO(updated as AmbulanceCallRow);
};

/** Give a queued call a vehicle. */
export async function dispatchCall(id: number, input: unknown, actor: Session) {
  const { ambulanceId } = validate({ ambulanceId: { type: "number", required: true } } as const, input);
  const hospitalId = requireHospitalId(actor);
  return withKeyLocks([`ambulance:${hospitalId}`], async () => {
    const row = await load(id, actor);
    must(row, ["Queued"], "dispatched");
    const v = await takeVehicle(ambulanceId, actor);
    return done(id, { ambulance_id: v.id, vehicle_number: v.vehicle_number, driver_name: v.driver_name, status: "Dispatched", dispatched_at: new Date().toISOString() }, `dispatched ${v.code || v.vehicle_number}`, row, actor);
  });
}

export async function arriveAtScene(id: number, actor: Session) {
  const row = await load(id, actor);
  must(row, ["Dispatched"], "marked at scene");
  return done(id, { status: "At scene", at_scene_at: new Date().toISOString() }, "at scene", row, actor);
}

export async function startTransport(id: number, actor: Session) {
  const row = await load(id, actor);
  must(row, ["At scene"], "marked as transporting");
  return done(id, { status: "Transporting" }, "transporting", row, actor);
}

/** Close the call: the vehicle is free again, and a fare raises an Ambulance bill. */
export async function completeCall(id: number, input: unknown, actor: Session) {
  const data = validate({ amount: { type: "number", required: false, min: 0 } } as const, input ?? {});
  const row = await load(id, actor);
  must(row, WITH_VEHICLE, "completed");
  const fare = data.amount ?? Number(row.amount);
  if (row.ambulance_id) await ambulancesRepo.update(row.ambulance_id, { status: "Available" });
  if (fare > 0) await createBill({ ...(row.patient_id ? { patientId: row.patient_id } : {}), patientName: row.patient_name, type: "Ambulance", amount: fare, status: "Pending" }, actor);
  return done(id, { status: "Completed", amount: fare, closed_at: new Date().toISOString() }, "completed", row, actor);
}

export async function cancelCall(id: number, actor: Session) {
  const row = await load(id, actor);
  must(row, OPEN_CALL, "cancelled");
  if (row.ambulance_id && WITH_VEHICLE.includes(row.status)) await ambulancesRepo.update(row.ambulance_id, { status: "Available" });
  return done(id, { status: "Cancelled", closed_at: new Date().toISOString() }, "cancelled", row, actor);
}

/** Older clients move a call with PATCH { status }; it goes through the same steps. */
export async function updateCall(id: number, input: unknown, actor: Session) {
  const schema = {
    status: { type: "enum", required: false, values: ["Dispatched", "Completed", "Cancelled"] },
    amount: { type: "number", required: false, min: 0 },
  } as const;
  const data = validatePartial(schema, input);
  if (data.status === "Completed") return completeCall(id, { amount: data.amount }, actor);
  if (data.status === "Cancelled") return cancelCall(id, actor);
  const existing = await load(id, actor);
  if (data.status && data.status !== existing.status) throw new ConflictError("Use the dispatch step to send a vehicle");
  if ("amount" in data) {
    const row = await ambulanceCallsRepo.update(id, { amount: data.amount });
    await audit(actor, "update", "ambulance-call", id, { amount: data.amount });
    return toAmbulanceCallDTO(row as AmbulanceCallRow);
  }
  return toAmbulanceCallDTO(existing);
}

export async function deleteCall(id: number, actor: Session) {
  const existing = await load(id, actor);
  if (WITH_VEHICLE.includes(existing.status) && existing.ambulance_id) await ambulancesRepo.update(existing.ambulance_id, { status: "Available" });
  await ambulanceCallsRepo.remove(id);
  await audit(actor, "delete", "ambulance-call", id);
}

// ── Dashboard ───────────────────────────────────────────────────────────────

const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const mins = (a: string | null | undefined, b: string | null | undefined): number | null => {
  if (!a || !b) return null;
  const m = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return m >= 0 ? m : null;
};
const avg = (xs: (number | null)[]): number | null => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((n, x) => n + x, 0) / v.length) * 10) / 10 : null; };

export async function getAmbulanceDashboard(rawDays: number, actor: Session): Promise<AmbulanceDashboardDTO> {
  requireHospitalId(actor);
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
  const to = localDate();
  const from = addDays(to, -(days - 1));
  const [calls, vehicles] = await Promise.all([all<AmbulanceCallRow>(ambulanceCallsRepo, actor), all<AmbulanceRow>(ambulancesRepo, actor)]);
  const day = (c: AmbulanceCallRow) => (c.created_at ? new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: process.env.HOSPITAL_TIMEZONE || "Asia/Kolkata" }) : "");
  const inRange = calls.filter((c) => day(c) >= from && day(c) <= to);
  const completed = inRange.filter((c) => c.status === "Completed");
  const byType = new Map<string, number>();
  for (const c of inRange) byType.set(c.call_type || "Emergency pickup", (byType.get(c.call_type || "Emergency pickup") ?? 0) + 1);
  return {
    days, from, to,
    calls: { total: inRange.length, completed: completed.length, cancelled: inRange.filter((c) => c.status === "Cancelled").length, active: calls.filter((c) => WITH_VEHICLE.includes(c.status)).length, queued: calls.filter((c) => c.status === "Queued").length, revenue: Math.round(completed.reduce((n, c) => n + Number(c.amount), 0) * 100) / 100 },
    response: { dispatchMin: avg(inRange.map((c) => mins(c.created_at, c.dispatched_at))), sceneMin: avg(inRange.map((c) => mins(c.created_at, c.at_scene_at))), tripMin: avg(completed.map((c) => mins(c.dispatched_at, c.closed_at))) },
    byType: [...byType].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byVehicle: vehicles.sort((a, b) => a.id - b.id).map((v) => ({ code: v.code || `AMB-${String(v.id).padStart(2, "0")}`, vehicleType: v.vehicle_type ?? "", calls: inRange.filter((c) => c.ambulance_id === v.id).length, completed: completed.filter((c) => c.ambulance_id === v.id).length })),
    series: Array.from({ length: days }, (_, i) => { const d = addDays(from, i); return { date: d, calls: inRange.filter((c) => day(c) === d).length }; }),
    fleet: { available: vehicles.filter((v) => v.status === "Available").length, dispatched: vehicles.filter((v) => v.status === "On Call").length, offRoad: vehicles.filter((v) => v.status === "Maintenance").length, total: vehicles.length },
  };
}

void ValidationError;
