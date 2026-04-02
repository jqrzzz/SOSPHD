/* ─── Supabase-Backed Advisor Store ───────────────────────────────────
 *  Reads/writes from research.notes, research.tasks,
 *  research.advisor_sessions, research.advisor_messages.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@/lib/supabase/server";
import type {
  ResearchNote,
  ResearchTask,
  TaskStatus,
  AdvisorSession,
  AdvisorMessage,
  AdvisorRole,
} from "./advisor-types";

// ── Notes ───────────────────────────────────────────────────────────

export async function getNotes(limit = 10): Promise<ResearchNote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as ResearchNote[];
}

export async function createNote(data: {
  title?: string | null;
  content: string;
  tags?: string[];
  linked_case_id?: string | null;
}): Promise<ResearchNote> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: note, error } = await supabase
    .schema("research")
    .from("notes")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      title: data.title ?? null,
      content: data.content,
      tags: data.tags ?? [],
      linked_case_id: data.linked_case_id ?? null,
    })
    .select()
    .single();

  if (error || !note) {
    throw new Error(`Failed to create note: ${error?.message}`);
  }

  return note as ResearchNote;
}

// ── Tasks ───────────────────────────────────────────────────────────

export async function getTasks(filters?: {
  status?: TaskStatus;
  limit?: number;
}): Promise<ResearchTask[]> {
  const supabase = await createClient();
  let query = supabase
    .schema("research")
    .from("tasks")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 50);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as ResearchTask[];
}

export async function createTask(data: {
  title: string;
  description?: string | null;
  priority?: number;
  due_date?: string | null;
  linked_case_id?: string | null;
}): Promise<ResearchTask> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: task, error } = await supabase
    .schema("research")
    .from("tasks")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 2,
      due_date: data.due_date ?? null,
      status: "todo",
      linked_case_id: data.linked_case_id ?? null,
    })
    .select()
    .single();

  if (error || !task) {
    throw new Error(`Failed to create task: ${error?.message}`);
  }

  return task as ResearchTask;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<ResearchTask | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as ResearchTask;
}

// ── Sessions ────────────────────────────────────────────────────────

export async function getSessions(): Promise<AdvisorSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("advisor_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as AdvisorSession[];
}

export async function createSession(title?: string): Promise<AdvisorSession> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: session, error } = await supabase
    .schema("research")
    .from("advisor_sessions")
    .insert({
      user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
      title: title ?? "New Session",
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error(`Failed to create session: ${error?.message}`);
  }

  return session as AdvisorSession;
}

export async function getSessionById(id: string): Promise<AdvisorSession | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("advisor_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return data as AdvisorSession;
}

// ── Messages ────────────────────────────────────────────────────────

export async function getMessagesBySessionId(sessionId: string): Promise<AdvisorMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("advisor_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as AdvisorMessage[];
}

export async function addMessage(data: {
  session_id: string;
  role: AdvisorRole;
  content: string;
  context_snapshot?: Record<string, unknown> | null;
}): Promise<AdvisorMessage> {
  const supabase = await createClient();
  const { data: msg, error } = await supabase
    .schema("research")
    .from("advisor_messages")
    .insert({
      session_id: data.session_id,
      role: data.role,
      content: data.content,
      context_snapshot: data.context_snapshot ?? null,
    })
    .select()
    .single();

  if (error || !msg) {
    throw new Error(`Failed to add message: ${error?.message}`);
  }

  return msg as AdvisorMessage;
}
