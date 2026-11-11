/**
 * Pre-authorisation (cashless hospitalisation) forms. Every insurer and TPA asks for the same standard Part C details in its own
 * layout, wording and declarations. The details are kept once per form under these standard keys; each insurer's form definition
 * (see src/lib/preauth/forms.generated.ts) says which of them it asks, what it calls them and what its declaration says.
 */

export type PreauthFieldType = "text" | "longtext" | "date" | "time" | "number" | "money" | "yesno" | "gender" | "emergency" | "treatment" | "maternity" | "chronic";

export interface PreauthFieldSpec {
  label: string;
  type: PreauthFieldType;
  /** Where the field sits on the form. */
  section: PreauthSectionKey;
  /** Make the input span the whole row. */
  wide?: boolean;
}

export type PreauthSectionKey = "insurer" | "hospital" | "patient" | "doctor" | "admission" | "costs" | "chronic";

export const PREAUTH_SECTIONS: { key: PreauthSectionKey; title: string }[] = [
  { key: "insurer", title: "Details of the Third Party Administrator / Insurer" },
  { key: "hospital", title: "Details of the Hospital" },
  { key: "patient", title: "To be filled by the Insured / Patient" },
  { key: "doctor", title: "To be filled by the Treating Doctor / Hospital" },
  { key: "admission", title: "Details of the Patient Admitted" },
  { key: "costs", title: "Expected Cost of Hospitalisation" },
  { key: "chronic", title: "Mandatory: Past History of any Chronic Illness (since month / year)" },
];

