/**
 * The wider patient profile captured by the registration form (beyond name, gender and mobile):
 * personal details, work, payers, identity documents and COVID history. Everything here is optional.
 */
import { BadRequestError } from "@/lib/errors";
import { optionalMobileRule } from "@/lib/field-rules";

const pastDate = (label: string) => (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return `${label} is not a valid date`;
  if (d.getTime() > Date.now() + 86_400_000) return `${label} cannot be in the future`;
  return null;
};

/** Plain optional fields: schema key → database column. */
export const PROFILE_COLUMNS = {
  ageMonths: "age_months",
  referralSource: "referral_source",
  medicoLegal: "medico_legal",
  temporary: "is_temporary",
  dataConsent: "data_consent",
  alternatePhone: "alternate_phone",
  addressLine2: "address_line2",
  title: "title",
  guardianName: "guardian_name",
  careOf: "care_of",
  anniversary: "anniversary",
  maritalStatus: "marital_status",
  religion: "religion",
  language: "language",
  nationality: "nationality",
  education: "education",
  notes: "notes",
  occupation: "occupation",
  employer: "employer",
  designation: "designation",
  workPhone: "work_phone",
  privilegeCardNo: "privilege_card_no",
} as const;

export const profileSchema = {
  ageMonths: { type: "number", required: false, min: 0, max: 11 },
  referralSource: { type: "string", required: false, max: 60 },
  medicoLegal: { type: "boolean", required: false },
  temporary: { type: "boolean", required: false },
  dataConsent: { type: "boolean", required: false },
  alternatePhone: optionalMobileRule,
  addressLine2: { type: "string", required: false, max: 240 },
  title: { type: "string", required: false, max: 20 },
  guardianName: { type: "string", required: false, max: 120 },
  careOf: { type: "string", required: false, max: 120 },
  anniversary: { type: "string", required: false, max: 40, custom: pastDate("anniversary") },
  maritalStatus: { type: "string", required: false, max: 30 },
  religion: { type: "string", required: false, max: 40 },
  language: { type: "string", required: false, max: 40 },
  nationality: { type: "string", required: false, max: 40 },
  education: { type: "string", required: false, max: 60 },
  notes: { type: "string", required: false, max: 1000 },
  occupation: { type: "string", required: false, max: 80 },
  employer: { type: "string", required: false, max: 120 },
  designation: { type: "string", required: false, max: 80 },
  workPhone: { type: "string", required: false, max: 20 },
  privilegeCardNo: { type: "string", required: false, max: 40 },
} as const;

export interface Payer {
  type: string;
  name: string;
  policyNumber: string;
  validUntil: string | null;
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Payers / coverage lines. Entirely blank lines are dropped. */
export function parsePayers(input: unknown): Payer[] {
  if (input == null || input === "") return [];
  if (!Array.isArray(input)) throw new BadRequestError("payers must be a list");
  if (input.length > 10) throw new BadRequestError("Too many payers (10 at most)");
  const out: Payer[] = [];
  for (const raw of input) {
    const p = (raw ?? {}) as Record<string, unknown>;
    const payer: Payer = {
      type: str(p.type, 40) || "Insurance",
      name: str(p.name, 120),
      policyNumber: str(p.policyNumber, 80),
      validUntil: str(p.validUntil, 40) || null,
    };
    if (!payer.name && !payer.policyNumber) continue;
    if (payer.validUntil && Number.isNaN(new Date(payer.validUntil).getTime())) throw new BadRequestError("A payer's validity date isn't a valid date");
    out.push(payer);
  }
  return out;
}

export interface CovidDetails {
  vaccination: string | null;
  lastDose: string | null;
  infectedBefore: boolean;
}

const VACCINATION = ["Not vaccinated", "Partially vaccinated", "Fully vaccinated", "Booster taken"];

export function parseCovid(input: unknown): CovidDetails | null {
  if (input == null || input === "") return null;
  const c = input as Record<string, unknown>;
  const vaccination = str(c.vaccination, 40) || null;
  if (vaccination && !VACCINATION.includes(vaccination)) throw new BadRequestError("Unknown COVID vaccination status");
  const lastDose = str(c.lastDose, 40) || null;
  if (lastDose && Number.isNaN(new Date(lastDose).getTime())) throw new BadRequestError("The last COVID dose date isn't a valid date");
  const infectedBefore = c.infectedBefore === true || c.infectedBefore === "true";
  if (!vaccination && !lastDose && !infectedBefore) return null;
  return { vaccination, lastDose, infectedBefore };
}
