/* ─── Advisor Store — READ paths (SERVER ONLY) ─────────────────────────
 *  Queries research.{notes, tasks, advisor_sessions, advisor_messages}.
 *
 *  SERVER ONLY as of the Phase 2 client unification: every consumer of
 *  this store is a server context (server components, API routes,
 *  lib/agent/tools.ts, lib/data/context-builder.ts), and the previous
 *  browser client carried no session cookies on the server — queries ran
 *  as `anon`, RLS returned nothing, and the seed fallback silently served
 *  fabricated content. The `server-only` import makes any future client
 *  import a build error instead of a repeat of that bug.
 *
 *  Fallback policy (lib/data/degraded.ts): seed data in dev, EMPTY in
 *  production, always with a [SOSPHD:DEGRADED] warning.
 *
 *  Per Phase 3 of audit-action-plan.md, this file is reads-only; writes
 *  live in advisor-mutations.ts.
 * ────────────────────────────────────────────────────────────────────── */

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode, seedOrEmpty } from "@/lib/data/degraded";
import type {
  ResearchNote,
  ResearchTask,
  TaskStatus,
  AdvisorSession,
} from "./advisor-types";

// ── Seed data (fallback) ─────────────────────────────────────────────

const DEMO_USER_ID = "user_demo";

const seedNotes: ResearchNote[] = [
  {
    id: "note_001",
    created_at: "2026-02-08T10:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    title: "TTGP delay pattern observed",
    content:
      "Cases 004 shows a 22-hour payment delay caused by insurer dispute over diving exclusion. This is a strong candidate for the TTGP paper — need to check if other scuba cases show similar delays.",
    tags: ["ttgp", "payment-delay", "scuba"],
    linked_case_id: "case_004",
  },
  {
    id: "note_002",
    created_at: "2026-02-09T14:30:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    title: "Stepped-wedge rollout plan",
    content:
      "Need to draft the rollout schedule for site onboarding. First 3 sites in Q2, next 5 in Q3. Each site activation = a new step in the wedge.",
    tags: ["methodology", "rollout"],
    linked_case_id: null,
  },
  {
    id: "note_003",
    created_at: "2026-02-10T09:15:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    title: "IRB submission draft",
    content:
      "Ethics review submitted to university board. Expected response in 4-6 weeks. De-identification protocol documented.",
    tags: ["irb", "ethics"],
    linked_case_id: null,
  },
  {
    id: "note_004",
    created_at: "2026-02-11T16:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    title: null,
    content: "Helicopter dispatch in case_001 was accepted by operator — first clean provenance chain recorded.",
    tags: ["provenance"],
    linked_case_id: "case_001",
  },
  {
    id: "note_005",
    created_at: "2026-02-12T08:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    title: "Paper 1 outline",
    content:
      "Title: Measuring TTDC and TTGP in Tourist Medical Emergencies. Structure: Intro, Definitions, Measurement Framework, Data Collection Protocol, Preliminary Results.",
    tags: ["paper-1", "writing"],
    linked_case_id: null,
  },
];

const seedTasks: ResearchTask[] = [
  {
    id: "task_001",
    created_at: "2026-02-08T10:30:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    status: "doing",
    priority: 1,
    due_date: "2026-02-20",
    title: "Complete Paper 1 methods section",
    description: "Draft the data collection protocol and TTDC/TTGP computation methodology for the measurement framework paper.",
    linked_case_id: null,
  },
  {
    id: "task_002",
    created_at: "2026-02-09T15:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    status: "todo",
    priority: 1,
    due_date: "2026-02-28",
    title: "Prepare IRB amendment for multi-site data",
    description: "Extend existing IRB approval to cover data from additional sites in the stepped-wedge rollout.",
    linked_case_id: null,
  },
  {
    id: "task_003",
    created_at: "2026-02-10T11:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    status: "todo",
    priority: 2,
    due_date: null,
    title: "Analyze payment delay patterns in diving cases",
    description: "Pull all cases tagged with diving/scuba activities and compute TTGP distributions. Look for insurer-specific patterns.",
    linked_case_id: "case_004",
  },
  {
    id: "task_004",
    created_at: "2026-02-11T09:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    status: "todo",
    priority: 2,
    due_date: "2026-03-15",
    title: "Draft site onboarding checklist",
    description: "Create a standardized checklist for onboarding new sites into the stepped-wedge trial.",
    linked_case_id: null,
  },
  {
    id: "task_005",
    created_at: "2026-02-12T07:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    status: "todo",
    priority: 3,
    due_date: null,
    title: "Review provenance completeness for case_002",
    description: "Case 002 is missing GUARANTEED_PAYMENT and DEFINITIVE_CARE_START events. Follow up with operator.",
    linked_case_id: "case_002",
  },
];

const seedSessions: AdvisorSession[] = [
  {
    id: "session_001",
    created_at: "2026-02-10T10:00:00Z",
    user_id: DEMO_USER_ID,
    title: "Paper 1 Planning",
  },
];

// ── Notes (reads only — writes in advisor-mutations.ts) ─────────────

export async function getNotes(limit = 10): Promise<ResearchNote[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!error && data) return data as ResearchNote[];
      if (error) warnDegradedMode("getNotes", error.message);
    } catch (e) {
      warnDegradedMode(
        "getNotes",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getNotes", "supabase env vars missing");
  }
  return seedOrEmpty(
    [...seedNotes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit),
    [],
  );
}

// ── Tasks (reads only) ──────────────────────────────────────────────

export async function getTasks(filters?: {
  status?: TaskStatus;
  limit?: number;
}): Promise<ResearchTask[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("tasks")
        .select("*")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 50);

      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (!error && data) return data as ResearchTask[];
      if (error) warnDegradedMode("getTasks", error.message);
    } catch (e) {
      warnDegradedMode(
        "getTasks",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getTasks", "supabase env vars missing");
  }

  let result = [...seedTasks];
  if (filters?.status) result = result.filter((t) => t.status === filters.status);
  result.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return seedOrEmpty(result.slice(0, filters?.limit ?? 50), []);
}

// ── Sessions (reads only) ───────────────────────────────────────────

export async function getSessions(): Promise<AdvisorSession[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("advisor_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) return data as AdvisorSession[];
      if (error) warnDegradedMode("getSessions", error.message);
    } catch (e) {
      warnDegradedMode(
        "getSessions",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getSessions", "supabase env vars missing");
  }
  return seedOrEmpty(
    [...seedSessions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ),
    [],
  );
}
