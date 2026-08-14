/* ─── PhD Agent Tools ─────────────────────────────────────────────────
 *  Each tool is a function the AI agent can invoke.
 *  Tools are the bridge between "thinking" and "doing."
 *
 *  Design principle: tools return structured data, not formatted text.
 *  The agent decides how to present results to the user.
 * ────────────────────────────────────────────────────────────────────── */

import { RESEARCH_DOMAIN } from "./domain";
import { categorizeText as pureCategorize } from "./categorize";
// Fieldwork reads are client-safe and default to the BROWSER client,
// which carries no session in this server-only module — every call here
// must pass the server client or RLS returns nothing (Phase 2 fix).
import { getJournalEntries, getContacts, getProtocols, getProtocolProgress } from "@/lib/data/fieldwork-store";
import { getServerSupabase } from "@/lib/supabase/server-auth";
import { getNotes, getTasks } from "@/lib/data/advisor-store";
import { createTask, createNote } from "@/lib/data/advisor-mutations";
import { getDocs } from "@/lib/data/docs-store";
import { getCases, getEventsByCaseId } from "@/lib/data/store";
import { computeAllMetrics } from "@/lib/data/metrics";

// ── Tool type definitions ───────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

// ── Tool: Research Status ───────────────────────────────────────────

async function getResearchStatus() {
  const sb = await getServerSupabase();
  const [journal, contacts, protocols, notes, tasks, docs, cases] = await Promise.all([
    getJournalEntries(undefined, sb),
    getContacts(undefined, sb),
    getProtocols(undefined, sb),
    getNotes(100),
    getTasks(),
    getDocs(),
    getCases(),
  ]);

  const activeProtocols = protocols.filter((p) => p.status === "in_progress");
  const completedProtocols = protocols.filter((p) => p.status === "completed");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const corridorsCovered = new Set(journal.map((e) => e.corridor).filter(Boolean));

  return {
    fieldwork: {
      journalEntries: journal.length,
      contacts: contacts.length,
      activeProtocols: activeProtocols.length,
      completedProtocols: completedProtocols.length,
      corridorsCovered: corridorsCovered.size,
      corridorsTotal: RESEARCH_DOMAIN.corridors.length,
      siteVisits: journal.filter((e) => e.entry_type === "site_visit").length,
      interviews: journal.filter((e) => e.entry_type === "interview").length,
    },
    writing: {
      documents: docs.length,
      activeDocs: docs.filter((d) => d.status === "active").length,
      drafts: docs.filter((d) => d.status === "draft").length,
    },
    tasks: {
      total: tasks.length,
      open: openTasks.length,
      highPriority: openTasks.filter((t) => t.priority === 1).length,
    },
    cases: {
      total: cases.length,
      open: cases.filter((c) => c.status === "open").length,
      active: cases.filter((c) => c.status === "active").length,
      closed: cases.filter((c) => c.status === "closed").length,
    },
    notes: notes.length,
    papers: RESEARCH_DOMAIN.papers.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
    })),
  };
}

// ── Tool: Identify Research Gaps ────────────────────────────────────

