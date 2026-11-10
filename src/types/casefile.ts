/**
 * The IPD case file: the set of forms kept with an admitted patient (the sheets that sit on the bed). One case file per admission, one
 * saved record per form. What other parts of the app already know about the patient (vitals, doctor rounds, medicines, IV lines,
 * handovers, lab orders, prescriptions) is read alongside and shown in the matching form, so it is never typed twice.
 */

/** The forms, in the order a hospital starts with (its admin can rearrange them). */
export const CASE_FILE_FORMS = [
  "admission_history",
  "past_history",
  "physical_exam",
  "diagnosis_plan",
  "doctor_notes",
  "progress_note",
  "treatment_sheet",
  "nursing_handover",
  "tpr_chart",
  "io_chart",
  "investigation_sheet",
  "room_charges",
  "room_handover",
] as const;
export type CaseFormKey = (typeof CASE_FILE_FORMS)[number];

export interface CaseFileHeaderDTO {
  hospital: { name: string; address: string; city: string; phone: string; email: string };
  patient: { id: number | null; name: string; age: number; sex: string; uhid: string; phone: string; allergies: string; chronic: string };
  admission: { id: number; ipdNo: string; admittedOn: string; status: string; ward: string; bed: string; doctor: string; diagnosis: string; diet: string };
}

/** One saved form. `version` is 0 for a form nobody has saved yet. */
export interface CaseFormRecordDTO {
  data: Record<string, unknown>;
  version: number;
  updatedAt: string | null;
  updatedBy: string;
}

/** What the rest of the app holds about this admission, for the forms to show beside what staff write. */
export interface CaseFileLinkedDTO {
  vitals: { at: string; date: string; time: string; tempF: number | null; pulse: number | null; rr: number | null; bp: string; spo2: number | null; note: string; by: string }[];
  doctorNotes: { date: string; time: string; by: string; text: string }[];
  dailyNotes: { date: string; time: string; by: string; text: string }[];
  /** Each medicine ordered, and for every day the four sheet windows (8am–2pm, 2pm–8pm, 8pm–2am, 2am–8am): "" none due, "due", "given" or "held". */
  medicines: { id: number; name: string; dosage: string; frequency: string; route: string; start: string; end: string; status: string; days: Record<string, ("" | "due" | "given" | "held")[]> ; givenBy: Record<string, string[]> }[];
  prescriptions: { rx: string; date: string; doctor: string; diagnosis: string; items: { name: string; dosage: string; frequency: string; duration: string; instructions: string }[] }[];
  ivLines: { date: string; time: string; fluid: string; volumeMl: number; rateMlHr: number; status: string; by: string }[];
  handovers: { date: string; shift: string; note: string; author: string }[];
  labTests: { name: string; date: string; status: string; orderNumber: string }[];
}

export interface CaseFileDTO extends CaseFileHeaderDTO {
  /** The order this hospital keeps the forms in. */
  order: CaseFormKey[];
  forms: Record<string, CaseFormRecordDTO>;
  linked: CaseFileLinkedDTO;
}

export interface CaseFileListItemDTO {
  admissionId: number;
  ipdNo: string;
  patientName: string;
  patientId: number | null;
  uhid: string;
  age: number;
  ward: string;
  bed: string;
  doctor: string;
  admittedOn: string;
  status: string;
  /** How many of the forms have something written in them. */
  filled: number;
  total: number;
  updatedAt: string | null;
}