/** The standard fields, in the order a Part C form asks them. */
export const PREAUTH_FIELDS: Record<string, PreauthFieldSpec> = {
  tpaName: { label: "Name of TPA / Insurance company", type: "text", section: "insurer" },
  tollFreePhone: { label: "Toll free phone no.", type: "text", section: "insurer" },
  tollFreeFax: { label: "Toll free fax no.", type: "text", section: "insurer" },

  hospitalName: { label: "Name of the hospital", type: "text", section: "hospital" },
  hospitalAddress: { label: "Hospital address", type: "text", section: "hospital", wide: true },
  hospitalCity: { label: "City", type: "text", section: "hospital" },
  hospitalState: { label: "State", type: "text", section: "hospital" },
  hospitalPincode: { label: "Pin code", type: "text", section: "hospital" },
  rohiniId: { label: "Rohini ID", type: "text", section: "hospital" },
  hospitalPhone: { label: "Hospital contact no.", type: "text", section: "hospital" },
  hospitalEmail: { label: "Hospital email ID", type: "text", section: "hospital" },
  hospitalFax: { label: "Fax number", type: "text", section: "hospital" },

  patientName: { label: "Name of the patient", type: "text", section: "patient" },
  gender: { label: "Gender", type: "gender", section: "patient" },
  age: { label: "Age (years)", type: "number", section: "patient" },
  dob: { label: "Date of birth", type: "date", section: "patient" },
  contactNo: { label: "Contact number", type: "text", section: "patient" },
  altContactNo: { label: "Contact number of attending relative", type: "text", section: "patient" },
  insuredCardId: { label: "Insured card ID number", type: "text", section: "patient" },
  policyNo: { label: "Policy number / Name of corporate", type: "text", section: "patient" },
  employeeId: { label: "Employee ID", type: "text", section: "patient" },
  panNo: { label: "PAN no.", type: "text", section: "patient" },
  proposerName: { label: "Name of the proposer", type: "text", section: "patient" },
  ckyc: { label: "CKYC of the proposer", type: "text", section: "patient" },
  otherInsurance: { label: "Currently do you have any other mediclaim / health insurance", type: "yesno", section: "patient" },
  otherInsurerName: { label: "Company name", type: "text", section: "patient" },
  familyPhysician: { label: "Do you have a family physician (name, contact)", type: "text", section: "patient" },
  patientAddress: { label: "Current address of the insured patient", type: "text", section: "patient", wide: true },
  occupation: { label: "Occupation of insured patient", type: "text", section: "patient" },
  hasFamilyPhysician: { label: "Do you have a family physician", type: "yesno", section: "patient" },
  familyPhysicianName: { label: "Name of the family physician", type: "text", section: "patient" },
  familyPhysicianContact: { label: "Contact number of the family physician", type: "text", section: "patient" },
  otherPolicyNo: { label: "Policy number / health ID card (other insurance)", type: "text", section: "patient" },
  idProofName: { label: "Govt recognised age / ID proof: ID name", type: "text", section: "patient" },
  idNumber: { label: "ID number", type: "text", section: "patient" },
  insuredEmail: { label: "Insured email ID", type: "text", section: "patient" },

  doctorName: { label: "Name of the treating doctor", type: "text", section: "doctor" },
  doctorContact: { label: "Contact number", type: "text", section: "doctor" },
  illness: { label: "Nature of illness / disease with presenting complaints", type: "longtext", section: "doctor", wide: true },
  clinicalFindings: { label: "Relevant clinical findings", type: "longtext", section: "doctor", wide: true },
  durationDays: { label: "Duration of the present ailment (days)", type: "number", section: "doctor" },
  firstConsultDate: { label: "Date of first consultation", type: "date", section: "doctor" },
  pastHistory: { label: "Past history of present ailment, if any", type: "longtext", section: "doctor", wide: true },
  provisionalDiagnosis: { label: "Provisional diagnosis", type: "text", section: "doctor", wide: true },
  icd10: { label: "ICD 10 code", type: "text", section: "doctor" },
  lineOfTreatment: { label: "Proposed line of treatment", type: "treatment", section: "doctor", wide: true },
  investigationDetails: { label: "If investigation and / or medical management, provide details", type: "longtext", section: "doctor", wide: true },
  drugRoute: { label: "Route of drug administration", type: "text", section: "doctor" },
  surgeryName: { label: "If surgical, name of surgery", type: "text", section: "doctor", wide: true },
  icd10pcs: { label: "ICD 10 PCS code", type: "text", section: "doctor" },
  otherTreatment: { label: "If other treatments, provide details", type: "text", section: "doctor", wide: true },
  injuryHow: { label: "How did injury occur", type: "text", section: "doctor", wide: true },
  isRta: { label: "In case of accident: is it RTA", type: "yesno", section: "doctor" },
  injuryDate: { label: "Date of injury", type: "date", section: "doctor" },
  reportedToPolice: { label: "Reported to police", type: "yesno", section: "doctor" },
  firNo: { label: "FIR no.", type: "text", section: "doctor" },
  substanceAbuse: { label: "Injury / disease caused due to substance abuse / alcohol consumption", type: "yesno", section: "doctor" },
  substanceTest: { label: "Test conducted to establish this (if yes, attach reports)", type: "yesno", section: "doctor" },
  maternity: { label: "In case of maternity (G P L A)", type: "maternity", section: "doctor" },
  expectedDelivery: { label: "Expected date of delivery", type: "date", section: "doctor" },
  lmp: { label: "LMP (last menstrual period)", type: "date", section: "doctor" },

  admissionDate: { label: "Date of admission", type: "date", section: "admission" },
  admissionTime: { label: "Time of admission", type: "time", section: "admission" },
  admissionType: { label: "Is this an emergency / a planned hospitalisation event", type: "emergency", section: "admission" },
  expectedDays: { label: "Expected number of days stay in hospital", type: "number", section: "admission" },
  icuDays: { label: "Days in ICU", type: "number", section: "admission" },
  roomType: { label: "Room type", type: "text", section: "admission" },

  roomRent: { label: "Per day room rent + nursing & service charges + patient's diet", type: "money", section: "costs" },
  investigationCost: { label: "Expected cost for investigation + diagnostics", type: "money", section: "costs" },
  icuCharges: { label: "ICU charges", type: "money", section: "costs" },
  otCharges: { label: "OT charges", type: "money", section: "costs" },
  professionalFees: { label: "Professional fees: surgeon + anaesthetist fees + consultation charges", type: "money", section: "costs" },
  medicinesCost: { label: "Medicines + consumables + cost of implants", type: "money", section: "costs" },
  otherExpenses: { label: "Other hospital expenses, if any", type: "money", section: "costs" },
  packageCharges: { label: "All inclusive package charges, if any applicable", type: "money", section: "costs" },
  totalCost: { label: "Sum total expected cost of hospitalisation", type: "money", section: "costs" },

  declDate: { label: "Date of declaration", type: "date", section: "chronic" },
  declTime: { label: "Time of declaration", type: "time", section: "chronic" },

  chronicDiabetes: { label: "Diabetes", type: "chronic", section: "chronic" },
  chronicHeart: { label: "Heart disease", type: "chronic", section: "chronic" },
  chronicHypertension: { label: "Hypertension", type: "chronic", section: "chronic" },
  chronicHyperlipidemia: { label: "Hyperlipidemias", type: "chronic", section: "chronic" },
  chronicOsteoarthritis: { label: "Osteoarthritis", type: "chronic", section: "chronic" },
  chronicAsthma: { label: "Asthma / COPD / Bronchitis", type: "chronic", section: "chronic" },
  chronicCancer: { label: "Cancer", type: "chronic", section: "chronic" },
  chronicAlcohol: { label: "Alcohol or drug abuse", type: "chronic", section: "chronic" },
  chronicHiv: { label: "Any HIV or STD / related ailments", type: "chronic", section: "chronic" },
  chronicOther: { label: "Any other ailment, give details", type: "chronic", section: "chronic" },
};

export const PREAUTH_FIELD_KEYS = Object.keys(PREAUTH_FIELDS);

/** The fields that add up to the "sum total expected cost". */
export const COST_PARTS = ["roomRent", "investigationCost", "icuCharges", "otCharges", "professionalFees", "medicinesCost", "otherExpenses"] as const;

