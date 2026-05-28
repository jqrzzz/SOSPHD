/* ─── Fieldwork Mutations — SERVER ONLY ────────────────────────────────
 *  Write paths for research.journal_entries, research.contacts,
 *  research.protocols.
 *
 *  Lives in its own file (separate from fieldwork-store.ts) because it
 *  imports the server-side Supabase auth helper, which transitively
 *  pulls in `next/headers`. If this file were imported (directly or
 *  through fieldwork-store) by a client component, Turbopack would
 *  fail the build with:
 *    "You're importing a component that needs 'next/headers'."
 *
 *  Server actions in lib/fieldwork-actions.ts import from here for
 *  writes and from fieldwork-store for reads.
 * ────────────────────────────────────────────────────────────────────── */

import { requireAuthOrThrow } from "@/lib/supabase/server-auth";
import { getProtocolById } from "./fieldwork-store";
import type {
  JournalEntry,
  JournalEntryType,
  JournalAttachment,
  Contact,
  ContactRole,
  FieldProtocol,
} from "./fieldwork-types";

// ── Journal entries ─────────────────────────────────────────────────

export async function createJournalEntry(data: {
  entry_type: JournalEntryType;
  title: string;
  content: string;
  location?: string | null;
  corridor?: string | null;
  tags?: string[];
  contact_ids?: string[];
  linked_case_id?: string | null;
  attachments?: JournalAttachment[];
}): Promise<JournalEntry> {
  const { supabase: sb, userId } = await requireAuthOrThrow();

  const { data: row, error } = await sb
    .schema("research")
    .from("journal_entries")
    .insert({
      user_id: userId,
      entry_type: data.entry_type,
      title: data.title,
      content: data.content,
      location: data.location ?? null,
      corridor: data.corridor ?? null,
      tags: data.tags ?? [],
      contact_ids: data.contact_ids ?? [],
      linked_case_id: data.linked_case_id ?? null,
      attachments: data.attachments ?? [],
      is_pinned: false,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create journal entry: ${error?.message}`);
  }
  return row as JournalEntry;
}

export async function updateJournalEntry(
  id: string,
  data: Partial<
    Pick<
      JournalEntry,
      | "title"
      | "content"
      | "entry_type"
      | "location"
      | "corridor"
      | "tags"
      | "contact_ids"
      | "linked_case_id"
      | "is_pinned"
      | "attachments"
    >
  >,
): Promise<JournalEntry> {
  // Defense-in-depth: RLS already enforces ownership, but bound the
  // query by user_id so a misconfigured policy can't permit cross-user
  // writes. Same pattern for every UPDATE/DELETE in this file.
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("journal_entries")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update journal entry: ${error?.message}`);
  }
  return row as JournalEntry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to delete journal entry: ${error.message}`);
  }
}

// ── Contacts ────────────────────────────────────────────────────────

export async function createContact(data: {
  name: string;
  role: ContactRole;
  organization?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  location?: string | null;
  corridor?: string | null;
  tags?: string[];
  notes?: string;
  business_card_url?: string | null;
}): Promise<Contact> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("contacts")
    .insert({
      user_id: userId,
      name: data.name,
      role: data.role,
      organization: data.organization ?? null,
      title: data.title ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      location: data.location ?? null,
      corridor: data.corridor ?? null,
      tags: data.tags ?? [],
      notes: data.notes ?? "",
      linked_journal_ids: [],
      business_card_url: data.business_card_url ?? null,
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create contact: ${error?.message}`);
  }
  return row as Contact;
}

export async function updateContact(
  id: string,
  data: Partial<
    Pick<
      Contact,
      | "name"
      | "role"
      | "organization"
      | "title"
      | "email"
      | "phone"
      | "whatsapp"
      | "location"
      | "corridor"
      | "tags"
      | "notes"
      | "business_card_url"
      | "linked_journal_ids"
    >
  >,
): Promise<Contact> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("contacts")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update contact: ${error?.message}`);
  }
  return row as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { error } = await sb
    .schema("research")
    .from("contacts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`);
  }
}

// ── Protocols ───────────────────────────────────────────────────────

export async function createProtocolFromTemplate(
  templateId: string,
  data: {
    location?: string;
    corridor?: string;
    linked_contact_ids?: string[];
  },
): Promise<FieldProtocol> {
  const template = await getProtocolById(templateId);
  if (!template) {
    throw new Error("Template not found");
  }
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("protocols")
    .insert({
      user_id: userId,
      template_id: templateId,
      status: "in_progress",
      title: template.title,
      description: template.description,
      sections: template.sections,
      location: data.location ?? null,
      corridor: data.corridor ?? null,
      linked_journal_id: null,
      linked_contact_ids: data.linked_contact_ids ?? [],
    })
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to create protocol: ${error?.message}`);
  }
  return row as FieldProtocol;
}

export async function updateProtocol(
  id: string,
  data: Partial<
    Pick<
      FieldProtocol,
      | "status"
      | "sections"
      | "location"
      | "corridor"
      | "linked_journal_id"
      | "linked_contact_ids"
    >
  >,
): Promise<FieldProtocol> {
  const { supabase: sb, userId } = await requireAuthOrThrow();
  const { data: row, error } = await sb
    .schema("research")
    .from("protocols")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error || !row) {
    throw new Error(`Failed to update protocol: ${error?.message}`);
  }
  return row as FieldProtocol;
}
