import { describe, expect, it } from "vitest";
import {
  CANONICAL_REQUIREMENTS,
  computeCoverage,
  coverageSummary,
  greStance,
  portfolioRollup,
} from "../admissions-coverage";
import type { InstitutionRequirement } from "../admissions-types";

function req(over: Partial<InstitutionRequirement> = {}): InstitutionRequirement {
  return {
    id: Math.random().toString(36).slice(2),
    created_at: "2026-08-01T00:00:00Z",
    user_id: "u",
    institution_id: "i",
    kind: "document",
    label: "Something",
    detail: null,
    due_date: null,
    mandatory: true,
    status: "not_started",
    source_url: null,
    verified_at: null,
    ...over,
  };
}

const NOW = new Date("2026-08-16T00:00:00Z");
const NO_SUPERVISOR = { next_deadline: null, supervisor_required: false };

describe("the canonical set itself", () => {
  it("has unique slugs", () => {
    const slugs = CANONICAL_REQUIREMENTS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("is ordered by descending lead time — work that depends on other people first", () => {
    const leads = CANONICAL_REQUIREMENTS.map((c) => c.leadDays);
    expect([...leads].sort((a, b) => b - a)).toEqual(leads);
  });
});

describe("computeCoverage", () => {
  it("reports everything as unknown when nothing is recorded", () => {
    const c = computeCoverage(NO_SUPERVISOR, [], NOW);
    // supervisor_agreement drops out when the school does not require one.
    expect(c.items).toHaveLength(CANONICAL_REQUIREMENTS.length - 1);
    expect(c.unknown).toHaveLength(c.items.length);
    expect(c.coveragePct).toBe(0);
  });

  it("keeps the supervisor item only when the school requires one", () => {
    const withSup = computeCoverage(
      { next_deadline: null, supervisor_required: true }, [], NOW,
    );
    expect(withSup.items.some((i) => i.canonical.slug === "supervisor_agreement")).toBe(true);
    const without = computeCoverage(NO_SUPERVISOR, [], NOW);
    expect(without.items.some((i) => i.canonical.slug === "supervisor_agreement")).toBe(false);
  });

  it("distinguishes verified from merely recorded", () => {
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "Degree transcripts", verified_at: "2026-08-01T00:00:00Z" }),
      req({ label: "Research proposal" }),
    ], NOW);
    const by = (s: string) => c.items.find((i) => i.canonical.slug === s)!;
    expect(by("transcripts").state).toBe("verified");
    expect(by("research_proposal").state).toBe("recorded");
  });

  it("treats waived and not-applicable as established, not missing", () => {
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "GRE", status: "waived", verified_at: "2026-08-01T00:00:00Z" }),
    ], NOW);
    const gre = c.items.find((i) => i.canonical.slug === "gre")!;
    expect(gre.state).toBe("not_applicable");
    expect(c.unknown.some((i) => i.canonical.slug === "gre")).toBe(false);
  });

  it("lets one bundled row satisfy several canonical items", () => {
    // Real data: JHU records a single row covering four separate things.
    const c = computeCoverage(NO_SUPERVISOR, [
      req({
        label: "Statement of purpose, CV, references, transcripts",
        detail: "GRE optional.",
      }),
    ], NOW);
    const settled = ["personal_statement", "cv", "referees", "transcripts"];
    for (const slug of settled) {
      expect(
        c.items.find((i) => i.canonical.slug === slug)!.state,
        `${slug} should be matched by the bundled row`,
      ).toBe("recorded");
    }
    expect(c.extra).toHaveLength(0);
  });

  it("matches on the detail text, not only the label", () => {
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "Supporting material", detail: "Include an academic CV." }),
    ], NOW);
    expect(c.items.find((i) => i.canonical.slug === "cv")!.state).toBe("recorded");
  });

  it("does not let short tokens match inside unrelated words", () => {
    // "fee" must not match "coffee"; "cv" must not match "cvs"; "gre" must
    // not match "aggregate" or "degree" — that last one matters, because
    // "degree transcripts" appears in almost every real row.
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "Degree transcripts", detail: "Aggregate score required." }),
    ], NOW);
    expect(c.items.find((i) => i.canonical.slug === "gre")!.state).toBe("unknown");
    expect(c.items.find((i) => i.canonical.slug === "application_fee")!.state).toBe("unknown");
  });

  it("surfaces recorded requirements that match nothing canonical", () => {
    // School-specific quirks belong in `extra` rather than being forced
    // into the taxonomy. LSHTM's "which doctorate" decision is a real one.
    const odd = req({ label: "Decide PhD vs DrPH" });
    const c = computeCoverage(NO_SUPERVISOR, [odd], NOW);
    expect(c.extra.map((r) => r.id)).toEqual([odd.id]);
  });

  it("recognises an FTE capacity note as evidence about format compatibility", () => {
    // Real data: LSHTM records "Capacity check: 0.5 FTE sustained". That is
    // exactly the question format_compatibility asks, so it must count as
    // established rather than sitting unmatched while the item reads unknown.
    const c = computeCoverage(NO_SUPERVISOR, [
      req({
        label: "Capacity check: 0.5 FTE sustained",
        detail: "part-time candidature needs ~0.5 FTE (full-time = 35 hrs/week).",
        verified_at: "2026-08-14T00:00:00Z",
      }),
    ], NOW);
    expect(c.items.find((i) => i.canonical.slug === "format_compatibility")!.state)
      .toBe("verified");
  });
});

