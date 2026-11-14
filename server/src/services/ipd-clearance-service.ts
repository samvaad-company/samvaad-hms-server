/**
 * Discharge clearance. Before an inpatient goes home, every department that served them in-house is asked whether the patient owes
 * it anything:
 *
 *   discharge started ──▶ Pending ──▶ Cleared
 *                            └──────▶ Flagged (a bill is still to pay) ──patient pays──▶ asked again (Pending, round + 1) ──▶ …
 *
 * Only departments the patient actually has an entry in are asked (a pharmacy dispense, a lab or radiology order, a blood transfusion,
 * an OT booking, an ambulance call). Lab and radiology are asked only for in-house work: an order sent to an outside (third-party)
 * centre is that centre's to bill and is never raised here. Each department's staff get a notification when asked, and the discharge
 * is refused until every department has cleared.
 */
import { billsRepo, labRepo, radiologyRepo, pharmacyDispensesRepo, bloodTransfusionsRepo, otRepo, ambulanceCallsRepo, ipdDischargeClearancesRepo, usersRepo } from "@/repositories";
import type { BillRow, IpdAdmissionRow, IpdDischargeClearanceRow, UserRow } from "@/db/tables";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Resource } from "@/auth/rbac";
import { type Session } from "@/auth/session";
import { audit } from "@/services/audit";
import { notifyUsers } from "@/services/notifications-service";
import { assertOwnedByHospital, scopeToHospital } from "@/services/hospital-scope";
import { ipdRepo } from "@/repositories";
import type { IpdClearanceDTO, IpdClearanceInboxDTO } from "@shared/types/api";

interface Department {
  key: string;
  label: string;
  resource: Resource;
  /** The bill type this department raises, so what is already unpaid can be shown to its staff. */
  billType: string | null;
  /** How many entries this patient has in the department since being admitted (cancelled ones and, for lab / radiology, outside-centre ones don't count). */
  entries: (patientId: number, since: string, actor: Session) => Promise<number>;
}

const onOrAfter = (stamp: string | null | undefined, since: string) => (stamp ?? "").slice(0, 10) >= since;
const live = (status: string | null | undefined) => !/cancel|return/i.test(status ?? "");
const byPatient = (patientId: number, actor: Session) => scopeToHospital({ unpaged: true, filters: [{ column: "patient_id", op: "eq" as const, value: patientId }] }, actor);

export const DEPARTMENTS: Department[] = [
  { key: "pharmacy", label: "Pharmacy", resource: "pharmacy", billType: "Pharmacy",
    entries: async (p, since, a) => (await pharmacyDispensesRepo.listRows(byPatient(p, a))).rows.filter((r) => onOrAfter(r.created_at, since) && live(r.status)).length },
  { key: "lab", label: "Lab", resource: "lab", billType: "Lab",
    // lab_center_id set = sent to an outside lab: not ours to ask.
    entries: async (p, since, a) => (await labRepo.listRows(byPatient(p, a))).rows.filter((r) => r.lab_center_id == null && onOrAfter(r.test_date || r.created_at, since) && live(r.status)).length },
  { key: "radiology", label: "Radiology", resource: "radiology", billType: "Radiology",
    entries: async (p, since, a) => (await radiologyRepo.listRows(byPatient(p, a))).rows.filter((r) => r.radiology_center_id == null && onOrAfter(r.test_date || r.created_at, since) && live(r.status)).length },
  { key: "bloodbank", label: "Blood bank", resource: "bloodbank", billType: "Blood",
    entries: async (p, since, a) => (await bloodTransfusionsRepo.listRows(byPatient(p, a))).rows.filter((r) => onOrAfter(r.created_at, since)).length },
  { key: "ot", label: "Operation theatre", resource: "ot", billType: null,
    entries: async (p, since, a) => (await otRepo.listRows(byPatient(p, a))).rows.filter((r) => onOrAfter(r.scheduled_date || r.created_at, since) && live(r.status)).length },
  { key: "ambulance", label: "Ambulance", resource: "ambulance", billType: "Ambulance",
    entries: async (p, since, a) => (await ambulanceCallsRepo.listRows(byPatient(p, a))).rows.filter((r) => onOrAfter(r.call_date || r.created_at, since) && live(r.status)).length },
];
const dept = (key: string) => DEPARTMENTS.find((d) => d.key === key);