async function identifyResearchGaps() {
  const sb = await getServerSupabase();
  const [journal, contacts, protocols, tasks, docs] = await Promise.all([
    getJournalEntries(undefined, sb),
    getContacts(undefined, sb),
    getProtocols(undefined, sb),
    getTasks(),
    getDocs(),
  ]);

  const gaps: Array<{ area: string; gap: string; severity: "high" | "medium" | "low"; suggestion: string }> = [];

  // Check corridor coverage
  const coveredCorridors = new Set(journal.map((e) => e.corridor).filter(Boolean));
  for (const corridor of RESEARCH_DOMAIN.corridors) {
    if (!coveredCorridors.has(corridor.name)) {
      gaps.push({
        area: "fieldwork",
        gap: `No field data for ${corridor.name}`,
        severity: "high",
        suggestion: `Schedule a site visit to ${corridor.name}. Use the Corridor Assessment protocol template.`,
      });
    }
  }

  // Check contact role coverage
  const contactRoles = new Set(contacts.map((c) => c.role));
  const criticalRoles = ["doctor", "insurance", "transport", "hospital_admin"] as const;
  for (const role of criticalRoles) {
    if (!contactRoles.has(role)) {
      gaps.push({
        area: "network",
        gap: `No ${role} contacts in research network`,
        severity: "medium",
        suggestion: `Identify and add a ${role} contact. This role is critical for understanding the coordination chain.`,
      });
    }
  }

  // Check paper progress
  for (const paper of RESEARCH_DOMAIN.papers) {
    const relatedDocs = docs.filter((d) => d.tags.some((t) => t.includes(paper.id.replace("_", "-"))));
    if (relatedDocs.length === 0) {
      gaps.push({
        area: "writing",
        gap: `No documents tagged for ${paper.title}`,
        severity: paper.status === "drafting" ? "high" : "medium",
        suggestion: `Create a document for ${paper.fullTitle} and start outlining.`,
      });
    }

    for (const need of paper.dataNeeds) {
      const hasData = journal.some((e) =>
        e.content.toLowerCase().includes(need.toLowerCase().slice(0, 20))
      );
      if (!hasData) {
        gaps.push({
          area: "data",
          gap: `${paper.title}: missing "${need}"`,
          severity: "medium",
          suggestion: `Collect data for: ${need}`,
        });
      }
    }
  }

  // Check for stale tasks
  const staleTasks = tasks.filter((t) => {
    if (t.status === "done") return false;
    if (!t.due_date) return false;
    return new Date(t.due_date) < new Date();
  });
  for (const task of staleTasks) {
    gaps.push({
      area: "tasks",
      gap: `Overdue task: "${task.title}"`,
      severity: "high",
      suggestion: `Review and either complete or reschedule this task.`,
    });
  }

  // Check protocol completeness
  const incompleteProtocols = protocols.filter((p) => p.status === "in_progress");
  for (const protocol of incompleteProtocols) {
    const progress = getProtocolProgress(protocol);
    if (progress.percent < 50) {
      gaps.push({
        area: "fieldwork",
        gap: `Protocol "${protocol.title}" is only ${progress.percent}% complete`,
        severity: "medium",
        suggestion: `Complete the remaining ${progress.total - progress.checked} items in this protocol.`,
      });
    }
  }

  // Historical data import — resolved 2026-08-13 (836 cases ingested).
  // The check stays so a future status regression resurfaces the gap.
  if ((RESEARCH_DOMAIN.historicalData.status as string) === "pending_import") {
    gaps.push({
      area: "data",
      gap: `${RESEARCH_DOMAIN.historicalData.caseCount} historical cases not yet imported`,
      severity: "high",
      suggestion: `Import the ${RESEARCH_DOMAIN.historicalData.dateRange} case data into research.cases for baseline analysis.`,
    });
  }

  return {
    totalGaps: gaps.length,
    byArea: {
      fieldwork: gaps.filter((g) => g.area === "fieldwork").length,
      network: gaps.filter((g) => g.area === "network").length,
      writing: gaps.filter((g) => g.area === "writing").length,
      data: gaps.filter((g) => g.area === "data").length,
      tasks: gaps.filter((g) => g.area === "tasks").length,
    },
    gaps: gaps.sort((a, b) => {
      const sev = { high: 0, medium: 1, low: 2 };
      return sev[a.severity] - sev[b.severity];
    }),
  };
}

// ── Tool: Compute Case Metrics ──────────────────────────────────────

