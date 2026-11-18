/**
 * Claim forms. Only for admitted patients whose stay is paid by an insurer or TPA ("Paid by" is not Self pay). For each, the details the
 * hospital already holds (patient, policy, admission, hospital, treating doctor, bills) are gathered under the standard claim keys; the
 * browser prints them onto the insurer's own claim form (Part A for the insured, Part B for the hospital) and offers it as a PDF.
 */
import { billsRepo, doctorsRepo, hospitalsRepo, ipdRepo, patientsRepo } from "@/repositories";
import type { BillRow, DoctorRow, HospitalRow, IpdAdmissionRow, PatientRow } from "@/db/tables";
import { ForbiddenError } from "@/lib/errors";
import { type Session } from "@/auth/session";
import { can } from "@/auth/rbac";
import { assertOwnedByHospital, requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { TZ } from "@/lib/clock";
import { claimFormFor } from "@shared/lib/claims/forms";
import type { ClaimCandidateDTO, ClaimDraftDTO, ClaimValues } from "@shared/types/claims";

const DISCHARGED_WINDOW_DAYS = 60;

function requireAccess(actor: Session) {
  requireHospitalId(actor);
  if (!can(actor.role, "tpa", "read", actor.hospitalId)) throw new ForbiddenError(`Your role (${actor.role}) cannot open claim forms.`);
}

const isInsured = (a: IpdAdmissionRow) => {
  const p = (a.payer ?? "").trim().toLowerCase();
  return p !== "" && p !== "self pay" && p !== "self-pay" && p !== "cash";
};

/** yyyy-mm-dd → dd/mm/yyyy, the way an Indian form is filled. */
const dmy = (iso: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const clock = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  return `${p.find((x) => x.type === "hour")?.value}:${p.find((x) => x.type === "minute")?.value}`;
};

/** The policy number for this payer: the patient's own policy with that insurer, else the one on their record. */
function policyFor(patient: PatientRow | null, payer: string): string {
  if (!patient) return "";
  const p = payer.trim().toLowerCase();
  const own = (patient.payers ?? []).find((x) => x.policyNumber && (x.name ?? "").trim().toLowerCase() === p);
  return own?.policyNumber ?? patient.policy_number ?? (patient.payers ?? []).find((x) => x.policyNumber)?.policyNumber ?? "";
}

function toCandidate(a: IpdAdmissionRow, patient: PatientRow | null): ClaimCandidateDTO {
  const form = claimFormFor(a.payer);
  return {
    admissionId: a.id, admissionNo: a.admission_no ?? "", patientId: a.patient_id ?? null, patientName: a.patient_name, age: patient?.age ?? a.patient_age ?? null,
    gender: patient?.gender ?? "", ward: a.ward ?? "", bed: a.bed ?? "", doctor: a.doctor ?? "", admissionDate: a.admission_date ?? "", dischargeDate: a.discharge_date ?? null,
    status: a.status, payer: a.payer ?? "", policyNo: policyFor(patient, a.payer ?? ""), formKey: form?.key ?? null, formName: form?.name ?? null,
  };
}

/** Admitted patients paid by an insurer / TPA. With `?discharged=1`, those discharged in the last 60 days as well (claims are often filed at discharge). */
export async function listCandidates(query: URLSearchParams, actor: Session): Promise<ClaimCandidateDTO[]> {
  requireAccess(actor);
  const withDischarged = query.get("discharged") === "1";
  const { rows } = await ipdRepo.listRows(scopeToHospital({ unpaged: true }, actor));
  const cutoff = new Date(Date.now() - DISCHARGED_WINDOW_DAYS * 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  const stays = (rows as IpdAdmissionRow[])
    .filter(isInsured)
    .filter((a) => a.status !== "Discharged" || (withDischarged && (a.discharge_date ?? a.admission_date ?? "") >= cutoff));
  const ids = [...new Set(stays.map((a) => a.patient_id).filter((v): v is number => v != null))];
  const patients = new Map<number, PatientRow>();
  for (const id of ids) { const p = (await patientsRepo.getRow(id)) as PatientRow | null; if (p) patients.set(id, p); }
  const search = (query.get("search") ?? "").trim().toLowerCase();
  return stays
    .map((a) => toCandidate(a, a.patient_id != null ? patients.get(a.patient_id) ?? null : null))
    .filter((c) => !search || `${c.patientName} ${c.admissionNo} ${c.payer} ${c.doctor} ${c.ward} ${c.bed}`.toLowerCase().includes(search))
    .sort((a, b) => Number(a.status === "Discharged") - Number(b.status === "Discharged") || b.admissionDate.localeCompare(a.admissionDate) || b.admissionId - a.admissionId);
}

const money = (n: number) => (n > 0 ? String(Math.round(n * 100) / 100) : "");

/** Everything the hospital knows for one admission, under the standard claim keys. */
export async function getDraft(admissionId: number, actor: Session): Promise<ClaimDraftDTO> {
  requireAccess(actor);
  const hid = actor.hospitalId as number;
  const adm = (await ipdRepo.getRow(admissionId)) as IpdAdmissionRow | null;
  assertOwnedByHospital(adm, actor, "Admission");
  const a = adm as IpdAdmissionRow;
  const patient = a.patient_id != null ? ((await patientsRepo.getRow(a.patient_id)) as PatientRow | null) : null;
  if (patient) assertOwnedByHospital(patient, actor, "Patient");
  const hospital = (await hospitalsRepo.getRow(hid)) as HospitalRow | null;
  const doctor = a.doctor_id ? ((await doctorsRepo.getRow(a.doctor_id)) as DoctorRow | null) : null;
  const cand = toCandidate(a, patient);

  const { rows: billRows } = await billsRepo.listRows(scopeToHospital({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: a.id }] }, actor));
  const bills = (billRows as BillRow[]).filter((b) => b.status !== "Refunded" && b.type === "IPD");
  const total = bills.reduce((n, b) => n + Number(b.total ?? 0), 0);

  const gender = patient?.gender === "Female" ? "Female" : patient?.gender === "Male" ? "Male" : patient?.gender ? "Other" : "";
  const address = [patient?.address, patient?.address_line2, patient?.city, patient?.state, patient?.pincode].filter(Boolean).join(", ");
  const hospitalAddress = [hospital?.address, hospital?.city, hospital?.state, hospital?.pincode].filter(Boolean).join(", ");
  const discharge = a.discharge_date ?? a.planned_discharge_date ?? "";

  const values: ClaimValues = {
    insurerName: cand.formName ?? a.payer ?? "",
    patientName: a.patient_name, insuredName: patient?.name ?? a.patient_name, policyNo: cand.policyNo, gender, dob: dmy(patient?.dob), age: patient?.age != null ? String(patient.age) : "",
    address, phone: patient?.phone ?? "", email: patient?.email ?? "", occupation: patient?.occupation ?? "",
    hospitalName: hospital?.name ?? "", hospitalAddress, hospitalReg: hospital?.reg_number ?? "", hospitalPan: hospital?.pan_number ?? "",
    hospitalPhone: hospital?.phone || hospital?.mobile || "", hospitalEmail: hospital?.email ?? "",
    doctorName: doctor?.name ?? a.doctor ?? "",
    diagnosis: a.diagnosis ?? "", admissionDate: dmy(a.admission_date), admissionTime: clock(a.created_at), dischargeDate: dmy(discharge),
    roomType: [a.ward, a.bed].filter(Boolean).join(" · "), admissionType: a.admission_type === "Emergency" ? "Emergency" : "Planned",
    totalBill: money(total), advancePaid: money(Number(a.deposit_amount ?? 0)),
  };
  return { candidate: cand, values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")) };
}


