import { generateText } from "ai";
import { z } from "zod";
import { getDocById, updateDoc } from "@/lib/data/docs-store";
import { createTask } from "@/lib/data/advisor-store";

export const maxDuration = 60;

const requestSchema = z.object({
  doc_id: z.string().min(1),
  mode: z.enum(["summarize", "rewrite", "outline", "extract_tasks", "one_pager"]),
  selection_text: z.string().optional(),
});

const MODE_PROMPTS: Record<string, string> = {
  summarize: `You are an academic research assistant. Produce a concise summary of the provided document content. Focus on:
- Key claims and findings
- Methodology described
- Data gaps identified
- Next steps mentioned

Output format: A clear, structured summary in Markdown. Do NOT add preamble like "Here is a summary" — just output the summary directly.`,

  rewrite: `You are an academic writing assistant specializing in health services research. Rewrite the provided content to be:
- Clear and precise academic prose
- Properly structured with logical flow
- Using appropriate hedging language for claims
- Formatted in Markdown with proper headings

Output the rewritten content in Markdown. Do NOT add preamble — just output the improved text directly. Preserve all section headings.`,

  outline: `You are a research structuring assistant. Generate a detailed academic paper outline from the provided content. Include:
- Section and subsection headings (## and ###)
- Bullet points describing what each section should cover
- Suggested word counts per section
- Notes on what data or analysis is needed

Output in Markdown format. Do NOT add preamble.`,

  extract_tasks: `You are a research project manager. Analyze the provided document and extract all actionable tasks. For each task, determine:
- A clear, specific title
- A brief description of what needs to be done
- Priority: 1 (urgent/blocking), 2 (important), 3 (nice-to-have)

Output ONLY a JSON object in this exact format:
\`\`\`json
{"tasks":[{"title":"...","description":"...","priority":2}]}
\`\`\`

Do NOT include any other text before or after the JSON block.`,

  one_pager: `You are an academic writing assistant. Convert the provided content into a polished one-page research summary suitable for:
- Conference submissions
- Grant applications
- Advisor meetings

Structure:
## Title
## Problem
## Approach
## Key Contributions
## Current Status
## Next Steps

Keep it under 500 words. Use clear, persuasive academic prose. Output in Markdown. Do NOT add preamble.`,
};

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { doc_id, mode, selection_text } = parsed.data;

  const doc = await getDocById(doc_id);
  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const contentToProcess = selection_text || doc.content_md;

  if (!contentToProcess.trim()) {
    return Response.json(
      { error: "No content to process. Write something first." },
      { status: 400 },
    );
  }

  const systemPrompt = MODE_PROMPTS[mode];

  const result = await generateText({
    model: "openai/gpt-4o-mini",
    system: systemPrompt,
    prompt: `Document title: "${doc.title}"\n\nContent:\n${contentToProcess}`,
    abortSignal: req.signal,
  });

  const outputText = result.text;

  // Handle task extraction
  if (mode === "extract_tasks") {
    const jsonMatch = outputText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const taskData = JSON.parse(jsonMatch[1]);
        if (taskData.tasks && Array.isArray(taskData.tasks)) {
          const createdTasks = await Promise.all(
            taskData.tasks.map(
              (t: { title: string; description?: string; priority?: number }) =>
                createTask({
                  title: t.title,
                  description: t.description ?? null,
                  priority: t.priority ?? 2,
                  linked_case_id: doc.linked_case_id ?? null,
                }),
            ),
          );
          return Response.json({
            mode,
            tasks_created: createdTasks.length,
            tasks: taskData.tasks,
            output: outputText,
          });
        }
      } catch {
        // Fall through to return raw output
      }
    }
  }

  // For rewrite and one_pager, optionally update the doc
  if (mode === "rewrite" || mode === "one_pager") {
    return Response.json({
      mode,
      output: outputText,
      doc_id,
      can_apply: true,
    });
  }

  return Response.json({
    mode,
    output: outputText,
    doc_id,
  });
}