async function admissionOf(id: number, actor: Session): Promise<IpdAdmissionRow> {
  const row = (await ipdRepo.getRow(id)) as IpdAdmissionRow | null;
  assertOwnedByHospital(row, actor, "Admission");
  return row as IpdAdmissionRow;
}

/** The departments this patient has an in-house entry in since the admission began, with how many entries. */
async function departmentsInUse(a: IpdAdmissionRow, actor: Session): Promise<{ d: Department; entries: number }[]> {
  if (!a.patient_id) return [];
  const since = a.admission_date.slice(0, 10);
  const found: { d: Department; entries: number }[] = [];
  for (const d of DEPARTMENTS) {
    const entries = await d.entries(a.patient_id, since, actor);
    if (entries > 0) found.push({ d, entries });
  }
  return found;
}

async function unpaidFor(a: IpdAdmissionRow, billType: string | null, actor: Session): Promise<number> {
  if (!a.patient_id || !billType) return 0;
  const since = a.admission_date.slice(0, 10);
  const { rows } = await billsRepo.listRows(byPatient(a.patient_id, actor));
  return (rows as BillRow[]).filter((b) => b.type === billType && (b.status === "Pending" || b.status === "Partial") && onOrAfter(b.bill_date, since)).reduce((n, b) => n + Number(b.total), 0);
}

async function rowsFor(admissionId: number, actor: Session): Promise<IpdDischargeClearanceRow[]> {
  const { rows } = await ipdDischargeClearancesRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "admission_id", op: "eq" as const, value: admissionId }] }, actor));
  return rows as IpdDischargeClearanceRow[];
}

async function toDto(r: IpdDischargeClearanceRow, a: IpdAdmissionRow, actor: Session): Promise<IpdClearanceDTO> {
  const d = dept(r.department);
  return {
    id: r.id, admissionId: r.admission_id, department: r.department, label: d?.label ?? r.department, status: r.status as IpdClearanceDTO["status"],
    amountDue: Number(r.amount_due ?? 0), note: r.note ?? "", round: r.round, requestedBy: r.requested_by, requestedAt: r.requested_at,
    respondedBy: r.responded_by ?? "", respondedAt: r.responded_at ?? null,
    unpaidBills: r.status === "Cleared" ? 0 : await unpaidFor(a, d?.billType ?? null, actor),
    patientName: a.patient_name, admissionNo: a.admission_no ?? "", bed: a.bed ?? "", ward: a.ward ?? "",
  };
}

/** Who to tell in a department: its own staff (not outside-centre logins). Super admins only when nobody else can act. */
async function staffOf(hospitalId: number, d: Department): Promise<number[]> {
  const { rows } = await usersRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never);
  const able = (rows as UserRow[]).filter((u) => u.status !== "Inactive" && u.lab_center_id == null && u.radiology_center_id == null && can(u.role, d.resource, "write", hospitalId));
  const own = able.filter((u) => u.role !== "Super Admin");
  return (own.length ? own : able).map((u) => u.id);
}

async function tell(a: IpdAdmissionRow, d: Department, round: number) {
  if (!a.hospital_id) return;
  await notifyUsers(a.hospital_id, await staffOf(a.hospital_id, d), {
    kind: "discharge-clearance",
    title: `${a.patient_name} is about to be discharged`,
    body: `${d.label}: please confirm there is no pending bill${round > 1 ? " (asked again — the patient has paid)" : ""}.${a.bed ? ` Bed ${a.ward ? `${a.ward} · ` : ""}${a.bed}.` : ""}`,
    link: "/clearances",
  });
}

