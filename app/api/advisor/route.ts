/* ─── PhD Instructor — Advisor API Route ──────────────────────────────
 *  Loads the mandate (instructor's brief) and memory (running notes),
 *  builds a live research-context snapshot, streams a Claude response
 *  if ANTHROPIC_API_KEY is set, falls back to OpenAI otherwise.
 *
 *  After each turn, the memory file is updated in the background so the
 *  next session continues the thread.
 * ────────────────────────────────────────────────────────────────────── */

import {
  consumeStream,
  convertToModelMessages,
  generateText,
  streamText,
  type LanguageModel,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildContextSnapshot } from "@/lib/data/context-builder";
import { createTasksFromAI } from "@/lib/advisor-actions";
import { addMessage } from "@/lib/data/advisor-store";
import { formatDuration } from "@/lib/data/metrics";
import { getResearchPulse, suggestNextActions, detectGaps } from "@/lib/agent";
import { readMandate, readMemory, writeMemory } from "@/lib/instructor";

export const maxDuration = 60;

// ── Model selection ─────────────────────────────────────────────────

function pickModel(): LanguageModel | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4-6");
  }
  if (process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini");
  }
  return null;
}

// ── Live context formatting ─────────────────────────────────────────

function formatContextForPrompt(
  ctx: Awaited<ReturnType<typeof buildContextSnapshot>>,
): string {
  const lines: string[] = [
    `## Current Context Snapshot`,
    `User role: ${ctx.user_role}`,
    `Total cases: ${ctx.total_cases}`,
    "",
    `### Recent Cases (${ctx.recent_cases.length})`,
  ];

  for (const c of ctx.recent_cases) {
    lines.push(
      `- ${c.patient_ref} | status: ${c.status} | severity: ${c.severity} | "${c.chief_complaint}" | created: ${c.created_at}`,
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
    lines.push("", "### Missing Milestones (all open/active cases)");
    for (const m of ctx.missing_milestones_all) {
      lines.push(`- ${m.patient_ref} (${m.case_id}): ${m.missing.join(", ")}`);
    }
  }

  if (ctx.top_tasks.length > 0) {
    lines.push("", `### Top Tasks (${ctx.top_tasks.length})`);
    for (const t of ctx.top_tasks) {
      lines.push(`- [${t.status}] P${t.priority}: ${t.title}`);
    }
  }

  if (ctx.recent_notes.length > 0) {
    lines.push("", `### Recent Notes (${ctx.recent_notes.length})`);
    for (const n of ctx.recent_notes) {
      lines.push(
        `- ${n.title ?? "(untitled)"} (${n.created_at}): ${n.content}`,
      );
    }
  }

  return lines.join("\n");
}

function formatAgentInsights(
  pulse: Awaited<ReturnType<typeof getResearchPulse>>,
  actions: Awaited<ReturnType<typeof suggestNextActions>>,
  gaps: Awaited<ReturnType<typeof detectGaps>>,
): string {
  const lines: string[] = [
    "",
    "## Agent Intelligence (Real-Time)",
    "",
    `### Research Health: ${pulse.score}/100 (${pulse.health})`,
    `- Corridor coverage: ${pulse.corridorCoverage}`,
    `- High-priority gaps: ${pulse.highPriorityGaps}`,
    `- Total gaps: ${pulse.totalGaps}`,
    `- Open tasks: ${pulse.openTasks}`,
  ];

  if (actions.length > 0) {
    lines.push("", "### Suggested Next Actions");
    for (const a of actions) {
      lines.push(`- [${a.severity.toUpperCase()}] ${a.action} (${a.area})`);
    }
  }

  if (gaps.totalGaps > 0) {
    lines.push("", `### Research Gaps (${gaps.totalGaps} total)`);
    const highGaps = gaps.gaps.filter((g) => g.severity === "high");
    for (const g of highGaps.slice(0, 5)) {
      lines.push(`- [HIGH] ${g.gap} — ${g.suggestion}`);
    }
    const medGaps = gaps.gaps.filter((g) => g.severity === "medium");
    for (const g of medGaps.slice(0, 3)) {
      lines.push(`- [MED] ${g.gap}`);
    }
  }

  return lines.join("\n");
}

// ── Optional task extraction (if instructor emits a JSON task block) ─

function extractAndCreateTasks(text: string): void {
  const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (!jsonMatch) return;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      void createTasksFromAI(parsed.tasks);
    }
  } catch {
    // Not a tasks block — ignore.
  }
}

