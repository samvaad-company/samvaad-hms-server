/**
 * What a hospital starts with in Setup: a service catalogue, two rate plans, payers and sponsors, the registration lists,
 * facility masters, ID formats and a head-office branch. Seeded the first time anything in Setup is read (see
 * setup-service.ts), and editable like any other record afterwards.
 */
import { type HospitalRow } from "@/db/tables";
import type { ConfigKey, SetupKind } from "@shared/types/setup";

type Create = (row: Record<string, unknown>) => Promise<{ id: number }>;
type Data = Record<string, unknown>;

/** First day of the current financial year (April), as the price lists and tax mappings are effective from. */
function fyStart(month = 4): string {
  const now = new Date();
  const y = now.getMonth() + 1 >= month ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(month).padStart(2, "0")}-01`;
}

export async function seedSetupDefaults(hospitalId: number, hospital: HospitalRow | null, create: Create): Promise<void> {
  const order: Record<string, number> = {};
  const add = async (kind: SetupKind, code: string, name: string, data: Data = {}, active = true): Promise<number> => {
    order[kind] = (order[kind] ?? 0) + 1;
    const row = await create({ hospital_id: hospitalId, kind, code, name, active, sort_order: order[kind], data });
    return row.id;
  };
  const from = fyStart();

  // Registration and billing lists
  const payer = { GEN: await add("payer_class", "GEN", "General / Cash Tariff"), TPA: await add("payer_class", "TPA", "TPA / Insurance Tariff"), CORP: await add("payer_class", "CORP", "Corporate Tariff") };
  const cats: Record<string, number> = {};
  for (const [code, name, colour] of [["GEN", "General / Cash", "#22c55e"], ["INS", "Insurance", "#3b82f6"], ["TPA", "TPA Cashless", "#8b5cf6"], ["CORP", "Corporate", "#f59e0b"], ["GOVT", "Government Scheme", "#14b8a6"], ["STAFF", "Staff & Dependents", "#ec4899"], ["CAMP", "Camp / Charity", "#64748b"]]) {
    cats[code] = await add("patient_category", code, name, { colour, description: "" });
  }
  for (const [code, name] of [["NEW", "New Consultation"], ["FU", "Follow-up"], ["PROC", "Procedure / Day Care"], ["VAC", "Vaccination"], ["HC", "Health Checkup"], ["LAB", "Laboratory / Sample Collection"], ["RAD", "Radiology / Imaging"], ["DRES", "Dressing / Injection"], ["EMR", "Emergency"]]) await add("visit_purpose", code, name);
  for (const [code, name, colour] of [["EXP", "Expected", "#94a3b8"], ["ARR", "Arrived", "#3b82f6"], ["WAIT", "Waiting", "#f59e0b"], ["INC", "In Consultation", "#22c55e"], ["DONE", "Completed", "#16a34a"], ["LEFT", "Left Without Being Seen", "#ef4444"]]) await add("arrival_status", code, name, { colour });
  for (const [code, name, min, max] of [["BPL", "Below Poverty Line", 0, 100000], ["LIG", "Lower Income Group", 100000, 300000], ["MIG", "Middle Income Group", 300000, 1000000], ["HIG", "Higher Income Group", 1000000, null]] as const) await add("income_group", code, name, { minIncome: min, maxIncome: max });
  const refs: [string, string, string, number | null][] = [
    ["City Polyclinic, Akota", "Corporate / organization", "", null], ["Dr. Mahesh Desai", "Referring doctor", "Pediatrician", 10], ["Dr. Ramesh Patel", "Referring doctor", "General Practitioner", 10],
    ["Dr. Sunita Shah", "Referring doctor", "Gynecologist", 10], ["Free Health Camp - Gotri", "Health camp", "", null], ["Vadodara Diagnostic Centre", "Corporate / organization", "", null],
    ["Walk-in", "Walk-in / direct", "", null], ["Website / Online Booking", "Online", "", null],
  ];
  for (const [name, type, specialty, payoutValue] of refs) await add("referral_source", "", name, { type, specialty, payoutValue });

  // Organization
  for (const [code, name] of [["GM", "General Medicine"], ["GS", "General Surgery"], ["PED", "Pediatrics"], ["OBG", "Obstetrics & Gynecology"], ["ORT", "Orthopedics"], ["CAR", "Cardiology"], ["DER", "Dermatology"], ["ENT", "ENT"], ["OPH", "Ophthalmology"], ["PSY", "Psychiatry"], ["NEP", "Nephrology"], ["PUL", "Pulmonology"], ["GAS", "Gastroenterology"], ["NEU", "Neurology"], ["URO", "Urology"], ["ONC", "Oncology"], ["ANE", "Anesthesiology"], ["RAD", "Radiology"], ["PAT", "Pathology"], ["DEN", "Dentistry"]]) await add("specialty", code, name);
  for (const [code, name, type] of [["OPD", "OPD Billing Unit", "Billing"], ["IPD", "IPD Billing Unit", "Billing"], ["PHA", "Pharmacy Billing Unit", "Billing"], ["DIA", "Diagnostics Billing Unit", "Billing"], ["MIS", "MIS / Reporting Unit", "Reporting"]]) await add("org_unit", code, name, { type });

  // Facility
  const wards: Record<string, number> = {};
  for (const [code, name] of [["GEN", "General Ward"], ["SEMI", "Semi-Private"], ["PVT", "Private"], ["DLX", "Deluxe"], ["ICU", "ICU"], ["HDU", "HDU"]]) wards[code] = await add("ward_class", code, name, { description: "" });
  const areas: Record<string, number> = {};
  for (const [code, name, type] of [["REC", "Reception & Registration", "Reception"], ["OPDB", "OPD Block", "Other"], ["IPDB", "IPD Block", "Ward"], ["OT", "Operation Theatre Complex", "Operation Theatre"], ["ICUA", "Critical Care Area", "ICU"], ["LABA", "Laboratory", "Laboratory"], ["RADA", "Imaging Centre", "Radiology"], ["PHAA", "Pharmacy Counter", "Pharmacy"], ["CAS", "Casualty / Emergency", "Emergency"], ["STO", "Central Stores", "Other"]]) areas[code] = await add("facility_area", code, name, { type });
  for (let i = 1; i <= 10; i++) await add("consulting_room", `CR-${String(i).padStart(2, "0")}`, `Consulting Room ${i}`, { facilityAreaId: areas.OPDB });

  const branchId = await add("branch", (hospital?.code || "MAIN").toUpperCase().slice(0, 12), hospital?.name || "Main Hospital", {
    address: hospital?.address ?? "", city: hospital?.city ?? "", state: hospital?.state ?? "", pincode: hospital?.pincode ?? "", phone: hospital?.phone ?? "", email: hospital?.email ?? "",
    gstin: (hospital?.gst_number ?? "").toUpperCase().slice(0, 15), estRegNo: hospital?.reg_number ?? "", issuingAuthority: "", validUntil: null, invoicePrefix: "", opens: "00:00", closes: "23:59", isPrimary: true, defaultRatePlanId: null,
  });
  const ccMain = await add("collection_center", "MAIN-LAB", "Main Laboratory", { facilityAreaId: areas.LABA, branchId, external: false });
  await add("collection_center", "COL-02", "Satellite Collection Centre", { facilityAreaId: null, branchId, external: false });
  await add("collection_center", "EXT-REF", "Reference Lab (Outsourced)", { facilityAreaId: null, branchId: null, external: true });
  for (const [code, name, contact] of [["CCB1", "Diagnostic Collection - Alkapuri", "Front desk"], ["CCB2", "Path Collection - Akota", "Front desk"], ["CCB3", "Health Hub - Waghodia Road", "Front desk"], ["CCB4", "Collection Point - Sayajigunj", "Front desk"]]) await add("lab_collection_center", code, name, { address: "", contactPerson: contact, phone: "", email: "" });
  for (const [code, name, location] of [["R-A1", "Rack A1 - Tablets", "Store 1 · Shelf B"], ["R-A2", "Rack A2 - Syrups", "Store 1 · Shelf C"], ["R-B1", "Rack B1 - Injectables", "Store 2 · Shelf A"], ["R-C1", "Cold chain fridge", "Store 2 · Cold room"]]) await add("drug_rack", code, name, { location });

  // Service catalogue
  const groupDefs: [string, string, string][] = [["CONS", "Consultations", "Consultation"], ["PROC", "Procedures & Minor Surgery", "Procedure"], ["DIAG", "Diagnostics & Imaging", "Diagnostic"], ["LAB", "Laboratory", "Laboratory"], ["IPD", "IPD Charges", "IPD charge"], ["SURG", "Surgical Packages", "Package"], ["PRG", "Wellness Programmes", "Other"]];
  const groups: Record<string, number> = {};
  for (const [code, name, billingCategory] of groupDefs) groups[code] = await add("service_group", code, name, { parentId: null, billingCategory });
  const svc: [string, string, string, number, string?][] = [
    ["CONS", "CONS-GEN", "General Consultation", 500], ["CONS", "CONS-SPL", "Specialist Consultation", 800], ["CONS", "CONS-FU", "Follow-up Consultation", 250], ["CONS", "CONS-EMR", "Emergency Consultation", 1000], ["CONS", "CONS-VID", "Tele/Video Consultation", 400], ["CONS", "REG-NEW", "New Registration Fee", 200],
    ["PROC", "PROC-DRS", "Dressing (Minor)", 300], ["PROC", "PROC-DRSL", "Dressing (Large)", 600], ["PROC", "PROC-NEB", "Nebulization", 250], ["PROC", "PROC-INJ", "Injection Administration", 150], ["PROC", "PROC-SUT", "Suturing (Minor)", 1200], ["PROC", "PROC-CAT", "Catheterization", 800], ["PROC", "PROC-IVL", "IV Line / Cannulation", 200], ["PROC", "PROC-ABG", "Plaster / POP Cast", 1500],
    ["DIAG", "DIAG-ECG", "ECG", 400], ["DIAG", "DIAG-XR", "X-Ray (Single Film)", 600], ["DIAG", "DIAG-XR2", "X-Ray (Two Films)", 1000], ["DIAG", "DIAG-USG", "Ultrasound Abdomen", 1500], ["DIAG", "DIAG-USP", "Ultrasound Pregnancy", 1800], ["DIAG", "DIAG-2DE", "2D Echo", 2500], ["DIAG", "DIAG-CT", "CT Scan (Plain)", 4500], ["DIAG", "DIAG-MRI", "MRI (Single Region)", 6500], ["DIAG", "DIAG-PFT", "Pulmonary Function Test", 1200],
    ["LAB", "LAB-CBC", "Complete Blood Count", 350, "per test"], ["LAB", "LAB-LFT", "Liver Function Test", 700, "per test"], ["LAB", "LAB-RFT", "Renal Function Test", 650, "per test"], ["LAB", "LAB-FBS", "Fasting Blood Sugar", 100, "per test"], ["LAB", "LAB-PPBS", "Post-prandial Blood Sugar", 100, "per test"], ["LAB", "LAB-LIP", "Lipid Profile", 600, "per test"], ["LAB", "LAB-TSH", "Thyroid Profile (TSH)", 450, "per test"], ["LAB", "LAB-HBA", "HbA1c", 550, "per test"], ["LAB", "LAB-URN", "Urine Routine", 150, "per test"], ["LAB", "LAB-DEN", "Dengue NS1 Antigen", 900, "per test"],
    ["IPD", "IPD-GEN", "General Ward Bed (per day)", 1100, "per day"], ["IPD", "IPD-SEMI", "Semi-Private Bed (per day)", 1800, "per day"], ["IPD", "IPD-PVT", "Private Room (per day)", 3000, "per day"], ["IPD", "IPD-ICU", "ICU Bed (per day)", 5000, "per day"], ["IPD", "IPD-NUR", "Nursing Charges (per day)", 600, "per day"], ["IPD", "IPD-RMO", "RMO / Duty Doctor (per day)", 800, "per day"],
    ["SURG", "SURG-APP", "Appendectomy Package", 45000, "per package"], ["SURG", "SURG-CSE", "Cesarean Section Package", 55000, "per package"], ["SURG", "SURG-HER", "Hernia Repair Package", 40000, "per package"], ["SURG", "SURG-CAT", "Cataract Surgery (Phaco) Package", 30000, "per package"], ["SURG", "SURG-LCH", "Laparoscopic Cholecystectomy Package", 65000, "per package"], ["SURG", "SURG-KNE", "Knee Arthroscopy Package", 70000, "per package"],
    ["PRG", "PRG-DRP", "Diabetes Reversal Programme (3 months)", 15000, "per programme"], ["PRG", "PRG-BPR", "BP Reversal Programme (3 months)", 12000, "per programme"], ["PRG", "PRG-OBS", "Medical Management of Obesity (3 months)", 18000, "per programme"],
  ];
  const services: Record<string, number> = {};
  for (const [g, code, name, price, unit] of svc) {
    const gst = code === "PROC-INJ";
    services[code] = await add("service", code, name, {
      shortName: "", groupId: groups[g], cghsCode: "", socCode: "", price, unit: unit ?? "per session", gstApplies: gst, gstRate: gst ? 18 : 0,
      hsnSac: g === "LAB" || g === "DIAG" ? "9993" : "", taxFrom: from, collectionCenterId: g === "LAB" ? ccMain : null,
      wardClassId: BED_CHARGE_CLASS[code] ? wards[BED_CHARGE_CLASS[code]] : null,
    });
  }

  // Rate plans
  const standard = await add("rate_plan", "", "Standard Cash Tariff 2026-27", {
    payerClassId: payer.GEN, basePlanId: null, patientCategoryId: cats.GEN, wardClassId: wards.GEN, effectiveFrom: from, effectiveTo: null, notes: "", isDefault: true, prices: { general: {}, package: {}, tpa: {} }, history: [],
  });
  await add("rate_plan", "", "TPA / Cashless Tariff 2026-27", {
    payerClassId: payer.TPA, basePlanId: standard, patientCategoryId: cats.TPA, wardClassId: wards.GEN, effectiveFrom: from, effectiveTo: null, notes: "Derived from the standard tariff; overrides only what differs.", isDefault: false, prices: { general: {}, package: {}, tpa: {} }, history: [],
  });

  // Packages
  const incl = (codes: [string, number][]) => codes.map(([c, qty]) => ({ kind: "service", refId: services[c], name: svc.find((s) => s[1] === c)![2], category: "", qty, rate: null, maxQty: null, maxAmount: null }));
  const pkgs: [string, string, string, number, number, number | null, number | null, string, [string, number][]][] = [
    ["PKG-MHC-BASIC", "Master Health Check - Basic", "Health check", 1999, 1, null, 30, "Annual preventive screen: CBC, blood sugar, lipid profile, urine routine, ECG and a physician consultation.", []],
    ["PKG-MHC-ADV", "Master Health Check - Advanced", "Health check", 3999, 1, null, 30, "Basic screen plus thyroid, liver and kidney function, HbA1c and an abdominal ultrasound.", [["LAB-CBC", 1], ["LAB-LIP", 1], ["LAB-LFT", 1], ["LAB-RFT", 1], ["LAB-TSH", 1], ["LAB-HBA", 1], ["DIAG-ECG", 1], ["DIAG-USG", 1], ["CONS-SPL", 1]]],
    ["PKG-CARD", "Cardiac Wellness Package", "Health check", 4999, 1, null, 30, "ECG, 2D echo, lipid profile and a cardiology consultation.", [["DIAG-ECG", 1], ["DIAG-2DE", 1], ["LAB-LIP", 1], ["CONS-SPL", 1]]],
    ["PKG-DIAB", "Diabetic Follow-up Package", "Multi-visit", 3500, 4, 30, 180, "Four monthly reviews with HbA1c at the first and last visit.", [["CONS-FU", 4], ["LAB-HBA", 2], ["LAB-FBS", 4]]],
    ["PKG-ANC", "Antenatal Care Package", "Multi-visit", 8500, 9, 30, 300, "Monthly antenatal visits with the routine scans and tests.", [["CONS-SPL", 9], ["DIAG-USP", 3], ["LAB-CBC", 3]]],
    ["PKG-APP", "Appendectomy Surgical Package", "Surgical", 45000, 1, null, 30, "Surgeon, anaesthesia, OT and three days in a semi-private room.", [["SURG-APP", 1], ["IPD-SEMI", 3]]],
    ["PKG-CSE", "Cesarean Section Package", "Surgical", 55000, 1, null, 30, "Surgeon, anaesthesia, OT, newborn care and four days in a semi-private room.", [["SURG-CSE", 1], ["IPD-SEMI", 4]]],
  ];
  for (const [code, name, type, price, sessions, gapDays, validityDays, description, inc] of pkgs) await add("package", code, name, { type, price, sessions, gapDays, validityDays, description, inclusions: incl(inc), exclusions: [], orderingRules: [] });

  // Payments and banks
  for (const [code, name, group] of [["CASH", "Cash", "Cash"], ["CHEQUE", "Cheque", "Cheque"], ["DD", "Demand Draft", "Dd"], ["ECS", "ECS", "Ecs"], ["CREDIT_CARD", "Credit Card", "Card"], ["DEBIT_CARD", "Debit Card", "Card"], ["UPI", "UPI", "Upi"], ["PAYTM", "Paytm", "Wallet"], ["PHONEPE", "PhonePe", "Wallet"], ["NEFT", "NEFT", "Netbanking"], ["RTGS", "RTGS", "Netbanking"], ["SODEXO", "Sodexo / Meal Card", "Wallet"]]) await add("payment_mode", code, name, { group });
  const bank = await add("bank_account", "", "State Bank of India", { label: "Main branch", ifsc: "SBIN0009876", accountLast4: "4567", accountType: "Current", isDefault: true });
  await add("bank_account", "", "HDFC Bank", { label: "Current account", ifsc: "HDFC0001234", accountLast4: "5678", accountType: "Current", isDefault: false });
  await add("edc_terminal", "", "Front Office EDC 1", { terminalId: "TID00012345", merchantId: "MID987654321", model: "Pinelabs Plutus", bankAccountId: bank });
  await add("edc_terminal", "", "IPD Billing EDC", { terminalId: "TID00067890", merchantId: "MID987654322", model: "Ezetap Android", bankAccountId: bank });

  // Sponsors and contracts
  const sponsorDefs: [string, string][] = [
    ["Star Health & Allied Insurance", "Insurer"], ["HDFC Ergo Health", "Insurer"], ["ICICI Lombard", "Insurer"], ["New India Assurance", "Insurer"], ["Care Health Insurance", "Insurer"], ["Niva Bupa", "Insurer"],
    ["MediAssist TPA", "TPA"], ["Paramount TPA", "TPA"], ["Vidal Health TPA", "TPA"], ["Bajaj Allianz General Insurance", "Insurer"], ["Aditya Birla Health Insurance", "Insurer"], ["Tata AIG General Insurance", "Insurer"],
    ["Heritage Health TPA", "TPA"], ["Family Health Plan (FHPL) TPA", "TPA"], ["Reliance General Insurance", "Insurer"], ["L&T Engineering Employees", "Corporate / Group"], ["Oil & Natural Gas Corp Employees", "Corporate / Group"],
    ["Gujarat MA Yojana", "Government scheme"], ["Ayushman Bharat PM-JAY", "Government scheme"], ["ESIC Vadodara", "Government scheme"],
  ];
  const contracts: Record<string, number> = {};
  let n = 0;
  const copayDefault = (id: string) => ({ id, appliesTo: "Whole contract (default rule)", groupId: null, copayPercent: null, deductible: null, copayMin: null, copayMax: null, annualLimit: 750000, encounterLimit: 200000, episodicLimit: null });
  for (const [name, type] of sponsorDefs) {
    const sponsorId = await add("sponsor", "", name, { type });
    const label = type === "Insurer" ? "Group Mediclaim 2026" : type === "TPA" || type === "Corporate / Group" ? "Corporate 2026" : "Scheme 2026";
    const first = n === 0;
    n++;
    contracts[`${name} - ${label}`] = await add("contract", `CON-${String(n).padStart(4, "0")}`, `${name} - ${label}`, {
      sponsorId, kind: "Package", ratePlanId: null, validFrom: first ? "2025-05-31" : "2025-01-08", validTo: first ? "2026-09-15" : null, discountPercent: first ? -10 : -7.5, creditDays: first ? 45 : 60,
      copay: [copayDefault(`d${n}`)], exclusions: [], limits: [], drg: [],
    }, !first);
    if (first) {
      n++;
      contracts[`${name} - Premium 2026`] = await add("contract", `CON-${String(n).padStart(4, "0")}`, `${name} - Premium 2026`, {
        sponsorId, kind: "Package", ratePlanId: null, validFrom: "2025-01-23", validTo: null, discountPercent: 0, creditDays: 90,
        copay: [
          copayDefault("p1"),
          { id: "p2", appliesTo: "Procedures & Minor Surgery (group)", groupId: groups.PROC, copayPercent: 20, deductible: null, copayMin: null, copayMax: null, annualLimit: null, encounterLimit: 40000, episodicLimit: null },
          { id: "p3", appliesTo: "Consultations (group)", groupId: groups.CONS, copayPercent: 10, deductible: null, copayMin: 1000, copayMax: null, annualLimit: null, encounterLimit: 25000, episodicLimit: 15000 },
          { id: "p4", appliesTo: "Wellness Programmes (group)", groupId: groups.PRG, copayPercent: 10, deductible: null, copayMin: null, copayMax: null, annualLimit: null, encounterLimit: null, episodicLimit: null },
        ],
        exclusions: [], limits: [], drg: [],
      });
    }
  }
  const dual = async (a: string, b: string, rule: string, share: number) => add("dual_sponsor_rule", "", `${a} → ${b}`, { primaryContractId: contracts[a], secondaryContractId: contracts[b], rule, primarySharePercent: share });
  await dual("HDFC Ergo Health - Group Mediclaim 2026", "Aditya Birla Health Insurance - Group Mediclaim 2026", "Proportional split", 70);
  await dual("Star Health & Allied Insurance - Group Mediclaim 2026", "Family Health Plan (FHPL) TPA - Corporate 2026", "Primary first", 100);
  await dual("Star Health & Allied Insurance - Premium 2026", "Paramount TPA - Corporate 2026", "Primary first", 100);

  // Doctor and referral payout rules
  for (const [name, role, scope, valueKind, value] of [["Consulting doctors (default)", "Consulting", "All services", "percent", 30], ["Surgeons (IPD)", "Surgeon", "IPD", "percent", 40], ["Referring doctors", "Referred", "All services", "fixed", 10], ["Outhouse / outsourced tests", "Outhouse", "All services", "percent", 10]] as const) {
    await add("payout_rule", "", name, { role, scope, serviceId: null, valueKind, value, effectiveFrom: from, effectiveTo: null });
  }

  // ID formats
  for (const f of ID_FORMAT_DEFAULTS) await add("id_format", f.code, f.name, { mask: f.mask, prefix: f.prefix, reset: f.reset, scope: "Org-wide", luhn: false, gender: false, custom: false, defaultMask: f.mask });

  // Clinical forms and protocols
  for (const [name, specialty] of [["Cardiology - Hypertension Review", "Cardiology"], ["General Medicine - Fever Workup", "General Medicine"], ["Obstetrics - Antenatal Visit", "Obstetrics & Gynecology"], ["Orthopedics - Knee Osteoarthritis", "Orthopedics"], ["Pediatrics - Upper Respiratory Infection", "Pediatrics"]]) {
    await add("clinical_form", "", name, { specialty, version: 0, status: "Draft", fields: [], assignedDepartments: [] });
  }
  await add("protocol", "", "Sepsis bundle (first hour)", { category: "Emergency", description: "Recognise and treat sepsis within the first hour.", steps: ["Measure lactate", "Take blood cultures before antibiotics", "Give broad-spectrum antibiotics", "Start 30 ml/kg crystalloid for hypotension or lactate ≥ 4", "Reassess perfusion and start vasopressors if still hypotensive"] });
  await add("protocol", "", "Chest pain pathway", { category: "Cardiology", description: "First 10 minutes for a patient with suspected acute coronary syndrome.", steps: ["12-lead ECG within 10 minutes", "Aspirin 325 mg unless allergic", "Cardiac monitor and IV access", "Troponin at 0 and 3 hours", "Escalate to the cardiologist on ST elevation"] });
  await add("protocol", "", "Pre-operative checklist", { category: "Surgery", description: "Confirmed before a patient leaves the ward for theatre.", steps: ["Identity band and consent checked", "Fasting status confirmed", "Site marked", "Allergies and blood group recorded", "Pre-medication given and charted"] });
}

/** The bed-charge services and the ward class each one prices a bed in. */
export const BED_CHARGE_CLASS: Record<string, string> = { "IPD-GEN": "GEN", "IPD-SEMI": "SEMI", "IPD-PVT": "PVT", "IPD-ICU": "ICU" };

/** The numbered documents and their starting masks. Those the HMS issues today (see `LIVE_ID_FORMATS`) start as the formats it has always used. */
export const ID_FORMAT_DEFAULTS: { code: string; name: string; mask: string; prefix: string; reset: string }[] = [
  { code: "uhid", name: "UHID", mask: "HMS-{SEQ:4}", prefix: "", reset: "Never" },
  { code: "prescription", name: "Prescription no.", mask: "RX-{FY}-{SEQ:6}", prefix: "", reset: "Every FY" },
  { code: "invoice", name: "Bill / invoice no.", mask: "{PREFIX}-{SEQ:8}", prefix: "INV", reset: "Never" },
  { code: "receipt", name: "Receipt no.", mask: "RCP-{FY}-{SEQ:6}", prefix: "", reset: "Every FY" },
  { code: "credit_note", name: "Credit note no.", mask: "CN/{YY}/{SEQ:5}", prefix: "", reset: "Every year" },
  { code: "admission", name: "Admission no.", mask: "ADM/{YYYY}/{SEQ:5}", prefix: "", reset: "Every year" },
  { code: "claim", name: "Claim no.", mask: "CLM-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "purchase_order", name: "Purchase order no.", mask: "PO-{SEQ:4}", prefix: "", reset: "Never" },
  { code: "grn", name: "GRN no.", mask: "GRN-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "certificate", name: "Certificate no.", mask: "CERT/{FY}/{SEQ:4}", prefix: "", reset: "Every FY" },
  { code: "visit", name: "Visit no.", mask: "V/{FY2}/{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "opd", name: "OPD no.", mask: "OPD/{FY2}/{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "ipd", name: "IPD no.", mask: "IPD/{FY2}/{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "deposit", name: "Deposit no.", mask: "DEP-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "refund", name: "Refund no.", mask: "REF-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "mlc", name: "MLC no.", mask: "MLC/{FY}/{SEQ:4}", prefix: "", reset: "Every FY" },
  { code: "incident", name: "Incident no.", mask: "INC/{FY}/{SEQ:4}", prefix: "", reset: "Every FY" },
  { code: "grievance", name: "Grievance no.", mask: "GRV/{FY}/{SEQ:4}", prefix: "", reset: "Every FY" },
  { code: "ot", name: "OT no.", mask: "OT/{YYYY}/{SEQ:4}", prefix: "", reset: "Every year" },
  { code: "estimate", name: "Estimate no.", mask: "EST-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "lab_order", name: "Lab order no.", mask: "LAB-{SEQ:4}", prefix: "", reset: "Never" },
  { code: "radiology_order", name: "Radiology order no.", mask: "RAD-{SEQ:4}", prefix: "", reset: "Never" },
  { code: "blood_donor", name: "Blood donor no.", mask: "BD/{YY}/{SEQ:5}", prefix: "", reset: "Every year" },
  { code: "birth_record", name: "Birth register no.", mask: "BR/{FY2}/{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "death_record", name: "Death register no.", mask: "DR/{FY2}/{SEQ:5}", prefix: "", reset: "Every FY" },
  { code: "mrd_file", name: "MRD file no.", mask: "F/{YY}/{SEQ:5}", prefix: "", reset: "Every year" },
  { code: "consent", name: "Consent form no.", mask: "CF-{FY}-{SEQ:6}", prefix: "", reset: "Every FY" },
  { code: "cssd_cycle", name: "Sterilization cycle no.", mask: "CC/{YY}/{SEQ:5}", prefix: "", reset: "Every year" },
  { code: "employee", name: "Employee ID", mask: "EMP-{SEQ:4}", prefix: "", reset: "Every FY" },
  { code: "ambulance_trip", name: "Ambulance trip no.", mask: "AMB-{FY}-{SEQ:5}", prefix: "", reset: "Every FY" },
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** The built-in values for a config key; stored values are merged over these. */
export function defaultConfig(key: ConfigKey, hospital: HospitalRow | null): Record<string, unknown> {
  switch (key) {
    case "hospital":
      return {
        name: hospital?.name ?? "", shortName: hospital?.name ?? "", vertical: "Multispecialty", bedCount: 0, phone: str(hospital?.phone), email: str(hospital?.email), tagline: "",
        address: [hospital?.address, hospital?.city, hospital?.state].filter(Boolean).join(", "), addressLine2: "", pincode: str(hospital?.pincode),
        gstin: str(hospital?.gst_number).toUpperCase(), gstRegistration: "Regular", gstRounding: "Round half up (default)", unknownPatientState: "Treat as intra-state (CGST+SGST)",
        pan: str(hospital?.pan_number), cin: "", rohini: "", pcpndt: "", clinicStateCode: "", invoicePrefix: "", upiVpa: "", invoiceFooter: "",
        supportName: "", supportEmail: "", supportPhone: "", gstOnBills: true, pricesInclusive: false, roundOff: true, multiCenter: false,
        fyStartMonth: 4, fyStartDay: 1,
        clinicRegNo: str(hospital?.reg_number), clinicAuthority: "", clinicValidUntil: "", bloodLicenceNo: "", bloodAuthority: "", bloodValidUntil: "",
        autoPostBedCharges: true, autoPostConsultFee: true, autoPostRegistrationFee: true, postingTime: "00:05", allowBackdating: false, backdatingDays: 2,
        mlcRequired: true, consentBeforeProcedure: true, doubleCheckHighRisk: true, dischargeSummaryRequired: true, allergyCheckOnPrescribe: true, retentionYears: 10,
      };
    case "billing":
      return {
        manualPaymentModes: ["Cash", "Upi", "Card"],
        roleDiscountLimits: { Receptionist: null, "Billing staff": null, Doctor: null },
        userDiscountLimits: {},
      };
    case "notifications":
      return {
        email: true, sms: false, whatsapp: false, appointmentReminders: true, reminderHoursBefore: 24, labReportReady: true, invoiceOnBilling: true, lowStockAlerts: true,
        dailySummaryEmail: false, summaryRecipients: "",
      };
    case "security":
      return { sessionTimeoutMinutes: 60, minPasswordLength: 8, requireMixedCase: true, lockoutAttempts: 5, twoFactorForAdmins: false, auditRetentionDays: 365 };
    case "plan":
      return { planName: "Samvaad HMS", billingCycle: "Annual", seats: 0, validUntil: "", licenceKey: "", supportContact: "" };
    case "referral":
      return { code: `${(hospital?.code ?? "HOSP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}-REF`, rewardNote: "", referred: [] };
  }
}
