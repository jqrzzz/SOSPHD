/* ─── Application coverage — what we do NOT know ───────────────────────
 *  `research.institution_requirements` records what research turned up.
 *  That is not the same as what a school actually requires, and the
 *  difference is the dangerous part: a school with three recorded
 *  requirements and fifteen real ones looks tidy right up until the
 *  fortnight before a deadline.
 *
 *  This module holds the canonical set of things a research-degree
 *  application needs, matches recorded requirements onto it, and reports
 *  what is left over. The leftovers are the blindspots — items nobody has
 *  established either way. They are ranked ahead of ordinary unfinished
 *  work, because an unknown cannot be planned around and a known can.
 *
 *  DESIGN NOTE — why a code taxonomy rather than a table.
 *  The canonical list is a claim about how research-degree admissions
 *  work in general, not data about any one school. It changes when our
 *  understanding of the process changes, which is a code change with a
 *  diff and a review, not a row edit. Per-school facts stay in the
 *  database where they carry source_url and verified_at.
 *
 *  Pure functions only — no server-only import, so the UI can use these
 *  directly and the tests do not need a database.
 * ────────────────────────────────────────────────────────────────────── */

import type {
  Institution,
  InstitutionRequirement,
  RequirementKind,
} from "./admissions-types";

/** How universal an item is across research-degree applications. */
export type Applicability =
  /** Every application needs it. Absence is a gap, full stop. */
  | "universal"
  /** Needed by some schools, or by some applicants. Absence means we have
   *  not established WHETHER it applies — still an unknown, softer. */
  | "conditional";

/**
 * Whether one piece of work satisfies this item everywhere, or has to be
 * repeated per school.
 *
 * This is the difference between a list that reads as sixty unknowns and
 * one that reads as six actions. One IELTS sitting produces a score four
 * schools accept; one GRE booking serves three. Treating those as
 * independent per-school unknowns overstates the work several times over
 * and — worse — hides which single action has the most leverage.
 */
export type RequirementScope = "portfolio" | "per_school";

export interface CanonicalRequirement {
  slug: string;
  label: string;
  kind: RequirementKind;
  applicability: Applicability;
  scope: RequirementScope;
  /** Why this is on the list, and what goes wrong if it is discovered late. */
  why: string;
  /**
   * Working days of lead time before a deadline that this realistically
   * needs. Drives the "already late" calculation, which is the only part
   * of a checklist that does any work — an item needing six weeks against
   * a deadline four weeks out is not pending, it is missed.
   *
   * These are deliberate estimates, not sourced facts. They are stated
   * here rather than buried so they can be argued with.
   */
  leadDays: number;
  /** Lowercase substrings that identify this item in a recorded label. */
  match: string[];
}

/**
 * The canonical set. Ordered by when work must start, not by importance —
 * the referee ask and the credential evaluation outrank the proposal not
 * because they matter more but because they depend on other people.
 */
