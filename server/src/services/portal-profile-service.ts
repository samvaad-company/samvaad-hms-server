/**
 * Patient portal: the patient's own details, and requests to change them.
 *
 * A patient never writes into their record. They send a request (only the fields below), it is kept as "pending" with the old and the
 * new values side by side, and front-desk staff apply or reject it. Applying runs the normal patient update, so every rule on phone
 * numbers, emails and the like holds. Name, date of birth, gender and UHID are not patient-changeable.
 */
import { patientUpdateRequestsRepo } from "@/repositories";
import { type PatientRow, type PatientUpdateRequestRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { BadRequestError, ConflictError, ValidationError, type FieldError } from "@/lib/errors";
import { mobileRule, optionalEmailRule } from "@/lib/field-rules";
import { validatePartial } from "@/lib/validation";
import { audit } from "@/services/audit";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { updatePatient } from "@/services/patients-service";
import { portalPatient } from "@/services/portal-common";

const MAX_PENDING = 5;
const split = (v: string | null | undefined) => String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export async function portalProfile(patientId: number) {
  const p = await portalPatient(patientId);
  return {
    name: p.name, uhid: p.patient_code ?? "", age: p.age, dob: p.dob ?? null, gender: p.gender ?? "", phone: p.phone ?? "", email: p.email ?? "",
    bloodGroup: p.blood_group ?? "", address: p.address ?? "", city: p.city ?? "", state: p.state ?? "", pincode: p.pincode ?? "",
    emergencyName: p.emergency_name ?? "", emergencyRelation: p.emergency_relation ?? "", emergencyPhone: p.emergency_phone ?? "",
    allergies: split(p.allergies), chronicConditions: split(p.chronic_conditions), abhaId: p.abha_id ?? "",
  };
}

const textRule = (max: number) => ({ type: "string", required: false, max }) as const;
const changeSchema = {
  phone: mobileRule,
  email: optionalEmailRule,
  address: textRule(240), city: textRule(80), state: textRule(80), pincode: textRule(12),
  emergencyName: textRule(120), emergencyRelation: textRule(60), emergencyPhone: mobileRule,
} as const;
const LISTS = ["allergies", "chronicConditions"] as const;

/** The patient's current value for a field, in the same shape as the request, so staff can compare. */
function currentOf(p: PatientRow, key: string): unknown {
  switch (key) {
    case "phone": return p.phone ?? "";
    case "email": return p.email ?? "";
    case "address": return p.address ?? "";
    case "city": return p.city ?? "";
    case "state": return p.state ?? "";
    case "pincode": return p.pincode ?? "";
    case "emergencyName": return p.emergency_name ?? "";
    case "emergencyRelation": return p.emergency_relation ?? "";
    case "emergencyPhone": return p.emergency_phone ?? "";
    case "allergies": return split(p.allergies);
    case "chronicConditions": return split(p.chronic_conditions);
    default: return null;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function createUpdateRequest(patientId: number, rawChanges: unknown) {
  const patient = await portalPatient(patientId);
  if (rawChanges == null || typeof rawChanges !== "object" || Array.isArray(rawChanges)) throw new BadRequestError("Send the details you want to change.");
  const input = rawChanges as Record<string, unknown>;
  const allowed = new Set<string>([...Object.keys(changeSchema), ...LISTS]);
  const unknown = Object.keys(input).filter((k) => !allowed.has(k));
  if (unknown.length) throw new ValidationError(unknown.map((k): FieldError => ({ field: k, message: "can't be changed here. Please visit the front desk." })));

  const clean = validatePartial(changeSchema, input) as Record<string, unknown>;
  const lists: Record<string, string[]> = {};
  const errors: FieldError[] = [];
  for (const key of LISTS) {
    if (!(key in input)) continue;
    const raw = input[key];
    if (!Array.isArray(raw) || raw.length > 30 || raw.some((x) => typeof x !== "string" || x.trim().length > 80)) { errors.push({ field: key, message: "must be a short list of names" }); continue; }
    lists[key] = [...new Set(raw.map((x: string) => x.trim()).filter(Boolean))];
  }
  if (errors.length) throw new ValidationError(errors);

  const next: Record<string, unknown> = { ...clean, ...lists };
  const previous: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) {
    if (same(v, currentOf(patient, k))) continue;
    changes[k] = v;
    previous[k] = currentOf(patient, k);
  }
  if (!Object.keys(changes).length) throw new BadRequestError("Nothing is different from what the hospital already has.");

  const { rows } = await patientUpdateRequestsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }] } as never);
  if ((rows as PatientUpdateRequestRow[]).filter((r) => r.status === "pending").length >= MAX_PENDING) {
    throw new ConflictError("You already have several changes waiting for the hospital. Please wait for them to be applied, or call the hospital.");
  }
  const row = await patientUpdateRequestsRepo.create({
    hospital_id: patient.hospital_id, patient_id: patient.id, changes, previous, status: "pending", via: "patient-portal", decision_note: null, decided_by: null, decided_at: null,
  } as never) as PatientUpdateRequestRow;
  await audit(null, "create", "patient_update_request", row.id, { via: "patient-portal", fields: Object.keys(changes) });
  return requestView(row);
}

