/* ─── Advisor Mutations — SERVER ONLY ──────────────────────────────────
 *  Write paths for research.{notes, tasks, advisor_sessions,
 *  advisor_messages}.
 *
 *  Lives separate from advisor-store.ts (reads). Both files are
 *  currently only imported from server contexts, but this split
 *  prevents future drift if anyone imports advisor-store from a
 *  client component — server-auth.ts pulls next/headers and would
 *  poison the client bundle.
 *
 *  All functions:
 *    - Resolve auth via requireAuthOrThrow
 *    - Throw on missing auth or DB error (no more silent null returns)
 *    - Return non-nullable types
 *  Server actions in lib/advisor-actions.ts wrap each call in
 *  try/catch and return structured {error} envelopes to the UI.
 * ────────────────────────────────────────────────────────────────────── */

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import type {
  ResearchNote,
  ResearchTask,
  TaskStatus,
  AdvisorSession,
  AdvisorMessage,
  AdvisorRole,
} from "./advisor-types";

// ── Notes ────────────────────────────────────────────────────────────

export async function createNote(data: {
  title?: string | null;
  content: string;
  tags?: string[];
  linked_case_id?: string | null;
}): Promise<ResearchNote> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("notes")
    .insert({
      user_id: userId,
      title: data.title ?? null,
      content: data.content,
      tags: data.tags ?? [],
      linked_case_id: data.linked_case_id ?? null,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create note: ${error?.message}`);
  }
  return row as ResearchNote;
}

export async function updateNote(
  id: string,
  data: {
    title?: string | null;
    content?: string;
  },
): Promise<ResearchNote> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("notes")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update note: ${error?.message}`);
  }
  return row as ResearchNote;
}

export async function deleteNote(id: string): Promise<void> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("notes")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete note: ${error.message}`);
  }
}

// ── Tasks ────────────────────────────────────────────────────────────

export async function createTask(data: {
  title: string;
  description?: string | null;
  priority?: number;
  due_date?: string | null;
  linked_case_id?: string | null;
}): Promise<ResearchTask> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("tasks")
    .insert({
      user_id: userId,
      status: "todo",
      priority: data.priority ?? 2,
      due_date: data.due_date ?? null,
      title: data.title,
      description: data.description ?? null,
      linked_case_id: data.linked_case_id ?? null,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create task: ${error?.message}`);
  }
  return row as ResearchTask;
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<ResearchTask> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("tasks")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update task status: ${error?.message}`);
  }
  return row as ResearchTask;
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: number;
    due_date?: string | null;
  },
): Promise<ResearchTask> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("tasks")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update task: ${error?.message}`);
  }
  return row as ResearchTask;
}

export async function deleteTask(id: string): Promise<void> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("tasks")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`);
  }
}

// ── Sessions ────────────────────────────────────────────────────────

export async function createSession(title?: string): Promise<AdvisorSession> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("advisor_sessions")
    .insert({
      user_id: userId,
      title: title ?? "New Session",
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create session: ${error?.message}`);
  }
  return row as AdvisorSession;
}

// ── Messages ────────────────────────────────────────────────────────

export async function addMessage(data: {
  session_id: string;
  role: AdvisorRole;
  content: string;
  context_snapshot?: Record<string, unknown> | null;
}): Promise<AdvisorMessage> {
  const { supabase: sb } = await requireAuthOrThrow();
  const { data: row, error } = await sb
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
  if (error || !row) {
    throw new Error(`Failed to add message: ${error?.message}`);
  }
  return row as AdvisorMessage;
}
