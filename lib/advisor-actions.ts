"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createNote,
  createTask,
  createSession,
  updateTaskStatus,
} from "@/lib/data/advisor-store";

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

  await createNote({
    title: parsed.data.title || null,
    content: parsed.data.content,
    linked_case_id: parsed.data.linked_case_id || null,
  });

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

  await createTask({
    title: parsed.data.title,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    linked_case_id: parsed.data.linked_case_id || null,
  });

  revalidatePath("/advisor");
  return { success: true };
}

export async function createSessionAction(): Promise<{ id: string }> {
  const session = await createSession();
  revalidatePath("/advisor");
  return { id: session.id };
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

  const result = await updateTaskStatus(parsed.data.id, parsed.data.status);
  if (!result) {
    return { error: "Task not found" };
  }

  revalidatePath("/advisor");
  return { success: true };
}

/** Called by the API route after AI suggests tasks */
export async function createTasksFromAI(
  taskList: Array<{
    title: string;
    description?: string;
    priority?: number;
    linked_case_id?: string;
  }>,
) {
  for (const t of taskList) {
    await createTask({
      title: t.title,
      description: t.description ?? null,
      priority: t.priority ?? 2,
      linked_case_id: t.linked_case_id ?? null,
    });
  }
}
