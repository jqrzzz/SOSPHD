/* ─── Admissions module types ──────────────────────────────────────────
 *  The bureaucratic half of the PhD: institutions, what each demands,
 *  and every supervisor conversation.
 *
 *  Provenance rule (mirrors the [REF:] discipline in the papers): every
 *  institution and requirement carries source_url + verified_at. A null
 *  verified_at means "not confirmed against the official page" and the
 *  UI must say so — admissions details change every cycle.
 * ────────────────────────────────────────────────────────────────────── */

export type ApplicationStage =
  | "researching"
  | "shortlisted"
  | "contacting"
  | "preparing"
  | "submitted"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  researching: "Researching",
  shortlisted: "Shortlisted",
  contacting: "Contacting supervisors",
  preparing: "Preparing application",
  submitted: "Submitted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Not pursuing",
};

/** Study formats. `external` = research conducted off-campus under
 *  distant supervision — the model that fits an operating founder. */
export type StudyFormat = "full_time" | "part_time" | "by_publication" | "external";

export const STUDY_FORMAT_LABELS: Record<StudyFormat, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  by_publication: "By publication",
  external: "External / distance",
};

export type RequirementKind =
  | "deadline"
  | "test"
  | "document"
  | "reference"
  | "process"
  | "fee";

export type RequirementStatus =
  | "not_started"
  | "in_progress"
  | "done"
  | "waived"
  | "not_applicable";

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  waived: "Waived",
  not_applicable: "N/A",
};

export interface Institution {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  name: string;
  school: string | null;
  programme: string;
  country: string;
  city: string | null;
  formats: StudyFormat[];
  funding_model: string | null;
  /** True when a supervisor must agree BEFORE the application is filed —
   *  this inverts the timeline, making outreach the critical path. */
  supervisor_required: boolean;
  stage: ApplicationStage;
  fit_score: number | null;
  fit_rationale: string | null;
  next_deadline: string | null;
  next_deadline_label: string | null;
  homepage_url: string | null;
  notes: string;
  source_url: string | null;
  verified_at: string | null;
}

export interface InstitutionRequirement {
  id: string;
  created_at: string;
  user_id: string;
  institution_id: string;
  kind: RequirementKind;
  label: string;
  detail: string | null;
  due_date: string | null;
  mandatory: boolean;
  status: RequirementStatus;
  source_url: string | null;
  verified_at: string | null;
}

export interface Outreach {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  institution_id: string | null;
  contact_id: string | null;
  person_name: string;
  person_role: string | null;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  follow_up_at: string | null;
}

/** Whole-days from today until `date` (negative = past). */
export function daysUntil(date: string, now = new Date()): number {
  const target = new Date(`${date}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}

/** Urgency band for a deadline — drives the colour of the countdown. */
export function deadlineUrgency(
  days: number,
): "past" | "critical" | "soon" | "later" {
  if (days < 0) return "past";
  if (days <= 30) return "critical";
  if (days <= 90) return "soon";
  return "later";
}

/** Share of mandatory requirements that are done or waived. */
export function readiness(reqs: InstitutionRequirement[]): number {
  const mandatory = reqs.filter((r) => r.mandatory && r.status !== "not_applicable");
  if (mandatory.length === 0) return 0;
  const settled = mandatory.filter(
    (r) => r.status === "done" || r.status === "waived",
  ).length;
  return Math.round((settled / mandatory.length) * 100);
}
