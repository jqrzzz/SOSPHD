import { generateText } from "ai";
import { z } from "zod";
import { buildPaperContext } from "@/lib/data/analytics";
import { requireOpenAIKey } from "@/lib/utils";

export const maxDuration = 60;

const requestSchema = z.object({
  section: z.enum(["methods", "results", "discussion", "abstract", "full_draft"]),
  custom_instructions: z.string().optional().default(""),
});

const SECTION_PROMPTS: Record<string, string> = {
  methods: `You are an academic writing assistant specializing in health services research methodology.

Generate a Methods section for a research paper studying tourist medical emergency coordination. Use the provided data context to write specific, accurate content.

Structure the section as:
### 3.1 Study Design
### 3.2 Setting and Participants
### 3.3 Intervention
### 3.4 Outcome Measures
### 3.5 Data Collection
### 3.6 Analysis

Requirements:
- Reference the stepped-wedge cluster randomized trial design
- Define TTDC, TTGP, and TTTA precisely with their event boundaries
- Mention the decision provenance framework (AI recommendation → human decision → outcome)
- Include the actual sample size and case counts from the data
- Use passive voice and past tense as appropriate for methods
- Be specific about measurement: timestamps, event types, computation formulas

Output in Markdown. No preamble.`,

  results: `You are an academic writing assistant specializing in health services research.

Generate a Results section for a research paper on tourist medical emergency coordination. Use the provided data to write factual, data-driven content.

Structure the section as:
### 4.1 Sample Characteristics
### 4.2 Primary Outcomes (TTDC and TTGP)
### 4.3 Secondary Outcomes (TTTA)
### 4.4 Payment Delay Analysis
### 4.5 AI Recommendation Provenance

Requirements:
- Report ALL numbers from the data context — sample sizes, means, medians
- Highlight the TTGP > TTDC finding (payment delayed care)
- Report AI recommendation acceptance/override rates
- Use appropriate academic hedging language
- Include severity distribution
- Reference specific cases by their pseudonymized patient_ref when illustrative

Output in Markdown. No preamble.`,

  discussion: `You are an academic writing assistant specializing in health services research.

Generate a Discussion section for a research paper on tourist medical emergency coordination. Use the provided data and findings context.

Structure as:
### 5.1 Principal Findings
### 5.2 Comparison with Prior Work
### 5.3 Implications for Practice
### 5.4 Strengths and Limitations
### 5.5 Future Directions

Requirements:
- Summarize the key findings (TTDC/TTGP relationship, payment delays, AI acceptance rates)
- Discuss the novelty of the TTGP metric
- Address the decision provenance contribution
- Acknowledge limitations: sample size, single-site, stepped-wedge power
- Suggest future multi-site studies

Output in Markdown. No preamble.`,

  abstract: `You are an academic writing assistant. Generate a structured abstract (250 words max) for a research paper on tourist medical emergency coordination.

Structure:
**Background:** ...
**Methods:** ...
**Results:** ...
**Conclusions:** ...

Use the provided data for accurate numbers. Output in Markdown. No preamble.`,

  full_draft: `You are an academic writing assistant specializing in health services research.

Generate a complete first draft of a research paper on tourist medical emergency coordination, using the provided data context.

Structure:
## Abstract
## 1. Introduction
## 2. Background
## 3. Methods
## 4. Results
## 5. Discussion
## 6. Conclusion

Requirements:
- Use all provided metrics and data points accurately
- The paper introduces TTDC and TTGP as novel metrics
- Frame the decision provenance framework as a methodological contribution
- Reference the stepped-wedge design for the multi-site evaluation
- Include specific numbers from the data context throughout
- Academic tone with appropriate hedging
- Aim for approximately 3000-4000 words

Output in Markdown. No preamble.`,
};

export async function POST(req: Request) {
  const guard = requireOpenAIKey();
  if (guard) return guard;

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { section, custom_instructions } = parsed.data;
  const paperCtx = await buildPaperContext();

  const dataContext = `
## Data Context (use these numbers in the paper)

${paperCtx.formatted.sample_size}

${paperCtx.formatted.metric_summary}

${paperCtx.formatted.payment_delay_finding}

${paperCtx.formatted.provenance_summary}

${paperCtx.formatted.severity_distribution}

## Raw Metric Table
${paperCtx.rows
  .map(
    (r) =>
      `- ${r.patient_ref} | sev=${r.severity} | status=${r.status} | TTTA=${r.ttta_ms !== null ? Math.round(r.ttta_ms / 60000) + "min" : "N/A"} | TTGP=${r.ttgp_ms !== null ? Math.round(r.ttgp_ms / 60000) + "min" : "N/A"} | TTDC=${r.ttdc_ms !== null ? Math.round(r.ttdc_ms / 60000) + "min" : "N/A"} | payment_delayed=${r.payment_delayed} | recs=${r.recommendation_count} accepted=${r.accepted_count} overridden=${r.override_count}`,
  )
  .join("\n")}
`;

  const systemPrompt = SECTION_PROMPTS[section];
  const userPrompt = custom_instructions
    ? `${dataContext}\n\n## Additional Instructions\n${custom_instructions}`
    : dataContext;

  const result = await generateText({
    model: "openai/gpt-4o-mini",
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: req.signal,
  });

  return Response.json({
    section,
    output: result.text,
    data_snapshot: {
      total_cases: paperCtx.summary.total_cases,
      closed_cases: paperCtx.summary.closed_cases,
      generated_at: new Date().toISOString(),
    },
  });
}
