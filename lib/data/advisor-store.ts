/* ─── In-Memory Advisor Store ──────────────────────────────────────────
 *  Same pattern as store.ts — swap for Supabase client calls later.
 * ────────────────────────────────────────────────────────────────────── */

import type {
  ResearchNote,
  ResearchTask,
  TaskStatus,
  AdvisorSession,
  AdvisorMessage,
  AdvisorRole,
} from "./advisor-types";

// ── Seed data ────────────────────────────────────────────────────────

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

const seedMessages: AdvisorMessage[] = [];

// ── Mutable store ────────────────────────────────────────────────────

const notes = [...seedNotes];
const tasks = [...seedTasks];
const sessions = [...seedSessions];
const messages = [...seedMessages];

let nextNoteNum = 6;
let nextTaskNum = 6;
let nextSessionNum = 2;
let nextMessageNum = 1;

// ── Notes ────────────────────────────────────────────────────────────

export function getNotes(limit = 10): ResearchNote[] {
  return [...notes]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export function createNote(data: {
  title?: string | null;
  content: string;
  tags?: string[];
  linked_case_id?: string | null;
}): ResearchNote {
  const note: ResearchNote = {
    id: `note_${String(nextNoteNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    title: data.title ?? null,
    content: data.content,
    tags: data.tags ?? [],
    linked_case_id: data.linked_case_id ?? null,
  };
  notes.push(note);
  return note;
}

// ── Tasks ────────────────────────────────────────────────────────────

export function getTasks(filters?: {
  status?: TaskStatus;
  limit?: number;
}): ResearchTask[] {
  let result = [...tasks];

  if (filters?.status) {
    result = result.filter((t) => t.status === filters.status);
  }

  // Sort by priority (asc), then created_at (desc)
  result.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return result.slice(0, filters?.limit ?? 50);
}

export function createTask(data: {
  title: string;
  description?: string | null;
  priority?: number;
  due_date?: string | null;
  linked_case_id?: string | null;
}): ResearchTask {
  const task: ResearchTask = {
    id: `task_${String(nextTaskNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    user_id: DEMO_USER_ID,
    site_id: null,
    status: "todo",
    priority: data.priority ?? 2,
    due_date: data.due_date ?? null,
    title: data.title,
    description: data.description ?? null,
    linked_case_id: data.linked_case_id ?? null,
  };
  tasks.push(task);
  return task;
}

export function updateTaskStatus(id: string, status: TaskStatus): ResearchTask | null {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.status = status;
  return task;
}

// ── Sessions ─────────────────────────────────────────────────────────

export function getSessions(): AdvisorSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function createSession(title?: string): AdvisorSession {
  const session: AdvisorSession = {
    id: `session_${String(nextSessionNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    user_id: DEMO_USER_ID,
    title: title ?? "New Session",
  };
  sessions.push(session);
  return session;
}

export function getSessionById(id: string): AdvisorSession | undefined {
  return sessions.find((s) => s.id === id);
}

// ── Messages ─────────────────────────────────────────────────────────

export function getMessagesBySessionId(sessionId: string): AdvisorMessage[] {
  return messages
    .filter((m) => m.session_id === sessionId)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

export function addMessage(data: {
  session_id: string;
  role: AdvisorRole;
  content: string;
  context_snapshot?: Record<string, unknown> | null;
}): AdvisorMessage {
  const msg: AdvisorMessage = {
    id: `msg_${String(nextMessageNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    session_id: data.session_id,
    role: data.role,
    content: data.content,
    context_snapshot: data.context_snapshot ?? null,
  };
  messages.push(msg);
  return msg;
}