describe("lead time and lateness", () => {
  it("is undefined when no deadline is known — you cannot be late for no date", () => {
    const c = computeCoverage(NO_SUPERVISOR, [], NOW);
    expect(c.items.every((i) => i.behind === null)).toBe(true);
    expect(c.behind).toHaveLength(0);
  });

  it("flags items whose lead time exceeds the days remaining", () => {
    // 40 days out: referees (60d lead) are late, application fee (7d) is not.
    const c = computeCoverage(
      { next_deadline: "2026-09-25", supervisor_required: false }, [], NOW,
    );
    const by = (s: string) => c.items.find((i) => i.canonical.slug === s)!;
    expect(by("referees").behind).toBe(true);
    expect(by("application_fee").behind).toBe(false);
  });

  it("does not flag work that is already done", () => {
    const c = computeCoverage(
      { next_deadline: "2026-09-25", supervisor_required: false },
      [req({ label: "Referees", status: "done" })],
      NOW,
    );
    expect(c.items.find((i) => i.canonical.slug === "referees")!.behind).toBe(false);
  });

  it("flags unknown items too — unscoped work is the worst case", () => {
    const c = computeCoverage(
      { next_deadline: "2026-09-25", supervisor_required: false }, [], NOW,
    );
    const referees = c.items.find((i) => i.canonical.slug === "referees")!;
    expect(referees.state).toBe("unknown");
    expect(referees.behind).toBe(true);
  });
});

describe("coverageSummary", () => {
  it("leads with what is not known", () => {
    const c = computeCoverage(NO_SUPERVISOR, [], NOW);
    expect(coverageSummary(c)).toMatch(/required items unknown/);
  });

  it("says so plainly when nothing is outstanding", () => {
    const reqs = CANONICAL_REQUIREMENTS.map((canonical) =>
      req({ label: canonical.match[0], verified_at: "2026-08-01T00:00:00Z" }),
    );
    const c = computeCoverage(NO_SUPERVISOR, reqs, NOW);
    expect(c.unknown).toHaveLength(0);
    expect(coverageSummary(c)).toBe("Every requirement established");
    expect(c.coveragePct).toBe(100);
  });
});

describe("picking between several rows that match one item", () => {
  it("prefers a confirmed row over an unconfirmed one", () => {
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "GRE — unconfirmed note" }),
      req({ label: "GRE required", verified_at: "2026-08-01T00:00:00Z" }),
    ], NOW);
    expect(c.items.find((i) => i.canonical.slug === "gre")!.state).toBe("verified");
  });

  it("prefers a live requirement over one marked not-applicable", () => {
    // A correction sitting beside the row it corrects must not be masked
    // by the older, weaker claim.
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "GRE", status: "not_applicable" }),
      req({ label: "GRE is in fact required" }),
    ], NOW);
    expect(c.items.find((i) => i.canonical.slug === "gre")!.state).toBe("recorded");
  });

  it("does not leave the losing rows looking unmatched", () => {
    const c = computeCoverage(NO_SUPERVISOR, [
      req({ label: "GRE note one" }),
      req({ label: "GRE note two" }),
    ], NOW);
    expect(c.extra).toHaveLength(0);
  });
});

