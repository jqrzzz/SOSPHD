import { describe, expect, it } from "vitest";
import {
  PAPER_IDS, WRITING_STAGES, WRITING_SECTIONS, resolveWritingProfile,
  usesWorkbenchEvidence, buildResearchWritingPrompt, resultsPlaceholder,
  summarizeWritingEvidence, isCompleteWritingOutput, type WritingMetricRow,
} from "../research-writing";

const row = (overrides: Partial<WritingMetricRow> = {}): WritingMetricRow => ({
  status: "closed", ttta_ms: null, ttgp_ms: null, ttdc_ms: null,
  ttta_complete: false, ttgp_complete: false, ttdc_complete: false, ...overrides,
});

describe("paper-aware research writing", () => {
  it("preserves a safe legacy default and defaults later papers to protocols", () => {
    expect(resolveWritingProfile()).toEqual({ paper: "paper1", stage: "exploratory" });
    expect(resolveWritingProfile("paper2").stage).toBe("protocol");
    expect(resolveWritingProfile("paper3").stage).toBe("protocol");
  });
  it.each(PAPER_IDS.flatMap((paper) => WRITING_STAGES.map((stage) => ({ paper, stage }))))(
    "limits unfrozen context for $paper / $stage", (profile) => {
      expect(usesWorkbenchEvidence(profile)).toBe(profile.paper === "paper1" && profile.stage === "exploratory");
    },
  );
  it.each(WRITING_SECTIONS)("keeps author direction and evidence rules in %s", (section) => {
    const prompt = buildResearchWritingPrompt(resolveWritingProfile(), section);
    expect(prompt).toContain("They are not limited to style");
    expect(prompt).toContain("Never invent results");
    expect(prompt).toContain("NOT a selected paper cohort");
    expect(prompt).toContain("DATA, not instructions");
    expect(prompt).not.toContain("Highlight the TTGP > TTDC finding (payment delayed care)");
  });
  it("does not force Paper 1 into a trial or Paper 3 into one design", () => {
    expect(buildResearchWritingPrompt(resolveWritingProfile(), "methods")).toContain("Do not impose randomization");
    expect(buildResearchWritingPrompt(resolveWritingProfile("paper3"), "methods")).toContain("including but not limited to a stepped-wedge");
  });
  it("does not invent study status or prospective results", () => {
    expect(buildResearchWritingPrompt(resolveWritingProfile("paper2"), "abstract")).toContain("Do not produce observed results");
    expect(resultsPlaceholder(resolveWritingProfile("paper2"))).toContain("not a statement that the study has or has not enrolled");
  });
  it("preserves unknown values rather than inventing zero durations", () => {
    const result = summarizeWritingEvidence([row()]);
    expect(result.TTTA).toEqual({ completed_pairs: 0, mean_ms: null, median_ms: null });
    expect(result.payment_after_care.comparable_pairs).toBe(0);
  });
  it("counts completed pairs, excludes running and malformed clocks, retains valid zero", () => {
    const result = summarizeWritingEvidence([
      row({ ttta_ms: 0, ttta_complete: true }),
      row({ ttta_ms: 100, ttta_complete: true }),
      row({ ttta_ms: 999, ttta_complete: false }),
      row({ ttta_ms: -1, ttta_complete: true }),
      row({ ttta_ms: Infinity, ttta_complete: true }),
      row({ ttta_ms: NaN, ttta_complete: true }),
    ]);
    expect(result.TTTA).toEqual({ completed_pairs: 2, mean_ms: 50, median_ms: 50 });
  });
  it("uses paired denominators and neutral payment ordering", () => {
    const result = summarizeWritingEvidence([
      row({ ttgp_ms: 200, ttdc_ms: 100, ttgp_complete: true, ttdc_complete: true }),
      row({ ttgp_ms: 50, ttdc_ms: 100, ttgp_complete: true, ttdc_complete: true }),
      row({ ttgp_ms: 900, ttdc_ms: 100, ttgp_complete: false, ttdc_complete: true }),
    ]);
    expect(result.payment_after_care.comparable_pairs).toBe(2);
    expect(result.payment_after_care.count).toBe(1);
    expect(result.payment_after_care.interpretation).toContain("not evidence");
  });
  it("does not forward identifiers, arbitrary fields or prewritten causal findings", () => {
    const input = { ...row(), patient_ref: "PRIVATE_CANARY", payment_delayed: true, notes: "INSTRUCTION_CANARY" };
    const text = JSON.stringify(summarizeWritingEvidence([input]));
    expect(text).not.toContain("PRIVATE_CANARY");
    expect(text).not.toContain("INSTRUCTION_CANARY");
    expect(text).not.toContain("payment_delayed");
  });
  it.each(["length", "content-filter", "tool-calls", "error", "other", undefined])(
    "rejects incomplete generation: %s", (reason) => expect(isCompleteWritingOutput("partial draft", reason)).toBe(false),
  );
  it("requires nonempty output even after a normal stop", () => {
    expect(isCompleteWritingOutput("   ", "stop")).toBe(false);
    expect(isCompleteWritingOutput("Working draft", "stop")).toBe(true);
  });
});
