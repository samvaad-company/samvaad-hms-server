/**
 * The 42 insurer and TPA pre-authorisation forms, one definition each: its heading and letterhead lines, the standard Part C fields it asks
 * (with its own wording where it has one), and its declaration. Generated from the insurers' published PDF forms; do not edit by hand.
 */
import type { PreauthFormDef } from "../../types/preauth";

export const PREAUTH_FORMS: PreauthFormDef[] = [
 {
  "key": "acko",
  "name": "Acko General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART -- C",
  "header": [
   "ACKO GENERAL INSURANCE"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": "Address"
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other med claim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "A: Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "B: Contact number"
   },
   {
    "key": "illness",
    "label": "C: Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H: If investigation and/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I: If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J: If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur L: In case of accident"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity G A"
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon +Anesthetist Fees +consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with State code Patient/Insured Name and Sign",
   "DECLARATION BY THE PATIENT I REPRESENTATIVE",
   "a. 1 agrees to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer /TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA /Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. 4 | P a g e",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the between the facts in this form and discharge summary or other documents",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA /Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. 5 | P a g e"
  ]
 },
 {
  "key": "aditya-birla",
  "name": "Aditya Birla Health Insurance",
  "kind": "Insurer",
  "title": "Preauthorization Form",
  "header": [
   "Aditya Birla Health Insurance Co. Limited",
   "Request For Cashless Hospitalisation For Medical Insurance Policy"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free FAX"
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age"
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/ Name of corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim/Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have any family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of ILLNESS / Disease with presenting Complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "I. If Investigation &/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency /a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet Rs."
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon+ Anaesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum total expected cost of hospitalisation"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations on the reverse of this form.",
   "c. Registration No. with State Code: (PLEASE READ VERY CAREFULLY) Patient / Insured Name & Signature",
   "DECLARATION BY THE PATIENT/REPRESENTATIVE: 1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer / TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge. 2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy. 3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorised by the Insurer / TPA not governed by the terms and conditions of the policy will be paid by me. 4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect, I forfeit my claim and agree to indemnify the Insurer / TPA. 5. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. 6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited. 7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA. Patient's/Insured's Name: Patient's/Insured's Signature Contact Number: HOSPITAL DECLARATION 1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization. 2. All valid original documents duly countersigned by the insured / patient as per the checklist mentioned below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. 3. All nonmedical expenses OR expenses not relevant to hospitalization or illness OR expenses disallowed in the Authorisation Letter of the TPA / Insurance Co. OR arising out of incorrect information in the pre-authorisation form will be collected from the patient. 4. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents. 5. The patient declaration has been signed by the patient or by his representative in our presence. 6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. 7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured. Aditya Birla Health Insurance Co. Limited. IRDAI Reg.153. CIN No. U66000MH2015PLC263677. Address:- 10th Floor, R-Tech Park, Nirlon Compound, Next to HUB Mall, Off Western Express Highway, Goregaon East, Mumbai - 400 063. Telephone: +91 22 6225 7600, Fax: +91 22 6225 7700. For more details on risk factors, terms and conditions please read sales brochure carefully before concluding a sale. Aditya Birla Health Logo is owned by Aditya Birla Management Corporation Private Limited and used under license by us."
  ]
 },
 {
  "key": "bajaj-allianz",
  "name": "Bajaj Allianz General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY",
  "header": [
   "Bajaj Allianz General Insurance Company Limited.",
   "Regd. & Head Office : Bajaj Allianz House, Airport Road, Yerawada, Pune 411 006 CIN: U66010PN2000PLC015329",
   "CASHLESS FORM",
   "PLEASE FAX/SCAN PAGE 1 AND 2 ONLY REQUEST FOR CASHLESS HOSPITALISATION FOR MEDICAL INSURANCE POLICY DETAILS OF THE PROVIDER"
  ],
  "footer": [
   "CIN: U66010PN2000PLC015329 | UIN: BAJHLIP19087V011819"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Hospital Name/nursing Home Name"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "hospitalCity",
    "label": "City Name"
   },
   {
    "key": "hospitalState",
    "label": "State Name"
   },
   {
    "key": "hospitalPincode",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "hospitalPhone",
    "label": "Hospital Contact No"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Years"
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Name of the Attendant"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "panNo",
    "label": "Pan No"
   },
   {
    "key": "proposerName",
    "label": "Name of the Proposer"
   },
   {
    "key": "ckyc",
    "label": "CKYC of the proposer"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured patient"
   },
   {
    "key": "insuredEmail",
    "label": "Insured E-mail id"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of ILLNESS / Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": ""
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation & I or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "i ) If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No ."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": ""
   },
   {
    "key": "lmp",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Expected no.of days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing &"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics."
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees +"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemia"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol or drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD / Related ailments"
   },
   {
    "key": "chronicOther",
    "label": "Any other Ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations on the reverse of this form",
   "1. For retail policies/individual customers: Consent/Declaration to be added in proposal and claim for CKYC no.: I/we hereby give my/our consent to the Company to verify and obtain my/our identity/address proof through Central KYC Registry or National Securities Depository Limited Portal for the purpose of undertaking KYC verification.",
   "2. For Juridical person/non-individual customer: Consent/Declaration to be added in proposal and claim for CKYC no.: I/we hereby give my/our consent to the Company to verify and obtain my/our identity/address proof through Central KYC Registry or Goods and Service Tax Portal or Ministry Of Corporate Affairs Portal or National Securities Depository Limited portal for the purpose of undertaking KYC.",
   "3. For Group Policies: Consent/Declaration to be added in claim form CKYC no.: I/we hereby give my/our consent to the Company to verify and obtain my/our identity/address proof through Central KYC Registry for the purpose of undertaking KYC",
   "4. For Juridical person/non-individual customer and Group Policies: Consent/Declaration to be added in claim form CKYC no.: I/we hereby give my/our consent to the Company to verify and obtain my/our identity/address proof through Central KYC Registry or UIDAI or through any other modes for the purpose of undertaking KYC",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE A. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Bajaj Allianz General Insurance Company Limited after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge. B. Payment to hospital is governed by the terms and conditions of the policy. In case the Bajaj Allianz General Insurance Company Limited is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy. C. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Bajaj Allianz General Insurance Company Limited not governed by the terms and conditions of the policy will be paid by me. D . I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Bajaj Allianz General Insurance Company Limited E . I agree and understand that Bajaj Allianz General Insurance Company Limited is in no way warranting the service of the hospital & that the Bajaj Allianz General Insurance Company Limited is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. F . I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited. G . I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Bajaj Allianz General Insurance Company Limited I. I/We authorize Insurance Company/TPA to contact me/us through SMS/Email/WhatsApp for any update on this claim.",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized Bajaj Allianz General Insurance Company Limited official verifying documents pertaining to hospitalization.",
   "2. All valid original documents duty countersigned by the insured I patient as per the checklist below will be sent to Bajaj Allianz General Insurance Company Limited within 2 days of Patient Discharge.",
   "3. WE AGREE THAT BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LIMITED WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents.",
   "4. The patient declaration has been signed by the patient or by his representative in our presence.",
   "5. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "6. We will abide by the terms and conditions agreed in the MOU.",
   "7. We confirm that no additional amount would be collected liom the insured in excess of Agreed Package Rates except costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/considered in package).",
   "8. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "9. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MOU or applicable laws Date- Time - CIN: U66010PN2000PLC015329 | UIN: BAJHLIP19087V011819",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner I Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured. *As per IRDA circular Ref: IRDA/SDD/GDL/CIR/020/02/2013 Anti-Money Laundering /Counter Financing of Terrorism (AML/CFT)-Guidelines for General Insurers All general insurance companies are required to carry out KYC norms at the settlement stage where claim payout crosses a threshold of ` One lakh per claim. In cases where payments are made to third party service providers such as hospitals, the KYC norms shall apply on the customers on whose behalf service providers act."
  ]
 },
 {
  "key": "care",
  "name": "Care Health Insurance",
  "kind": "Insurer",
  "title": "Pre-Authorisation Form - `Care' Request for Cashless Hospitalisation for Medical Insurance Policy",
  "header": [
   "CARE HEALTH INSURANCE",
   "1. To be filled in CAPITAL LETTERS only. 2. If there is insufficient space, please provide further details on a separate sheet. 3. Please Fax/Scan Page 1 & 2 only."
  ],
  "footer": [
   "Care Health Insurance Limited (Formerly Religare Health Insurance Company Limited) Registered Office: 5th Floor, 19 Chawla House, Nehru Place,New Delhi-110019 Corresp. Office: Unit No. 604 - 607, 6th Floor, Tower C, Unitech Cyber Park, Sector-39, Gurugram -122001 (Haryana) Website: www.careinsurance.com",
   "CIN: U66000DL2007PLC161503 UIN: CHIHLIP22184V062122 IRDAI Registration No. - 148"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll Free Phone No."
   },
   {
    "key": "tollFreeFax",
    "label": "Toll Free FAX"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact Number of Attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured Card ID Number"
   },
   {
    "key": "policyNo",
    "label": "Policy Number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim/Health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of the Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Person"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact Number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness/Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation &/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of Admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of Admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for Investigation + Diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional Fees Surgeon + Anesthetist Fees + Consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable please specify)."
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital Expenses"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol or drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD / Related ailments"
   },
   {
    "key": "chronicOther",
    "label": "Any other Ailment give details"
   }
  ],
  "declaration": [
   "Declaration We confirm having read understood and agreed to the Declarations on the next page of this form.",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer/TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/TPA.",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer/TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/ TPA.",
   "h. I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim.",
   "d) Patient's/Insured's Signature : Date : Time : Hospital Declaration",
   "a. We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA/Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA/Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "chola-ms",
  "name": "Cholamandalam MS General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR MEDICAL INSURANCE POLICY",
  "header": [
   "CHOLAMANDALAM MS GENERAL INSURANCE",
   "BASIC INFORMATION - (TO BE FILLED IN BLOCK LETTERS) Rohini ID",
   "Patient ABHA ID",
   "2) TO BE FILLED BY THE INSURED/ PATIENT"
  ],
  "footer": [
   "CHOLAMANDALAM MS GENERAL INSURANCE COMPANY LIMITED",
   "Registered Office: 2nd Floor, \"DARE House\", 2, N.S.C. Bose Road, Chennai - 600 001. Toll free: 1800 208 9100 | website: www.cholainsurance.com Pre Authorization Request: faxhealth@cholams.murugappa.com | Queries & Complaints: customercare@cholams.murugappa.com",
   "Registered Office: 2nd Floor, \"DARE House\", 2, N.S.C. Bose Road, Chennai - 600 001 | IRDA Regn. No.123 | PAN: AABCC6633K | CIN: U66030TN2001PLC047977 Refer our website for Policy Wordings and detailed Terms & Conditions, Exclusions and the Ombudsman list. Call Toll Free: 1800 208 9100 | SMS CHOLA to 56677 | Visit www.cholainsurance.com | Email customercare@cholams.murugappa.com Disclaimer: The Company may contact you for matters related to your policy or to provide details of products & services offered. To opt out from the facility, please register under Do Not Call section on our website."
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "BASIC INFORMATION - (TO BE FILLED IN BLOCK LETTERS) Rohini ID"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact Number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/ Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "panNo",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Medi claim / Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Name of the family physician"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact Number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness/ Disease with Presenting Complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant Clinical Findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the Present Ailment"
   },
   {
    "key": "firstConsultDate",
    "label": ""
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation& / or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCSCode"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA Yes No"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse/ alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this Yes No (If Yes, attach reports)"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "lmp",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": ""
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / a planned hospitalization event? Emergency Planned"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & ` Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for Investigation + Diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon+Anaesthetist Fees + ` Consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable ` please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the lnsurer / T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the lnsurer / T.P.A not governed by the terms and conditions of the policy will be paid by me. In case any clarification is needed on admissibility of a particular item I shall contact T.P.A at the Toll Free Number on the reverse of this form.",
   "4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "5. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / lPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any fate or untrue statement, suppression or concealment, my right to claim reimbursement of the said expenses shall be absolutely forfeited. I further declare that, in respect of the above treatment, no benefits are admissible under any other Medical Scheme or Insurance",
   "7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA. Patient's/ lnsured's Name Contact number Patient's / lnsured's Signature",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "2. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "3. All non-medical expenses , OR expenses not relevant to hospitalization or illness, OR expenses disallowed in the Authorization Letter of the TPA / Insurance Co, OR arising out of incorrect information in the pre-authorisation form will be collected from the patient.",
   "4. WE AGREE THAT TPA / INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents.",
   "5. The patient declaration has been signed by the patient or by his representative in our presence.",
   "6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "7. We will abide by the terms and conditions agreed in the MOU.",
   "8. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/ considered in package). 3 of 4",
   "9. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/ considered in package).",
   "10. ln the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover from the same from us (the Network Provider) and / or take necessary action, as provided under the MOU or applicable laws.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital. 2. Cash Memos from lhe Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitione- / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner/ Surgeon that the patient is fully cured. 6. Original Final Bills has to be signed by the Patient/ Insured.",
   "DOCUMENTS TO BE PROVIDED BY THE PATIENT/ INSURED IN SUPPORT OF THE CLAIM 1. Aadhar card copy (Optional). 2. Pan card copy. 3. In case of Non availability of PAN CARD - FORM 60 as per the annexure need to be provided. 4 of 4 Income-tax Rules, 1962 FORM NO. 60 [See second proviso to rule 114B] Form for declaration to be filed by an individual or a person (not being a company or firm) who does not have a permanent account number and who enters into any transaction specified in rule 114B First Name Middle Name Surname Date of Birth / Incorporation of Declarant DD:MM:YYYY Father's Name (in case of individual) First Name Middle Name Surname Flat/ Room No. Floor No. Name of premises Block Name/No. Road/ Street/ Lane Area/ Locality Town/ City District State Pin code Telephone Number (with STD code) Mobile Number Amount of Transaction (Rs.) Date of Transaction DD:MM:YYYY In case of transaction in joint names, number of persons involved in the transaction Mode of transaction Cash, Online transfer, Cheque, Other Card, Draft/Banker's Cheque, Aadhaar Number issued by UIDAI (if available) If applied for PAN and it is not yet generated enter date of application and acknowledgement number If PAN not applied, fill estimated total income (including income of spouse, minor child etc. as per section 64 of Income-tax Act, 1961) for the financial year in which the above transaction is held",
   "a. Agricultural income (`)",
   "b. Other than agricultural income (`) Details of document being Document produced in support of identify in Column 1 (Refer Instruction overleaf ) Document Code Document Identification Number Name and address of the authority issuing the document Details of document being produced in support of address in Columns 4 to 13 (Refer Instruction overleaf) Document Code Document Identification Number Name and address of the authority issuing the document Verification |, do Hereby declare that whatis stated above is true to the best of my knowledge and belief. I further declare that I do not have a Permanent Account Number and my/ our estimated total income (including income of spouse, minor child etc. as per section 64 of Income-tax Act, 1961) computed in accordance with the provisions of Income-tax Act, 1961 for the financial year in which the above transaction is held will be less than maximum amount not chargeable to tax. Verified today, the day of 20 Place (Signature of declarant)"
  ]
 },
 {
  "key": "edelweiss",
  "name": "Edelweiss General Insurance",
  "kind": "Insurer",
  "title": "Request for Cashless Hospitalization for Health lnsurance Policy Part - C (Revised)",
  "header": [
   "EDELWEISS GENERAL INSURANCE",
   "NEED CASHLESS HOSPITALISATION? PLEASE HELP US WITH SOME DETAILS. (Do fill up this form in BLOCK LETTERS)"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "hospitalEmail",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "B. Contact No."
   },
   {
    "key": "altContactNo",
    "label": "F. Contact No. of Attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured's ID Card No."
   },
   {
    "key": "policyNo",
    "label": "H. Policy No./Name of Company"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance?"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": ""
   },
   {
    "key": "patientAddress",
    "label": "N. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A. Name of the Treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "B. Contact No."
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the Present Ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First Consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past History of Present Ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional Diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": "H. If Investigation and/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "lf Surgical, Name of Surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": "K. How Did Injury Occur?"
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to Substance Abuse/Alcohol Consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test Conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of Admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of Admission"
   },
   {
    "key": "admissionType",
    "label": "C. Emergency/Planned Hospitalization Event?"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per Day Room Rent + Nursing and Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected Cost of Investigation + Diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT Charges"
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable, please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other Hospital Expenses, if any"
   },
   {
    "key": "packageCharges",
    "label": "O. All-inclusive Package Charges, if any applicable"
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug Abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/STD Related Ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "THIS DECLARATION IS IMPORTANT, SO PLEASE READ IT CAREFULLY. We confirm having read, understood and agreed to the declarations made in this form. A. Name of the Treating Doctor: B. Qualification: C. Registration No. with State Code:",
   "MM YYYY MM YYYY MM YYYY MM YYYY MM YYYY Patient/lnsured Name and Sign",
   "DECLARATION BY THE INSURED PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the final bill & the discharge summary, before my discharge.",
   "b. Payment to Hospital is governed by the terms and conditions of the policy. In case the lnsurer/ TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA and not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if, at any time, the facts disclosed by me are found to be false or incorrect, I shall forfeit my claim and agree to indemnify the Insurer/ TPA.",
   "e. I agree and understand that TPA is, in no way, warranting the service of the hospital & that the Insurer/ TPA is, in no way, guaranteeing that the services provided by the Hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the foregoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/ TPA.",
   "h. I/We authorize Insurance Company/ TPA to contact me/us through mobile/email for any update on this claim",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents, duly countersigned by the insured/patient as per the checklist below, will be sent to TPA/lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA/Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative, in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the Health Services Agreement.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment, which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured, except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates,the authorized TPA/Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the Health Services Agreement or applicable laws. Edelweiss General Insurance Company Limited, Corporate Office: 5th Floor, Tower 3, Kohinoor City Mall, Kohinoor City, Kirol Road, Kurla (West), Mumbai400 070, Registered Office: Edelweiss House, Off CST Road, Kalina, Mumbai-400 098, IRDAI Regn. No.: 159, CIN: U66000MH2016PLC273758, Reach us on: 1800 12000, Email: support@edelweissinsurance.com, Website: www.edelweissinsurance.com, Issuing/Corporate Office: +91 22 2286 4400, Grievance Redressal Officer: +91 22 4931 4422, Dedicated Toll-Free Number for Grievance: 1800 120 216216. Trade logo displayed above belongs to Edelweiss Financial Services Limited and is used by Edelweiss General Insurance Company Limited under license."
  ]
 },
 {
  "key": "ericson-tpa",
  "name": "Ericson TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "ERICSON TPA",
   "REOUEST FOR C",
   "HLESS HOSPITALISATION FOR HE TH INSURANCE",
   "POLICY PART - C (Revised)",
   "a,"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA\"/lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": "A. Name ofth Patient B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "i.Company Name ii.Give Details"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician: L: Name ofthe Family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "O: Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": "B: Contact number"
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (ifyes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "admissionType",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost ofinvestigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses ifany"
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma./COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) we confirm having read understood and agreed to the Declarations ofthis form Name ofthe treating doctor b. Qualification:",
   "c. Resistration number with State code Patient/lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE a I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is govemed by the terms and conditions ofthe policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions ofthe policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not govemed by the terms and conditions ofthe policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions ofthe policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the tnsurer / T.P.A",
   "e. I agree and understand thatT.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be ofa particular quality or standard.",
   "f. I hereby warrant the truth ofthe forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concalment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnifo the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"t/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\" a) Patient's / Insured's Name",
   "d) Patient's / Insured's Signature e-mail Id (optional)",
   "HOSPITAL DECLARATION a We have no objection to any authorized TPA / Insurance Company official veri$,ing documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TpA / lnsurance Company within 7 days ofthe patient,s discharge.",
   "c. we agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence. e we agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected liom the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibilityi choosing separate line oftreatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the dposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line oftreatment which is not envisaged/considered in package). In the event ofunauthorized recovery ofany additional amount from the Insured in excess of Agreed Package Rates, the adhorized TPA / Insurance Company reserves the right to recoverthe same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "family-health-plan",
  "name": "Family Health Plan TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART -- C",
  "header": [
   "FAMILY HEALTH PLAN TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID iii.e-mail id"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": ""
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "M: Contact number, if any"
   },
   {
    "key": "altContactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other med claim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N: Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O: Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A: Name of the treating Doctor: B: Contact number"
   },
   {
    "key": "doctorContact",
    "label": "A: Name of the treating Doctor: B: Contact number"
   },
   {
    "key": "illness",
    "label": "C: Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H: If investigation and/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I: If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J: If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur L: In case of accident"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon +Anesthetist Fees +consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with State code Patient/Insured Name and Sign 3|Page",
   "DECLARATION BY THE PATIENT I REPRESENTATIVE",
   "a. 1 agrees to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer /TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA /Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the between the facts in this form and discharge summary or other documents",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA /Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. 4|Page"
  ]
 },
 {
  "key": "generali-central",
  "name": "Generali Central Insurance",
  "kind": "Insurer",
  "title": "PRE-AUTHORIZATION / CLAIM FORM FOR CASHLESS FACILITY",
  "header": [
   "GENERALI CENTRAL INSURANCE",
   "Hospital Id No:",
   "GCI-PAF-03",
   "------------------------------------------------------------------------TO BE FILLED BY THE INSURED/PATIENT-----------------------------------------------------------------",
   "Patient Name:"
  ],
  "footer": [
   "Phone: 1800 209 1016 / 1800 103 8889 Fax: 1800 209 1017 / 1800 103 9998 Email:GCH.cashless@generalicentral.com",
   "Generali Central Insurance Company Limited (Formerly known as Future Generali India Insurance Company Limited) | Registered Office: Unit No. 801 & 802, 8th Floor, Tower C, Embassy 247 Park, LBS Marg, Vikhroli (West), Mumbai - 400083 | IRDAI Regn. No.: 132 | CIN: U66030MH2006PLC165287 | Website: www.generalicentralinsurance.com | Email ID: gccare@generalicentral.com| Toll-free Phone: 1800 220 233 / 1860 500 3333/ 022 6783 7800"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of the Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Patient Name"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Patient/Attendant Mobile No."
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": "Policy No"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health Insurance Yes"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have Family Physician Yes No. Name of Family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "(days) Name of Treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": "Nature of Illness / Disease with Presenting Complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant Clinical Findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of present Ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First Consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past History of Present Ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional Diagnosis"
   },
   {
    "key": "icd10",
    "label": ""
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed Line of Treatment during Hospitalization"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation & /or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, Name of Surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Diseases caused due to Substance Abuse / Alcohol Consumptions"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": ""
   },
   {
    "key": "lmp",
    "label": "LMP Date"
   },
   {
    "key": "admissionDate",
    "label": ""
   },
   {
    "key": "admissionTime",
    "label": "Time of Admission"
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemia"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol or Drug Abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD/Related Ailments"
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "--------------------------------------------------------------------------------------DECLARATION------------------------------------------------------------------------------------I have completed this form and will be responsible for correctness of the medical information certified by me. I agree that Generali Central shall not be liable to make payment in case of any discrepancy between the preauthorization form and discharge summary. Name of the treating Doctor: Qualification: MCI Registration No with State Code: Signature of Doctor: Stamp / Seal of Hospital BENEFICIARY CONSENT / AUTHORISATION I have `No Objection' to Generali Central obtaining details of my treatment / collecting documents and also hereby authorize Generali Central to pay the hospital bill from the sum insured of my insurance policy. I also undertake to pay all non medical / non authorized expenses in the hospital bill directly to the hospital at the time of discharge. In case Generali Central issues \"Denial of cashless facility\" to the provider, I have 'No objection' in paying the hospital bill for the treatment given. All information provided above is true and I agree that if I have provided any false or untrue information, my right to claim the expenses shall be absolutely forfeited. NAME OF INSURED: SIGNATURE OF INSURED: INSURED Email ID: INSURED Mobile No: Declaration by the patient/representative I agree to allow the hospital to submit all original documents pertaining to hospitalization to the insurer after the discharge. I agree to sign on the final bill and the discharge summary before my discharge. Payment to hospital is governed by the terms and conditions of the policy. In case the insurer is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy. All non medical expenses and expenses not relevant to current hospitalization and the amounts over and above the limit authorized by the insurer not governed by the terms and conditions of the policy will be paid by me. In case any clarification is needed on admissibility of a particular item I shall contact insurer at the toll free no on the reverse of the form. I hereby declare to abide by the terms and conditions of the policy and it at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer. I agree and understand that insurer is in no way warranting the services of the hospital and the insurer is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I made or shall make any false or untrue statement, suppression or concealment, my right to claim reimbursement of the said exp enses shall be absolutely forfeited. I further declare that, in respect of the above treatment, no benefits are admissible under any other medical scheme or insurance. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the insurer. Patient's /Insured's Name Contact No: Patient's / Insured's Signature Hospital Declaration We have no objection to any authorized insurance company official verifying documents pertaining to hospitalization. All valid original documents duly counter singed by the insured/patient as per the check list below will be sent to insurance company within 7 days of the patient's discharge. All non medical expenses or expenses not relevant to hospitalization/illness, or expenses disallowed in the authorization letter of the insurance company , or arising out of incorrect information in the preauthorization form will be collected from the patient.",
   "WE AGREE THAT INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY OR OTHER DOCUMENTS. The patient declaration has been signed by the patient or by his / her representative in our presence. We agree to provide clarification for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. We will abide by the terms and conditions agreed in the MOU. ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------Documents to be provided by the hospital in support of the claim",
   "1. Authorization Letter 2. Original Detailed Discharge Summary 3. Original Hospital Main Bill and Detailed Break Up 4. All Original Pharmacy Bills and Investigation Bill if any 5. All Investigation Reports & Prescriptions Including OT Notes"
  ]
 },
 {
  "key": "geninus",
  "name": "Geninus India",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "GENINUS INDIA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": ""
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": ""
   },
   {
    "key": "familyPhysician",
    "label": ""
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": ""
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": ""
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": ""
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": ""
   },
   {
    "key": "substanceTest",
    "label": ""
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": ""
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [],
  "scanned": true
 },
 {
  "key": "go-digit",
  "name": "Go Digit General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "GO DIGIT GENERAL INSURANCE"
  ],
  "footer": [
   "Go Digit General Insurance Limited, Atlantis, 95, 4th 'B' Cross Road, Koramangala Industrial Layout, 5th Block, Bengaluru-560095 CIN: U66010PN2016PLC167410 | Website: www.godigit.com | IRDAI Regn No: 158"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of the Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "ROHINI ID"
   },
   {
    "key": "hospitalEmail",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "lnsured' s Card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim/health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": "Current address of insured patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of illness/disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD-l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation/Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD-l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did the injury occur?"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "In case of maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "Expected number of days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent+nursing and service charges+ patient's diet"
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Surgeon's Professional Fees + Anesthetist Fees + Consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable, please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses, if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read, understood, and agreed to the Declarations within this form Name of the treating doctor Qualification Registration number with State code Patient/lnsured Name and Sign Declaration by the patient /representative",
   "a) I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA aftermy discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b) Payment to hospital is governed by the terms and conditions of the policy. In case the lnsurer/TPA is not liable to settle thehospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c) All non-medical expenses, and expenses not relevant to the current hospitalization; and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d) I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found tobe false or incorrect, I forfeit my claim and agree to indemnify the Insurer/TPA.",
   "e) I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer/TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f) I hereby warrant the truth of the foregoing particulars in every respect, and I agree that if I have made or shall make any false or untrue statements, suppression, or concealment with respect to the claim, my right to claim reimbursement of thesaid expenses shall be absolutely forfeited.",
   "g) I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/TPA.",
   "h) \"I/We authorize the Insurance Company/TPA to contact me/us through mobile/email for any update on this claim?\".",
   "d) Patient's /Insured's Signature: Hospital declaration",
   "a) We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "b) All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA/lnsurance Company within 7 days of the patient's discharge.",
   "c) We agree that TPA/Insurance Company will not be liable to make the payment in the event of any discrepancybetween the facts in this form and the discharge summary or other documents.",
   "d) The patient's declaration has been signed by the patient or by his representative in our presence.",
   "e) We agree to provide clarifications for the queries raised regarding this hospitalization and we take sole responsibilityfor any delay in offering clarifications.",
   "f) We will abide by the terms and conditions agreed upon or agreed to MOU.",
   "g) We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates, except costs towards non-admissible amounts (including additional charges due to opting for higher room rent thaneligibility/choosing separate line of treatment which is not envisaged/considered in the package).",
   "h) We confirm that no recoveries would be made from the deposit amount collected from the insured, except for coststoward non-admissible amounts (including additional charges due to opting for higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in the package).",
   "i) In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA/Insurance Company reserves the right to recover the same from us (the Network Provider) and/ortake necessary action, as provided under the MOU or applicable laws."
  ]
 },
 {
  "key": "good-health",
  "name": "Good Health TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "GOOD HEALTH TPA",
   "Please fill all pages : This is Page 1 of 4",
   "1 DETAILS OF THIRD PARTY ADMINISTRATOR AND HOSPITAL"
  ],
  "footer": [
   "PRE - AUTHORIZATION FORM",
   "REQUEST FOR CASHLESS HOSPITALIZATION FOR HEALTH INSURANCE POLICY TO BE FILLED IN BLOCK LETTERS",
   "GOOD HEALTH INSURANCE TPA LIMITED"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "NAME OF THE TPA"
   },
   {
    "key": "tollFreePhone",
    "label": "TOLL FREE PHONE NO."
   },
   {
    "key": "tollFreeFax",
    "label": "1 8 0 0 4 2 5 3 2 3 2 TOLL FREE FAX NO. 1 8 6 0 4 2 5 4 2 4 2"
   },
   {
    "key": "hospitalName",
    "label": "HOSPITAL NAME"
   },
   {
    "key": "hospitalAddress",
    "label": "HOSPITAL LOCATION"
   },
   {
    "key": "rohiniId",
    "label": "HOSPITAL ROHINI ID"
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": ""
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "AGE YEARS / MONTHS DATE OF BIRTH CONTACT NO. OF ATTENDING RELATIVE TPA CARD ID"
   },
   {
    "key": "contactNo",
    "label": "DO YOU HAVE A FAMILY PHYSICIAN YES / NO PHYSICIAN NAME CONTACT NO."
   },
   {
    "key": "altContactNo",
    "label": "AGE YEARS / MONTHS DATE OF BIRTH CONTACT NO. OF ATTENDING RELATIVE TPA CARD ID"
   },
   {
    "key": "insuredCardId",
    "label": "AGE YEARS / MONTHS DATE OF BIRTH CONTACT NO. OF ATTENDING RELATIVE TPA CARD ID"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "EMPLOYEE ID ADDRESS OF THE INSURED PATIENT"
   },
   {
    "key": "otherInsurance",
    "label": "DO YOU HAVE ANY OTHER MEDICLAIM YES / NO POLICY NO. INSURANCE CO. NAME"
   },
   {
    "key": "familyPhysician",
    "label": "DO YOU HAVE A FAMILY PHYSICIAN YES / NO PHYSICIAN NAME CONTACT NO."
   },
   {
    "key": "patientAddress",
    "label": "EMPLOYEE ID ADDRESS OF THE INSURED PATIENT"
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "NAME OF THE TREATING DOCTOR"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": "NATURE OF ILLNESS / DISEASE WITH PRESENTING"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "DURATION OF PRESENT AILMENT"
   },
   {
    "key": "firstConsultDate",
    "label": ""
   },
   {
    "key": "pastHistory",
    "label": "PAST HISTORY OF PRESENT AILMENT"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "PROVISIONAL DIAGNOSIS"
   },
   {
    "key": "icd10",
    "label": "ICD 10 CODE INVESTIGATIONS"
   },
   {
    "key": "lineOfTreatment",
    "label": "PROPOSED LINE OF TREATMENT (PLS TICK)"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "ROUTE OF DRUG MANAGEMENT"
   },
   {
    "key": "surgeryName",
    "label": "NAME OF SURGERY"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS CODE"
   },
   {
    "key": "otherTreatment",
    "label": "OTHER TREATMENT"
   },
   {
    "key": "injuryHow",
    "label": "HOW DID INJURY OCCUR"
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": "DATE OF INJURY FIR NO."
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "DATE OF INJURY FIR NO."
   },
   {
    "key": "substanceAbuse",
    "label": "DUE TO SUBSTANCE ABUSE/ALCOHOL"
   },
   {
    "key": "substanceTest",
    "label": "TEST CONDUCTED TO ESTABLISH THIS (IF YES, ATTACH REPORT)"
   },
   {
    "key": "maternity",
    "label": "IN CASE OF MATERNITY"
   },
   {
    "key": "expectedDelivery",
    "label": "EXPECTED DATE OF DELIVERY"
   },
   {
    "key": "admissionDate",
    "label": "DATE OF ADMISSION"
   },
   {
    "key": "admissionTime",
    "label": "TIME OF ADMISSION"
   },
   {
    "key": "admissionType",
    "label": "IS THIS AN EMERGENCY / PLANNED HOSPITALIZATION EMERGENCY"
   },
   {
    "key": "expectedDays",
    "label": "EXPECTED NO. OF DAYS / STAY IN HOSPITAL ROOM TYPE"
   },
   {
    "key": "icuDays",
    "label": "DAYS IN ICU"
   },
   {
    "key": "roomType",
    "label": "EXPECTED NO. OF DAYS / STAY IN HOSPITAL ROOM TYPE"
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": "ICU CHARGES"
   },
   {
    "key": "otCharges",
    "label": "OT CHARGES"
   },
   {
    "key": "professionalFees",
    "label": "PROFESSIONAL FEES SURGEON + ANESTHETIC FEES + CONSULTATION CHARGES"
   },
   {
    "key": "medicinesCost",
    "label": "MEDICINES + CONSUMABLES + COST OF IMPLANTS (PLS SPECIFY)"
   },
   {
    "key": "otherExpenses",
    "label": "OTHER HOSPITAL EXPENSES, IF ANY"
   },
   {
    "key": "packageCharges",
    "label": "ALL-INCLUSIVE PACKAGE CHARGES IF APPLICABLE"
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": "HYPERTENSION.........................."
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "HYPERLIPIDEMIAS....................."
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "OSTEOARTHRITIS......................"
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": "CANCER......................................."
   },
   {
    "key": "chronicAlcohol",
    "label": "ALCOHOL/DRUG ABUSE..........."
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to the hospital is governed by the terms and conditions of the policy. In case the insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amount over & above the limit authorized by the Insurer / TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect, I forfeit my claim and agree to indemnify Insurer / TPA.",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company / TPA to contact me / us through mobile / email for any update on this claim.\"",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to the TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount shall be collected for the insured in excess of the Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and / or take necessary action, as provided under the MOU or applicable laws.",
   "DOCTOR'S NAME AND SIGN"
  ]
 },
 {
  "key": "hdfc-ergo",
  "name": "HDFC ERGO Health",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART-C (Revised)",
  "header": [
   "HDFC ERGO HEALTH"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact Number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H. If investigation and /or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I. If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J. If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K. How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Ai.Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H.Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L.Professional fees Surgeon+ Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "O. All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form a. Name of the treating doctor b. Qualification:",
   "c. Registration number with State code Patient/Insured Name and Sign",
   "DECLARATION BY THE PATIENT/ REPRESENTATIVE",
   "a. 1 agree to allow the hospital to submit all original documents pertaining to hospitalization to the lnsurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer/ TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the lnsurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/ T.P.A e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer/ TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. f. 1 hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer /TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "c) E-mail Id (optional)",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. 3"
  ]
 },
 {
  "key": "health-india",
  "name": "Health India TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY (TO BE FILLED IN BLOCK LETTERS)",
  "header": [
   "HEALTH INDIA TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D: Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J.Currently do you have any other mediclaim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "A: Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "B. Contact Number"
   },
   {
    "key": "illness",
    "label": "C: Nature of Illness / Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E:Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration l"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code J"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency / planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis vii Cancer"
   },
   {
    "key": "chronicCancer",
    "label": "Asthma / COPD / Bronchitis vii Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol / Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "c. Registration number with State code: Patient/lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer /T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer /T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company / TPA to contact me / us through mobile/email for any update on this claim\"",
   "c) e-mail Id (optional)",
   "d) Patient's / Insured's Signature: Date: HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged / considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates,the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MOU or applicable laws. HEALTH INDIA INSURANCE TPA SERVICES PVT. LTD. Neelkanth Corporate IT Park, 4th floor, 406-412, Kirol park, Vidyavihar (West) Website : www.healthindiatpa.com, Email ID:- crm@healthindiatpa.com Contact Number:- 022-66867575"
  ]
 },
 {
  "key": "heritage",
  "name": "Heritage Health TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised)",
  "header": [
   "HERITAGE HEALTH TPA",
   "IRDAI License No. 008",
   "a."
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "Contact number"
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/"
   },
   {
    "key": "substanceTest",
    "label": "Vi. Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "Expected number of Days/Stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent + nursing and service charges + patients diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with state code Patient/Insured Name and Signature",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/TPA.",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer/TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "c) e-mail Id (optional)",
   "HOSPITAL DECLARATION a. We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA/Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA/Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates expect costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA/Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MOU or applicable laws."
  ]
 },
 {
  "key": "hitpa",
  "name": "HITPA (Health Insurance TPA of India)",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART -C (REVISED) (TO BE FILLED IN BLOCK LETTERS)",
  "header": [
   "HITPA (HEALTH INSURANCE TPA OF INDIA)"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number of Health insurance TPA of India Ltd"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax of Health insurance TPA of India Ltd"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "hospitalEmail",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a Family Physician: s"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment: ....................... Days"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": ""
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption yesno Yes"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "I Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "i Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form a. Name of the treating doctor: .............................................................................................................",
   "b. Qualification: ..................................................................................................................................",
   "c. Registration number with State code ................................................................................. Patient / Insured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. i agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / TPA.",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA. h.. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\"",
   "d) Patient's / Insured's Signature: ......................................................................................................... Date:............................................................Time: ...........................................................................",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA/insurance Company within 7 days of the patient's discharge. c. we agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take responsibility the sole for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/considered in package.",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and /or take necessary action, as provided under the MOU or applicable laws. 4|Page"
  ]
 },
 {
  "key": "icici-lombard",
  "name": "ICICI Lombard",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised)",
  "header": [
   "ICICI LOMBARD"
  ],
  "footer": [
   "HOSPITAL DECLARATION"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID E-mail ID of Hospital IL NT Code"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "Contact number, if any"
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured Health ID Card Number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/Health ID Card"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and,/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR no."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption Yes No"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": "Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent +"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon +"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the lnsurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer/ TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the lnsure/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/ T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer/ TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer /TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\". Patient's / lnsured's Signature:",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the Insured/Patient/Representative of patients as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TP A/ Insurance Company reserves the right to recover the same from us (the 1etwork Provider) and/or take necessary action, as provided under the MOU or applicable laws. We confirm having read understood and agreed to the Declarations of this form Name of the treating doctor Qualification Registration number with State code Signature of treating doctor Patient/lnsured Name and Sign",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital. 2. Cash Memos from the Hospitals/Chemists supported by proper prescription. 3. Receipt and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner/Surgeon recommending such pathologial Test. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner/Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "icici-pru",
  "name": "ICICI Prudential Life",
  "kind": "Insurer",
  "title": "PRE-AUTHORIZATION REQUEST FORM",
  "header": [
   "ICICI PRUDENTIAL LIFE",
   "Form: P",
   "Contact us: 1860 266 7766",
   "PART - I (To be filled in by Claimant/Patient/Life Assured)",
   "Mandatory Documents Attached (Please tick the relevant box)"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": "Address"
   },
   {
    "key": "hospitalPincode",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Years"
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": "Contact No."
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of corporate"
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact No."
   },
   {
    "key": "illness",
    "label": "Nature of illness / Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation & I or Medical"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "vi.Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of Admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "I OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation Charges `"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable please `"
   },
   {
    "key": "otherExpenses",
    "label": "specify). Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease Hypertension"
   },
   {
    "key": "chronicHypertension",
    "label": "Heart Disease Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations on the reverse of this form a) Name of the treating doctor:",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. Agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TP.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me. 4 . I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A 5 . I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. 6 . I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited. 7 . I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer I TPA.",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization. 2. All valid original documents duty countersigned by the insured I patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. 3. All non medical expenses, OR expenses not relevant to hospitalization or illness, OR expenses disallowed in the Authorization Letter of the TPA / Insurance Co, OR arising out of incorrect information in the pre-authorisation form will be collected from the patient. 4. WE AGREE THAT TPA / INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents. 5. The patient declaration has been signed by the patient or by his representative in our presence. 6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. 7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM",
   "1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "iffco-tokio",
  "name": "IFFCO Tokio General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "IFFCO TOKIO GENERAL INSURANCE"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free Fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of the Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "hospitalPincode",
    "label": "Pin Code"
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": "Insured ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Name of the family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact No"
   },
   {
    "key": "illness",
    "label": "Nature of ILLNESS / Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation & / Medical"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": "No III) Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to police"
   },
   {
    "key": "firNo",
    "label": "No Fir No. No (If yes, attach reports)"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury Disease caused due to substance abuse / alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "lmp",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon"
   },
   {
    "key": "medicinesCost",
    "label": "Cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": "Medicines+Consumables. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": ") All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": ") Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes Heart Disease Hypertension"
   },
   {
    "key": "chronicHeart",
    "label": "Diabetes Heart Disease Hypertension"
   },
   {
    "key": "chronicHypertension",
    "label": "Diabetes Heart Disease Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE 1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the insurer/TPA after discharge. I agree to sign on the Final Bill & the Discharge Summary before my discharge. 2. Payment to hospital is governed by the terms and conditions of the policy. In case the insurer/TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy 3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me. In case any clarification is needed on admissibility of a particular item, I shall contact TPA Toll Free Number on this form. 4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/TPA 5. I agree and understand that T. P.A is in no way warranting the service of the hospital & that the Insurer/TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. 6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment, my right to claim reimbursement of the said expenses shall be absolutely forfeited. I further declare that, in respect of the above treatment, no benefits are admissible under any other Medical Scheme or Insurance. 7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA. 8. I authorize Insurer/TPA to view my medical & nursing records, investigation reports, medicines given, their bills etc.; and to collect their photocopies. Patient's / insured's Name: Contact Number: Patient's/ insured's signature: HOSPITAL DECLARATION 1. We have no objection to any authorized TPA/ Insurance company official verifying documents pertaining to hospitalization. 2. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA/ Insurance company within 7 days of the patient's discharge. 3. All non-medical expenses OR expenses not relevant to hospitalization or illnesses OR expenses disallowed in the Authorization Letter of the TPA/ Insurance Co. OR arising out of incorrect information in the pre-authorization form will be collected from the patient. 4. We agree that TPA/ insurance company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents. 5. The patient declaration has been signed by the patient or by his representative in our presence. 6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. 7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED IN ORIGINAL BY THE HOSPITAL IN SUPPORT OF CLAIM (DURING CLAIM SUBMISSION)",
   "1. Detailed Discharge Summary and all Bills from the hospital <<In IRDA prescribed format>> 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "indusind-reliance",
  "name": "IndusInd (Reliance) General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "INDUSIND (RELIANCE) GENERAL INSURANCE"
  ],
  "footer": [
   "indusindinsurance.com",
   "022 4890 3009 (Paid)",
   "74004 22200 (WhatsApp)"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital Hospital email ID"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Hospital ID ROHINI ID"
   },
   {
    "key": "patientName",
    "label": "Name of the patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Insurer Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family Physician if yes name"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of insured patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/ alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission o Emergency o Planned"
   },
   {
    "key": "admissionType",
    "label": "Time of admission o Emergency o Planned"
   },
   {
    "key": "expectedDays",
    "label": "Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "1 Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "2 Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "3 Hypertension 4 Hyperlipidemias"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "3 Hypertension 4 Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "5 Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": "7 Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "8 Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "9 Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "10 Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (PLEASE READ VERY CAREFULLY) We confirm having read understood and agreed to the declarations on the reverse of this form",
   "a. Name of the treating doctor",
   "b. Qualification",
   "c. Registration number with State code",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard. Download Now",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/ TPA.",
   "h. I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim",
   "c) E-mail Id (optional) Date: Place: Patient's / Insured's Signature",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization. 2. All valid original documents duly countersigned by the insured patient as per the checklist below will be sent to TPA/ lnsurance Company within 7 days of the patient's discharge. 3. We agree that TPA / Insurance Company will not be Liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents. 4. The patient declaration has been signed by the patient or by his representative in our presence. 5. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. 6. We will abide by the terms and conditions agreed in the MOU. 7. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/ considered in package). 8. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package). 9. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA/ Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws. 10. Any change in Diagnosis/Treatment plan should be intimated before discharge of patient. 11. If clinical details provided are insufficient, Insurer/TPA may delay the authorization or denial for cashless access. 12. As per IRDAI any claimed amount above 1 lac, Pan card of the Insured/Policy holder/Proposer is mandatory and below 1 lac, Photo identity proof is mandatory. Doctor Signature HEALTH CARE ADDRESS: Health Care Unit: IndusInd General Insurance, No.1-89/3/B/40 to 42/ks/301, 3rd floor, Krishe Block, Krishe Sapphire, Madhapur, Hyderabad - 500081. Email: healthcare@indusindinsurance.com. Download Now"
  ]
 },
 {
  "key": "kotak",
  "name": "Kotak Mahindra General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR MEDICAL INSURANCE POLICY",
  "header": [
   "KOTAK MAHINDRA GENERAL INSURANCE",
   "FAMILY HEALTH PLAN (TPA) LTD"
  ],
  "footer": [
   "_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": "Contact number, if any"
   },
   {
    "key": "altContactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": ""
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": "Nature of ILLNESS / Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "FIR No"
   },
   {
    "key": "substanceAbuse",
    "label": ""
   },
   {
    "key": "substanceTest",
    "label": ""
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics."
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants Other Hospital expenses if any"
   },
   {
    "key": "otherExpenses",
    "label": "Medicines + Consumables + Cost of Implants Other Hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease Hypertension Hyperlipidemias Osteoarthritis"
   },
   {
    "key": "chronicHypertension",
    "label": "Heart Disease Hypertension Hyperlipidemias Osteoarthritis"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Heart Disease Hypertension Hyperlipidemias Osteoarthritis"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Heart Disease Hypertension Hyperlipidemias Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other Ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations on the reverse of this form A) Name of the treating doctor: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ B) Qualification: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ C) Registration No. with State Code: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "5. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA. A) Patient's / Insured's Name: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ B) Contact number: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ C) Patient's / Insured's Signature: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization. 2. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. 3. All non-medical expenses, OR expenses not relevant to hospitalization or illness, OR expenses disallowed in the Authorization Letter of the TPA / Insurance Co, OR arising out of incorrect information in the pre-authorization form will be collected from the patient. 4. WE AGREE THAT TPA / INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents. 5. The patient declaration has been signed by the patient or by his representative in our presence. 6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. 7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM",
   "1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "liberty",
  "name": "Liberty General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE",
  "header": [
   "LIBERTY GENERAL INSURANCE",
   "POLICY PART - C (Revised)"
  ],
  "footer": [
   "Liberty General Insurance Limited 10th Floor, Tower A, Peninsula Business Park, Ganpatrao Kadam Marg, Lower Parel, Mumbai - 400 013 Phone: +91 22 6700 1313 Fax: +91 22 6700 1606 Email: care@libertyinsurance.in IRDA of India registration number: 150 l CIN: U66000MH2010PLC209656",
   "Trade Logo displayed above belongs to Liberty Mutual and used by the Liberty General Insurance Limited under license.",
   "Please send your cashless requests at Preauth@Libertyinsurance.in. For any further queries please contact: Liberty General Insurance Limited, Liberty Health 360, The Capitol, 3rd Floor New DP road, Pune 411027. Phone 020-67125757"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA / Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free FAX"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number / Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "I. Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of ILLNESS / Disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation & / or Medical"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "In case of accident. II) Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse / alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity G"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / a planned hospitalization event? Emergency"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (If applicable"
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other Ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations on the reverse of this form",
   "DECLARATION BY THE PATIENT I REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer /T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer/ TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the lnsurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/ T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer/ TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer /TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "c) e-mail Id (optional) : Patient's / lnsured's Signature : HOSPITAL DECLARATION a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured I patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole respons1b1hty for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package). I. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TP A/ Insurance Company reserves the right to recover the same from us (the 1etwork Provider) and/or take necessary action, as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "linkk",
  "name": "Link K TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised) (TO BE FILLED IN BLOCK LETTERS)",
  "header": [
   "LINK K TPA",
   "a."
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA / lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini id"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "Contact number"
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness / Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and / or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse / alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "Expected number of Days / stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "iX. Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "X. Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with State code Patient / lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer / TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amount over & above the limit authorized by the Insurer / T.P.A. not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A.",
   "e. I agree and understand that T.P.A. is in no way warranting the service of the hospital & that the Insurer / TPA is no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, Suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the insurer / TPA.",
   "h. \"I/We authorize Insurance Company / TPA to contact me/us through mobile/email for any update on this claim\"",
   "c) Patient's / Insured's Signature: email-Id (optional)",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence. e We agree to provide clarifications for the queries raised regarding this hospitalization and we take responsibility the sole for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package). i . In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and / or take necessary action , as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "magma-hdi",
  "name": "Magma HDI General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "MAGMA HDI GENERAL INSURANCE"
  ],
  "footer": [
   "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised)"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "F. Contact Number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy Number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "TO BE FILLED BY TREATING DOCTOR/HOSPITAL A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H. If investigation and/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "N. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "DETAILS OF PATIENT ADMITTED A. Date of admission B. Time of admission"
   },
   {
    "key": "admissionTime",
    "label": "DETAILS OF PATIENT ADMITTED A. Date of admission B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "O. All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form a. Name of the treating doctor b. Qualification:",
   "c. Registration number with State code Patient/Insured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer /TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company/TPAto contact me/us through mobile/email for any update on this claim\". 3",
   "d) Patient's / Insured's Signature: c) e-mail Id (optional) Date: Time:",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA/ Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non- admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. Magma General Insurance Limited (erstwhile Magma HDI General Insurance Company Limited) | www.magmainsurance.com | E-mail: customercare@magmainsurance.com | Toll Free: 1800 266 3202 | Registered Office: Equinox Business Park, Tower 3, Ambedkar Nagar, 2nd Floor, Unit Number 1B & 2B, LBS Marg, Kurla (West), Mumbai - 400070, Maharashtra, India. | CIN: U66000MH2009PLC460693 | IRDAI Reg. No. 149 | Trade Logo displayed above belongs to Magma Ventures Private Limited and is used by Magma General Insurance Limited under license. | Chat with MIRA on our website or say \"Hi\" on WhatsApp No. 7208976789 (CF.PC.Comm.ver21.11.25) 4"
  ]
 },
 {
  "key": "manipal-cigna",
  "name": "ManipalCigna Health Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised)",
  "header": [
   "ManipalCigna Health Insurance Company Limited (Formerly known as CignaTTK Health Insurance Company Limited) CIN U66000MH2012PLC227948 | IRDAI Reg. No. 151 Reg. Office: 401/402, 4th Floor, Raheja Titanium, off. Western Express Highway, Goregaon (East), Mumbai- "
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll Free Phone Number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Years"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact Number of Attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured Card ID Number"
   },
   {
    "key": "policyNo",
    "label": "Policy Number / Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "i ) Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a Family Physician"
   },
   {
    "key": "patientAddress",
    "label": "Current address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the Treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact Number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness / Disease with Presenting Complaints"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the Present Ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First Consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past History of Present Ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional Diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed Line of Treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation and / or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of Surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other Treatments, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did Injury Occur?"
   },
   {
    "key": "isRta",
    "label": "Is it RTA?"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to Substance Abuse / Alcohol Consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of Admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an Emergency / a Planned Hospitalisation Event?"
   },
   {
    "key": "expectedDays",
    "label": "Expected No. of Days Stay in Hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected Cost for Investigation + Diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional Fees Surgeon + Anesthetist Fees + Consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable, please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All Inclusive Package Charges, if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total Expected Cost of Hospitalisation"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD / Related Ailments"
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION: (Please read very carefully) We confirm having read, understood and agreed to the Declarations portion of this form.",
   "F I R S T NAME MIDDLE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalisation to the Insurer / TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the Terms and Conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the Terms and Conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalisation and the amounts over & above the limit authorised by the Insurer / TPA not governed by the Terms and Conditions of the policy will be paid by me.",
   "4. I hereby declare to abide by the Terms and Conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect, I forfeit my claim and agree to indemnify the Insurer / TPA.",
   "5. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "8. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "F I R S T NAME M I D D L E NAME",
   "c) Patient's / Insured's Signature: Email ID (optional) : : : HOSPITAL DECLARATION:",
   "1. We have no objection to any authorised TPA / Insurance Company official verifying documents pertaining to hospitalisation.",
   "2. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "3. We agree that tpa / insurance company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "4. The patient declaration has been signed by the patient or by his representative in our presence.",
   "5. We agree to provide clarifications for the queries raised regarding this hospitalisation and we take the sole responsibility for any delay in offering clarifications.",
   "6. We will abide by the Terms and Conditions agreed in the MOU.",
   "7. We confirm that no additional amount would be collected liom the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/considered in package).",
   "8. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "9. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates,the adhorized TPA / Insurance Company reserves the right to recoverthe same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws. Date : Time :",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital, duly signed by the Patient/Representative. 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Diagnostic Tests Reports and Receipts supported by note from the attending Medical Practitioner/Surgeon recommending such Diagnostic Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon giving the patient's condition and advice on discharge."
  ]
 },
 {
  "key": "mdindia",
  "name": "MDIndia Health Insurance TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised)",
  "header": [
   "MDINDIA HEALTH INSURANCE TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/ lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient B. Gender"
   },
   {
    "key": "gender",
    "label": "A. Name of the Patient B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": "G. lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": ""
   },
   {
    "key": "familyPhysician",
    "label": ""
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H: If investigation and,/or Medical Management, provide"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I: lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J: If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": ""
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma./COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer viii . Alcohol/Drug abuse"
   },
   {
    "key": "chronicAlcohol",
    "label": "Cancer viii . Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form a. Name of the treating doctor b. Qualification:",
   "c. Registration number with State code Patient / lnsured Name",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/ TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\" a) Patient's / Insured's Name:",
   "d) Patient's / Insured's Signature: Time:_",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA/ lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take responsibility the sole for any delay in offering clarifications",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. ."
  ]
 },
 {
  "key": "medsave",
  "name": "MedSave Health Insurance TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART -- C",
  "header": [
   "MEDSAVE HEALTH INSURANCE TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID iii.e-mail id"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": ""
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "M: Contact number, if any"
   },
   {
    "key": "altContactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other med claim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N: Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O: Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A: Name of the treating Doctor: B: Contact number"
   },
   {
    "key": "doctorContact",
    "label": "A: Name of the treating Doctor: B: Contact number"
   },
   {
    "key": "illness",
    "label": "C: Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H: If investigation and/or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I: If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J: If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur L: In case of accident"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon +Anesthetist Fees +consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with State code Patient/Insured Name and Sign 3|Page",
   "DECLARATION BY THE PATIENT I REPRESENTATIVE",
   "a. 1 agrees to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer /TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA /Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the between the facts in this form and discharge summary or other documents",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA /Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. 4|Page"
  ]
 },
 {
  "key": "medi-assist",
  "name": "Medi Assist Insurance TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "MEDI ASSIST INSURANCE TPA",
   "PART C (Revised)"
  ],
  "footer": [
   "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY",
   "TO BE FILLED IN BLOCK LETTERS",
   "Page 1 of 2 | Version: 25.06.2019"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": "Toll Free Fax no."
   },
   {
    "key": "hospitalName",
    "label": "Name of the hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Years"
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": "Contact no."
   },
   {
    "key": "insuredCardId",
    "label": "Insurer ID card no."
   },
   {
    "key": "policyNo",
    "label": "Policy number/Name of corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other medical claim/health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Insurer name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician, if yes"
   },
   {
    "key": "patientAddress",
    "label": "Address of insured patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact no."
   },
   {
    "key": "illness",
    "label": "Name of Illness/disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "days e.1) Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and/or medical management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "Non-Allopathic treatment i.1) ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police"
   },
   {
    "key": "firNo",
    "label": "FIR no."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this, If yes attach reports"
   },
   {
    "key": "maternity",
    "label": "In case of maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "an emergency/ f ) Room type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist fees + Consultation charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/ COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol or drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD / related ailments"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION (PLEASE READ VERY CAREFULLY) We confirm having read understood and agreed to the declaration of this form",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / TPA",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/ TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\"",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA/ Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be Liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/ considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MOU or applicable laws.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM",
   "1. Detailed Discharge Summary and all Bills from the hospital. 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, Supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of Operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "navi",
  "name": "Navi General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY",
  "header": [
   "NAVI GENERAL INSURANCE",
   "PLEASE FAX / SCAN PAGE 1 ONLY (PART C)"
  ],
  "footer": [
   "Navi special care | Cashless Request FormI UIN NAVHLIP24030V012324 Registered & Corporate Office: Navi General Insurance Limited ((Formerly known as DHFL General Insurance Limited)",
   "Vaishnavi Tech Square, 7th Floor, Iballur Village, Begur Hobli, Bengaluru, Karnataka- 560102 Toll-free number: 1800 123 0004 | Website: www.navi.com/Insurance | Email: insurance.help@navi.com",
   "CIN: U66000KA2016PLC148551 | IRDAI Registration Number: 155"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA / Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll Free Phone Number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll Free FAX"
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy Number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim/Health Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have family physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact Number"
   },
   {
    "key": "illness",
    "label": "Nature of illness/ disease"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation &/or Medical"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, Name of Surgery"
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments, provide"
   },
   {
    "key": "injuryHow",
    "label": "How did injury"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Reported to Police Yes No"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse Yes No"
   },
   {
    "key": "substanceTest",
    "label": "Test Conducted to establish this Yes No (If Yes, attach reports)"
   },
   {
    "key": "maternity",
    "label": "In case of maternity G P L A"
   },
   {
    "key": "expectedDelivery",
    "label": "Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/a planned hospitalisation Emergency"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional Fees+ Anaesthetist Fees+"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of implants"
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalisation"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other ailments, provide details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read, understood and agreed to the Declarations.",
   "c) (IMPORTANT - PLEASE TURN OVER) Hospital Seal (Must include Hospital Id) (PLEASE READ VERY CAREFULLY) Registration No. with State Code :",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalisation to the Insurer/TPA after the discharge. I agree to sign the Final Bill & Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalisation and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / TPA.",
   "5. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalisation. 2. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. 3. All non-medical expenses OR expenses not relevant to hospitalization or illness, OR expenses disallowed in the Authorisation Letter of the TPA / Insurance Co., OR arising out of incorrect information in the pre-authorisation form will be collected from the patient. 4. WE AGREE THAT TPA / INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents. 5. The patient declaration has been signed by the patient or by his representative in our presence. 6. We agree to provide clarifications for the queries raised regarding this hospitalisation and we take the sole responsibility for any delay in offering clarifications. 7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM",
   "1. Detailed Discharge Summary and all Bills from the hospital. 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner I Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured."
  ]
 },
 {
  "key": "niva-bupa",
  "name": "Niva Bupa Health Insurance",
  "kind": "Insurer",
  "title": "Request for Cashless Hospitalisation for Health Insurance Policy Part - C",
  "header": [
   "NIVA BUPA HEALTH INSURANCE",
   "a) Name of lnsurance company:",
   "N I VA BUPA HEAL TH I NSURACE",
   "b) Customer helpline number:",
   "1 860 500 8888"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": "Fax no./email Id"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "ROHINI ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number & name of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "J. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "K. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "L. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "M. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "H. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "I. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "TO BE FILLED BY TREATING DOCTOR/HOSPITAL A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H. If investigation &/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I. If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": "J. If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K. How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "(iii) Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of days stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per Day Room Rent + Nursing and Service Charges + Patients Diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU Charges (INR)"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges (INR)"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anesthetist Fees + Consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines+ Consumables+ Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "O. All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating Doctor",
   "c. Registration number with State code Patient/Insured Name and Sign",
   "DECLARATION BY THE PATIENT/REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the lnsurer/ T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer/ TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the lnsurer/ T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer/ T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer/ TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/TPA.",
   "h. \"I/We authorize Insurance Company TPA to contact me/us through mobile/email for any update on this claim\".",
   "3. e-mail Id (optional)",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole respons1b1hty for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA/ Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. Niva Bupa Health Insurance Company Limited Registered office:- C-98, First Floor, Lajpat Nagar, Part 1, New Delhi-110024 Disclaimer: Insurance is a subject matter of solicitation. Niva Bupa Health Insurance Company Limited (formerly known as Max Bupa Health Insurance Company Limited) (IRDAI Registration No. 145). `Bupa' and `HEARTBEAT' logo are registered trademarks of their respective owners and are being used by Niva Bupa Health Insurance Company Limited under license. Customer Helpline: 1860-500-8888. Website: www.nivabupa.com. CIN: U66000DL2008PLC182918. For more details on terms and conditions, exclusions, risk factors, waiting period & benefits, please read sales brochure carefully before concluding a sale."
  ]
 },
 {
  "key": "paramount",
  "name": "Paramount Health Services TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY (TO BE FILLED IN BLOCK LETTERS)",
  "header": [
   "PARAMOUNT HEALTH SERVICES TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D: Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": "B. Contact Number"
   },
   {
    "key": "illness",
    "label": "C: Nature of Illness / Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H: If investigation and / or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration l"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J: If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency / planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis vii Cancer"
   },
   {
    "key": "chronicCancer",
    "label": "Asthma / COPD / Bronchitis vii Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol / Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "c. Registration number with State code: Patient/lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer /T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer /T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company / TPA to contact me / us through mobile/email for any update on this claim\"",
   "c) e-mail Id (optional)",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged / considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates,the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MOU or applicable laws. Time Registered office:Plot No.A-442,Road no.28,M.I.D.C.Industrial Area,Wagle Estate,Thane(w),Thane-Maharashtra-400604. Tel-66620808,Fax-66444754/55 , E-mail - contact.phs@paramounttpa.com www.paramounttpa.com"
  ]
 },
 {
  "key": "park",
  "name": "Park Mediclaim TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "PARK MEDICLAIM TPA",
   "REOUEST FOR C",
   "HLESS HOSPITALISATION FOR HE TH INSURANCE",
   "POLICY PART - C (Revised)",
   "a,"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA\"/lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": "A. Name ofth Patient B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "i.Company Name ii.Give Details"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician: L: Name ofthe Family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "O: Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": "B: Contact number"
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (ifyes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "admissionType",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost ofinvestigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses ifany"
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma./COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) we confirm having read understood and agreed to the Declarations ofthis form Name ofthe treating doctor b. Qualification:",
   "c. Resistration number with State code Patient/lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE a I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is govemed by the terms and conditions ofthe policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions ofthe policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not govemed by the terms and conditions ofthe policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions ofthe policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the tnsurer / T.P.A",
   "e. I agree and understand thatT.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be ofa particular quality or standard.",
   "f. I hereby warrant the truth ofthe forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concalment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnifo the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"t/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\" a) Patient's / Insured's Name",
   "d) Patient's / Insured's Signature e-mail Id (optional)",
   "HOSPITAL DECLARATION a We have no objection to any authorized TPA / Insurance Company official veri$,ing documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TpA / lnsurance Company within 7 days ofthe patient,s discharge.",
   "c. we agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence. e we agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected liom the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibilityi choosing separate line oftreatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the dposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line oftreatment which is not envisaged/considered in package). In the event ofunauthorized recovery ofany additional amount from the Insured in excess of Agreed Package Rates, the adhorized TPA / Insurance Company reserves the right to recoverthe same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws. Cashless Authorization Letter (Part-D) Claim l.' umber: (Please quote this number for all further correspondence) Authorization is valid for admission up to (date) Date: DD/MM/YYYY lenC Hospitat .... . looo**. I Rohini ld Name of Insurance Company Name ofTPA Proposer Name Patient's Member ID/TPA,{nsurer Id ofthe Patient Relation with Proposer Dear Sir /Madam , Thishasreferencetothepre-authorizationrequestsubmittedon..........Weherebyauthorizecashlessfacilityasperdetails mentioned below: Patient Name Policy Number lne\" ' Expected Date of Admission lcenaer: Policy Period Expected Date of Discharge Room category Eligible Room Category as per T&C ofPolicy Contract: Provisional Diagnosis Authorization Details:. Estimated length of stay I Proposed line of treatment Date & Tim Referelce number Slatus dd,/mm/yyyy - hh:mm dd,/mm,/yyyy - hh:mm Total Authorized amourlt:- Rs ........( In words ) Authorization Remarks : Hos tal Aereed Ta riff: t. Package case Agreed Package Rat ............................. Il. Non-package Case:",
   "i. Room Rent/day",
   "ii. tCU Rent/day iii. Nursing Charges/day........... Iv. Consultant Visit Charges/day.",
   "v. Surgeon's fee/OT/Anaestheti st",
   "vi. Others (specify) ---Authorization Summan: Total Bill Amount *Other Deductions Discount (INR) (lNR) (At the time of Final Authorization) i (lNR) (At the time of Final Authorization) Co-Pay : (lNR) Deductibles : (lNR) Total Authorised Amount: :(lNR) Amount to be paid by lnsured *Other Deduction Details: : (lNR)(At the time ofFinal Authorization) S.no Description Bill Amount Deducted Amount Admissible Amount Deduction Reason",
   "t. Cashless Authorization letter issued on the basis of information provided in Pre- Authorization form. In case misrepresentation/concealment ofthe facts, any material difference/ deviation/ discrepancy in information is observed in discharge summary/ IPD records then cashless authorization shall stand null & void. At any point of claim processing lnsurer or TPA reserves right to raise queries for any other document to ascertain admissibility of claim.",
   "2. KYC (Know your customer) details of proposer/employee/Beneficiary are mandatory for claim payout above Rs I lakh. 3. Network provider shall not collect any additional amount from the individual in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line oftreatment which is not envisaged/considered in package)'",
   "4. Network provider shall not make any recovery from the deposit amount collected ftom the Insured except for coststowards non-admissible amounts (includingadditional charges due to opting higher room rcnt than eligibility/ choosing separate line oftreatment which is not envisaged/considered in package)'",
   "5. In the event ofunauthorized recovery ofany additional amount from the Insured in excess ofAgreed Package Rates, the authorized TPA / tnsurance Company reserves the right to recover the same or get the same refunded to the policyholder fiom the Network Provider a.nd/or take necessary action, as provided under the MoU.",
   "6. where a treatment/procedure is to be carried out by a doctor/surgeon ofinsured's choice (not empaneled with the hospital), Network Provider may give treatment after obtaining specific consent ofpolicyholder.",
   "7. Differential Costs bome by policyholder may be reimbursed by insurers subject to the terms and conditions ofthe policy.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital",
   "2. Cash Memos from the Hospitals / Chemists supported by proper prescription.",
   "3. Diagnostic Test Reports and Receipts supported by notc from the attending Medical Practitioner / Surgeon recommending such Diagnostic supponed by note from the attending Medical Practitioner/ Surgeon recommending such diagnostic tests.",
   "4. Surgeon's Certificate stating nature ofoperation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon giving patient's condition and advice on discharge Name ofthe Product.......and UIN No ........: - lmDortant Policv terms & conditions (sub-limits/co-Day/deductible etc) Aulhorized signatory (Insurer/TPA) Address:"
  ]
 },
 {
  "key": "raheja-qbe",
  "name": "Raheja QBE (Raheja QBI) General Insurance",
  "kind": "Insurer",
  "title": "Claim Form Part - C \"Request for Cashless Hospitalisation For Health Insurance Policy\" (To be filled in block letters)",
  "header": [
   "RAHEJA QBE (RAHEJA QBI) GENERAL INSURANCE"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "A. Name of TPA/insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other Mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H. If investigation and,/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I. If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J. If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K. How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": "consultation Charges M. Medicines + Consumables + Cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma./COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "Declaration (Please read very carefully) Days Days we confirm having read understood and agreed to the Declarations of this form a) Name of the treating doctor b) Qualification",
   "c) Registration number with State code Patient/ insured Name and Sign Declaration By The Patient / Representative",
   "a) I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b) Payment to hospital is governed by the terms and conditions of the policy. In case the insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c) All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by",
   "d) I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A e) I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f) I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g) I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h) \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\"",
   "d) Patient's / Insured's Signature: Hospital Declaration",
   "a) We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b) All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA insurance Company within 7 days of the patient's discharge.",
   "c) We agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d) The patient declaration has been signed by the patient or by his representative in our presence.",
   "e) We agree to provide clarifications for the queries raised regarding this hospitalization and we take responsibility the sole for any delay in offering clarifications.",
   "f) We will abide by the terms and conditions agreed in the MOU.",
   "g) We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/considered in package).",
   "h) We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i) In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws. Documents To Be Provided By The Hospital In Support Of The Claim",
   "1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Diagnostic Test Reports and Receipts supported by note from the attending Medical Practitioner / Surgeon recommending such Diagnostic supported by note from the attending Medical Practitioner/ Surgeon recommending such diagnostic tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon giving patient's condition and advice on discharge Name of the Product.......and UIN No ........: - lmportant Policy terms & conditions (sub-limits/coDay/deductible etc) Authorized signatory (Insurer/TPA) Address:"
  ]
 },
 {
  "key": "raksha",
  "name": "Raksha TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART -- C (Revised)",
  "header": [
   "Raksha"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E: Duration of the present ailment ----------------------Days"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": ""
   },
   {
    "key": "lineOfTreatment",
    "label": "G: Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": ""
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date Of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report"
   },
   {
    "key": "maternity",
    "label": "M. In Case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "admissionType",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "G. Room Type H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "roomRent",
    "label": "G. Room Type H. Per day room rent + nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges K. OT charges"
   },
   {
    "key": "otCharges",
    "label": "J. ICU charges K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anaesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "c. Registration number with State code Raksha Patient/Insured Name and Sign 4",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE Raksha",
   "a) Iaagree to allow the hospital to submit all original documents pertaining to hospitalization to the . Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge. b)Pbayment to hospital is governed by the terms and conditions of the policy. In case the Insurer / . TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c) All non-medical expenses and expenses not relevant to current hospitalization and the c . amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me. d)Idhereby declare to abide by the terms and conditions of the policy and if at any time the facts . disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e) Ieagree and understand that T.P.A is in no way warranting the service of the hospital & . that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f) Ifhereby warrant the truth of the forgoing particulars in every respect and I agree that if I have . made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited. g)I agree to indemnify the hospital against all expenses incurred on my behalf, which are not g . reimbursed by the Insurer / TPA. h)\"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update h on this claim\". .",
   "d) Patient's / Insured's Signature: ----------------------------------------------------------------Date: --------------------------------- Time: ---------------------------------",
   "HOSPITAL DECLARATION",
   "a) We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization. a .",
   "b) All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge. b .",
   "c) We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents. . dc) The patient declaration has been signed by the patient or by his representative in our presence.",
   "e) We agree to provide clarifications for the queries raised regarding this hospitalization and d we take the sole responsibility for any delay in offering clarifications. .",
   "f) We will abide by the terms and conditions agreed in the MOU. e . 5 .",
   "g) We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility. choosing separate line of treatment which is not envisaged/considered in package).",
   "h) We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package).",
   "i) In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates,the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "royal-sundaram",
  "name": "Royal Sundaram General Insurance",
  "kind": "Insurer",
  "title": "PLEASE FAX/SCAN PAGE 1 & 2 ONLY REQUEST FOR CASHLESS HOSPITALISATION FOR MEDICAL INSURANCE POLICY",
  "header": [
   "ROYAL SUNDARAM GENERAL INSURANCE"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "DETAILS OF THE THIRD PARTY ADMINISTRATOR/INSURER Name of the Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free FAX"
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Year"
   },
   {
    "key": "dob",
    "label": "Date of birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim/Health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "DETAILS OF THE THIRD PARTY ADMINISTRATOR/INSURER Name of the Insurance Company"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician Yes No"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If Investigation & or Medical Management provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If any other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA Yes No"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "FIR No"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "vi.Test conducted to establish this"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "A Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency/planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing &"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation Rs."
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees-Surgeon+"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + please specify) Cost of Implants (if applicable Rs."
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable Rs."
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization Rs."
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": "Any other Ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION We confirm having read understood and agreed to the Declarations attached along with this form",
   "MIDDLE NAME",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "2. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/TPA not governed by the terms and conditions of the policy will be paid by me.",
   "4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / TPA",
   "5. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the foregoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "7. I further declare that in respect of the above treatment no benefit is admissible under any other medical insurance scheme other than the one stated by me. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "HOSPITAL DECLARATION",
   "1. We have no objection to any authorized TPA/Insurance Company official verifying documents pertaining to hospitalization.",
   "2. All valid original documents duly countersigned by the insured/ patient as per the checklist below will be sent to TPA/Insurance Company within 7 days of the patient's discharge.",
   "3. All non medical expenses , OR expenses not relevant to hospitalization or illness, OR expenses disallowed in the Authorization Letter of the TPA / Insurance Co, OR arising out of incorrect information in the pre-authorisation form will be collected from the patient.",
   "4. WE AGREE THAT TPA / INSURANCE COMPANY WILL NOT BE LIABLE TO MAKE THE PAYMENT IN THE EVENT OF ANY DISCREPANCY BETWEEN THE FACTS IN THIS FORM AND DISCHARGE SUMMARY or other documents.",
   "5. The patient declaration has been signed by the patient or by his representative in our presence.",
   "6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications. We also agree to provide copies of indoor case record and any other relevant medical record if sought by Insurer/TPA",
   "7. We will abide by the terms and conditions agreed in the MOU.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM",
   "1. Detailed Discharge Summary and all Bills from the hospital (Summary bill, Itemised bill). 2. Cash Memos from the Hospitals/Chemists supported by proper prescription, receipts. 3. Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner/Surgeon recommending such pathological Tests including X-ray and scan films. 4. Break up of package charges if any 5. KYC document obtained from insured as per AML guidelines prescribed by Government of India. 6. Patient declaration and hospital declaration statement. 7. TDS exemption details if any. Royal Sundaram Alliance Insurance Company Limited Corporate Office: Sundaram Towers, 45 & 46, Whites Road, Chennai-600 014. Registered Office: 21, Patullos Road, Chennai - 600 002. 1860 425 0000 customer.services@royalsundaram.in www.royalsundaram.in"
  ]
 },
 {
  "key": "safeway",
  "name": "Safeway (Health Assist) TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART-C (Revised)",
  "header": [
   "SAFEWAY (HEALTH ASSIST) TPA"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA/Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll Free Phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll Free Fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini Id"
   },
   {
    "key": "patientName",
    "label": "A. Name of The Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": "D. Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "E. Contact Number"
   },
   {
    "key": "altContactNo",
    "label": "F. Contact Number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. Insured Card Id Number"
   },
   {
    "key": "policyNo",
    "label": "H. Policy Number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other Mediclaim/health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "B. Contact number"
   },
   {
    "key": "illness",
    "label": "C. Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "H. If investigation and/or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "I. If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "J. If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "K. How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury/Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "M. In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment give details"
   }
  ],
  "declaration": [
   "DECLARATION (Mandatory) (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "c. Registration number with State Code Patient/Insured Name and Sign 4|P a g e",
   "DECLARATION BYF THE PATIENT /REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer /TPA not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer /TPA.",
   "e. I agree and understand that TPA is in no way warranting the service of the hospital & that the Insurer/TPA is not way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer/TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "i. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA/ Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. Date & Time: 5|P a g e"
  ]
 },
 {
  "key": "sbi-general",
  "name": "SBI General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "SBI GENERAL INSURANCE",
   "Hospital ID :"
  ],
  "footer": [
   "REQUESTFORCASHLESS HOSPITALISATION PART C (Revised)",
   "TO BE FILLED IN BLOCK LETTERS ONLY"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": "Toll Free no."
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of the hospital"
   },
   {
    "key": "hospitalAddress",
    "label": "Hospital Location"
   },
   {
    "key": "rohiniId",
    "label": "ROHINIID"
   },
   {
    "key": "patientName",
    "label": "Name of the patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: Years"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "contact No."
   },
   {
    "key": "insuredCardId",
    "label": "Insurer ID Card No."
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other medical claim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": ""
   },
   {
    "key": "familyPhysician",
    "label": "Do you have family physician, if yes"
   },
   {
    "key": "patientAddress",
    "label": "Address of insured patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating doctor"
   },
   {
    "key": "doctorContact",
    "label": "contact No."
   },
   {
    "key": "illness",
    "label": "Name of illness / disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Days e.1) Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and/or medical management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration IV Oral Other"
   },
   {
    "key": "surgeryName",
    "label": "If surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatments, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this, if yes attach report"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of delivery"
   },
   {
    "key": "admissionDate",
    "label": "DETAILS OF PATIENT ADMITTED A) Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "PerDayRoom Rent+Nursing & Servicecharges+Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost for investigation + diagnostics"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist fees + Consultation charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables cost of Implants"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol or drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV or STD / Related Ailments"
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "DECLARATION (PLEASE READ VERY CAREFULLY) We confirm having read understood and agreed to the declaration of this form",
   "a. Name of the treating doctor",
   "b. Qualification",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "g. h.",
   "c. Patient's / Insured's Signature HOSPITAL DECLARATION a. b. c.",
   "d. e. f. g.",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. 2. 3."
  ]
 },
 {
  "key": "star-health",
  "name": "Star Health and Allied Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED",
   "Regd. & Corporate Office: 1, New Tank Street, Valluvar Kottam High Road, Nungambakkam, Chennai - 600 034. Corporate Office - Claims Dept : No.15, Sri Balaji Complex, Whites Lane, Royapettah, Chennai - 600 014. Phone : 044 - 2828 8800 CIN : L66010TN2005PLC05664"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": ""
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": ""
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": ""
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": ""
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": ""
   },
   {
    "key": "otherInsurance",
    "label": ""
   },
   {
    "key": "familyPhysician",
    "label": ""
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": ""
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": ""
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": ""
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": ""
   },
   {
    "key": "icd10",
    "label": ""
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": ""
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": ""
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": ""
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": ""
   },
   {
    "key": "firNo",
    "label": ""
   },
   {
    "key": "substanceAbuse",
    "label": ""
   },
   {
    "key": "substanceTest",
    "label": ""
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": ""
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": ""
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": ""
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": ""
   },
   {
    "key": "investigationCost",
    "label": ""
   },
   {
    "key": "icuCharges",
    "label": ""
   },
   {
    "key": "otCharges",
    "label": ""
   },
   {
    "key": "professionalFees",
    "label": ""
   },
   {
    "key": "medicinesCost",
    "label": ""
   },
   {
    "key": "otherExpenses",
    "label": ""
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": ""
   },
   {
    "key": "chronicHeart",
    "label": ""
   },
   {
    "key": "chronicHypertension",
    "label": ""
   },
   {
    "key": "chronicHyperlipidemia",
    "label": ""
   },
   {
    "key": "chronicOsteoarthritis",
    "label": ""
   },
   {
    "key": "chronicAsthma",
    "label": ""
   },
   {
    "key": "chronicCancer",
    "label": ""
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [],
  "scanned": true
 },
 {
  "key": "tata-aig",
  "name": "Tata AIG General Insurance",
  "kind": "Insurer",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C",
  "header": [
   "TATA AIG GENERAL INSURANCE"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": "A. Name of the Patient"
   },
   {
    "key": "gender",
    "label": "B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": "M.Contact number, if any"
   },
   {
    "key": "altContactNo",
    "label": ""
   },
   {
    "key": "insuredCardId",
    "label": ""
   },
   {
    "key": "policyNo",
    "label": "H. Policy number/Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "I. Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "J. Currently do you have any other mediclaim/health insurance"
   },
   {
    "key": "familyPhysician",
    "label": "K. Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": "N. Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "O. Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "A. Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "B. Contact number"
   },
   {
    "key": "illness",
    "label": "C. Nature of Illness/Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "E. Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": ""
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F. Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "G. Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": ""
   },
   {
    "key": "surgeryName",
    "label": "I. If surgical, name of surgery ICD 10 PCS code"
   },
   {
    "key": "icd10pcs",
    "label": "I. If surgical, name of surgery ICD 10 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": ""
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": "Date of Injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "expectedDelivery",
    "label": "Expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission Planned"
   },
   {
    "key": "admissionType",
    "label": "C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": "G. Room Type"
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent + nursing and service charges + patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon +Anesthetist Fees +consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "O. All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "P. Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "b. Qualification",
   "c. Registration number with State code Patient/Insured Name and Sign",
   "DECLARATION BY THE PATIENT I REPRESENTATIVE",
   "a. I agrees to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer /TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / T.P.A",
   "e. I agree and understand that T.P.A is in no way warranting the service of the hospital & that the Insurer /TPA is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"I/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\".",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA /Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured/patient as per the checklist below will be sent to TPA / Insurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be liable to make the payment in the between the facts in this form and discharge summary or other documents d. The patient declaration has been signed by the patient or by his representative in our presence.",
   "e. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards nonadmissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the Insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line of treatment which is not envisaged/considered in package). I. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA /Insurance Company reserves the right to recover the same from us (the Network Provider) and/or take necessary action, as provided under the MoU or applicable laws. Tata AIG General Insurance Company Limited Registered Office: Peninsula Business Park, Tower A, 15th Floor, G. K. Marg, Lower Parel, Mumbai - 400 013. 24X7 Toll Free No: 1800 266 7780 or 1800 22 9966 (For Senior Citizens) Fax: 022-6693 8170 Email: customersupport@tataaig.com Website: www.tataaig.com IRDA of India Registration No.: 108 CIN: U85110MH2000PLC128425"
  ]
 },
 {
  "key": "universal-sompo",
  "name": "Universal Sompo General Insurance",
  "kind": "Insurer",
  "title": "Request for Cashless Hospitalisation for Health Insurance Policy (PART C)",
  "header": [
   "Email ID: healthserve@universalsompo.com"
  ],
  "footer": [
   "(IMPORTANT: PLEASE TURN OVER)"
  ],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of the Insurance Company"
   },
   {
    "key": "tollFreePhone",
    "label": ""
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of the Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "ROHINI ID"
   },
   {
    "key": "hospitalEmail",
    "label": ""
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age: years"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending relative"
   },
   {
    "key": "insuredCardId",
    "label": "Insured card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other Mediclaim / Helath Insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family physician?"
   },
   {
    "key": "patientAddress",
    "label": "Current Address of Insured Patient"
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured Patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of illness/ disease with presenting complaints"
   },
   {
    "key": "clinicalFindings",
    "label": "Relevant clinical findings"
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of first consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 Code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation & / or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of drug administration"
   },
   {
    "key": "surgeryName",
    "label": "If Surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD 10 PCS Code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did the injury occur?"
   },
   {
    "key": "isRta",
    "label": "Is it RTA?"
   },
   {
    "key": "injuryDate",
    "label": "Date of injury"
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR No."
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse /alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to extablish this?"
   },
   {
    "key": "maternity",
    "label": "In case of maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "Expected Date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": ""
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / a planned hospitalization event?"
   },
   {
    "key": "expectedDays",
    "label": ""
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per Day Room Rent + Nursing & Service Charges + Patient's Diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU Charges"
   },
   {
    "key": "otCharges",
    "label": "OT Charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees +"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of implants (if applicable,"
   },
   {
    "key": "otherExpenses",
    "label": "please specify), other hospital expenses, if any"
   },
   {
    "key": "packageCharges",
    "label": "All inclusive package charges, if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart Disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicAsthma",
    "label": "Osteoarthritis Asthma / COPD / Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": ""
   },
   {
    "key": "chronicHiv",
    "label": ""
   },
   {
    "key": "chronicOther",
    "label": ""
   }
  ],
  "declaration": [
   "c) Registration number with state code: Patient / Insured Name & Signature",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "1. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Universal Sompo General Insurance Company Ltd after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge. 2. Payment to hospital is governed by the terms and conditions of the policy. In case the Universal Sompo General Insurance Company Ltd is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy. 3. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Universal Sompo General Insurance Company Ltd not governed by the terms and conditions of the policy will be paid by me. In case any clarification is needed on admissibility of a particular item I shall contact Insurance Company at the Toll Free Number on the reverse of this form.",
   "4. I hereby declare to abide by the terms and conditions of the policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Universal Sompo General Insurance Company Ltd.",
   "5. I agree and understand that Insurer is in no way warranting the service of the hospital & that the Universal Sompo General Insurance Company Ltd is in no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "6. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concealment, my right to claim reimbursement of the said expenses shall be absolutely forfeited. I further declare that, in respect of the above treatment, no benefits are admissible under any other Medical Scheme or Insurance.",
   "7. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the Universal Sompo General Insurance Company Ltd.",
   "8. I/We authorize Universal Sompo General Insurance Company Ltd to contact me/us through mobile/email for any update on this claim.",
   "6. We agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "7. We will abide by the terms and conditions agreed in the MOU.",
   "8. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility choosing separate line of treatment which is not envisaged/ considered in package).",
   "9. We confirm that no recoveries would be made from the deposit amount collected from the insured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/choosing separate line of treatment which is not envisaged/considered in package).",
   "10. In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, Universal Sompo General Insurance Company Ltd reserves the right to recover the same from us (the Network Provider) and,/or take necessary action, as provided under the MOU or applicable laws. :",
   "DOCUMENTS TO BE PROVIDED BY THE HOSPITAL IN SUPPORT OF THE CLAIM 1. Detailed Discharge Summary and all Bills from the hospital 2. Cash Memos from the Hospitals / Chemists supported by proper prescription. 3. Receipts and Pathological Test Reports from Pathologists, supported by note from the attending Medical Practitioner / Surgeon recommending such pathological Tests. 4. Surgeon's Certificate stating nature of operation performed and Surgeon's Bill and Receipt. 5. Certificates from attending Medical Practitioner / Surgeon that the patient is fully cured. *As per IRDA circular Ref: IRDA/SDD/GDL/CIR/020/02/2013 Anti-Money Laundering /Counter Financing of Terrorism (AML/CFT)-Guidelines for General Insurers. All general insurance companies are required to carry out KYC norms at the settlement stage where claim payout crosses a threshold of ` One lakh per claim. In cases where payments are made to third party service providers such as hospitals, the KYC norms shall apply on the customers on whose behalf service providers act. Registered Office: Universal Sompo General Insurance Co Ltd,103, First Floor, Ackruti Star, MIDC Central Road, Andheri (East) , Mumbai-400093 Health Claims Management: Universal Sompo General Insurance Co Ltd, 1st Floor, Plot No.- C 56 A/13, Sector - 62, Noida, Uttar Pradesh -201309 Toll Free Helpline No: 1800 200 4030/ 1800 22 4030; Email ID: healthserve@universalsompo.com Website: www.universalsompo.com; CIN# U66010MH2007PLC166770"
  ]
 },
 {
  "key": "vidal",
  "name": "Vidal Health TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY PART - C (Revised) (TO BE FILLED IN BLOCK LETTERS)",
  "header": [
   "VIDAL HEALTH TPA",
   "a."
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA / lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": "Toll free fax"
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini id"
   },
   {
    "key": "patientName",
    "label": "Name of the Patient"
   },
   {
    "key": "gender",
    "label": "Gender"
   },
   {
    "key": "age",
    "label": "Age"
   },
   {
    "key": "dob",
    "label": "Date of Birth"
   },
   {
    "key": "contactNo",
    "label": "Contact number"
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": "Policy number / Name of Corporate"
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim / health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "Company Name"
   },
   {
    "key": "familyPhysician",
    "label": "Do you have a family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": "Name of the treating Doctor"
   },
   {
    "key": "doctorContact",
    "label": "Contact number"
   },
   {
    "key": "illness",
    "label": "Nature of Illness / Disease with presenting complaint"
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": "Duration of the present ailment"
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": "Past history of present ailment, if any"
   },
   {
    "key": "provisionalDiagnosis",
    "label": "Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD 10 code"
   },
   {
    "key": "lineOfTreatment",
    "label": "Proposed line of treatment"
   },
   {
    "key": "investigationDetails",
    "label": "If investigation and / or Medical Management, provide details"
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": "lf surgical, name of surgery"
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": "If other treatment, provide details"
   },
   {
    "key": "injuryHow",
    "label": "How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury / Disease caused due to substance abuse / alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (if yes, attach report)"
   },
   {
    "key": "maternity",
    "label": "In case of Maternity"
   },
   {
    "key": "expectedDelivery",
    "label": "expected date of Delivery"
   },
   {
    "key": "admissionDate",
    "label": "Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "Time of admission"
   },
   {
    "key": "admissionType",
    "label": "Is this an emergency / planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "Expected number of Days / stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "Days in ICU"
   },
   {
    "key": "roomType",
    "label": "Room Type"
   },
   {
    "key": "roomRent",
    "label": "Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "Expected cost of investigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "ICU charges"
   },
   {
    "key": "otCharges",
    "label": "OT charges"
   },
   {
    "key": "professionalFees",
    "label": "Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "Other hospital expenses if any"
   },
   {
    "key": "packageCharges",
    "label": "All-inclusive package charges if any applicable"
   },
   {
    "key": "totalCost",
    "label": "Sum Total expected cost of hospitalization"
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma/COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "iX. Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "X. Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) We confirm having read understood and agreed to the Declarations of this form",
   "a. Name of the treating doctor",
   "c. Registration number with State code Patient / lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE",
   "a. I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer / TPA after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amount over & above the limit authorized by the Insurer / T.P.A. not governed by the terms and conditions of the policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions of the policy and if at any facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the insurer / T.P.A.",
   "e. I agree and understand that T.P.A. is in no way warranting the service of the hospital & that the Insurer / TPA is no way guaranteeing that the services provided by the hospital will be of a particular quality or standard.",
   "f. I hereby warrant the truth of the forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, Suppression or concealment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnify the hospital against all expenses incurred on my behalf, which are not reimbursed by the insurer / TPA.",
   "h. \"I/We authorize Insurance Company / TPA to contact me/us through mobile/email for any update on this claim\"",
   "c) Patient's / Insured's Signature: email-Id (optional)",
   "HOSPITAL DECLARATION",
   "a. We have no objection to any authorized TPA / Insurance Company official verifying documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TPA / lnsurance Company within 7 days of the patient's discharge.",
   "c. We agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence. e We agree to provide clarifications for the queries raised regarding this hospitalization and we take responsibility the sole for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected from the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package).",
   "h. We confirm that no recoveries would be made from the deposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility / choosing separate line of treatment which is not envisaged / considered in package). i . In the event of unauthorized recovery of any additional amount from the Insured in excess of Agreed Package Rates, the authorized TPA / Insurance Company reserves the right to recover the same from us (the Network Provider) and / or take necessary action , as provided under the MoU or applicable laws."
  ]
 },
 {
  "key": "volo",
  "name": "Volo (East West Assist) TPA",
  "kind": "TPA",
  "title": "REQUEST FOR CASHLESS HOSPITALISATION FOR HEALTH INSURANCE POLICY — PART C",
  "header": [
   "VOLO (EAST WEST ASSIST) TPA",
   "REOUEST FOR C",
   "( DETAILS OF THIRD PARTY ADMINISTRATOR )",
   "HLESS HOSPITALISATION FOR HE TH INSURANCE",
   "POLICY PART - C (Revised)"
  ],
  "footer": [],
  "fields": [
   {
    "key": "tpaName",
    "label": "Name of TPA\"/lnsurance company"
   },
   {
    "key": "tollFreePhone",
    "label": "Toll free phone number"
   },
   {
    "key": "tollFreeFax",
    "label": ""
   },
   {
    "key": "hospitalName",
    "label": "Name of Hospital"
   },
   {
    "key": "hospitalAddress",
    "label": ""
   },
   {
    "key": "rohiniId",
    "label": "Rohini ID"
   },
   {
    "key": "patientName",
    "label": ""
   },
   {
    "key": "gender",
    "label": "A. Name ofth Patient B. Gender"
   },
   {
    "key": "age",
    "label": ""
   },
   {
    "key": "dob",
    "label": ""
   },
   {
    "key": "contactNo",
    "label": ""
   },
   {
    "key": "altContactNo",
    "label": "Contact number of attending Relative"
   },
   {
    "key": "insuredCardId",
    "label": "G. lnsured Card ID number"
   },
   {
    "key": "policyNo",
    "label": ""
   },
   {
    "key": "employeeId",
    "label": "Employee ID"
   },
   {
    "key": "otherInsurance",
    "label": "Currently do you have any other mediclaim /health insurance"
   },
   {
    "key": "otherInsurerName",
    "label": "i.Company Name ii.Give Details"
   },
   {
    "key": "familyPhysician",
    "label": "K: Do you have a family Physician: L: Name ofthe Family Physician"
   },
   {
    "key": "patientAddress",
    "label": ""
   },
   {
    "key": "occupation",
    "label": "O: Occupation of Insured patient"
   },
   {
    "key": "doctorName",
    "label": ""
   },
   {
    "key": "doctorContact",
    "label": "B: Contact number"
   },
   {
    "key": "illness",
    "label": ""
   },
   {
    "key": "clinicalFindings",
    "label": ""
   },
   {
    "key": "durationDays",
    "label": ""
   },
   {
    "key": "firstConsultDate",
    "label": "Date of First consultation"
   },
   {
    "key": "pastHistory",
    "label": ""
   },
   {
    "key": "provisionalDiagnosis",
    "label": "F: Provisional diagnosis"
   },
   {
    "key": "icd10",
    "label": "ICD l0 code"
   },
   {
    "key": "lineOfTreatment",
    "label": ""
   },
   {
    "key": "investigationDetails",
    "label": ""
   },
   {
    "key": "drugRoute",
    "label": "Route of Drug Administration"
   },
   {
    "key": "surgeryName",
    "label": ""
   },
   {
    "key": "icd10pcs",
    "label": "ICD l0 PCS code"
   },
   {
    "key": "otherTreatment",
    "label": ""
   },
   {
    "key": "injuryHow",
    "label": "K: How did injury occur"
   },
   {
    "key": "isRta",
    "label": "Is it RTA"
   },
   {
    "key": "injuryDate",
    "label": ""
   },
   {
    "key": "reportedToPolice",
    "label": "Report to Police"
   },
   {
    "key": "firNo",
    "label": "FIR NO"
   },
   {
    "key": "substanceAbuse",
    "label": "Injury /Disease caused due to substance abuse/alcohol consumption"
   },
   {
    "key": "substanceTest",
    "label": "Test conducted to establish this (ifyes, attach report)"
   },
   {
    "key": "maternity",
    "label": ""
   },
   {
    "key": "admissionDate",
    "label": "A. Date of admission"
   },
   {
    "key": "admissionTime",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "admissionType",
    "label": "B. Time of admission C. Is this an emergency/planned hospitalization event"
   },
   {
    "key": "expectedDays",
    "label": "E. Expected number of Days/stay in hospital"
   },
   {
    "key": "icuDays",
    "label": "F. Days in ICU"
   },
   {
    "key": "roomType",
    "label": ""
   },
   {
    "key": "roomRent",
    "label": "H. Per day room rent+nursing and service charges+ patients diet"
   },
   {
    "key": "investigationCost",
    "label": "I. Expected cost ofinvestigation + diagnostic"
   },
   {
    "key": "icuCharges",
    "label": "J. ICU charges"
   },
   {
    "key": "otCharges",
    "label": "K. OT charges"
   },
   {
    "key": "professionalFees",
    "label": "L. Professional fees Surgeon + Anesthetist Fees + consultation Charges"
   },
   {
    "key": "medicinesCost",
    "label": "M. Medicines + Consumables + Cost of Implants (if applicable please specify)"
   },
   {
    "key": "otherExpenses",
    "label": "N. Other hospital expenses ifany"
   },
   {
    "key": "packageCharges",
    "label": ""
   },
   {
    "key": "totalCost",
    "label": ""
   },
   {
    "key": "chronicDiabetes",
    "label": "Diabetes"
   },
   {
    "key": "chronicHeart",
    "label": "Heart disease"
   },
   {
    "key": "chronicHypertension",
    "label": "Hypertension"
   },
   {
    "key": "chronicHyperlipidemia",
    "label": "Hyperlipidemias"
   },
   {
    "key": "chronicOsteoarthritis",
    "label": "Osteoarthritis"
   },
   {
    "key": "chronicAsthma",
    "label": "Asthma./COPD/Bronchitis"
   },
   {
    "key": "chronicCancer",
    "label": "Cancer"
   },
   {
    "key": "chronicAlcohol",
    "label": "Alcohol/Drug abuse"
   },
   {
    "key": "chronicHiv",
    "label": "Any HIV/ or STD Related ailment"
   },
   {
    "key": "chronicOther",
    "label": "Any other ailment, give details"
   }
  ],
  "declaration": [
   "DECLARATION (Please read very carefully) we confirm having read understood and agreed to the Declarations ofthis form Name ofthe treating doctor b. Qualification:",
   "c. Resistration number with State code Patient/lnsured Name and Sign",
   "DECLARATION BY THE PATIENT / REPRESENTATIVE a I agree to allow the hospital to submit all original documents pertaining to hospitalization to the Insurer/T.P.A after the discharge. I agree to sign on the Final Bill & the Discharge Summary, before my discharge.",
   "b. Payment to hospital is govemed by the terms and conditions ofthe policy. In case the lnsurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions ofthe policy.",
   "c. All non-medical expenses and expenses not relevant to current hospitalization and the amounts over & above the limit authorized by the Insurer/T.P.A not govemed by the terms and conditions ofthe policy will be paid by me.",
   "d. I hereby declare to abide by the terms and conditions ofthe policy and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the tnsurer / T.P.A",
   "e. I agree and understand thatT.P.A is in no way warranting the service of the hospital & that the Insurer / TPA is in no way guaranteeing that the services provided by the hospital will be ofa particular quality or standard.",
   "f. I hereby warrant the truth ofthe forgoing particulars in every respect and I agree that if I have made or shall make any false or untrue statement, suppression or concalment with respect to the claim, my right to claim reimbursement of the said expenses shall be absolutely forfeited.",
   "g. I agree to indemnifo the hospital against all expenses incurred on my behalf, which are not reimbursed by the Insurer / TPA.",
   "h. \"t/We authorize Insurance Company/TPA to contact me/us through mobile/email for any update on this claim\" a) Patient's / Insured's Name",
   "d) Patient's / Insured's Signature e-mail Id (optional)",
   "HOSPITAL DECLARATION a We have no objection to any authorized TPA / Insurance Company official veri$,ing documents pertaining to hospitalization.",
   "b. All valid original documents duly countersigned by the insured / patient as per the checklist below will be sent to TpA / lnsurance Company within 7 days ofthe patient,s discharge.",
   "c. we agree that TPA / Insurance Company will not be Iiable to make the payment in the event of any discrepancy between the facts in this form and discharge summary or other documents.",
   "d. The patient declaration has been signed by the patient or by his representative in our presence. e we agree to provide clarifications for the queries raised regarding this hospitalization and we take the sole responsibility for any delay in offering clarifications.",
   "f. We will abide by the terms and conditions agreed in the MOU.",
   "g. We confirm that no additional amount would be collected liom the insured in excess of Agreed Package Rates except costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibilityi choosing separate line oftreatment which is not envisaged/considered in package).",
   "h. We confirm that no recoveries would be made from the dposit amount collected from the lnsured except for costs towards non-admissible amounts (including additional charges due to opting higher room rent than eligibility/ choosing separate line oftreatment which is not envisaged/considered in package). In the event ofunauthorized recovery ofany additional amount from the Insured in excess of Agreed Package Rates, the adhorized TPA / Insurance Company reserves the right to recoverthe same from us (the Network Provider) and,/or take necessary action, as provided under the MoU or applicable laws."
  ]
 }
];