describe("scope", () => {
  it("tags every canonical item", () => {
    for (const c of CANONICAL_REQUIREMENTS) {
      expect(["portfolio", "per_school"], c.slug).toContain(c.scope);
    }
  });

  it("keeps fees, interviews and supervisor agreements per-school", () => {
    const bySlug = (s: string) => CANONICAL_REQUIREMENTS.find((c) => c.slug === s)!;
    for (const slug of ["application_fee", "interview", "supervisor_agreement", "funding_application", "personal_statement"]) {
      expect(bySlug(slug).scope, slug).toBe("per_school");
    }
    // One sitting, one CV, one set of transcripts serve every school.
    for (const slug of ["gre", "english_test", "cv", "transcripts", "referees"]) {
      expect(bySlug(slug).scope, slug).toBe("portfolio");
    }
  });
});

describe("portfolioRollup", () => {
  const school = (
    id: string,
    next_deadline: string | null,
    requirements: InstitutionRequirement[] = [],
  ) => ({ id, name: id, next_deadline, supervisor_required: false, requirements });

  it("collapses the same item across schools into one action", () => {
    const actions = portfolioRollup(
      [school("a", "2026-10-01"), school("b", "2026-12-01"), school("c", null)],
      NOW,
    );
    const cv = actions.find((a) => a.canonical.slug === "cv")!;
    expect(cv.blocking.map((b) => b.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("excludes per-school items entirely", () => {
    const actions = portfolioRollup([school("a", "2026-10-01")], NOW);
    expect(actions.every((a) => a.canonical.scope === "portfolio")).toBe(true);
    expect(actions.some((a) => a.canonical.slug === "application_fee")).toBe(false);
  });

  it("measures lateness against the soonest deadline it would miss", () => {
    // Referees need 60 days. School 'a' is 46 days out, 'b' is 107.
    const actions = portfolioRollup(
      [school("a", "2026-10-01"), school("b", "2026-12-01")],
      NOW,
    );
    const referees = actions.find((a) => a.canonical.slug === "referees")!;
    expect(referees.earliestDeadline).toBe("2026-10-01");
    expect(referees.daysToEarliest).toBe(46);
    expect(referees.behind).toBe(true);
  });

  it("drops a school once its copy of the work is done", () => {
    const done = req({ label: "Academic CV", status: "done" });
    const actions = portfolioRollup(
      [school("a", "2026-10-01", [done]), school("b", "2026-12-01")],
      NOW,
    );
    expect(actions.find((a) => a.canonical.slug === "cv")!.blocking.map((b) => b.id))
      .toEqual(["b"]);
  });

  it("keeps a school that merely has no date, since undated is not settled", () => {
    const actions = portfolioRollup([school("a", null)], NOW);
    const cv = actions.find((a) => a.canonical.slug === "cv")!;
    expect(cv.blocking.map((b) => b.id)).toEqual(["a"]);
    expect(cv.earliestDeadline).toBeNull();
    expect(cv.daysToEarliest).toBeNull();
    expect(cv.behind).toBe(false);
  });

  it("does not list an item a school has ruled out", () => {
    const na = req({ label: "GRE", status: "not_applicable" });
    const actions = portfolioRollup([school("a", "2026-10-01", [na])], NOW);
    expect(actions.some((a) => a.canonical.slug === "gre")).toBe(false);
  });

  it("orders late work first, then by how many schools it unblocks", () => {
    const actions = portfolioRollup(
      [school("a", "2026-10-01"), school("b", "2026-12-01")],
      NOW,
    );
    const late = actions.filter((a) => a.behind);
    expect(late.length).toBeGreaterThan(0);
    expect(actions.slice(0, late.length).every((a) => a.behind)).toBe(true);
  });
});

describe("optional requirements", () => {
  it("does not report an item the school called optional as behind", () => {
    // Duke-NUS records the GRE as optional. Knowing it is optional is a
    // positive finding, not an absence — it must not read as late work.
    const c = computeCoverage(
      { next_deadline: "2026-09-25", supervisor_required: false },
      [req({ label: "GRE (optional from 2026 intake)", mandatory: false })],
      NOW,
    );
    const gre = c.items.find((i) => i.canonical.slug === "gre")!;
    expect(gre.state).toBe("recorded");
    expect(gre.behind).toBe(false);
  });

  it("drops an optional item from the portfolio rollup for that school", () => {
    const actions = portfolioRollup([
      { id: "a", name: "a", next_deadline: "2026-10-01", supervisor_required: false,
        requirements: [req({ label: "GRE", mandatory: false })] },
      { id: "b", name: "b", next_deadline: "2026-12-01", supervisor_required: false,
        requirements: [] },
    ], NOW);
    expect(actions.find((a) => a.canonical.slug === "gre")!.blocking.map((b) => b.id))
      .toEqual(["b"]);
  });

  it("still blocks when the item is merely unknown", () => {
    // No row means no mandatory flag. Not knowing whether a school
    // requires something is not the same as being told it does not.
    const actions = portfolioRollup([
      { id: "a", name: "a", next_deadline: "2026-10-01", supervisor_required: false,
        requirements: [] },
    ], NOW);
    expect(actions.find((a) => a.canonical.slug === "gre")!.blocking).toHaveLength(1);
  });
});

describe("greStance", () => {
  it("is unknown when nothing on file mentions the GRE", () => {
    expect(greStance([req({ label: "Degree transcripts" })])).toBe("unknown");
  });

  it("reads a mandatory row as required", () => {
    expect(greStance([req({ label: "GRE REQUIRED — no exceptions" })])).toBe("required");
  });

  it("reads an optional row as not required", () => {
    expect(greStance([req({ label: "GRE (optional from 2026 intake)", mandatory: false })]))
      .toBe("not_required");
  });

  it("resolves contradictory rows toward required", () => {
    // JHU has both. Concluding "no GRE needed" from the optional row would
    // hide an eligibility bar until the deadline had passed.
    expect(greStance([
      req({ label: "Statement of purpose, CV, references", detail: "GRE optional.", mandatory: false }),
      req({ label: "CONFLICT: department page indicates GRE REQUIRED", mandatory: true }),
    ])).toBe("required");
  });

  it("ignores a row that has been waived", () => {
    expect(greStance([req({ label: "GRE", mandatory: true, status: "waived" })]))
      .toBe("not_required");
  });
});

describe("entry qualification", () => {
  const entry = () =>
    CANONICAL_REQUIREMENTS.find((c) => c.slug === "entry_qualification")!;

  it("leads the canonical set — it is the precondition beneath everything else", () => {
    expect(CANONICAL_REQUIREMENTS[0].slug).toBe("entry_qualification");
  });

  it("is per-school, because the bar differs by jurisdiction", () => {
    expect(entry().scope).toBe("per_school");
    expect(entry().applicability).toBe("universal");
  });

  it("matches how schools actually word their entry bar", () => {
    // Real wordings encountered across the shortlist.
    for (const label of [
      "Bachelor with good honours (2nd Upper or equivalent) minimum",
      "Master's degree normally required for DrPH applicants",
      "Entry requirement: upper second-class honours degree",
    ]) {
      const c = computeCoverage(NO_SUPERVISOR, [req({ label })], NOW);
      expect(
        c.items.find((i) => i.canonical.slug === "entry_qualification")!.state,
        label,
      ).toBe("recorded");
    }
  });

  it("reads as behind against any near deadline, because the remedy takes years", () => {
    // Unmet, the fix is a further degree. A 90-day runway does not touch it.
    const c = computeCoverage(
      { next_deadline: "2026-11-01", supervisor_required: false }, [], NOW,
    );
    expect(c.items.find((i) => i.canonical.slug === "entry_qualification")!.behind)
      .toBe(true);
  });
});
