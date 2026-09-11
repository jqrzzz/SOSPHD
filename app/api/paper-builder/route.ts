import { generateText } from "ai";
import { z } from "zod";
import { buildPaperContext } from "@/lib/data/analytics";
import { modelFor } from "@/lib/ai/config";
import { gateAIUsage, gateResearchRequest } from "@/lib/ai/gate";
import {
  AI_CUSTOM_INSTRUCTIONS_MAX_CHARS,
  assertWithinAIEvidenceLimit,
  maxOutputTokensFor,
  readAIRequestJson,
  requestPolicyErrorResponse,
} from "@/lib/ai/request-policy";
import { neutralizeTag } from "@/lib/ai/sanitize";
import {
  PAPER_IDS,
  WRITING_STAGES,
  WRITING_SECTIONS,
  WRITING_POLICY_VERSION,
  resolveWritingProfile,
  usesWorkbenchEvidence,
  buildResearchWritingPrompt,
  resultsPlaceholder,
  summarizeWritingEvidence,
  isCompleteWritingOutput,
} from "@/lib/ai/research-writing";

export const maxDuration = 60;

const requestSchema = z.object({
  section: z.enum(WRITING_SECTIONS),
  paper: z.enum(PAPER_IDS).optional().default("paper1"),
  stage: z.enum(WRITING_STAGES).optional(),
  custom_instructions: z.string().max(AI_CUSTOM_INSTRUCTIONS_MAX_CHARS).optional().default(""),
});

export async function POST(req: Request) {
  const research = await gateResearchRequest();
  if (!research.ok) return research.response;

  let body: unknown;
  try {
    body = await readAIRequestJson(req);
  } catch (error) {
    const response = requestPolicyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { section, paper, stage, custom_instructions } = parsed.data;
  const profile = resolveWritingProfile(paper, stage);
  const baseReceipt = {
    section,
    profile,
    provisional: true,
    writing_policy_version: WRITING_POLICY_VERSION,
  };

  // A results placeholder needs neither a provider call nor workbench-record reads.
  // Null counts mean not loaded, not that the study enrolled zero cases.
  if (section === "results" && !usesWorkbenchEvidence(profile)) {
    return Response.json({
      ...baseReceipt,
      output: resultsPlaceholder(profile),
      model_id: null,
      data_snapshot: {
        total_cases: null,
        closed_cases: null,
        generated_at: new Date().toISOString(),
        source: "not_loaded",
        frozen: false,
      },
      warnings: ["No study-result dataset supplied. This is a reporting placeholder, not observed results."],
    });
  }

  const usage = gateAIUsage(research.grant, "paper_builder");
  if (!usage.ok) return usage.response;

  const evidence = usesWorkbenchEvidence(profile)
    ? summarizeWritingEvidence((await buildPaperContext()).rows)
    : null;
  const dataContext = evidence ? JSON.stringify(evidence, null, 2) : "No study-result dataset supplied.";
  const authorDirections = neutralizeTag(custom_instructions, "author_directions");
  const prompt = [
    `<evidence>\n${dataContext}\n</evidence>`,
    "The following directions are from the authenticated author. Follow their purpose and structure within the evidence, privacy and stage rules.",
    `<author_directions>\n${authorDirections}\n</author_directions>`,
  ].join("\n\n");

  try {
    assertWithinAIEvidenceLimit(prompt);
  } catch (error) {
    const response = requestPolicyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const model = modelFor("paper_builder");
  let result;
  try {
    result = await generateText({
      model,
      system: buildResearchWritingPrompt(profile, section),
      prompt,
      abortSignal: req.signal,
      maxOutputTokens: maxOutputTokensFor("paper_builder"),
    });
  } catch {
    // Provider errors can include prompt text. Do not expose or log it.
    return Response.json({
      error: "Writing generation failed. No document was changed.",
      code: "generation_failed",
    }, { status: 502 });
  }

  if (!isCompleteWritingOutput(result.text, result.finishReason)) {
    return Response.json({
      error: "The generated text was empty or did not finish normally. Try a smaller section. No document was changed.",
      code: "incomplete_generation",
    }, { status: 502 });
  }

  return Response.json({
    ...baseReceipt,
    output: result.text,
    model_id: result.response?.modelId ?? model.modelId,
    data_snapshot: {
      total_cases: evidence?.total_records ?? null,
      closed_cases: evidence?.closed_status_records ?? null,
      generated_at: new Date().toISOString(),
      source: evidence ? "live_workbench_unfrozen" : "not_loaded",
      frozen: false,
    },
    warnings: [evidence
      ? "Exploratory workbench context, not a verified paper cohort or frozen analysis. Check claims and citations before manuscript use."
      : "Planning draft without study results. Assumptions are not observations; approvals are not implied."],
  });
}
