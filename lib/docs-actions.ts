"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createDoc,
  updateDoc,
  createVersion,
  getDocById,
} from "@/lib/data/docs-store";
import { DOC_FOLDERS } from "@/lib/data/docs-types";

// ── Schemas ──────────────────────────────────────────────────────────

const createDocSchema = z.object({
  title: z.string().min(1, "Title is required"),
  folder: z.string().default("General"),
  tags: z.string().optional().default(""),
  content_md: z.string().optional().default(""),
  linked_case_id: z.string().optional().default(""),
});

const updateDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Title is required").optional(),
  content_md: z.string().optional(),
  folder: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  linked_case_id: z.string().optional(),
});

const saveVersionSchema = z.object({
  doc_id: z.string().min(1),
  note: z.string().optional().default(""),
});

// ── Actions ─────────────────────────────────────────────────────────

export async function createDocAction(
  _prevState: { error?: string } | null,
  formData: FormData,
) {
  const raw = {
    title: formData.get("title"),
    folder: formData.get("folder") ?? "General",
    tags: formData.get("tags") ?? "",
    content_md: formData.get("content_md") ?? "",
    linked_case_id: formData.get("linked_case_id") ?? "",
  };

  const parsed = createDocSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tags = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const doc = await createDoc({
    title: parsed.data.title,
    folder: parsed.data.folder,
    tags,
    content_md: parsed.data.content_md,
    linked_case_id: parsed.data.linked_case_id || null,
  });

  redirect(`/docs/${doc?.id}`);
}

export async function updateDocAction(data: {
  id: string;
  title?: string;
  content_md?: string;
  folder?: string;
  status?: "draft" | "active" | "archived";
  linked_case_id?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const parsed = updateDocSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content_md !== undefined) updates.content_md = parsed.data.content_md;
  if (parsed.data.folder !== undefined) updates.folder = parsed.data.folder;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.linked_case_id !== undefined) {
    updates.linked_case_id = parsed.data.linked_case_id || null;
  }

  const result = await updateDoc(parsed.data.id, updates);
  if (!result) {
    return { error: "Document not found" };
  }

  revalidatePath(`/docs/${parsed.data.id}`);
  revalidatePath("/docs");
  return { success: true };
}

export async function saveVersionAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const raw = {
    doc_id: formData.get("doc_id"),
    note: formData.get("note") ?? "",
  };

  const parsed = saveVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const doc = await getDocById(parsed.data.doc_id);
  if (!doc) {
    return { error: "Document not found" };
  }

  await createVersion({
    doc_id: parsed.data.doc_id,
    content_md: doc.content_md,
    note: parsed.data.note || null,
  });

  revalidatePath(`/docs/${parsed.data.doc_id}`);
  return { success: true };
}

export async function restoreVersionAction(data: {
  doc_id: string;
  version_content: string;
}): Promise<{ error?: string; success?: boolean }> {
  // Save current state as a version before restoring
  const doc = await getDocById(data.doc_id);
  if (!doc) return { error: "Document not found" };

  await createVersion({
    doc_id: data.doc_id,
    content_md: doc.content_md,
    note: "Auto-saved before version restore",
  });

  const result = await updateDoc(data.doc_id, { content_md: data.version_content });
  if (!result) return { error: "Failed to restore version" };

  revalidatePath(`/docs/${data.doc_id}`);
  return { success: true };
}
