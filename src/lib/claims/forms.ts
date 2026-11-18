/**
 * The insurers' own claim forms (the PDFs they publish, in public/claims/). Each is printed from a template that says where every detail
 * goes (public/claims/<key>.json). The keys are the same as the pre-authorisation forms'.
 */
export interface ClaimFormDef {
  key: string;
  name: string;
  kind: "Insurer" | "TPA" | "Any insurer";
  /** Lower-case words that point at this insurer in the payer name set on an admission ("Star Health TPA", "HDFC ERGO"). */
  aliases: string[];
}

export const CLAIM_FORMS: ClaimFormDef[] = [
  { key: "acko", name: "Acko General Insurance", kind: "Insurer", aliases: ["acko"] },
  { key: "aditya-birla", name: "Aditya Birla Health Insurance", kind: "Insurer", aliases: ["aditya birla", "abhi"] },
  { key: "bajaj-allianz", name: "Bajaj Allianz General Insurance", kind: "Insurer", aliases: ["bajaj"] },
  { key: "care", name: "Care Health Insurance", kind: "Insurer", aliases: ["care health", "religare"] },
  { key: "chola-ms", name: "Cholamandalam MS General Insurance", kind: "Insurer", aliases: ["chola"] },
  { key: "edelweiss", name: "Edelweiss General Insurance", kind: "Insurer", aliases: ["edelweiss"] },
  { key: "generali-central", name: "Generali Central Insurance", kind: "Insurer", aliases: ["generali"] },
  { key: "hdfc-ergo", name: "HDFC ERGO Health", kind: "Insurer", aliases: ["hdfc"] },
  { key: "icici-lombard", name: "ICICI Lombard", kind: "Insurer", aliases: ["icici lombard", "lombard"] },
  { key: "icici-pru", name: "ICICI Prudential Life", kind: "Insurer", aliases: ["icici pru", "prudential"] },
  { key: "iffco-tokio", name: "IFFCO Tokio General Insurance", kind: "Insurer", aliases: ["iffco"] },
  { key: "indusind-reliance", name: "IndusInd (Reliance) General Insurance", kind: "Insurer", aliases: ["indusind", "reliance"] },
  { key: "kotak", name: "Kotak Mahindra General Insurance", kind: "Insurer", aliases: ["kotak", "zurich"] },
  { key: "liberty", name: "Liberty General Insurance", kind: "Insurer", aliases: ["liberty"] },
  { key: "magma-hdi", name: "Magma HDI General Insurance", kind: "Insurer", aliases: ["magma"] },
  { key: "manipal-cigna", name: "ManipalCigna Health Insurance", kind: "Insurer", aliases: ["manipal", "cigna"] },
  { key: "navi", name: "Navi General Insurance", kind: "Insurer", aliases: ["navi"] },
  { key: "niva-bupa", name: "Niva Bupa Health Insurance", kind: "Insurer", aliases: ["niva", "bupa"] },
  { key: "raheja-qbe", name: "Raheja QBE General Insurance", kind: "Insurer", aliases: ["raheja", "qbe"] },
  { key: "royal-sundaram", name: "Royal Sundaram General Insurance", kind: "Insurer", aliases: ["royal sundaram", "sundaram"] },
  { key: "sbi-general", name: "SBI General Insurance", kind: "Insurer", aliases: ["sbi general", "sbi"] },
  { key: "star-health", name: "Star Health and Allied Insurance", kind: "Insurer", aliases: ["star health", "star"] },
  { key: "tata-aig", name: "Tata AIG General Insurance", kind: "Insurer", aliases: ["tata aig", "tata"] },
  { key: "universal-sompo", name: "Universal Sompo General Insurance", kind: "Insurer", aliases: ["universal sompo", "sompo", "universal"] },
];

/** For a payer with no form of its own here: a standard claim form the hospital prints itself (no insurer PDF behind it). */
export const GENERIC_CLAIM_FORM: ClaimFormDef = { key: "generic", name: "Standard claim form (any insurer or TPA)", kind: "Any insurer", aliases: [] };
export const ALL_CLAIM_FORMS: ClaimFormDef[] = [...CLAIM_FORMS, GENERIC_CLAIM_FORM];

export const claimPdfUrl = (key: string) => `/claims/${key}.pdf`;
export const claimTemplateUrl = (key: string) => `/claims/${key}.json`;

/** The claim form for the insurer named on an admission ("Star Health Insurance", "HDFC ERGO TPA"), or null when none matches. */
export function matchClaimForm(payer: string | null | undefined): ClaimFormDef | null {
  const p = ` ${(payer ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  if (p.trim() === "" || /\bself pay\b/.test(p)) return null;
  let best: { def: ClaimFormDef; len: number } | null = null;
  for (const def of CLAIM_FORMS) {
    for (const a of def.aliases) {
      if (p.includes(` ${a} `) || (a.length > 4 && p.includes(a))) if (!best || a.length > best.len) best = { def, len: a.length };
    }
  }
  return best?.def ?? null;
}

/** The form to use for a payer: its own insurer's when there is one, else the standard form; null for self pay / no payer. */
export function claimFormFor(payer: string | null | undefined): ClaimFormDef | null {
  const p = (payer ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!p || p === "self pay" || p.startsWith("self pay ") || p.endsWith(" self pay")) return null;
  return matchClaimForm(payer) ?? GENERIC_CLAIM_FORM;
}
