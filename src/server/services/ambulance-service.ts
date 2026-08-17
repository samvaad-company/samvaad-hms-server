/**
 * Ambulance service — vehicle fleet and call/dispatch log. Dispatching a call
 * puts the vehicle On Call; completing or cancelling frees it. Completed calls
 * with a fare raise an "Ambulance" bill.
 */
import {
  ambulancesRepo,
  ambulanceCallsRepo,
} from "@/server/repositories";
import { createBill } from "@/server/services/billing-service";
import {
  toAmbulanceDTO,
  toAmbulanceCallDTO,
} from "@/server/repositories/mappers";
import { type QueryOptions } from "@/server/db/adapter";
import {
  type AmbulanceRow,
  type AmbulanceCallRow,
} from "@/server/db/tables";
import { ConflictError } from "@/server/lib/errors";
import { validate, validatePartial } from "@/server/lib/validation";
import { displayDate, displayTime } from "@/server/services/helpers";
import { audit } from "@/server/services/audit";
import { type Session } from "@/server/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/server/services/hospital-scope";

// ── Vehicles ────────────────────────────────────────────────────────────────

const vehicleSchema = {
  vehicleNumber: { type: "string", required: true, min: 4, max: 20 },
  model: { type: "string", required: true, min: 2, max: 80 },
  driverName: { type: "string", required: true, min: 2, max: 120 },
  driverPhone: { type: "string", required: true, min: 7, max: 20 },
  status: { type: "enum", required: false, values: ["Available", "On Call", "Maintenance"], default: "Available" },
} as const;

export const VEHICLES_LIST_CONFIG = {
  searchColumns: ["vehicle_number", "model", "driver_name"],
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

export async function createVehicle(input: unknown, actor: Session) {
  const data = validate(vehicleSchema, input);
  const row = await ambulancesRepo.create({
    hospital_id: actor.hospitalId,
    vehicle_number: data.vehicleNumber,
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
  if ("status" in data) patch.status = data.status;
  const row = await ambulancesRepo.update(id, patch);
  await audit(actor, "update", "ambulance", id, patch);
  return toAmbulanceDTO(row as AmbulanceRow);
}

export async function deleteVehicle(id: number, actor: Session) {
  const existing = await ambulancesRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ambulance");
  await ambulancesRepo.remove(id);
  await audit(actor, "delete", "ambulance", id);
}

// ── Calls ───────────────────────────────────────────────────────────────────

const callSchema = {
  patientName: { type: "string", required: true, min: 2, max: 120 },
  phone: { type: "string", required: false, max: 20, default: "" },
  pickupLocation: { type: "string", required: true, min: 2, max: 240 },
  dropLocation: { type: "string", required: true, min: 2, max: 240 },
  ambulanceId: { type: "number", required: false },
  amount: { type: "number", required: false, min: 0, default: 0 },
} as const;

export const CALLS_LIST_CONFIG = {
  searchColumns: ["patient_name", "vehicle_number", "driver_name", "pickup_location"],
  filterable: ["status"],
  sortable: ["call_date", "patient_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listCalls(options: QueryOptions, actor: Session) {
  return ambulanceCallsRepo.list(scopeToHospital(options, actor));
}

export async function createCall(input: unknown, actor: Session) {
  const data = validate(callSchema, input);

  let vehicleNumber = "";
  let driverName = "";
  if (data.ambulanceId) {
    const v = await ambulancesRepo.getRow(data.ambulanceId);
    assertOwnedByHospital(v, actor, "Ambulance");
    if (v.status !== "Available") {
      throw new ConflictError(`Ambulance ${v.vehicle_number} is ${v.status}`);
    }
    vehicleNumber = v.vehicle_number;
    driverName = v.driver_name;
    await ambulancesRepo.update(v.id, { status: "On Call" });
  }

  const row = await ambulanceCallsRepo.create({
    hospital_id: actor.hospitalId,
    patient_name: data.patientName,
    phone: data.phone,
    pickup_location: data.pickupLocation,
    drop_location: data.dropLocation,
    ambulance_id: data.ambulanceId ?? null,
    vehicle_number: vehicleNumber,
    driver_name: driverName,
    call_date: displayDate(),
    call_time: displayTime(),
    amount: data.amount,
    status: "Dispatched",
  });
  await audit(actor, "dispatch", "ambulance-call", row.id);
  return toAmbulanceCallDTO(row as AmbulanceCallRow);
}

export async function updateCall(id: number, input: unknown, actor: Session) {
  const existing = await ambulanceCallsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ambulance call");
  const schema = {
    status: { type: "enum", required: false, values: ["Dispatched", "Completed", "Cancelled"] },
    amount: { type: "number", required: false, min: 0 },
  } as const;
  const data = validatePartial(schema, input);
  const patch: Record<string, unknown> = {};
  if ("amount" in data) patch.amount = data.amount;
  if ("status" in data) patch.status = data.status;

  // Closing out the call releases the vehicle and bills the fare.
  const closing =
    (data.status === "Completed" || data.status === "Cancelled") &&
    existing.status === "Dispatched";
  if (closing && existing.ambulance_id) {
    await ambulancesRepo.update(existing.ambulance_id, { status: "Available" });
  }
  const fare = (data.amount as number) ?? Number(existing.amount);
  if (data.status === "Completed" && existing.status !== "Completed" && fare > 0) {
    await createBill(
      {
        patientName: existing.patient_name,
        type: "Ambulance",
        amount: fare,
        status: "Pending",
      },
      actor,
    );
  }

  const row = await ambulanceCallsRepo.update(id, patch);
  await audit(actor, "update", "ambulance-call", id, patch);
  return toAmbulanceCallDTO(row as AmbulanceCallRow);
}

export async function deleteCall(id: number, actor: Session) {
  const existing = await ambulanceCallsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Ambulance call");
  if (existing.status === "Dispatched" && existing.ambulance_id) {
    await ambulancesRepo.update(existing.ambulance_id, { status: "Available" });
  }
  await ambulanceCallsRepo.remove(id);
  await audit(actor, "delete", "ambulance-call", id);
}
