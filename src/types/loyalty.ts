/**
 * The patient loyalty programme: five cards (Basic → Silver → Gold → Platinum → VIP) that a patient moves up by earning points.
 * Points come from how long they have been coming, how often, their family, the patients they refer, their follow-ups, and
 * points an administrator adds by hand. A card sets the patient's prices on the bill. Everything here is editable in
 * Setup → Masters → Loyalty programme; the values below are what a hospital starts with.
 */

export const RANK_KEYS = ["basic", "silver", "gold", "platinum", "vip"] as const;
export type LoyaltyRankKey = (typeof RANK_KEYS)[number];

export interface LoyaltyDiscounts { lab: number; pharmacy: number; radiology: number; ipd: number }

export interface LoyaltyRank {
  key: LoyaltyRankKey;
  name: string;
  /** What kind of patient this card is for, e.g. "Infrequent referrer". */
  tagline: string;
  /** The colour of the card and its stars. */
  color: string;
  /** Points needed to hold this card. */
  minPoints: number;
  /** What the OPD consultation costs a holder of this card, in rupees. */
  opdFee: number;
  /** What an emergency visit costs a holder of this card, in rupees. */
  erFee: number;
  /** Percent off a lab, pharmacy, radiology or IPD bill. */
  discounts: LoyaltyDiscounts;
  /** Names from the programme's benefit list that this card includes. */
  benefits: string[];
}

export interface LoyaltyRule { points: number; max: number }

export interface LoyaltyScoring {
  /** Per completed year since the first OPD consultation. */
  perYear: LoyaltyRule;
  /** Per day the patient came in the last 12 months. */
  perVisit: LoyaltyRule;
  /** Per family member linked on an appointment ("family of"). */
  perFamilyMember: LoyaltyRule;
  /** Per patient they referred ("referred by" on an appointment). */
  perReferral: LoyaltyRule;
  /** Per follow-up they came back for. */
  perFollowUp: LoyaltyRule;
  /** A card with no activity for this many months is inactive and gives no benefits until the patient is back. */
  inactiveMonths: number;
}

export interface LoyaltyProgram {
  enabled: boolean;
  ranks: LoyaltyRank[];
  scoring: LoyaltyScoring;
  /** Every benefit the programme can offer; each card ticks the ones it includes. */
  benefitCatalogue: string[];
}

export const DEFAULT_BENEFITS = [
  "Zero wait", "VIP service", "Relationship Officer", "Dr Shishir Number", "Family Care", "Home Care (Normal)", "Old Age Care (Normal Rate)",
  "Home Visit – Lab / Med. Zero Charges (Extra)", "Financial Plan", "Mediclaim Policy", "Relation Death", "Credibility for Discount",
  "Career Guidance", "Business Guidance", "Wellness", "Coffee Meet", "Lunch / Dinner", "Short Trip", "Satkar",
];

export const DEFAULT_PROGRAM: LoyaltyProgram = {
  enabled: true,
  ranks: [
    { key: "basic", name: "Basic", tagline: "Infrequent referrer", color: "#8d6e63", minPoints: 0, opdFee: 400, erFee: 800, discounts: { lab: 10, pharmacy: 10, radiology: 10, ipd: 10 }, benefits: [] },
    { key: "silver", name: "Silver", tagline: "Frequent referrer", color: "#90a4ae", minPoints: 40, opdFee: 300, erFee: 700, discounts: { lab: 15, pharmacy: 10, radiology: 10, ipd: 15 }, benefits: ["Zero wait", "Family Care"] },
    { key: "gold", name: "Gold", tagline: "Long-time referrer", color: "#d4a017", minPoints: 90, opdFee: 200, erFee: 600, discounts: { lab: 20, pharmacy: 15, radiology: 15, ipd: 20 }, benefits: ["Zero wait", "Family Care", "Relationship Officer", "Home Care (Normal)", "Old Age Care (Normal Rate)", "Wellness"] },
    { key: "platinum", name: "Platinum", tagline: "Potential ambassador", color: "#5e6ad2", minPoints: 150, opdFee: 100, erFee: 500, discounts: { lab: 25, pharmacy: 15, radiology: 15, ipd: 25 }, benefits: ["Zero wait", "VIP service", "Relationship Officer", "Dr Shishir Number", "Family Care", "Home Care (Normal)", "Old Age Care (Normal Rate)", "Home Visit – Lab / Med. Zero Charges (Extra)", "Financial Plan", "Mediclaim Policy", "Credibility for Discount", "Wellness", "Coffee Meet"] },
    { key: "vip", name: "VIP", tagline: "Ambassador", color: "#1f2937", minPoints: 220, opdFee: 0, erFee: 0, discounts: { lab: 30, pharmacy: 20, radiology: 20, ipd: 30 }, benefits: [...["Zero wait", "VIP service", "Relationship Officer", "Dr Shishir Number", "Family Care", "Home Care (Normal)", "Old Age Care (Normal Rate)", "Home Visit – Lab / Med. Zero Charges (Extra)", "Financial Plan", "Mediclaim Policy", "Relation Death", "Credibility for Discount", "Career Guidance", "Business Guidance", "Wellness", "Coffee Meet", "Lunch / Dinner", "Short Trip", "Satkar"]] },
  ],
  scoring: {
    perYear: { points: 5, max: 50 },
    perVisit: { points: 2, max: 30 },
    perFamilyMember: { points: 5, max: 25 },
    perReferral: { points: 10, max: 50 },
    perFollowUp: { points: 2, max: 20 },
    inactiveMonths: 6,
  },
  benefitCatalogue: DEFAULT_BENEFITS,
};