async function computeCaseMetrics(params: { case_id?: string }) {
  const cases = await getCases();
  const targetCases = params.case_id
    ? cases.filter((c) => c.id === params.case_id)
    : cases;

  const results = await Promise.all(
    targetCases.map(async (c) => {
      const events = await getEventsByCaseId(c.id);
      const metrics = computeAllMetrics(events);

      const present = new Set(events.map((e) => e.event_type));
      const missing = RESEARCH_DOMAIN.requiredMilestones.filter(
        (m) => !present.has(m),
      );

      return {
        case_id: c.id,
        patient_ref: c.patient_ref,
        status: c.status,
        severity: c.severity,
        eventCount: events.length,
        missingMilestones: missing,
        provenanceComplete: missing.length === 0,
        metrics: metrics.map((m) => ({
          abbreviation: m.abbreviation,
          value_ms: m.value_ms,
          is_running: m.is_running,
          minutes: m.value_ms ? Math.round(m.value_ms / 60000) : null,
        })),
      };
    }),
  );

  // Aggregate stats
  const completeCases = results.filter((r) => r.provenanceComplete);
  const ttdcValues = results
    .map((r) => r.metrics.find((m) => m.abbreviation === "TTDC")?.minutes)
    .filter((v): v is number => v !== null && v !== undefined);
  const ttgpValues = results
    .map((r) => r.metrics.find((m) => m.abbreviation === "TTGP")?.minutes)
    .filter((v): v is number => v !== null && v !== undefined);

  return {
    cases: results,
    summary: {
      totalCases: results.length,
      completeProvenance: completeCases.length,
      incompleteProvenance: results.length - completeCases.length,
      ttdc: ttdcValues.length > 0 ? {
        count: ttdcValues.length,
        mean: Math.round(ttdcValues.reduce((a, b) => a + b, 0) / ttdcValues.length),
        min: Math.min(...ttdcValues),
        max: Math.max(...ttdcValues),
      } : null,
      ttgp: ttgpValues.length > 0 ? {
        count: ttgpValues.length,
        mean: Math.round(ttgpValues.reduce((a, b) => a + b, 0) / ttgpValues.length),
        min: Math.min(...ttgpValues),
        max: Math.max(...ttgpValues),
      } : null,
    },
  };
}

// ── Tool: Auto-Categorize Text ──────────────────────────────────────
// Delegates to the pure helper in ./categorize (also safe for client use).

function categorizeText(params: { text: string }) {
  return pureCategorize(params.text);
}

// ── Tool: Create Task from Insight ──────────────────────────────────

async function createTaskFromInsight(params: {
  title: string;
  description: string;
  priority?: number;
  linked_case_id?: string;
}) {
  return createTask({
    title: params.title,
    description: params.description,
    priority: params.priority ?? 2,
    linked_case_id: params.linked_case_id ?? null,
  });
}

// ── Tool: Create Note from Insight ──────────────────────────────────

async function createNoteFromInsight(params: {
  title: string;
  content: string;
  tags?: string[];
  linked_case_id?: string;
}) {
  return createNote({
    title: params.title,
    content: params.content,
    tags: params.tags ?? [],
    linked_case_id: params.linked_case_id ?? null,
  });
}

// ── Tool: Corridor Analysis ─────────────────────────────────────────

async function analyzeCorridorCoverage() {
  const sb = await getServerSupabase();
  const [journal, contacts] = await Promise.all([
    getJournalEntries(undefined, sb),
    getContacts(undefined, sb),
  ]);

  return RESEARCH_DOMAIN.corridors.map((corridor) => {
    const entries = journal.filter((e) => e.corridor === corridor.name);
    const corridorContacts = contacts.filter((c) => c.corridor === corridor.name);

    return {
      id: corridor.id,
      name: corridor.name,
      characteristics: corridor.characteristics,
      knownBottlenecks: corridor.knownBottlenecks,
      coverage: {
        journalEntries: entries.length,
        siteVisits: entries.filter((e) => e.entry_type === "site_visit").length,
        contacts: corridorContacts.length,
        hasData: entries.length > 0,
      },
    };
  });
}

