/**
 * The pre-authorisation forms, ready to use. Most are laid out from the standard Part C fields in the insurer's own wording
 * (forms.generated.ts). A form that has an "exact" template is also printed onto the insurer's real PDF, box for box: its fields
 * below are the ones that PDF asks, in its order and wording, and nothing else.
 */
import type { PreauthFormDef } from "../../types/preauth";
import { PREAUTH_FORMS as GENERATED } from "./forms.generated";
import { EXACT_FIELDS } from "./exact-forms.generated";

/** Forms printed onto the insurer's own PDF. The PDF and the box template are in public/preauth/. */
export const EXACT_FORMS: Record<string, { pdf: string; template: string }> = Object.fromEntries(
  ["icici-lombard", ...Object.keys(EXACT_FIELDS)].map((k) => [k, { pdf: `/preauth/${k}.pdf`, template: `/preauth/${k}.json` }]),
);

const f = (key: string, label: string) => ({ key, label });

/** What the ICICI Lombard Part C asks, in its order and wording. */
const LOMBARD_FIELDS = [
  f("hospitalName", "Name of Hospital"), f("hospitalAddress", "Address"), f("rohiniId", "Rohini ID"), f("hospitalEmail", "E-mail ID of Hospital"), f("hospitalFax", "Fax number"),
  f("patientName", "Name of the Patient"), f("gender", "Gender"), f("age", "Age"), f("dob", "Date of Birth"), f("contactNo", "Contact number"), f("altContactNo", "Contact number of attending Relative"),
  f("insuredCardId", "Insured Health ID Card Number"), f("insuredEmail", "Email ID of Customer"), f("policyNo", "Policy number / Name of Corporate"), f("employeeId", "Employee ID"),
  f("patientAddress", "Current Address of Insured Patient"), f("occupation", "Occupation of Insured Patient"), f("hasFamilyPhysician", "Do you have a family Physician"),
  f("familyPhysicianName", "Name of the Family Physician"), f("familyPhysicianContact", "Contact number, if any"), f("otherInsurance", "Currently do you have any other mediclaim / health insurance"),
  f("otherInsurerName", "Company name"), f("otherPolicyNo", "Policy number / Health ID Card"), f("idProofName", "Govt Recognised Age / ID Proof of Patient: ID Name"), f("idNumber", "ID Number"),
  f("doctorName", "Name of the treating Doctor"), f("doctorContact", "Contact number"), f("illness", "Nature of Illness / Disease with presenting complaint"), f("clinicalFindings", "Relevant Critical Findings"),
  f("durationDays", "Duration of the present ailment (days)"), f("firstConsultDate", "Date of First consultation"), f("pastHistory", "Past history of present ailment, if any"),
  f("provisionalDiagnosis", "Provisional diagnosis"), f("icd10", "ICD 10 code"), f("lineOfTreatment", "Proposed line of treatment"), f("investigationDetails", "If investigation and / or Medical Management, provide details"),
  f("drugRoute", "Route of Drug Administration"), f("surgeryName", "If surgical, name of surgery"), f("icd10pcs", "ICD 10 PCS code"), f("otherTreatment", "If other treatment, provide details"),
  f("injuryHow", "How did injury occur"), f("isRta", "In case of accident: Is it RTA"), f("injuryDate", "Date of Injury"), f("reportedToPolice", "Report to Police"), f("firNo", "FIR no."),
  f("substanceAbuse", "Injury / Disease caused due to substance abuse / alcohol consumption"), f("substanceTest", "Test conducted to establish this (if yes, attach report)"),
  f("maternity", "In case of Maternity (G P L A)"), f("expectedDelivery", "Expected date of Delivery"),
  f("admissionDate", "Date of admission"), f("admissionTime", "Time of admission"), f("admissionType", "Is this Emergency / Planned"), f("expectedDays", "Expected number of Days / stay in hospital"),
  f("icuDays", "Days in ICU"), f("roomType", "Room Type"),
  f("roomRent", "Per day room rent + nursing and service charges"), f("investigationCost", "Expected cost of investigation + diagnostic"), f("icuCharges", "ICU charges"), f("otCharges", "OT charges"),
  f("professionalFees", "Professional fees Surgeon + Anesthetist Fees + consultation Charges"), f("medicinesCost", "Medicines + Consumables + Cost of Implants (if applicable please specify)"),
  f("otherExpenses", "Other hospital expenses if any"), f("packageCharges", "All-inclusive package charges if any applicable"), f("totalCost", "Sum Total expected cost of hospitalization"),
  f("chronicDiabetes", "Diabetes"), f("chronicHeart", "Heart Disease"), f("chronicHypertension", "Hypertension"), f("chronicHyperlipidemia", "Hyperlipidemias"), f("chronicOsteoarthritis", "Osteoarthritis"),
  f("chronicAsthma", "Asthma / COPD / Bronchitis"), f("chronicCancer", "Cancer"), f("chronicAlcohol", "Alcohol / Drug abuse"), f("chronicHiv", "Any HIV or STD Related ailment"), f("chronicOther", "Any other ailment, give details"),
];

export const PREAUTH_FORMS: PreauthFormDef[] = GENERATED.map((d) => (d.key === "icici-lombard" ? { ...d, fields: LOMBARD_FIELDS, scanned: false } : EXACT_FIELDS[d.key] ? { ...d, fields: EXACT_FIELDS[d.key], scanned: false } : d));