/** What each department has said about this admission. */
export async function listClearances(admissionId: number, actor: Session): Promise<IpdClearanceDTO[]> {
  const a = await admissionOf(admissionId, actor);
  const rows = await rowsFor(a.id, actor);
  const order = DEPARTMENTS.map((d) => d.key);
  return Promise.all(rows.sort((x, y) => order.indexOf(x.department) - order.indexOf(y.department)).map((r) => toDto(r, a, actor)));
}

/**
 * Ask every department the patient has used that has not been asked yet; with `askAgain`, also re-ask the ones that flagged a bill
 * (the patient has paid). Departments that already cleared are left alone.
 */
export async function requestClearances(admissionId: number, input: unknown, actor: Session): Promise<IpdClearanceDTO[]> {
  const a = await admissionOf(admissionId, actor);
  if (a.status === "Discharged") throw new ConflictError("Patient is already discharged");
  const body = (input ?? {}) as { department?: unknown };
  const only = typeof body.department === "string" && body.department ? body.department : null;
  if (only && !dept(only)) throw new BadRequestError("Unknown department");
  await ensureRequested(a, actor, only);
  return listClearances(admissionId, actor);
}

async function ensureRequested(a: IpdAdmissionRow, actor: Session, only: string | null = null): Promise<void> {
  const existing = new Map((await rowsFor(a.id, actor)).map((r) => [r.department, r]));
  const asked: string[] = [];
  for (const { d } of await departmentsInUse(a, actor)) {
    if (only && d.key !== only) continue;
    const row = existing.get(d.key);
    if (!row) {
      await ipdDischargeClearancesRepo.create({ hospital_id: a.hospital_id, admission_id: a.id, department: d.key, status: "Pending", amount_due: 0, note: "", round: 1, requested_by: actor.name, requested_at: new Date().toISOString(), responded_by: "", responded_at: null });
      await tell(a, d, 1);
      asked.push(d.key);
    } else if (row.status === "Flagged" && only === d.key) {
      // The patient has paid: ask this department again.
      await ipdDischargeClearancesRepo.update(row.id, { status: "Pending", round: row.round + 1, requested_by: actor.name, requested_at: new Date().toISOString(), responded_at: null });
      await tell(a, d, row.round + 1);
      asked.push(d.key);
    }
  }
  if (asked.length) await audit(actor, "clearance-request", "ipd", a.id, { departments: asked });
}

/** A department answers: "Cleared", or "Flagged" with the pending amount and a note. */
export async function respondToClearance(clearanceId: number, input: unknown, actor: Session): Promise<IpdClearanceDTO> {
  const row = (await ipdDischargeClearancesRepo.getRow(clearanceId)) as IpdDischargeClearanceRow | null;
  assertOwnedByHospital(row, actor, "Clearance request");
  const r = row as IpdDischargeClearanceRow;
  const d = dept(r.department);
  if (!d || !can(actor.role, d.resource, "write", actor.hospitalId)) throw new ForbiddenError(`Only ${d?.label ?? "that department"} can answer this`);
  if (r.status === "Cleared") throw new ConflictError("This department has already cleared the patient");
  const a = await admissionOf(r.admission_id, actor);
  if (a.status === "Discharged") throw new ConflictError("Patient is already discharged");
  const b = (input ?? {}) as { decision?: unknown; amountDue?: unknown; note?: unknown };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  let patch: Record<string, unknown>;
  if (b.decision === "Cleared") {
    patch = { status: "Cleared", amount_due: 0, note, responded_by: actor.name, responded_at: new Date().toISOString() };
  } else if (b.decision === "Flagged") {
    const amount = Number(b.amountDue ?? 0);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestError("The pending amount isn't a valid amount");
    if (amount <= 0 && !note) throw new BadRequestError("Say what is pending: the amount, or a note");
    patch = { status: "Flagged", amount_due: amount, note, responded_by: actor.name, responded_at: new Date().toISOString() };
  } else throw new BadRequestError("Answer with “Cleared” or “Flagged”");
  const updated = (await ipdDischargeClearancesRepo.update(clearanceId, patch)) as IpdDischargeClearanceRow;
  await audit(actor, "clearance-" + String(b.decision).toLowerCase(), "ipd", a.id, { department: r.department, amountDue: patch.amount_due });
  return toDto(updated, a, actor);
}

