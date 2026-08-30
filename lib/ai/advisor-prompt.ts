/* ─── Advisor prompt assembly ──────────────────────────────────────────
 *  Builds the two blocks that go inside the advisor's <context>…</context>
 *  envelope: the data snapshot and the agent-intelligence summary.
 *
 *  WHY THIS IS ITS OWN MODULE. These formatters are the boundary where
 *  user-authored text enters a model prompt, which makes them the only
 *  thing standing between a crafted task title and an envelope breakout.
 *  They lived inside app/api/advisor/route.ts, where they could not be
 *  unit-tested — Next only permits route handlers to export HTTP verbs, so
 *  there was no way to reach them from a test. That is exactly backwards
 *  for security-critical code, and it is how the gap below survived.
 *
 *  THE RULE: every string that originates from a human or a model must go
 *  through sanitizeForContext before it is interpolated. Values that come
 *  from config, enums, counts, or computed durations do not need it — but
 *  when in doubt, sanitize. It is idempotent and costs nothing.
 * ────────────────────────────────────────────────────────────────────── */

import { sanitizeForContext } from "./sanitize";
import { AI_MAX_ILLUSTRATIVE_ROWS } from "./request-policy";
import { formatDuration } from "@/lib/data/metrics";
import type { buildContextSnapshot } from "@/lib/data/context-builder";
import type {
  getResearchPulse,
  suggestNextActions,
  detectGaps,
} from "@/lib/agent";

type ContextSnapshot = Awaited<ReturnType<typeof buildContextSnapshot>>;
type Pulse = Awaited<ReturnType<typeof getResearchPulse>>;
type Actions = Awaited<ReturnType<typeof suggestNextActions>>;
type Gaps = Awaited<ReturnType<typeof detectGaps>>;

/** The data snapshot block. */
export function formatContextForPrompt(ctx: ContextSnapshot): string {
  const lines: string[] = [
    `## Current Context Snapshot`,
    `User role: ${ctx.user_role}`,
    `Total cases: ${ctx.total_cases}`,
    "",
    `### Recent Cases (${ctx.recent_cases.length})`,
  ];

  for (const c of ctx.recent_cases) {
    // chief_complaint is operator-authored clinical free text.
    lines.push(
      `- ${c.patient_ref} | status: ${c.status} | severity: ${c.severity} | "${sanitizeForContext(c.chief_complaint)}" | created: ${c.created_at}`,
    );
  }

  if (ctx.active_case_metrics) {
    const m = ctx.active_case_metrics;
    lines.push("", `### Active Case Metrics (${m.case_id})`);
    lines.push(
      `- TTTA: ${m.ttta_ms !== null ? formatDuration(m.ttta_ms) : "N/A"} ${m.ttta_running ? "(running)" : ""}`,
    );
    lines.push(
      `- TTGP: ${m.ttgp_ms !== null ? formatDuration(m.ttgp_ms) : "N/A"} ${m.ttgp_running ? "(running)" : ""}`,
    );
    lines.push(
      `- TTDC: ${m.ttdc_ms !== null ? formatDuration(m.ttdc_ms) : "N/A"} ${m.ttdc_running ? "(running)" : ""}`,
    );
    if (m.missing_milestones.length > 0) {
      lines.push(`- Missing milestones: ${m.missing_milestones.join(", ")}`);
    }
  }

  if (ctx.missing_milestones_all.length > 0) {
    const missingForPrompt = ctx.missing_milestones_all.slice(
      0,
      AI_MAX_ILLUSTRATIVE_ROWS,
    );
    lines.push(
      "",
      `### Missing Milestones (${missingForPrompt.length} of ${ctx.missing_milestones_all.length} open/active cases)`,
    );
    for (const m of missingForPrompt) {
      lines.push(`- ${m.patient_ref} (${m.case_id}): ${m.missing.join(", ")}`);
    }
  }

  if (ctx.top_tasks.length > 0) {
    lines.push("", `### Top Tasks (${ctx.top_tasks.length})`);
    for (const t of ctx.top_tasks) {
      lines.push(`- [${t.status}] P${t.priority}: ${sanitizeForContext(t.title)}`);
    }
  }

  if (ctx.recent_notes.length > 0) {
    lines.push("", `### Recent Notes (${ctx.recent_notes.length})`);
    for (const n of ctx.recent_notes) {
      lines.push(
        `- ${sanitizeForContext(n.title) || "(untitled)"} (${n.created_at}): ${sanitizeForContext(n.content)}`,
      );
    }
  }

  return lines.join("\n");
}

/** The agent-intelligence block. */
export function formatAgentInsights(
  pulse: Pulse,
  actions: Actions,
  gaps: Gaps,
): string {
  const lines: string[] = [
    "",
    "## Agent Intelligence (Real-Time)",
    "",
    // Everything on this line is a number or a computed enum — no user text.
    `### Research Health: ${pulse.score}/100 (${pulse.health})`,
    `- Corridor coverage: ${pulse.corridorCoverage}`,
    `- High-priority gaps: ${pulse.highPriorityGaps}`,
    `- Total gaps: ${pulse.totalGaps}`,
    `- Open tasks: ${pulse.openTasks}`,
  ];

  if (actions.length > 0) {
    lines.push("", "### Suggested Next Actions");
    for (const a of actions) {
      // `action` and `area` are template strings built in lib/agent/tools.ts
      // from RESEARCH_DOMAIN / APP_CONFIG constants (corridor names, role
      // names, paper titles) — no user-authored text reaches them. Sanitized
      // anyway: it is idempotent, and the day someone interpolates a contact
      // name into a suggestion, this line should already be safe.
      lines.push(
        `- [${a.severity.toUpperCase()}] ${sanitizeForContext(a.action)} (${sanitizeForContext(a.area)})`,
      );
    }
  }

  if (gaps.totalGaps > 0) {
    lines.push("", `### Research Gaps (${gaps.totalGaps} total)`);
    // `gap` DOES carry user-authored text: lib/agent/tools.ts interpolates
    // task.title ("Overdue task: …") and protocol.title ("Protocol … is only
    // N% complete") straight into it. Those values remain untrusted even
    // though AI task auto-creation is disabled; sanitizing here prevents a
    // researcher-authored title from breaking the context envelope.
    const highGaps = gaps.gaps.filter((g) => g.severity === "high");
    for (const g of highGaps.slice(0, 5)) {
      lines.push(
        `- [HIGH] ${sanitizeForContext(g.gap)} — ${sanitizeForContext(g.suggestion)}`,
      );
    }
    const medGaps = gaps.gaps.filter((g) => g.severity === "medium");
    for (const g of medGaps.slice(0, 3)) {
      lines.push(`- [MED] ${sanitizeForContext(g.gap)}`);
    }
  }

  return lines.join("\n");
}
