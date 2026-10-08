/**
 * Vital records service — birth and death registries.
 */
import { birthRecordsRepo, deathRecordsRepo } from "@/repositories";
import {
  toBirthRecordDTO,
  toDeathRecordDTO,
} from "@/repositories/mappers";
import { type QueryOptions } from "@/db/adapter";
import {
  type BirthRecordRow,
  type DeathRecordRow,
} from "@/db/tables";
import { validate, validatePartial } from "@/lib/validation";
import { displayDate, displayTime } from "@/services/helpers";
import { audit } from "@/services/audit";
import { type Session } from "@/auth/session";
import { scopeToHospital, assertOwnedByHospital } from "@/services/hospital-scope";

// ── Births ──────────────────────────────────────────────────────────────────

const birthSchema = {
  childName: { type: "string", required: true, min: 2, max: 120 },
  gender: { type: "enum", required: true, values: ["Male", "Female"] },
  date: { type: "string", required: false, max: 40, default: "" },
  time: { type: "string", required: false, max: 20, default: "" },
  weightKg: { type: "number", required: false, min: 0, max: 10, default: 0 },
  motherName: { type: "string", required: true, min: 2, max: 120 },
  fatherName: { type: "string", required: false, max: 120, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  address: { type: "string", required: false, max: 240, default: "" },
} as const;

export const BIRTHS_LIST_CONFIG = {
  searchColumns: ["child_name", "mother_name", "father_name", "phone"],
  filterable: ["gender"],
  sortable: ["birth_date", "child_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listBirths(options: QueryOptions, actor: Session) {
  return birthRecordsRepo.list(scopeToHospital(options, actor));
}

export async function getBirth(id: number, actor: Session) {
  const row = await birthRecordsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Birth record");
  return toBirthRecordDTO(row);
}

export async function createBirth(input: unknown, actor: Session) {
  const data = validate(birthSchema, input);
  const row = await birthRecordsRepo.create({
    hospital_id: actor.hospitalId,
    child_name: data.childName,
    gender: data.gender,
    birth_date: data.date || displayDate(),
    birth_time: data.time || displayTime(),
    weight_kg: data.weightKg,
    mother_name: data.motherName,
    father_name: data.fatherName,
    phone: data.phone,
    address: data.address,
  });
  await audit(actor, "create", "birth-record", row.id);
  return toBirthRecordDTO(row as BirthRecordRow);
}

export async function updateBirth(id: number, input: unknown, actor: Session) {
  const existing = await birthRecordsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Birth record");
  const data = validatePartial(birthSchema, input);
  const patch: Record<string, unknown> = {};
  if ("childName" in data) patch.child_name = data.childName;
  if ("gender" in data) patch.gender = data.gender;
  if ("date" in data) patch.birth_date = data.date;
  if ("time" in data) patch.birth_time = data.time;
  if ("weightKg" in data) patch.weight_kg = data.weightKg;
  if ("motherName" in data) patch.mother_name = data.motherName;
  if ("fatherName" in data) patch.father_name = data.fatherName;
  if ("phone" in data) patch.phone = data.phone;
  if ("address" in data) patch.address = data.address;
  const row = await birthRecordsRepo.update(id, patch);
  await audit(actor, "update", "birth-record", id, patch);
  return toBirthRecordDTO(row as BirthRecordRow);
}

export async function deleteBirth(id: number, actor: Session) {
  const existing = await birthRecordsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Birth record");
  await birthRecordsRepo.remove(id);
  await audit(actor, "delete", "birth-record", id);
}

// ── Deaths ──────────────────────────────────────────────────────────────────

const deathSchema = {
  deceasedName: { type: "string", required: true, min: 2, max: 120 },
  gender: { type: "enum", required: true, values: ["Male", "Female"] },
  age: { type: "number", required: false, min: 0, max: 150, default: 0 },
  date: { type: "string", required: false, max: 40, default: "" },
  time: { type: "string", required: false, max: 20, default: "" },
  guardianName: { type: "string", required: false, max: 120, default: "" },
  cause: { type: "string", required: false, max: 240, default: "" },
  phone: { type: "string", required: false, max: 20, default: "" },
  address: { type: "string", required: false, max: 240, default: "" },
} as const;

export const DEATHS_LIST_CONFIG = {
  searchColumns: ["deceased_name", "guardian_name", "cause", "phone"],
  filterable: ["gender"],
  sortable: ["death_date", "deceased_name", "created_at"],
  defaultSort: [{ column: "id" as const, direction: "asc" as const }],
};

export async function listDeaths(options: QueryOptions, actor: Session) {
  return deathRecordsRepo.list(scopeToHospital(options, actor));
}

export async function getDeath(id: number, actor: Session) {
  const row = await deathRecordsRepo.getRow(id);
  assertOwnedByHospital(row, actor, "Death record");
  return toDeathRecordDTO(row);
}

export async function createDeath(input: unknown, actor: Session) {
  const data = validate(deathSchema, input);
  const row = await deathRecordsRepo.create({
    hospital_id: actor.hospitalId,
    deceased_name: data.deceasedName,
    gender: data.gender,
    age: data.age,
    death_date: data.date || displayDate(),
    death_time: data.time || displayTime(),
    guardian_name: data.guardianName,
    cause: data.cause,
    phone: data.phone,
    address: data.address,
  });
  await audit(actor, "create", "death-record", row.id);
  return toDeathRecordDTO(row as DeathRecordRow);
}

export async function updateDeath(id: number, input: unknown, actor: Session) {
  const existing = await deathRecordsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Death record");
  const data = validatePartial(deathSchema, input);
  const patch: Record<string, unknown> = {};
  if ("deceasedName" in data) patch.deceased_name = data.deceasedName;
  if ("gender" in data) patch.gender = data.gender;
  if ("age" in data) patch.age = data.age;
  if ("date" in data) patch.death_date = data.date;
  if ("time" in data) patch.death_time = data.time;
  if ("guardianName" in data) patch.guardian_name = data.guardianName;
  if ("cause" in data) patch.cause = data.cause;
  if ("phone" in data) patch.phone = data.phone;
  if ("address" in data) patch.address = data.address;
  const row = await deathRecordsRepo.update(id, patch);
  await audit(actor, "update", "death-record", id, patch);
  return toDeathRecordDTO(row as DeathRecordRow);
}

export async function deleteDeath(id: number, actor: Session) {
  const existing = await deathRecordsRepo.getRow(id);
  assertOwnedByHospital(existing, actor, "Death record");
  await deathRecordsRepo.remove(id);
  await audit(actor, "delete", "death-record", id);
}
