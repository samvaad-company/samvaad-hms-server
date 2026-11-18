/** Claim forms: the insurer's own claim form, filled from an admitted insured / cashless patient's record. */

export type ClaimValues = Record<string, string>;

/** An admitted patient whose stay is paid by an insurer or TPA. */
export interface ClaimCandidateDTO {
  admissionId: number;
  admissionNo: string;
  patientId: number | null;
  patientName: string;
  age: number | null;
  gender: string;
  ward: string;
  bed: string;
  doctor: string;
  admissionDate: string;
  dischargeDate: string | null;
  status: string;
  /** The insurer / TPA named on the admission ("Paid by"). */
  payer: string;
  policyNo: string;
  /** The claim form that goes with the payer, or null when none matches. */
  formKey: string | null;
  formName: string | null;
}

export interface ClaimDraftDTO {
  candidate: ClaimCandidateDTO;
  /** Everything the hospital already knows, under the standard claim keys (see src/lib/claims/fields.ts). */
  values: ClaimValues;
}
