/* ─── Baseline stats (read-only) ───────────────────────────────────────
 *  Aggregates over research.cases + research.case_events — the 836-case
 *  historical baseline plus any research-native cases. Counting happens
 *  client-side (PostgREST aggregates are disabled on the project), which
 *  is fine at this scale; the tool reports when the row cap was hit so a
 *  partial read is never mistaken for the full dataset.
 * ────────────────────────────────────────────────────────────────────── */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { countBy, fail, okJson } from "../helpers.js";
import { research } from "../supabase.js";

const ROW_CAP = 5000;

export function registerBaselineTools(server: McpServer): void {
  server.tool(
    "get_baseline_stats",
    "Read-only summary of the research case registry: totals, corridor/diagnosis/payer " +
      "breakdowns, evacuations, and milestone-event coverage (the TTTA/TTGP/TTDC inputs).",
    {},
    async () => {
      const { q: casesQ } = await research("cases");
      const { data: cases, error: casesError } = await casesQ
        .select("corridor, diagnosis_bucket, payer_entity, evacuated, source")
        .limit(ROW_CAP);
      if (casesError) return fail(`get_baseline_stats failed: ${casesError.message}`);
      const caseRows = cases as {
        corridor: string | null;
        diagnosis_bucket: string | null;
        payer_entity: string | null;
        evacuated: boolean | null;
        source: string | null;
      }[];

      const { q: eventsQ } = await research("case_events");
      const { data: events, error: eventsError } = await eventsQ
        .select("event_type")
        .limit(ROW_CAP);
      if (eventsError) return fail(`get_baseline_stats failed: ${eventsError.message}`);
      const eventRows = events as { event_type: string }[];

      const payers = countBy(caseRows.map((c) => c.payer_entity));
      return okJson({
        total_cases: caseRows.length,
        capped:
          caseRows.length >= ROW_CAP || eventRows.length >= ROW_CAP
            ? `Row cap ${ROW_CAP} hit — counts are partial`
            : false,
        by_source: countBy(caseRows.map((c) => c.source)),
        by_corridor: countBy(caseRows.map((c) => c.corridor)),
        by_diagnosis_bucket: countBy(caseRows.map((c) => c.diagnosis_bucket)),
        top_payers: Object.fromEntries(Object.entries(payers).slice(0, 10)),
        distinct_payers: Object.keys(payers).length,
        evacuated_count: caseRows.filter((c) => c.evacuated === true).length,
        milestone_event_coverage: countBy(eventRows.map((e) => e.event_type)),
      });
    },
  );
}
