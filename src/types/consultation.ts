/** The clinical record written with a prescription: what the doctor found and advised, not just the medicines. */

export type ConsultationFieldKind = "choice" | "multi" | "text";

export interface ConsultationField {
  id: string;
  label: string;
  kind: ConsultationFieldKind;
  /** Choices for "choice" (pick one) and "multi" (pick any). */
  options?: string[];
  /** The chosen option, the chosen options joined with ", ", or the typed text. */
  value: string;
  /** Shown after a text value, e.g. "bpm". */
  unit?: string;
  placeholder?: string;
  /** True for a field the doctor added to this prescription. */
  custom?: boolean;
}

export interface ConsultationSystem {
  /** Template key for a built-in system, or "custom-…" for one the doctor made. */
  key: string;
  title: string;
  fields: ConsultationField[];
}

export interface ConsultationVitals {
  bp: string;
  pulse: string;
  temp: string;
  spo2: string;
  weight: string;
  height: string;
  /** Where the readings came from, e.g. "OPD vitals, 12 Nov 2026 10:30". */
  source: string;
}

export interface ConsultationHistory {
  past: string;
  family: string;
  personal: string;
  medical: string;
}

/** One line of the patient's history: an allergy, an addiction, a remark, or how long something has been going on. */
export interface HistoryEntry {
  type: string;
  text: string;
  /** Since when ("3 years", "2019"); may be empty. */
  since: string;
}

export interface Consultation {
  chiefComplaint: string;
  history: ConsultationHistory;
  /** Allergies, addictions, remarks and the like noted for the patient; also kept on the patient's record. */
  patientHistory?: HistoryEntry[];
  vitals: ConsultationVitals;
  general: ConsultationField[];
  systemic: ConsultationSystem[];
  investigations: string[];
  secondaryDiagnosis: string;
  followUp: string;
  advice: { diet: string; exercise: string; other: string };
  /** The doctor's own remarks for this prescription (kept in their list to pick again). */
  remarks?: string;
}
