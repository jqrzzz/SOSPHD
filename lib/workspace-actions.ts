"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createUpload,
  deleteUpload,
  createMindMap,
  updateMindMap,
  deleteMindMap,
} from "@/lib/data/workspace-store";
import type { UploadCategory, MindMapNode, MindMapEdge } from "@/lib/data/workspace-types";

// ── Schemas ──────────────────────────────────────────────────────────

const uploadSchema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.coerce.number().int().positive(),
  category: z.enum([
    "transcript",
    "pdf",
    "image",
    "video",
    "document",
    "other",
  ]),
  url: z.string().min(1),
  tags: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  linked_case_id: z.string().optional().default(""),
  linked_doc_id: z.string().optional().default(""),
});

// ── Upload actions ───────────────────────────────────────────────────

export async function createUploadAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    filename: formData.get("filename"),
    mime_type: formData.get("mime_type"),
    size_bytes: formData.get("size_bytes"),
    category: formData.get("category"),
    url: formData.get("url") ?? "#",
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
    linked_case_id: formData.get("linked_case_id") ?? "",
    linked_doc_id: formData.get("linked_doc_id") ?? "",
  };

  const parsed = uploadSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tagList = parsed.data.tags
    ? parsed.data.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  createUpload({
    filename: parsed.data.filename,
    mime_type: parsed.data.mime_type,
    size_bytes: parsed.data.size_bytes,
    category: parsed.data.category as UploadCategory,
    url: parsed.data.url,
    tags: tagList,
    notes: parsed.data.notes,
    linked_case_id: parsed.data.linked_case_id || null,
    linked_doc_id: parsed.data.linked_doc_id || null,
  });

  revalidatePath("/workspace");
  return { success: true };
}

export async function deleteUploadAction(id: string) {
  deleteUpload(id);
  revalidatePath("/workspace");
}

// ── Mind Map actions ─────────────────────────────────────────────────

export async function createMindMapAction(title: string) {
  const mm = createMindMap(title || "Untitled Map");
  revalidatePath("/workspace");
  return { id: mm.id };
}

export async function saveMindMapAction(
  id: string,
  data: { title?: string; nodes?: MindMapNode[]; edges?: MindMapEdge[] },
) {
  const result = updateMindMap(id, data);
  if (!result) return { error: "Mind map not found" };
  revalidatePath("/workspace");
  return { success: true };
}

export async function deleteMindMapAction(id: string) {
  deleteMindMap(id);
  revalidatePath("/workspace");
}