export const TREATMENT_OPTIONS = ["Medical management", "Surgical management", "Intensive care", "Investigation", "Non-allopathic treatment"];

/** Declaration details filled in on the form itself, kept with the other values. */
export const DECLARATION_FIELDS = ["declQualification", "declRegNo", "declPatientName", "declPatientContact", "declPatientEmail"] as const;

export interface PreauthFormDef {
  key: string;
  /** The insurer or TPA the form belongs to. */
  name: string;
  kind: "Insurer" | "TPA";
  /** The form's own heading, as printed. */
  title: string;
  /** The letterhead lines above the form: company, address, phone, fax, email. */
  header: string[];
  /** Lines repeated at the foot of each page. */
  footer: string[];
  /** The standard fields this insurer's form asks, in its order, with its wording ("" = the standard wording). */
  fields: { key: string; label: string }[];
  /** The declaration and the list of documents, as the insurer words them. */
  declaration: string[];
  /** The source PDF is a scan; the layout is the standard Part C under this insurer's name. */
  scanned?: boolean;
}

export type PreauthStatus = "Draft" | "Awaiting doctor" | "Awaiting stamp" | "Ready";
export const PREAUTH_STATUSES: PreauthStatus[] = ["Draft", "Awaiting doctor", "Awaiting stamp", "Ready"];

export type PreauthValues = Record<string, string>;

export interface PreauthSummaryDTO {
  id: number;
  formKey: string;
  formName: string;
  patientId: number | null;
  patientName: string;
  doctorId: number | null;
  doctorName: string;
  status: PreauthStatus;
  createdBy: string;
  doctorSignedAt: string | null;
  stampedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreauthDTO extends PreauthSummaryDTO {
  values: PreauthValues;
  admissionId: number | null;
  doctorSignedBy: string | null;
  /** The doctor had automatic signing on, so the signature was applied as soon as the form was sent. */
  doctorSignedAuto: boolean;
  stampedBy: string | null;
  /** The images captured when it was signed and stamped, so the form stays as signed even if they are changed later. */
  doctorSignatureImg: string | null;
  doctorStampImg: string | null;
  hospitalStampImg: string | null;
  /** The patient's own signature, added on this form (drawn or uploaded), and who added it and when. */
  patientSignatureImg: string | null;
  patientSignedAt: string | null;
  patientSignedBy: string | null;
}

/** The images the caller has stored for signing (data URLs, or null): a doctor's signature and stamp, or the hospital's stamp for its top admin. */
export interface SignatureAssetsDTO {
  doctorSignature: string | null;
  doctorStamp: string | null;
  hospitalStamp: string | null;
  /** A doctor's choice: sign forms sent to them automatically. Always false for anyone else. */
  autoSign: boolean;
}

export interface NotificationListDTO { unread: number; items: NotificationDTO[] }

export interface NotificationDTO {
  id: number;
  kind: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

/** The forms waiting on the person asking: for a doctor, theirs to sign; for the hospital's top admin, those to stamp. */
export interface PreauthPendingDTO {
  toSign: PreauthSummaryDTO[];
  toStamp: PreauthSummaryDTO[];
}

// ── Claim packet: the signed pre-auth form and its supporting papers in one PDF ─────────────────────────────────────

export type PacketDocKind = "aadhaar" | "pan" | "policy" | "other";

export interface PacketPrescriptionOption { id: number; rxNumber: string; date: string; doctor: string; diagnosis: string; medicineCount: number }
export interface PacketReportOption { key: string; group: "Lab" | "Radiology"; name: string; date: string; fileName: string }
export interface PacketDocumentOption { id: number; title: string; category: string; fileName: string; mimeType: string; sizeBytes: number; kind: PacketDocKind; uploadedAt: string }

/** What can go into a form's packet: the patient's prescriptions, uploaded reports, and papers on file (with Aadhaar, PAN and policy picked out). */
export interface PacketOptionsDTO {
  formId: number;
  formName: string;
  patientId: number | null;
  patientName: string;
  /** The packet can be made once the form is signed and stamped. */
  ready: boolean;
  prescriptions: PacketPrescriptionOption[];
  reports: PacketReportOption[];
  documents: PacketDocumentOption[];
}

export interface PacketFileDTO {
  /** "report:lab:12", "document:7" */
  key: string;
  label: string;
  fileName: string;
  mimeType: string;
  /** The file as a data URL. */
  dataUrl: string;
}

export interface PacketPrescriptionDTO {
  id: number;
  rxNumber: string;
  date: string;
  doctor: string;
  diagnosis: string;
  patientName: string;
  patientAge: number;
  gender: string | null;
  allergies: string | null;
  items: { medicineName: string; dosage: string; frequency: string; duration: string; instructions: string | null }[];
}

export interface PacketContentDTO {
  prescriptions: PacketPrescriptionDTO[];
  files: PacketFileDTO[];
}
