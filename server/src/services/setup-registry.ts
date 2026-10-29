/**
 * What each Setup master looks like: its fields, which other masters it points at, and what stops it being deleted.
 * The generic service (setup-service.ts) reads this, so adding a list is an entry here and a screen, not a new table.
 */
import {
  ACCOUNT_TYPES, BILLING_CATEGORIES, COPAY_ENDS, FACILITY_AREA_TYPES, ID_RESETS, ID_SCOPES, ORG_UNIT_TYPES, PACKAGE_TYPES,
  PAYMENT_GROUPS, PAYOUT_ROLES, REFERRAL_TYPES, SERVICE_SCOPES, SPONSOR_TYPES, type SetupKind,
} from "@shared/types/setup";

export type FieldType = "s" | "n" | "b" | "e" | "d" | "id" | "j";

export interface Field {
  t: FieldType;
  required?: boolean;
  /** String length, or the highest value for a number. */
  max?: number;
  min?: number;
  values?: readonly string[];
  /** For "id": the master it points at. */
  ref?: SetupKind;
  /** A number that may also be left empty (stored as null). */
  nullable?: boolean;
  def?: unknown;
  /** Set by dedicated endpoints, never by the generic create/update. */
  managed?: boolean;
}

export interface KindDef {
  label: string;
  /** A short code is required and unique within the kind. */
  code?: "required" | "optional";
  /** Codes are minted by the server: prefix + 4 digits. */
  codeAuto?: string;
  uniqueName?: boolean;
  nameMin?: number;
  fields: Record<string, Field>;
  /** Records of other kinds that hold this record's id in `data[field]` — deleting is refused while any exist. */
  usedBy?: { kind: SetupKind; field: string; what: string }[];
  /** Sort: by the stored order (default), or by name. */
  sort?: "order" | "name" | "code";
  /** Keep a single record of this kind flagged `field`; setting it clears the others. */
  oneOf?: string;
}

const S = (max = 120, extra: Partial<Field> = {}): Field => ({ t: "s", max, def: "", ...extra });
const N = (extra: Partial<Field> = {}): Field => ({ t: "n", min: 0, max: 100_000_000, ...extra });
const B = (def = false): Field => ({ t: "b", def });
const E = (values: readonly string[], def?: string, extra: Partial<Field> = {}): Field => ({ t: "e", values, def: def ?? values[0], ...extra });
const D = (): Field => ({ t: "d" });
const ID = (ref: SetupKind, extra: Partial<Field> = {}): Field => ({ t: "id", ref, ...extra });
const J = (): Field => ({ t: "j", managed: true });

const simple = (label: string, extra: Partial<KindDef> = {}): KindDef => ({ label, code: "required", fields: {}, sort: "order", ...extra });