// ── Tool: Weekly Digest ─────────────────────────────────────────────

async function generateWeeklyDigest() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const cutoff = oneWeekAgo.toISOString();

  const sb = await getServerSupabase();
  const [journal, notes, tasks] = await Promise.all([
    getJournalEntries(undefined, sb),
    getNotes(100),
    getTasks(),
  ]);

  const recentEntries = journal.filter((e) => e.created_at >= cutoff);
  const recentNotes = notes.filter((n) => n.created_at >= cutoff);
  const completedTasks = tasks.filter((t) => t.status === "done");
  const openTasks = tasks.filter((t) => t.status !== "done");

  return {
    period: {
      from: cutoff,
      to: new Date().toISOString(),
    },
    activity: {
      newJournalEntries: recentEntries.length,
      newNotes: recentNotes.length,
      tasksCompleted: completedTasks.length,
      tasksOpen: openTasks.length,
    },
    highlights: recentEntries.map((e) => ({
      type: e.entry_type,
      title: e.title,
      corridor: e.corridor,
      date: e.created_at,
    })),
    urgentTasks: openTasks
      .filter((t) => t.priority === 1)
      .map((t) => ({ title: t.title, due: t.due_date })),
  };
}

// ── Export all tools ────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "get_research_status",
    description: "Get a comprehensive snapshot of the current research state: fieldwork progress, writing status, task counts, case metrics, and paper progress.",
    parameters: {},
    execute: async () => getResearchStatus(),
  },
  {
    name: "identify_research_gaps",
    description: "Analyze the research state and identify gaps: uncovered corridors, missing contact roles, data needs, overdue tasks, incomplete protocols.",
    parameters: {},
    execute: async () => identifyResearchGaps(),
  },
  {
    name: "compute_case_metrics",
    description: "Compute TTTA, TTGP, and TTDC metrics for one or all cases. Identifies missing milestones and provenance completeness.",
    parameters: {
      case_id: { type: "string", description: "Specific case ID, or omit for all cases" },
    },
    execute: async (params) => computeCaseMetrics({ case_id: params.case_id as string | undefined }),
  },
  {
    name: "categorize_text",
    description: "Auto-categorize text content: suggests entry type, tags, corridor, and detects metric mentions. Use for new journal entries or notes.",
    parameters: {
      text: { type: "string", description: "The text content to categorize", required: true },
    },
    execute: async (params) => categorizeText({ text: params.text as string }),
  },
  {
    name: "create_task",
    description: "Create a research task from an insight or gap identified during analysis.",
    parameters: {
      title: { type: "string", description: "Task title", required: true },
      description: { type: "string", description: "Task description", required: true },
      priority: { type: "number", description: "1=urgent, 2=normal, 3=low" },
      linked_case_id: { type: "string", description: "Related case ID" },
    },
    execute: async (params) => createTaskFromInsight(params as { title: string; description: string; priority?: number; linked_case_id?: string }),
  },
  {
    name: "create_note",
    description: "Create a research note from an AI-generated insight.",
    parameters: {
      title: { type: "string", description: "Note title", required: true },
      content: { type: "string", description: "Note content", required: true },
      tags: { type: "string[]", description: "Tags for the note" },
      linked_case_id: { type: "string", description: "Related case ID" },
    },
    execute: async (params) => createNoteFromInsight(params as { title: string; content: string; tags?: string[]; linked_case_id?: string }),
  },
  {
    name: "analyze_corridor_coverage",
    description: "Analyze research coverage across all corridors: which have field data, contacts, and site visits.",
    parameters: {},
    execute: async () => analyzeCorridorCoverage(),
  },
  {
    name: "generate_weekly_digest",
    description: "Generate a digest of research activity from the past 7 days.",
    parameters: {},
    execute: async () => generateWeeklyDigest(),
  },
];

/** Look up a tool by name */
export function getToolByName(name: string): ToolDefinition | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}
