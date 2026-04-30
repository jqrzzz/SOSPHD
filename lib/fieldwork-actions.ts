"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  createContact,
  updateContact,
  deleteContact,
  createProtocolFromTemplate,
  updateProtocol,
} from "@/lib/data/fieldwork-store";
import type { JournalEntryType, ContactRole } from "@/lib/data/fieldwork-types";
import { autoCategorize as runAutoCategorize } from "@/lib/agent";

export async function autoCategorizeAction(text: string) {
  return runAutoCategorize(text);
}

// ── Schemas ─────────────────────────────────────────────────────────

const journalSchema = z.object({
  entry_type: z.enum(["observation", "conversation", "interview", "site_visit", "event", "idea", "media"]),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  location: z.string().optional().default(""),
  corridor: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  contact_ids: z.string().optional().default(""),
  linked_case_id: z.string().optional().default(""),
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["doctor", "nurse", "hospital_admin", "insurance", "embassy", "transport", "government", "academic", "ngo", "fixer", "other"]),
  organization: z.string().optional().default(""),
  title: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  location: z.string().optional().default(""),
  corridor: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

// ── Journal Actions ─────────────────────────────────────────────────

export async function createJournalAction(
  _prevState: { error?: string; success?: boolean; id?: string } | null,
  formData: FormData,
) {
  const raw = {
    entry_type: formData.get("entry_type"),
    title: formData.get("title"),
    content: formData.get("content"),
    location: formData.get("location") ?? "",
    corridor: formData.get("corridor") ?? "",
    tags: formData.get("tags") ?? "",
    contact_ids: formData.get("contact_ids") ?? "",
    linked_case_id: formData.get("linked_case_id") ?? "",
  };

  const parsed = journalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tagList = parsed.data.tags
    ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const contactIdList = parsed.data.contact_ids
    ? parsed.data.contact_ids.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const entry = await createJournalEntry({
    entry_type: parsed.data.entry_type as JournalEntryType,
    title: parsed.data.title,
    content: parsed.data.content,
    location: parsed.data.location || null,
    corridor: parsed.data.corridor || null,
    tags: tagList,
    contact_ids: contactIdList,
    linked_case_id: parsed.data.linked_case_id || null,
  });

  revalidatePath("/fieldwork");
  return { success: true, id: entry?.id };
}

export async function updateJournalAction(
  id: string,
  data: {
    title?: string;
    content?: string;
    entry_type?: JournalEntryType;
    location?: string | null;
    corridor?: string | null;
    tags?: string[];
    contact_ids?: string[];
    linked_case_id?: string | null;
    is_pinned?: boolean;
  },
) {
  const result = await updateJournalEntry(id, data);
  if (!result) return { error: "Entry not found" };
  revalidatePath("/fieldwork");
  return { success: true };
}

export async function deleteJournalAction(id: string) {
  await deleteJournalEntry(id);
  revalidatePath("/fieldwork");
}

export async function togglePinAction(id: string, pinned: boolean) {
  await updateJournalEntry(id, { is_pinned: pinned });
  revalidatePath("/fieldwork");
}

// ── Contact Actions ─────────────────────────────────────────────────

export async function createContactAction(
  _prevState: { error?: string; success?: boolean; id?: string } | null,
  formData: FormData,
) {
  const raw = {
    name: formData.get("name"),
    role: formData.get("role"),
    organization: formData.get("organization") ?? "",
    title: formData.get("title") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    location: formData.get("location") ?? "",
    corridor: formData.get("corridor") ?? "",
    tags: formData.get("tags") ?? "",
    notes: formData.get("notes") ?? "",
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tagList = parsed.data.tags
    ? parsed.data.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const contact = await createContact({
    name: parsed.data.name,
    role: parsed.data.role as ContactRole,
    organization: parsed.data.organization || null,
    title: parsed.data.title || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    whatsapp: parsed.data.whatsapp || null,
    location: parsed.data.location || null,
    corridor: parsed.data.corridor || null,
    tags: tagList,
    notes: parsed.data.notes,
  });

  revalidatePath("/fieldwork");
  revalidatePath("/contacts");
  return { success: true, id: contact?.id };
}

export async function updateContactAction(
  id: string,
  data: Partial<{
    name: string;
    role: ContactRole;
    organization: string | null;
    title: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    location: string | null;
    corridor: string | null;
    tags: string[];
    notes: string;
    business_card_url: string | null;
  }>,
) {
  const result = await updateContact(id, data);
  if (!result) return { error: "Contact not found" };
  revalidatePath("/fieldwork");
  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContactAction(id: string) {
  await deleteContact(id);
  revalidatePath("/fieldwork");
  revalidatePath("/contacts");
}

// ── Protocol Actions ────────────────────────────────────────────────

export async function startProtocolAction(
  templateId: string,
  data: { location?: string; corridor?: string; linked_contact_ids?: string[] },
) {
  const protocol = await createProtocolFromTemplate(templateId, data);
  if (!protocol) return { error: "Template not found" };
  revalidatePath("/fieldwork");
  return { success: true, id: protocol.id };
}

export async function updateProtocolAction(
  id: string,
  data: Parameters<typeof updateProtocol>[1],
) {
  const result = await updateProtocol(id, data);
  if (!result) return { error: "Protocol not found" };
  revalidatePath("/fieldwork");
  return { success: true };
}