export const CANONICAL_REQUIREMENTS: CanonicalRequirement[] = [
  {
    slug: "format_compatibility",
    label: "Programme can be done without abandoning the operation",
    kind: "process",
    applicability: "universal",
    scope: "per_school",
    why:
      "This programme's own conclusion is that coordination timing must be captured prospectively by an instrumented operational system — which means the research depends on continued access to a running operation. A full-time residential programme abroad does not merely inconvenience that; it removes the data source. Whether a school permits part-time, external or split-site registration is therefore a precondition for applying at all, not a preference.",
    leadDays: 120,
    match: ["part-time", "part time", "full-time", "full time", "external", "distance", "split-site", "residency requirement", "fte", "capacity check"],
  },
  {
    slug: "supervisor_agreement",
    label: "Supervisor agreement secured",
    kind: "process",
    applicability: "conditional",
    scope: "per_school",
    why:
      "Where a named supervisor must agree before the form is filed, this is the whole timeline — the application cannot start until someone says yes. Singapore programmes generally work this way.",
    leadDays: 120,
    match: ["supervisor", "faculty member", "host", "advisor", "adviser"],
  },
  {
    slug: "funding_application",
    label: "Funding / scholarship application",
    kind: "process",
    applicability: "universal",
    scope: "per_school",
    why:
      "Scholarships are frequently a SEPARATE application with an EARLIER deadline than admission. This is the single most common way a candidate gets admitted and cannot afford to go.",
    leadDays: 90,
    match: ["funding", "scholarship", "studentship", "fellowship", "bursary", "stipend"],
  },
  {
    slug: "gre",
    label: "GRE",
    kind: "test",
    applicability: "conditional",
    scope: "portfolio",
    why:
      "Booking plus preparation plus score release. If a school requires it and it has not been booked, that school is out for the cycle — no amount of later effort recovers it. One sitting serves every school that accepts it, so the booking decision is made once across the whole shortlist.",
    leadDays: 90,
    match: ["gre"],
  },
  {
    slug: "data_governance",
    label: "Data governance — researching data your own company holds",
    kind: "process",
    applicability: "universal",
    scope: "per_school",
    why:
      "The registry behind these papers belongs to a company the candidate owns and operates. Every institution will want that addressed: a data-sharing or data-access agreement between the school and the company, a declared conflict of interest, an answer on who owns resulting IP, and a position on whether the candidate can be both the operator generating the data and the researcher analysing it. Schools differ substantially, and the answer shapes what can be published. Nothing on this is on file for any school.",
    leadDays: 90,
    match: ["data sharing", "data-sharing", "data access", "data governance", "conflict of interest", "intellectual property", "ip ownership", "dsa"],
  },
  {
    slug: "english_test",
    label: "English language test (IELTS / TOEFL)",
    kind: "test",
    applicability: "conditional",
    scope: "portfolio",
    why:
      "Whether a prior degree exempts you is school-specific and must be confirmed rather than assumed. Booking to score release runs several weeks, and scores expire. One sitting serves several schools — but check which test each accepts before booking, because at least one on this shortlist takes IELTS and not TOEFL.",
    leadDays: 75,
    match: ["ielts", "toefl", "english language", "english proficiency", "pte"],
  },
  {
    slug: "credential_evaluation",
    label: "Credential evaluation (WES / ECE)",
    kind: "document",
    applicability: "conditional",
    scope: "portfolio",
    why:
      "Third-party verification of foreign degrees. Weeks of turnaround entirely outside your control, and some schools require it in parallel with the application rather than after. One evaluation can usually be sent to several recipients, so it is ordered once.",
    leadDays: 75,
    match: ["wes", "credential evaluation", "ece", "naces", "transcript evaluation"],
  },
  {
    slug: "referees",
    label: "Referees / letters of recommendation",
    kind: "reference",
    applicability: "universal",
    scope: "portfolio",
    why:
      "Two or three letters, written by people with their own deadlines. Referees need four to six weeks' notice to write something useful rather than something dutiful. The quietest way an application fails. The same people serve every school, so the ask is made once — but at least one school on this shortlist requires an ACADEMIC referee, which is the binding constraint for a candidate whose recent years are operational rather than university-based.",
    leadDays: 60,
    match: ["referee", "reference", "recommendation", "letters of"],
  },
  {
    slug: "ethics_pathway",
    label: "Ethics / IRB pathway for this research",
    kind: "process",
    applicability: "universal",
    scope: "per_school",
    why:
      "Paper 1 carries an open action on exactly this and it cannot be closed without an institution. Two distinct approvals are needed and schools route them differently: retrospective analysis of de-identified operational records, and prospective collection of instrumented coordination data from live emergencies. The second is the harder one and shapes what Papers 2 and 3 can even attempt. Establishing the route is part of choosing the school, not something to discover after arriving.",
    leadDays: 60,
    match: ["ethics", "irb", "research governance", "human subjects", "ethical approval"],
  },
  {
    slug: "transcripts",
    label: "Degree transcripts",
    kind: "document",
    applicability: "universal",
    scope: "portfolio",
    why:
      "Official transcripts, often certified or sent institution-to-institution. Ordering and delivery are measured in weeks, not days.",
    leadDays: 45,
    match: ["transcript", "academic record", "mark sheet"],
  },
  {
    slug: "research_proposal",
    label: "Research proposal",
    kind: "document",
    applicability: "universal",
    scope: "portfolio",
    why:
      "The document the decision actually turns on for a research degree. Length and structure vary per school, so one proposal cannot simply be resent — it is retargeted each time.",
    leadDays: 45,
    match: ["proposal", "research plan", "research statement", "project outline"],
  },
  {
    slug: "degree_certificates",
    label: "Degree certificates",
    kind: "document",
    applicability: "universal",
    scope: "portfolio",
    why:
      "Scans of the awards themselves, sometimes notarised or translated. Cheap to produce, expensive to discover missing.",
    leadDays: 30,
    match: ["degree certificate", "diploma", "award certificate", "graduation certificate"],
  },
  {
    slug: "personal_statement",
    label: "Personal statement / statement of purpose",
    kind: "document",
    applicability: "universal",
    scope: "per_school",
    why:
      "Distinct from the proposal: why this person, this school, this moment. Schools differ on whether they want one, both, or a combined document.",
    leadDays: 30,
    match: ["personal statement", "statement of purpose", "sop", "motivation letter", "cover letter"],
  },
  {
    slug: "cv",
    label: "Academic CV",
    kind: "document",
    applicability: "universal",
    scope: "portfolio",
    why:
      "An academic CV is not a business CV — publications, presentations and funding lead; commercial roles are framed as research-relevant experience.",
    leadDays: 21,
    match: ["cv", "resume", "résumé", "curriculum vitae"],
  },
  {
    slug: "publications",
    label: "Publications / writing sample",
    kind: "document",
    applicability: "conditional",
    scope: "portfolio",
    why:
      "Some schools ask for a sample of written work. Whether a working paper counts, and whether an unpublished draft is acceptable, has to be confirmed.",
    leadDays: 21,
    match: ["publication", "writing sample", "written work", "portfolio"],
  },
  {
    slug: "passport_id",
    label: "Passport / identity document",
    kind: "document",
    applicability: "universal",
    scope: "portfolio",
    why:
      "Trivial unless the passport is close to expiry, in which case it blocks both the application and the visa behind it.",
    leadDays: 14,
    match: ["passport", "identity document", "national id", "identification"],
  },
  {
    slug: "interview",
    label: "Interview / selection process",
    kind: "process",
    applicability: "conditional",
    scope: "per_school",
    why:
      "Whether there is one, what form it takes, and whether it is scheduled across an inconvenient timezone. Knowing in advance is the whole value.",
    leadDays: 14,
    match: ["interview", "selection day", "shortlist call", "panel"],
  },
  {
    slug: "visa",
    label: "Student visa / immigration route",
    kind: "process",
    applicability: "conditional",
    scope: "per_school",
    why:
      "Post-offer, but the route and its evidence requirements shape whether a part-time or external format is even legal for a non-resident. Worth establishing before choosing a format.",
    leadDays: 14,
    match: ["visa", "immigration", "student pass", "cas", "i-20"],
  },
  {
    slug: "application_fee",
    label: "Application fee",
    kind: "fee",
    applicability: "universal",
    scope: "per_school",
    why:
      "Small, but a submission is not a submission until it is paid, and some systems will not release the form to reviewers without it.",
    leadDays: 7,
    match: ["fee", "payment", "application charge"],
  },
];