function requestView(r: PatientUpdateRequestRow) {
  return { id: r.id, status: r.status, changes: r.changes, previous: r.previous, requestedAt: r.created_at, decisionNote: r.decision_note ?? "", decidedAt: r.decided_at };
}

/** The patient's own requests and what became of them, newest first. */
export async function portalUpdateRequests(patientId: number) {
  const patient = await portalPatient(patientId);
  const { rows } = await patientUpdateRequestsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patient.id }] } as never);
  return (rows as PatientUpdateRequestRow[]).filter((r) => r.hospital_id === patient.hospital_id).sort((a, b) => b.id - a.id).slice(0, 50).map(requestView);
}

// ── Staff side: the front desk applies or rejects ────────────────────────────

export async function listRequestsForStaff(patientId: number, actor: Session) {
  const { rows } = await patientUpdateRequestsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: patientId }] } as never, actor));
  return (rows as PatientUpdateRequestRow[]).sort((a, b) => b.id - a.id).map((r) => ({ ...requestView(r), decidedBy: r.decided_by ?? "" }));
}

/** Apply (the normal patient update runs, so every rule holds) or reject a pending request. */
export async function decideRequest(requestId: number, input: unknown, actor: Session) {
  const row = await patientUpdateRequestsRepo.getRow(requestId) as PatientUpdateRequestRow | null;
  assertOwnedByHospital(row, actor, "Request");
  if (row.status !== "pending") throw new ConflictError("This request has already been dealt with.");
  const body = (input ?? {}) as { decision?: unknown; note?: unknown };
  const note = String(body.note ?? "").trim().slice(0, 200);
  let status: "applied" | "rejected";
  if (body.decision === "apply") {
    const c = row.changes;
    const patch: Record<string, unknown> = {};
    for (const k of ["phone", "email", "address", "city", "state", "pincode", "emergencyName", "emergencyRelation", "emergencyPhone"]) if (k in c) patch[k] = c[k];
    if ("allergies" in c) patch.allergies = (c.allergies as string[]).join(", ");
    if ("chronicConditions" in c) patch.chronic = (c.chronicConditions as string[]).join(", ");
    await updatePatient(row.patient_id, patch, actor);
    status = "applied";
  } else if (body.decision === "reject") {
    if (!note) throw new BadRequestError("Say why it is not accepted: the patient will see this.");
    status = "rejected";
  } else throw new BadRequestError("Choose apply or reject.");
  const updated = await patientUpdateRequestsRepo.update(row.id, { status, decision_note: note || null, decided_by: actor.name, decided_at: new Date().toISOString() }) as PatientUpdateRequestRow;
  await audit(actor, status === "applied" ? "apply" : "reject", "patient_update_request", row.id, { patientId: row.patient_id });
  return requestView(updated);
}

