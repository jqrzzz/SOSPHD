/* ─── Funding module types ─────────────────────────────────────────────
 *  Grants, fellowships, government schemes, foundations, major donors.
 *
 *  eligibility_category is the organising idea. Most research funding
 *  requires an academic host institution and an enrolled or employed PI.
 *  Pre-acceptance there is neither — so a list that doesn't separate
 *  "can apply today" from "only after a PhD place" buries the handful
 *  that are actually actionable now.
 * ────────────────────────────────────────────────────────────────────── */

export type FundingStage =
  | "identified"
  | "assessing"
  | "preparing"
  | "submitted"
  | "awarded"
  | "declined"
  | "not_eligible"
  | "passed";

export const FUNDING_STAGE_LABELS: Record<FundingStage, string> = {
  identified: "Identified",
  assessing: "Assessing fit",
  preparing: "Preparing application",
  submitted: "Submitted",
  awarded: "Awarded",
  declined: "Declined",
  not_eligible: "Not eligible",
  passed: "Passed on",
};

export type EligibilityCategory =
  | "a_open_now"
  | "c_company_eligible"
  | "b_needs_affiliation";

export const ELIGIBILITY_LABELS: Record<EligibilityCategory, string> = {
  a_open_now: "Open to you now",
  c_company_eligible: "Tourist SOS can apply",
  b_needs_affiliation: "Needs a university place first",
};

export const ELIGIBILITY_BLURB: Record<EligibilityCategory, string> = {
  a_open_now:
    "Open to independent or early-career researchers — no institutional affiliation required.",
  c_company_eligible:
    "Applies at the organisation level, so Tourist SOS can be the applicant rather than you personally.",
  b_needs_affiliation:
    "Requires an academic host institution or an enrolled/employed principal investigator — unlocks once a PhD place is confirmed.",
};

/** Display order: what you can act on today comes first. */
export const ELIGIBILITY_ORDER: EligibilityCategory[] = [
  "a_open_now",
  "c_company_eligible",
  "b_needs_affiliation",
];

export type FundingKind =
  | "grant"
  | "fellowship"
  | "scholarship"
  | "government"
  | "foundation"
  | "prize"
  | "donor"
  | "industry";

export interface FundingOpportunity {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  name: string;
  funder: string;
  kind: FundingKind;
  geography: string | null;
  amount_note: string | null;
  deadline_note: string | null;
  next_deadline: string | null;
  eligibility_note: string | null;
  eligibility_category: EligibilityCategory;
  relevance: string | null;
  stage: FundingStage;
  fit_score: number | null;
  confidence: string;
  caveats: string | null;
  notes: string;
  source_url: string | null;
  verified_at: string | null;
}

/** Stages that are no longer live work. */
const CLOSED: FundingStage[] = ["declined", "not_eligible", "passed"];

export function isLive(o: FundingOpportunity): boolean {
  return !CLOSED.includes(o.stage);
}
