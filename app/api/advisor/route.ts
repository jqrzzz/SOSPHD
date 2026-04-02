import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { buildContextSnapshot } from "@/lib/data/context-builder";
import { createTasksFromAI } from "@/lib/advisor-actions";
import { addMessage } from "@/lib/data/advisor-store";
import { formatDuration } from "@/lib/data/metrics";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the ResearchOS Advisor — an internal PhD guidance counselor embedded in a tourist medical emergency coordination platform.

## Your Role
You help the researcher organize their PhD work, identify missing data, generate next steps, and convert messy notes into structured tasks. You reference existing case data but NEVER expose real patient identifiers — only pseudonymized patient_ref values.

## Response Structure
ALWAYS structure your responses with these four sections:

### What I Heard
Briefly restate the user's question or concern to confirm understanding.

### What We Know vs Don't Know
Summarize relevant data from the context snapshot. Highlight computed metrics (TTTA, TTGP, TTDC) and their status (running vs complete). Flag missing milestone events.

### Next 3 Actions
Provide exactly 3 concrete, prioritized next steps the researcher should take.

### Data Gaps to Close
List specific missing data points, events, or measurements that would strengthen the research or unblock the next paper.

## Task Creation
When you identify actionable tasks, include them in a fenced JSON block:
\`\`\`json
{"tasks":[{"title":"...","description":"...","priority":2,"linked_case_id":"..."}]}
\`\`\`
Priority: 1 = highest urgency, 2 = normal, 3 = low.
Only include linked_case_id if the task directly relates to a specific case.

## Key Metrics
- TTTA = Time to Transport Activation (FIRST_CONTACT → TRANSPORT_ACTIVATED)
- TTGP = Time to Guaranteed Payment (FIRST_CONTACT → GUARANTEED_PAYMENT) 
- TTDC = Time to Definitive Care (FIRST_CONTACT → DEFINITIVE_CARE_START)

## Security Rules
- NEVER fabricate patient data or case details
- Only reference data provided in the context snapshot
- patient_ref values are pseudonyms — treat them as safe to mention
- Do NOT speculate about patient identities or demographics beyond what is recorded`;

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
      lines.push(
        `- [${t.status}] P${t.priority}: ${t.title}`,
      );
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

async function extractAndCreateTasks(text: string): Promise<void> {
  const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (!jsonMatch) return;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      await createTasksFromAI(parsed.tasks);
    }
  } catch {
    // Invalid JSON — skip task creation silently
  }
}

export async function POST(req: Request) {
  const {
    messages,
    sessionId,
  }: { messages: UIMessage[]; sessionId?: string } = await req.json();

  // Build safe context
  const contextSnapshot = await buildContextSnapshot();
  const contextText = formatContextForPrompt(contextSnapshot);

  const result = streamText({
    model: "openai/gpt-4o-mini",
    system: `${SYSTEM_PROMPT}\n\n${contextText}`,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages: allMessages, isAborted }) => {
      if (isAborted) return;

      // Extract tasks from the last assistant message
      const lastMsg = allMessages[allMessages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg.parts) {
        const textContent = lastMsg.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("");

        await extractAndCreateTasks(textContent);

        // Persist assistant message with context snapshot
        if (sessionId) {
          await addMessage({
            session_id: sessionId,
            role: "assistant",
            content: textContent,
            context_snapshot: contextSnapshot as unknown as Record<string, unknown>,
          });
        }
      }
    },
    consumeSseStream: consumeStream,
  });
}
