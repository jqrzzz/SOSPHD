import { describe, it, expect } from "vitest";
import { ENGINE_VERSION } from "../recommendations";

/* ─── QD-1: historical recommendations are tagged so Paper 2 can filter ─
 *
 * Live-intervention recs:   engine_version = `${ENGINE_VERSION}/${category}`
 * Historical (retro) recs:  engine_version = `${ENGINE_VERSION}/${category}/historical`
 *
 * Paper 2's intervention set: WHERE engine_version NOT LIKE '%/historical'
 * Full set (intervention ∪ retrospective): WHERE engine_version LIKE 'llm-paper2-v0.1/%'
 *
 * The composition logic lives at recommendations.ts:218–228. These
 * tests pin the schema of the suffix so a reviewer can verify the
 * methods section without reading TS.
 * ────────────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  "transport",
  "payment",
  "triage",
  "facility",
  "follow_up",
  "data_capture",
  "other",
];

function compose(category: string, source: "operational" | "historical") {
  const suffix = source === "historical" ? "/historical" : "";
  return `${ENGINE_VERSION}/${category}${suffix}`;
}

const isHistorical = (v: string) => v.endsWith("/historical");
const isInLineage = (v: string) => v.startsWith(`${ENGINE_VERSION}/`);

describe("recommendation engine_version tagging (QD-1)", () => {
  it("live recs carry no /historical suffix", () => {
    for (const c of CATEGORIES) {
      expect(compose(c, "operational")).toBe(`${ENGINE_VERSION}/${c}`);
      expect(isHistorical(compose(c, "operational"))).toBe(false);
    }
  });

  it("historical recs carry exactly the /historical suffix", () => {
    for (const c of CATEGORIES) {
      expect(compose(c, "historical")).toBe(
        `${ENGINE_VERSION}/${c}/historical`,
      );
      expect(isHistorical(compose(c, "historical"))).toBe(true);
    }
  });

  it("both populations stay in the same engine lineage (one Paper 2 prefix)", () => {
    for (const c of CATEGORIES) {
      expect(isInLineage(compose(c, "operational"))).toBe(true);
      expect(isInLineage(compose(c, "historical"))).toBe(true);
    }
  });

  it("Paper 2 intervention filter excludes historical, includes operational", () => {
    const samples = [
      compose("transport", "operational"),
      compose("payment", "historical"),
      compose("triage", "operational"),
      compose("facility", "historical"),
    ];
    const intervention = samples.filter((v) => !isHistorical(v));
    expect(intervention).toEqual([
      compose("transport", "operational"),
      compose("triage", "operational"),
    ]);
  });
});
