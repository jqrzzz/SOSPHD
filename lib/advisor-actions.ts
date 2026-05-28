"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createNote,
  createTask,
  createSession,
  updateTaskStatus,
  updateNote,
  deleteNote,
  updateTask,
  deleteTask,
} from "@/lib/data/advisor-mutations";

// ── Schemas ──────────────────────────────────────────────────────────

const createNoteSchema = z.object({
  title: z.string().optional().default(""),
  content: z.string().min(1, "Content is required"),
  linked_case_id: z.string().optional().default(""),
});

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  linked_case_id: z.string().optional().default(""),
});

const updateTaskStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["todo", "doing", "done"]),
});

// ── Actions ─────────────────────────────────────────────────────────

export async function createNoteAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    title: formData.get("title") ?? "",
    content: formData.get("content"),
    linked_case_id: formData.get("linked_case_id") ?? "",
  };

  const parsed = createNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createNote({
      title: parsed.data.title || null,
      content: parsed.data.content,
      linked_case_id: parsed.data.linked_case_id || null,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create note",
    };
  }

  revalidatePath("/advisor");
  return { success: true };
}

export async function createTaskAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    priority: formData.get("priority") ?? "2",
    linked_case_id: formData.get("linked_case_id") ?? "",
  };

  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createTask({
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      linked_case_id: parsed.data.linked_case_id || null,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }

  revalidatePath("/advisor");
  return { success: true };
}

export async function createSessionAction(): Promise<{ id: string; error?: string }> {
  try {
    const session = await createSession();
    revalidatePath("/advisor");
    return { id: session.id };
  } catch (err) {
    return {
      id: "",
      error: err instanceof Error ? err.message : "Failed to create session",
    };
  }
}

export async function updateTaskStatusAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    id: formData.get("id"),
    status: formData.get("status"),
  };

  const parsed = updateTaskStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await updateTaskStatus(parsed.data.id, parsed.data.status);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update task status",
    };
  }

  revalidatePath("/advisor");
  return { success: true };
}

// ── Note update/delete ──────────────────────────────────────────────

export async function updateNoteAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing note ID" };

  const title = (formData.get("title") as string) || null;
  const content = formData.get("content") as string;
  if (!content) return { error: "Content is required" };

  try {
    await updateNote(id, { title, content });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update note",
    };
  }

  revalidatePath("/workspace");
  return { success: true };
}

export async function deleteNoteAction(id: string) {
  try {
    await deleteNote(id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete note",
    };
  }
  revalidatePath("/workspace");
  return { success: true };
}

// ── Task update/delete ──────────────────────────────────────────────

export async function updateTaskAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing task ID" };

  const title = formData.get("title") as string;
  if (!title) return { error: "Title is required" };

  const description = (formData.get("description") as string) || null;
  const priority = parseInt(formData.get("priority") as string) || 2;

  try {
    await updateTask(id, { title, description, priority });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update task",
    };
  }

  revalidatePath("/workspace");
  return { success: true };
}

export async function deleteTaskAction(id: string) {
  try {
    await deleteTask(id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete task",
    };
  }
  revalidatePath("/workspace");
  return { success: true };
}

/**
 * Called by the API route after AI suggests tasks. Best-effort:
 * failed inserts are logged and skipped so a single bad task doesn't
 * lose the rest.
 */
export async function createTasksFromAI(
  taskList: Array<{
    title: string;
    description?: string;
    priority?: number;
    linked_case_id?: string;
  }>,
) {
  for (const t of taskList) {
    try {
      await createTask({
        title: t.title,
        description: t.description ?? null,
        priority: t.priority ?? 2,
        linked_case_id: t.linked_case_id ?? null,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SOSPHD] createTasksFromAI: failed to create task "${t.title}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