// ── Memory update ───────────────────────────────────────────────────

const MEMORY_UPDATE_SYSTEM = `You maintain the PhD instructor's running memory file. Read the current memory and the latest exchange, then return the UPDATED memory as markdown — nothing else, no commentary, no code fences.

Rules:
- Preserve the section structure exactly: Last session summary, Open questions, Working claims, Decisions already made, Paths explored and rejected.
- Keep total length under 4000 characters.
- Be brief. Bullet points. No padding.
- Roll out items the researcher has clearly resolved.
- Keep an item only if it is still active or still informs future sessions.
- Update "Last session summary" with one or two sentences about this exchange.`;

async function updateMemoryInBackground(
  model: LanguageModel,
  previousMemory: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  if (!userText.trim() && !assistantText.trim()) return;

  try {
    const { text } = await generateText({
      model,
      system: MEMORY_UPDATE_SYSTEM,
      prompt: [
        "# Current memory",
        previousMemory || "(empty — first session)",
        "",
        "# Latest exchange",
        "## Researcher",
        userText,
        "",
        "## Instructor",
        assistantText,
        "",
        "# Updated memory (markdown only):",
      ].join("\n"),
    });

    const trimmed = text.trim();
    if (trimmed.length > 80 && trimmed.length < 6000) {
      await writeMemory(trimmed);
    }
  } catch {
    // Silent: previous memory is still valid.
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractText(msg: { parts?: unknown[] } | undefined | null): string {
  if (!msg?.parts) return "";
  return msg.parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "text" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  const model = pickModel();
  if (!model) {
    return Response.json(
      {
        error:
          "No AI provider configured. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY in .env.local.",
      },
      { status: 503 },
    );
  }

  const {
    messages,
    sessionId,
  }: { messages: UIMessage[]; sessionId?: string } = await req.json();

  // Pull the instructor brief, memory, and live research context in parallel.
  const [mandate, memory, contextSnapshot, pulse, actions, gaps] =
    await Promise.all([
      readMandate(),
      readMemory(),
      buildContextSnapshot(),
      getResearchPulse(),
      suggestNextActions(5),
      detectGaps(),
    ]);

  const contextText = formatContextForPrompt(contextSnapshot);
  const agentText = formatAgentInsights(pulse, actions, gaps);

  const systemPrompt = [
    mandate,
    "",
    "---",
    "",
    "## Memory — your running notes across sessions",
    "",
    memory,
    "",
    "---",
    "",
    "## Live research context (computed at this turn)",
    "",
    contextText,
    agentText,
  ].join("\n");

  const result = streamText({
    model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages, isAborted }) => {
      if (isAborted) return;

      const assistantMsg = allMessages[allMessages.length - 1];
      const userMsg = allMessages[allMessages.length - 2];

      if (!assistantMsg || assistantMsg.role !== "assistant") return;

      const assistantText = extractText(assistantMsg);
      const userText = userMsg ? extractText(userMsg) : "";

      // Optional structured task creation.
      extractAndCreateTasks(assistantText);

      // Persist this turn (will silently no-op if the deployed schema
      // hasn't been wired yet — we'll address persistence later).
      if (sessionId) {
        await addMessage({
          session_id: sessionId,
          role: "assistant",
          content: assistantText,
          context_snapshot: contextSnapshot as unknown as Record<
            string,
            unknown
          >,
        });
      }

      // Update the running memory file so the next session picks up.
      await updateMemoryInBackground(model, memory, userText, assistantText);
    },
    consumeSseStream: consumeStream,
  });
}
