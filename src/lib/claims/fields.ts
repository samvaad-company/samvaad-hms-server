/**
 * The details every insurer's claim form asks for, kept once under standard keys. Part A is about the insured and the patient; Part B is
 * the hospital's (its details, the doctor, the stay and the bill). Each insurer's form is printed from these.
 */
export type ClaimGroup = "insurer" | "patient" | "hospital" | "stay" | "bill";

export interface ClaimFieldSpec {
  label: string;
  group: ClaimGroup;
  type: "text" | "date" | "time" | "gender" | "money" | "longtext" | "choice";
  options?: string[];
}

export const CLAIM_GROUPS: { key: ClaimGroup; title: string; note: string }[] = [
  { key: "insurer", title: "Insurer / TPA", note: "The company the claim is made to" },
  { key: "patient", title: "Part A: Insured and patient", note: "Filled from the patient's record and policy" },
  { key: "hospital", title: "Part B: Hospital details", note: "Filled from the hospital's profile and the treating doctor" },
  { key: "stay", title: "Part B: The stay", note: "Filled from the admission" },
  { key: "bill", title: "Part B: The bill", note: "Filled from the bills raised for the admission" },
];

export const CLAIM_FIELDS: Record<string, ClaimFieldSpec> = {
  insurerName: { label: "Insurance company / TPA", group: "insurer", type: "text" },

  patientName: { label: "Name of the patient", group: "patient", type: "text" },
  insuredName: { label: "Name of the insured / policy holder", group: "patient", type: "text" },
  policyNo: { label: "Policy number", group: "patient", type: "text" },
  cardId: { label: "Health card / member ID", group: "patient", type: "text" },
  employeeId: { label: "Employee ID (group policy)", group: "patient", type: "text" },
  dob: { label: "Date of birth", group: "patient", type: "date" },
  age: { label: "Age (years)", group: "patient", type: "text" },
  gender: { label: "Gender", group: "patient", type: "gender", options: ["Male", "Female", "Other"] },
  address: { label: "Address", group: "patient", type: "longtext" },
  phone: { label: "Mobile number", group: "patient", type: "text" },
  email: { label: "Email ID", group: "patient", type: "text" },
  occupation: { label: "Occupation", group: "patient", type: "text" },

  hospitalName: { label: "Name of the hospital", group: "hospital", type: "text" },
  hospitalAddress: { label: "Hospital address", group: "hospital", type: "longtext" },
  hospitalReg: { label: "Hospital registration number", group: "hospital", type: "text" },
  hospitalPan: { label: "Hospital PAN", group: "hospital", type: "text" },
  rohini: { label: "ROHINI ID", group: "hospital", type: "text" },
  hospitalPhone: { label: "Hospital phone", group: "hospital", type: "text" },
  hospitalEmail: { label: "Hospital email ID", group: "hospital", type: "text" },
  doctorName: { label: "Name of the treating doctor", group: "hospital", type: "text" },
  doctorReg: { label: "Doctor's registration number", group: "hospital", type: "text" },

  diagnosis: { label: "Diagnosis / nature of illness", group: "stay", type: "longtext" },
  admissionDate: { label: "Date of admission", group: "stay", type: "date" },
  admissionTime: { label: "Time of admission", group: "stay", type: "time" },
  dischargeDate: { label: "Date of discharge", group: "stay", type: "date" },
  roomType: { label: "Room / ward category", group: "stay", type: "text" },
  admissionType: { label: "Emergency or planned", group: "stay", type: "choice", options: ["Emergency", "Planned"] },

  totalBill: { label: "Total bill amount (Rs)", group: "bill", type: "money" },
  advancePaid: { label: "Advance / deposit paid (Rs)", group: "bill", type: "money" },
};

export const CLAIM_FIELD_KEYS = Object.keys(CLAIM_FIELDS);