export type CoverageState =
  /** A matching requirement exists and was confirmed against the official page. */
  | "verified"
  /** A matching requirement exists but nobody has confirmed it. */
  | "recorded"
  /** Established as not applying here — waived, exempt, or not required. */
  | "not_applicable"
  /** Nothing on file either way. THE BLINDSPOT. */
  | "unknown";

export interface CoverageItem {
  canonical: CanonicalRequirement;
  state: CoverageState;
  /** The recorded requirement backing this, when there is one. */
  requirement: InstitutionRequirement | null;
  /**
   * True when the deadline is nearer than this item's lead time. Only
   * meaningful when a deadline is known; null otherwise, which is itself
   * worth showing — an unknown deadline makes every lead time unplannable.
   */
  behind: boolean | null;
}

export interface Coverage {
  items: CoverageItem[];
  unknown: CoverageItem[];
  /** Unknowns that are universal — these are gaps, not open questions. */
  unknownUniversal: CoverageItem[];
  behind: CoverageItem[];
  /** Recorded requirements matching no canonical item. Not a problem —
   *  school-specific quirks belong here — but shown so nothing is hidden. */
  extra: InstitutionRequirement[];
  /** Share of canonical items that are established either way, 0–100. */
  coveragePct: number;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

/**
 * Does a recorded requirement satisfy a canonical item?
 *
 * Matching is on the label and detail together, because the useful
 * signal is often in the detail ("Statement of purpose, CV, references,
 * transcripts" is one row covering four canonical items). A row may
 * therefore match several slugs, which is correct — schools bundle.
 */
function matches(req: InstitutionRequirement, canonical: CanonicalRequirement): boolean {
  const hay = normalise(`${req.label} ${req.detail ?? ""}`);
  return canonical.match.some((needle) => {
    const n = normalise(needle);
    // Short tokens ("cv", "gre", "sop", "fee") are substrings of ordinary
    // words, so they must match as whole words. Longer ones stay
    // substrings so prefixes keep working.
    if (n.length <= 4) return new RegExp(`\\b${n}\\b`).test(hay);
    return hay.includes(n);
  });
}

/**
 * Compare a school's recorded requirements against the canonical set.
 *
 * `deadline` is the date to measure lead times against — normally the
 * institution's next deadline. When it is null every `behind` is null,
 * because you cannot be late for a date nobody has established.
 */
export function computeCoverage(
  institution: Pick<Institution, "next_deadline" | "supervisor_required">,
  requirements: InstitutionRequirement[],
  now = new Date(),
): Coverage {
  const daysToDeadline = institution.next_deadline
    ? Math.round(
        (new Date(`${institution.next_deadline}T00:00:00Z`).getTime() -
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
          86_400_000,
      )
    : null;

  const claimed = new Set<string>();

  const items: CoverageItem[] = CANONICAL_REQUIREMENTS.map((canonical) => {
    // Several rows can match one canonical item — schools bundle, and a
    // later correction often sits alongside the row it corrects. Picking
    // whichever came back first would make the reported state depend on
    // row order, so rank: confirmed beats unconfirmed, and a live
    // requirement beats one marked not-applicable. The strongest claim
    // about what the school wants is the one worth showing.
    const rank = (r: InstitutionRequirement) =>
      r.status === "not_applicable" || r.status === "waived" ? 0
      : r.verified_at ? 2
      : 1;
    const req =
      requirements
        .filter((r) => matches(r, canonical))
        .sort((a, b) => rank(b) - rank(a))[0] ?? null;
    // Every matching row is claimed, not just the winner — otherwise the
    // losers would resurface in `extra` as if they matched nothing.
    for (const r of requirements) {
      if (matches(r, canonical)) claimed.add(r.id);
    }

    let state: CoverageState;
    if (!req) state = "unknown";
    else if (req.status === "not_applicable" || req.status === "waived")
      state = "not_applicable";
    else if (req.verified_at) state = "verified";
    else state = "recorded";

    // Finished work cannot be late. Unfinished work is late when the
    // deadline is nearer than the lead time — and an unknown item is the
    // worst case of all, since the work has not even been scoped yet.
    // With no deadline on file, lateness is undefined rather than false:
    // you cannot be late for a date nobody has established.
    //
    // `mandatory: false` counts as settled because it is a positive
    // finding, not an absence: the school has told us the item is
    // optional. Duke-NUS's GRE is the live example. An UNKNOWN item is
    // never settled by this route — it has no requirement row to carry
    // the flag, and not knowing whether something is required is not the
    // same as being told it is not.
    const settled =
      state === "not_applicable" ||
      req?.status === "done" ||
      req?.status === "waived" ||
      req?.mandatory === false;

    let behind: boolean | null;
    if (settled) behind = false;
    else if (daysToDeadline === null) behind = null;
    else behind = daysToDeadline < canonical.leadDays;

    return { canonical, state, requirement: req, behind };
  });

  // A school that does not require an agreed supervisor should not be
  // reported as missing one. This is the one canonical item the
  // institution record itself answers.
  const applicable = items.filter(
    (i) => !(i.canonical.slug === "supervisor_agreement" && !institution.supervisor_required),
  );

  const unknown = applicable.filter((i) => i.state === "unknown");
  const established = applicable.length - unknown.length;

  return {
    items: applicable,
    unknown,
    unknownUniversal: unknown.filter((i) => i.canonical.applicability === "universal"),
    behind: applicable.filter((i) => i.behind === true),
    extra: requirements.filter((r) => !claimed.has(r.id)),
    coveragePct:
      applicable.length === 0 ? 0 : Math.round((established / applicable.length) * 100),
  };
}

/** A school as the rollup needs to see it. */
export interface RollupSchool {
  id: string;
  name: string;
  next_deadline: string | null;
  supervisor_required: boolean;
  requirements: InstitutionRequirement[];
}

export interface PortfolioAction {
  canonical: CanonicalRequirement;
  /** Schools where this is still outstanding. */
  blocking: { id: string; name: string; deadline: string | null }[];
  /** Soonest deadline among the blocked schools; null when none has a date. */
  earliestDeadline: string | null;
  daysToEarliest: number | null;
  /** That soonest deadline is already inside the lead time this needs. */
  behind: boolean;
}

/**
 * Collapse portfolio items across the whole shortlist into single actions.
 *
 * The per-school view is honest but exhausting: it shows the same CV, the
 * same transcripts and the same English test as separate unknowns at every
 * school, so five applications read as sixty problems. Most of them are
 * one piece of work each. This groups them, counts how many schools each
 * unblocks, and measures lateness against the soonest deadline it would
 * miss rather than against any one school's.
 *
 * Per-school items are excluded by construction — those genuinely are
 * repeated work and belong on the school's own page.
 */
export function portfolioRollup(
  schools: RollupSchool[],
  now = new Date(),
): PortfolioAction[] {
  const actions = new Map<string, PortfolioAction>();

  for (const school of schools) {
    const coverage = computeCoverage(school, school.requirements, now);
    for (const item of coverage.items) {
      if (item.canonical.scope !== "portfolio") continue;

      // Settled here means this school no longer needs the work — either
      // it is finished, or the school has said it is optional. An unknown
      // is NOT settled: not knowing whether a school wants your
      // transcripts is not the same as it not wanting them.
      //
      // `behind === false` is exactly that predicate for an item with a
      // deadline, but it is also false for an undated item, so the
      // components are checked directly rather than reusing it.
      const settled =
        item.state === "not_applicable" ||
        item.requirement?.status === "done" ||
        item.requirement?.status === "waived" ||
        item.requirement?.mandatory === false;
      if (settled) continue;

      const action = actions.get(item.canonical.slug) ?? {
        canonical: item.canonical,
        blocking: [],
        earliestDeadline: null,
        daysToEarliest: null,
        behind: false,
      };
      action.blocking.push({
        id: school.id,
        name: school.name,
        deadline: school.next_deadline,
      });
      actions.set(item.canonical.slug, action);
    }
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (const action of actions.values()) {
    const dated = action.blocking
      .map((b) => b.deadline)
      .filter((d): d is string => d !== null)
      .sort();
    action.earliestDeadline = dated[0] ?? null;
    action.daysToEarliest =
      action.earliestDeadline === null
        ? null
        : Math.round(
            (new Date(`${action.earliestDeadline}T00:00:00Z`).getTime() - today) /
              86_400_000,
          );
    action.behind =
      action.daysToEarliest !== null &&
      action.daysToEarliest < action.canonical.leadDays;
  }

  // Late work first, then by how many schools the action unblocks, then by
  // lead time — so the ordering answers "what should I start today".
  return [...actions.values()].sort(
    (a, b) =>
      Number(b.behind) - Number(a.behind) ||
      b.blocking.length - a.blocking.length ||
      b.canonical.leadDays - a.canonical.leadDays,
  );
}

/**
 * One-line summary for a list row.
 *
 * Deliberately leads with what is NOT known. A progress percentage over
 * recorded requirements is the number that lets a half-researched
 * application look finished, which is the failure this module exists to
 * prevent.
 */
export function coverageSummary(c: Coverage): string {
  if (c.unknown.length === 0) return "Every requirement established";
  const universal = c.unknownUniversal.length;
  const rest = c.unknown.length - universal;
  const parts: string[] = [];
  if (universal > 0) parts.push(`${universal} required item${universal === 1 ? "" : "s"} unknown`);
  if (rest > 0) parts.push(`${rest} to confirm`);
  return parts.join(" · ");
}
