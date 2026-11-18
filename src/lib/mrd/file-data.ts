/** Everything the system holds about one admission, gathered for the MRD file, and which checklist items it covers. */
import { api } from "@/lib/api/client";
import type { CaseFileDTO } from "@/types/casefile";
import type { BillDTO, ConsentDTO, ConsentDocumentDTO, DocumentDTO, IpdRecordDTO, LabTestDTO, OtRecordDTO, PatientDTO, PrescriptionDTO, RadiologyTestDTO } from "@/types/api";

export interface MrdFileData {
  admission: IpdRecordDTO;
  caseFile: CaseFileDTO | null;
  patient: PatientDTO | null;
  prescriptions: PrescriptionDTO[];
  consents: { consent: ConsentDTO; doc: ConsentDocumentDTO | null }[];
  documents: DocumentDTO[];
  lab: LabTestDTO[];
  radiology: RadiologyTestDTO[];
  ot: OtRecordDTO[];
  bills: BillDTO[];
  /** Sources that could not be read (usually a missing permission), by name. */
  missing: string[];
}

const ok = <T,>(r: PromiseSettledResult<T>, name: string, missing: string[], fallback: T): T => {
  if (r.status === "fulfilled") return r.value;
  missing.push(name);
  return fallback;
};

/** The day part of a date or timestamp, for comparing with the stay. */
const day = (v: string | null | undefined) => /^\d{4}-\d{2}-\d{2}/.exec(v ?? "")?.[0] ?? "";

export async function loadMrdFile(admission: IpdRecordDTO): Promise<MrdFileData> {
  const pid = admission.patientRefId;
  const missing: string[] = [];
  const [cf, pat, rx, con, docs, lab, rad, ot, bills] = await Promise.allSettled([
    api.get<CaseFileDTO>(`/casefile/${admission.id}`),
    pid ? api.get<PatientDTO>(`/patients/${pid}`) : Promise.resolve(null),
    pid ? api.list<PrescriptionDTO>("/prescriptions", { all: true, patient_id: pid }) : Promise.resolve({ data: [] as PrescriptionDTO[] }),
    pid ? api.list<ConsentDTO>(`/patients/${pid}/consents`, { all: true }) : Promise.resolve({ data: [] as ConsentDTO[] }),
    pid ? api.list<DocumentDTO>("/documents", { all: true, owner_type: "patient", owner_id: pid }) : Promise.resolve({ data: [] as DocumentDTO[] }),
    pid ? api.list<LabTestDTO>("/lab", { all: true, patient_id: pid }) : Promise.resolve({ data: [] as LabTestDTO[] }),
    pid ? api.list<RadiologyTestDTO>("/radiology", { all: true, patient_id: pid }) : Promise.resolve({ data: [] as RadiologyTestDTO[] }),
    api.list<OtRecordDTO>("/ot", { all: true }),
    pid ? api.list<BillDTO>("/billing", { all: true, patient_id: pid }) : Promise.resolve({ data: [] as BillDTO[] }),
  ]);

  const consentList = ok(con, "Consents", missing, { data: [] as ConsentDTO[] }).data;
  const consentDocs = await Promise.allSettled(consentList.map((c) => api.get<ConsentDocumentDTO>(`/consents/${c.id}/document`)));

  const from = day(admission.admissionDate);
  const to = day(admission.dischargeDate);
  const inStay = (d: string | null | undefined) => { const x = day(d); return !x || ((!from || x >= from) && (!to || x <= to)); };

  const billsAll = ok(bills, "Bills", missing, { data: [] as BillDTO[] }).data.filter((b) => b.admissionId === admission.id || (b.type === "IPD" && !b.admissionId && inStay(b.date)));
  // Each bill's lines are on the single-bill fetch only.
  const billsFull = await Promise.all(billsAll.map((b) => api.get<BillDTO>(`/billing/${b.id}`).catch(() => b)));

  return {
    admission,
    caseFile: ok(cf, "Case file", missing, null),
    patient: ok(pat, "Patient record", missing, null),
    prescriptions: ok(rx, "Prescriptions", missing, { data: [] as PrescriptionDTO[] }).data,
    consents: consentList.map((consent, i) => ({ consent, doc: consentDocs[i].status === "fulfilled" ? (consentDocs[i] as PromiseFulfilledResult<ConsentDocumentDTO>).value : null })),
    documents: ok(docs, "Documents", missing, { data: [] as DocumentDTO[] }).data,
    lab: ok(lab, "Lab reports", missing, { data: [] as LabTestDTO[] }).data,
    radiology: ok(rad, "Radiology reports", missing, { data: [] as RadiologyTestDTO[] }).data,
    ot: ok(ot as PromiseSettledResult<{ data: OtRecordDTO[] }>, "OT", missing, { data: [] as OtRecordDTO[] }).data.filter((o) => (pid ? o.patientId === pid : o.patientName === admission.patientName)),
    bills: billsFull,
    missing,
  };
}