/** The card a patient holds at this many points: the highest one whose minimum they have reached. */
export function rankForPoints(points: number, ranks: LoyaltyRank[]): LoyaltyRank {
  const sorted = [...ranks].sort((a, b) => a.minPoints - b.minPoints);
  let held = sorted[0];
  for (const r of sorted) if (points >= r.minPoints) held = r;
  return held;
}

// ── What the screens receive ────────────────────────────────────────────────────────────────────────────────────────────

export interface LoyaltyBreakdownLine { key: string; label: string; detail: string; points: number; max: number | null }

export interface LoyaltyMemberDTO {
  patientId: number;
  name: string;
  patientCode: string;
  phone: string;
  cardNo: string;
  rankKey: LoyaltyRankKey;
  rankName: string;
  tagline: string;
  color: string;
  /** 1 star for Basic up to 5 for VIP. */
  stars: number;
  points: number;
  autoPoints: number;
  manualPoints: number;
  breakdown: LoyaltyBreakdownLine[];
  status: "Active" | "Inactive";
  lastActivity: string | null;
  /** The next card, and how many more points it takes; null at the top. */
  next: { name: string; pointsNeeded: number } | null;
  /** 0–100: how far from this card's minimum to the next card's. */
  progress: number;
  referredCount: number;
  familyCount: number;
  /** Who referred this patient, and whose family they were booked under, from their own appointments. */
  referredBy: { patientId: number; name: string } | null;
  familyOf: { patientId: number; name: string; relation: string } | null;
}

export interface LoyaltySummaryDTO {
  members: number;
  /** Patients with no visit or bill for `inactiveMonths`: their cards are inactive. */
  inactive: number;
  /** The programme's inactivity window, in months (6 unless the hospital changed it). */
  inactiveMonths: number;
  /** The patients who have been quiet the longest (up to 6), so the admin can see who to bring back. */
  inactivePreview: { patientId: number; name: string; lastActivity: string | null; daysQuiet: number; rankName: string; color: string }[];
  referrals: number;
  families: number;
  byRank: { key: LoyaltyRankKey; name: string; color: string; count: number }[];
}

export interface LoyaltyListDTO { summary: LoyaltySummaryDTO; members: LoyaltyMemberDTO[]; total: number }

export interface LoyaltyLinkDTO {
  appointmentId: number;
  date: string;
  kind: "referral" | "family";
  /** The patient the appointment is for. */
  patientId: number;
  patientName: string;
  /** The referrer, or the person they are family of. */
  otherId: number;
  otherName: string;
  relation: string;
}

export interface LoyaltyDetailDTO extends LoyaltyMemberDTO {
  referrals: { patientId: number; name: string; date: string }[];
  family: { patientId: number; name: string; relation: string }[];
  adjustments: { id: number; points: number; reason: string; by: string; at: string }[];
}

/** What the bill needs to price a card holder. */
export interface LoyaltyPricingDTO {
  enrolled: boolean;
  rankKey: LoyaltyRankKey | null;
  rankName: string;
  color: string;
  status: "Active" | "Inactive";
  opdFee: number;
  erFee: number;
  discounts: LoyaltyDiscounts;
}