/** The requests waiting on the departments this user works in (newest first), plus the ones they have answered recently. */
export async function clearanceInbox(actor: Session): Promise<IpdClearanceInboxDTO> {
  const { rows } = await ipdDischargeClearancesRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const mine = (rows as IpdDischargeClearanceRow[]).filter((r) => { const d = dept(r.department); return d && can(actor.role, d.resource, "write", actor.hospitalId); });
  const admissions = new Map<number, IpdAdmissionRow>();
  for (const r of mine) if (!admissions.has(r.admission_id)) { const a = (await ipdRepo.getRow(r.admission_id)) as IpdAdmissionRow | null; if (a) admissions.set(a.id, a); }
  const dtos = async (list: IpdDischargeClearanceRow[]) => (await Promise.all(list.filter((r) => admissions.has(r.admission_id)).map((r) => toDto(r, admissions.get(r.admission_id)!, actor))));
  const newest = (x: IpdDischargeClearanceRow, y: IpdDischargeClearanceRow) => (y.requested_at ?? "").localeCompare(x.requested_at ?? "") || y.id - x.id;
  return {
    waiting: await dtos(mine.filter((r) => r.status === "Pending").sort(newest)),
    flagged: await dtos(mine.filter((r) => r.status === "Flagged" && admissions.get(r.admission_id)?.status !== "Discharged").sort(newest)),
    answered: (await dtos(mine.filter((r) => r.status === "Cleared").sort((x, y) => (y.responded_at ?? "").localeCompare(x.responded_at ?? "")).slice(0, 20))),
  };
}

/** Is there a final bill for this stay? An IPD bill for the admission (or, on older records without the link, one raised for the patient since admission). */
export async function hasFinalBill(a: IpdAdmissionRow, actor: Session): Promise<boolean> {
  if (!a.patient_id) return false;
  const since = a.admission_date.slice(0, 10);
  const { rows } = await billsRepo.listRows(byPatient(a.patient_id, actor));
  return (rows as BillRow[]).some((b) => b.type === "IPD" && b.status !== "Refunded" && (b.admission_id === a.id || (b.admission_id == null && onOrAfter(b.bill_date, since))));
}

/** Refuses the discharge unless the final bill exists. */
export async function assertFinalBill(a: IpdAdmissionRow, actor: Session): Promise<void> {
  if (!(await hasFinalBill(a, actor))) throw new ConflictError("Discharge can't happen yet: the final IPD bill has not been generated. Raise it in Billing, then discharge.", { code: "bill_missing" });
}

/** Refuses the discharge unless every department the patient used has cleared; asks any that have not been asked yet. */
export async function assertDepartmentsCleared(a: IpdAdmissionRow, actor: Session): Promise<void> {
  await ensureRequested(a, actor);
  const rows = await rowsFor(a.id, actor);
  const open = rows.filter((r) => r.status !== "Cleared");
  if (!open.length) return;
  const flagged = open.filter((r) => r.status === "Flagged");
  const text = open.map((r) => {
    const label = dept(r.department)?.label ?? r.department;
    return r.status === "Flagged" ? `${label} (₹${Number(r.amount_due).toLocaleString("en-IN")} pending${r.note ? ` — ${r.note}` : ""})` : `${label} (waiting for their answer)`;
  }).join("; ");
  throw new ConflictError(
    flagged.length
      ? `Discharge is not happening because payment is pending: ${text}. The patient must pay, then ask the department again.`
      : `Discharge is not happening yet: every department has to confirm first. Still waiting on ${text}.`,
    { code: "clearance_pending", departments: open.map((r) => ({ department: r.department, status: r.status, amountDue: Number(r.amount_due) })) },
  );
}