// ── Which checklist items the data covers ────────────────────────────────────

export const isAdmissionConsent = (c: ConsentDTO) => /admission/i.test(`${c.templateKey} ${c.formTitle}`);
export const isInsuranceDoc = (d: DocumentDTO) => /insur|tpa|cashless|claim|pre-?auth|policy/i.test(`${d.category} ${d.title} ${d.folderName}`);
export const isReportDoc = (d: DocumentDTO) => /report|lab|x-?ray|radiolog|usg|ecg|scan|mri|\bct\b/i.test(`${d.category} ${d.title} ${d.folderName}`);
export const isCounselling = (t: string) => /counsel/i.test(t);
export const isDischargeSummary = (t: string) => /discharge summary|^discharge\b/i.test(t.trim());

/** How many records back each item (index 0–19), with a short phrase for the screen. */
export function evidenceFor(f: MrdFileData): { count: number; text: string }[] {
  const cf = f.caseFile;
  const filled = (k: string) => (cf?.forms[k]?.version ?? 0) > 0;
  const daily = cf?.linked.dailyNotes ?? [];
  const rounds = cf?.linked.doctorNotes ?? [];
  const admittingDoctor = f.admission.doctor;
  const otherDoctors = rounds.filter((n) => n.by && admittingDoctor && !n.by.includes(admittingDoctor.replace(/^Dr\.?\s*/i, "")));
  const consultRx = f.prescriptions.filter((r) => r.consultation);
  const reports = f.lab.length + f.radiology.length + f.documents.filter(isReportDoc).length;
  const n = (count: number, one: string, many = `${one}s`): { count: number; text: string } => ({ count, text: count ? `${count} ${count === 1 ? one : many}` : "" });

  const items = [
    n(f.admission.patientName ? 1 : 0, "record"),                                   // 1 first page
    n(f.admission.diagnosis || filled("diagnosis_plan") ? 1 : 0, "diagnosis", "diagnoses"), // 2
    n(consultRx.length + (filled("admission_history") || filled("past_history") || filled("physical_exam") ? 1 : 0), "consultation"), // 3
    n(cf?.linked.prescriptions.length ?? 0, "prescription"),                                      // 4
    n(f.consents.filter((c) => !isAdmissionConsent(c.consent)).length, "consent"),  // 5
    n(f.consents.filter((c) => isAdmissionConsent(c.consent)).length, "consent"),   // 6
    n(daily.length + rounds.length + (filled("progress_note") || filled("doctor_notes") ? 1 : 0), "note"), // 7
    n((cf?.linked.vitals.length ?? 0) + (cf?.linked.handovers.length ?? 0) + (filled("tpr_chart") || filled("io_chart") || filled("nursing_handover") ? 1 : 0), "entry", "entries"), // 8
    n(reports, "report"),                                                           // 9
    n(otherDoctors.length, "visit"),                                                // 10
    n((cf?.linked.medicines.length ?? 0) + (cf?.linked.ivLines.length ?? 0), "medicine order"), // 11
    n(f.ot.length, "OT record"),                                                    // 12
    n(f.ot.length, "OT sheet"),                                                     // 13
    n(daily.filter((x) => isCounselling(x.text)).length, "note"),                   // 14
    n(daily.filter((x) => isDischargeSummary(x.text)).length, "summary", "summaries"), // 15
    n(f.bills.length, "bill"),                                                      // 16
    n(f.documents.filter(isInsuranceDoc).length, "document"),                       // 17
    n(0, ""), n(0, ""), n(0, ""),                                                   // 18–20 are the checker's own call
  ];
  return items;
}
