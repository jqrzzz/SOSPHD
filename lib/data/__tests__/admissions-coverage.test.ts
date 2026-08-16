import { describe, expect, it } from "vitest";
import {
  CANONICAL_REQUIREMENTS,
  computeCoverage,
  coverageSummary,
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
    const odd = req({ label: "Capacity check: 0.5 FTE sustained" });
    const c = computeCoverage(NO_SUPERVISOR, [odd], NOW);
    expect(c.extra.map((r) => r.id)).toEqual([odd.id]);
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
