/**
 * Pure helpers shared by the file-tracking service and the seed (no database access, so the seed can import it).
 */

export interface LocationPlan { name: string; kind: string; code: string }

const initials = (name: string) => name.replace(/&/g, " ").split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();

/**
 * The places a hospital's files normally live: three racks by UHID range, two archive rooms, the OT file counter,
 * a nurse station per department and a cabin per doctor. Codes are unique within the plan.
 */
export function defaultLocationPlan(departmentNames: string[], doctorNames: string[]): LocationPlan[] {
  const plan: LocationPlan[] = [
    { name: "MRD Rack A (UHID 0001-2000)", kind: "MRD rack", code: "RACK-A" },
    { name: "MRD Rack B (UHID 2001-4000)", kind: "MRD rack", code: "RACK-B" },
    { name: "MRD Rack C (UHID 4001+)", kind: "MRD rack", code: "RACK-C" },
    { name: "Archive Room - Ground Floor", kind: "Archive room", code: "ARCH-1" },
    { name: "Archive Room - Basement (>3 yr)", kind: "Archive room", code: "ARCH-2" },
    { name: "OT Complex File Counter", kind: "Operation theatre", code: "OT-FILE" },
  ];
  const used = new Set(plan.map((p) => p.code));
  const unique = (base: string) => { let c = base, i = 2; while (used.has(c)) c = `${base}${i++}`; used.add(c); return c; };
  for (const d of departmentNames) plan.push({ name: `${d} - Nurse Station`, kind: "Nurse station", code: unique(`NS-${initials(d)}`) });
  for (const d of doctorNames) plan.push({ name: `${d} - Cabin`, kind: "Doctor cabin", code: unique(`CAB-${initials(d.replace(/^Dr\.?\s*/i, ""))}`) });
  return plan;
}

/** The rack whose UHID range holds this patient: "(UHID 0001-2000)" or "(UHID 4001+)"; otherwise the first rack. */
export function rackFor<T extends { name: string }>(patientCode: string, racks: T[]): T | null {
  const n = Number(/(\d+)\s*$/.exec(patientCode ?? "")?.[1]);
  if (Number.isFinite(n)) {
    for (const r of racks) {
      const range = /(\d+)\s*-\s*(\d+)/.exec(r.name);
      if (range && n >= Number(range[1]) && n <= Number(range[2])) return r;
      const open = /(\d+)\s*\+/.exec(r.name);
      if (open && n >= Number(open[1])) return r;
    }
  }
  return racks[0] ?? null;
}

// ── Documents: retention policies and folders ────────────────────────────────

type DocClass = "Clinical" | "Financial" | "KYC" | "Statutory";

export const DEFAULT_POLICIES: { name: string; class: DocClass; years: number; categories: string[] }[] = [
  { name: "Clinical records", class: "Clinical", years: 10, categories: ["medical history", "report", "consent form", "discharge summary", "prescription", "opd records", "ipd records", "lab reports", "radiology reports", "consent & undertakings", "discharge summaries", "referral letters", "health camp records", "external reports", "registration"] },
  { name: "Financial records", class: "Financial", years: 8, categories: ["insurance", "invoice", "bill", "receipt", "insurance documents"] },
  { name: "KYC and identity", class: "KYC", years: 5, categories: ["id proof", "kyc", "kyc documents"] },
  { name: "Statutory registers", class: "Statutory", years: 10, categories: ["statutory", "register", "licence", "legal / mlc"] },
];


/** The folders a patient's papers are filed in. Any that a hospital doesn't have yet are added (by name, never twice). */
export const DEFAULT_FOLDERS: { name: string; class: DocClass | "General"; description: string }[] = [
  { name: "Registration", class: "General", description: "Registration forms and patient identity at the front desk" },
  { name: "OPD Records", class: "Clinical", description: "Outpatient case papers and notes" },
  { name: "IPD Records", class: "Clinical", description: "Inpatient charts, orders and notes" },
  { name: "Lab Reports", class: "Clinical", description: "Laboratory results" },
  { name: "Radiology Reports", class: "Clinical", description: "X-ray, ultrasound, CT and MRI reports" },
  { name: "Consent & Undertakings", class: "Clinical", description: "Signed consent forms and undertakings" },
  { name: "KYC Documents", class: "KYC", description: "Aadhaar, PAN and other identity documents" },
  { name: "Discharge Summaries", class: "Clinical", description: "Signed discharge summaries" },
  { name: "Referral Letters", class: "Clinical", description: "Letters to and from other doctors and hospitals" },
  { name: "Insurance Documents", class: "Financial", description: "Policies, pre-authorisations, claim papers" },
  { name: "Legal / MLC", class: "Statutory", description: "Medico-legal case papers and legal notices" },
  { name: "Other", class: "General", description: "Anything that fits nowhere else" },
  { name: "Health Camp Records", class: "Clinical", description: "Papers from outreach and health camps" },
  { name: "External Reports", class: "Clinical", description: "Reports done elsewhere that the patient brings in" },
];