export const REGISTRY: Record<SetupKind, KindDef> = {
  service_group: simple("Service group", {
    fields: { parentId: ID("service_group", { nullable: true }), billingCategory: E(BILLING_CATEGORIES, "Other") },
    usedBy: [{ kind: "service", field: "groupId", what: "services" }, { kind: "service_group", field: "parentId", what: "sub-groups" }],
  }),
  service: simple("Service", {
    nameMin: 2,
    fields: {
      shortName: S(40), groupId: ID("service_group", { nullable: true }), cghsCode: S(30), socCode: S(30),
      price: N({ def: 0 }), unit: S(30, { def: "per session" }), gstApplies: B(false), gstRate: N({ max: 100, def: 0 }),
      hsnSac: S(12), taxFrom: D(), collectionCenterId: ID("collection_center", { nullable: true }), wardClassId: ID("ward_class", { nullable: true }),
    },
    usedBy: [{ kind: "payout_rule", field: "serviceId", what: "payout rules" }],
  }),
  rate_plan: {
    label: "Rate plan", uniqueName: true, sort: "order", oneOf: "isDefault",
    fields: {
      payerClassId: ID("payer_class", { nullable: true }), basePlanId: ID("rate_plan", { nullable: true }),
      patientCategoryId: ID("patient_category", { nullable: true }), wardClassId: ID("ward_class", { nullable: true }),
      effectiveFrom: D(), effectiveTo: D(), notes: S(300), isDefault: B(false), prices: J(), history: J(),
    },
    usedBy: [{ kind: "rate_plan", field: "basePlanId", what: "rate plans built on it" }, { kind: "contract", field: "ratePlanId", what: "contracts" }, { kind: "branch", field: "defaultRatePlanId", what: "branches" }],
  },
  package: simple("Package", {
    fields: {
      type: E(PACKAGE_TYPES), price: N({ def: 0 }), sessions: N({ min: 1, max: 365, def: 1 }), gapDays: N({ max: 3650, nullable: true }),
      validityDays: N({ max: 3650, nullable: true }), description: S(500), inclusions: J(), exclusions: J(), orderingRules: J(),
    },
  }),
  sponsor: { label: "Sponsor", uniqueName: true, sort: "order", fields: { type: E(SPONSOR_TYPES) }, usedBy: [{ kind: "contract", field: "sponsorId", what: "contracts" }] },
  contract: {
    label: "Contract", codeAuto: "CON-", sort: "order",
    fields: {
      sponsorId: ID("sponsor", { required: true }), kind: E(["Package", "Rate plan"]), ratePlanId: ID("rate_plan", { nullable: true }),
      validFrom: D(), validTo: D(), discountPercent: N({ min: -100, max: 100, def: 0 }), creditDays: N({ max: 365, def: 0 }),
      copay: J(), exclusions: J(), limits: J(), drg: J(),
    },
    usedBy: [{ kind: "dual_sponsor_rule", field: "primaryContractId", what: "dual-sponsor rules" }, { kind: "dual_sponsor_rule", field: "secondaryContractId", what: "dual-sponsor rules" }],
  },
  dual_sponsor_rule: {
    label: "Dual-sponsor rule", sort: "order",
    fields: { primaryContractId: ID("contract", { required: true }), secondaryContractId: ID("contract", { required: true }), rule: E(COPAY_ENDS), primarySharePercent: N({ max: 100, def: 70 }) },
  },
  payer_class: simple("Payer class", { usedBy: [{ kind: "rate_plan", field: "payerClassId", what: "rate plans" }] }),
  payment_mode: simple("Payment mode", { fields: { group: E(PAYMENT_GROUPS) } }),
  bank_account: {
    label: "Bank account", sort: "order", oneOf: "isDefault",
    fields: { label: S(80), ifsc: S(11), accountLast4: S(4), accountType: E(ACCOUNT_TYPES), isDefault: B(false) },
    usedBy: [{ kind: "edc_terminal", field: "bankAccountId", what: "card terminals" }],
  },
  edc_terminal: {
    label: "Card terminal", uniqueName: true, sort: "order",
    fields: { terminalId: S(40), merchantId: S(40), model: S(60), bankAccountId: ID("bank_account", { nullable: true }) },
    usedBy: [{ kind: "edc_settlement", field: "terminalId", what: "settlements" }],
  },
  edc_settlement: {
    label: "Settlement", sort: "order",
    fields: { terminalId: ID("edc_terminal", { required: true }), date: { t: "d", required: true }, amount: N({ required: true, min: 0.01 }), batchNo: S(40), reference: S(60) },
  },
  payout_rule: {
    label: "Payout rule", sort: "order",
    fields: {
      role: E(PAYOUT_ROLES), scope: E(SERVICE_SCOPES), serviceId: ID("service", { nullable: true }),
      valueKind: E(["percent", "fixed"]), value: N({ required: true }), effectiveFrom: { t: "d", required: true }, effectiveTo: D(),
    },
  },
  patient_category: simple("Patient category", { fields: { colour: S(7), description: S(200) }, usedBy: [{ kind: "rate_plan", field: "patientCategoryId", what: "rate plans" }] }),
  visit_purpose: simple("Visit purpose"),
  arrival_status: simple("Arrival status", { fields: { colour: S(7) } }),
  income_group: simple("Income group", { fields: { minIncome: N({ def: 0 }), maxIncome: N({ nullable: true }) } }),
  referral_source: { label: "Referral source", uniqueName: true, sort: "order", fields: { type: E(REFERRAL_TYPES), specialty: S(60), payoutValue: N({ nullable: true }) } },
  specialty: simple("Specialty"),
  org_unit: simple("Org unit", { fields: { type: E(ORG_UNIT_TYPES, "Other") } }),
  id_format: simple("ID format", {
    sort: "order",
    fields: { mask: S(60, { required: true }), prefix: S(10), reset: E(ID_RESETS, "Every FY"), scope: E(ID_SCOPES), luhn: B(false), gender: B(false), custom: B(false), defaultMask: S(60) },
  }),
  clinical_form: { label: "Clinical form", uniqueName: true, sort: "order", fields: { specialty: S(80), version: N({ max: 999, def: 0 }), status: E(["Draft", "Published"]), fields: J(), assignedDepartments: J() } },
  protocol: { label: "Protocol", uniqueName: true, sort: "order", fields: { category: S(60), description: S(2000), steps: J() } },
  ward_class: simple("Ward class", { fields: { description: S(200) }, usedBy: [{ kind: "rate_plan", field: "wardClassId", what: "rate plans" }, { kind: "service", field: "wardClassId", what: "bed-charge services" }] }),
  consulting_room: { label: "Consulting room", code: "optional", uniqueName: true, sort: "order", fields: { facilityAreaId: ID("facility_area", { nullable: true }) } },
  facility_area: simple("Facility area", {
    fields: { type: E(FACILITY_AREA_TYPES, "Other") },
    usedBy: [{ kind: "collection_center", field: "facilityAreaId", what: "collection centres" }, { kind: "consulting_room", field: "facilityAreaId", what: "consulting rooms" }],
  }),
  collection_center: simple("Collection centre", {
    fields: { facilityAreaId: ID("facility_area", { nullable: true }), branchId: ID("branch", { nullable: true }), external: B(false) },
    usedBy: [{ kind: "service", field: "collectionCenterId", what: "services" }],
  }),
  lab_collection_center: simple("Lab collection centre", { fields: { address: S(200), contactPerson: S(80), phone: S(20), email: S(120) } }),
  drug_rack: simple("Drug rack", { fields: { location: S(120) } }),
  branch: {
    label: "Branch", code: "required", sort: "order", oneOf: "isPrimary",
    fields: {
      address: S(300), city: S(80), state: S(80), pincode: S(10), phone: S(20), email: S(120), gstin: S(15), estRegNo: S(60),
      issuingAuthority: S(120), validUntil: D(), invoicePrefix: S(20), opens: S(5, { def: "09:00" }), closes: S(5, { def: "18:00" }),
      isPrimary: B(false), defaultRatePlanId: ID("rate_plan", { nullable: true }),
    },
    usedBy: [{ kind: "collection_center", field: "branchId", what: "collection centres" }],
  },
};

/** Masters whose rows have no code (the name identifies them). */
export const hasCode = (k: SetupKind) => !!REGISTRY[k].code || !!REGISTRY[k].codeAuto;
