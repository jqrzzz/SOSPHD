/* Explicit fieldwork read results. No demo/empty fallback on this path.
 * Client-safe; server callers MUST pass their authenticated client, including null.
 * Existing legacy store callers are left intact for the separate research-use PR.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/db";
import { orIlikeContains } from "./pgrst";
import { JOURNAL_ENTRY_TYPES } from "@/lib/fieldwork/journal-capture";
import type { JournalEntry, Contact, FieldProtocol } from "./fieldwork-types";

export type FieldworkRead<T> = { ok: true; data: T } | { ok: false; error: string };
export interface JournalQuery {
  page?: number; search?: string; entry_type?: string; pinned_only?: boolean; tag?: string;
}
export const JOURNAL_PAGE_SIZE = 50;
export const FIELDWORK_SUPPORT_LIMIT = 100;
export interface JournalPage {
  entries: JournalEntry[]; total: number; page: number; has_more: boolean;
}
export interface FieldworkSupport {
  contacts: Contact[]; templates: FieldProtocol[]; protocols: FieldProtocol[];
  contact_total: number; template_total: number; protocol_total: number;
}
const UNAVAILABLE = "Fieldwork could not be loaded. This does not mean no records exist. Sign in with research access or retry.";

export function parseJournalQuery(input: JournalQuery = {}) {
  const { page = 0, search = "", entry_type = "all", pinned_only = false, tag = "" } = input;
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000 ||
      typeof search !== "string" || search.length > 100 || search.includes("\0") ||
      typeof tag !== "string" || tag.length > 100 || tag.includes("\0") ||
      typeof pinned_only !== "boolean" ||
      (entry_type !== "all" && !JOURNAL_ENTRY_TYPES.some((t) => t === entry_type))) {
    throw new Error("Invalid fieldwork filter.");
  }
  return { page, search: search.trim(), entry_type, pinned_only, tag: tag.trim() };
}

async function readContext(client?: SupabaseClient | null) {
  // A deliberately supplied null server client must NOT resolve a browser fallback.
  const sb = client === undefined ? getSupabase() : client;
  if (!sb) throw new Error(UNAVAILABLE);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user?.id) throw new Error(UNAVAILABLE);
  const db = sb.schema("research");
  const allowed = await db.rpc("is_allowed_user");
  if (allowed.error || allowed.data !== true) throw new Error(UNAVAILABLE);
  return { db, owner: data.user.id };
}

function validCount(count: unknown): count is number {
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
}

/** Filters run in the database BEFORE paging, including the dedicated pinned view.
 * Counts describe this owner's matching records at read time, not unique episodes
 * or eligible research evidence. Offset pages are a live view, not a frozen census.
 */
export async function getJournalPage(input: JournalQuery = {}, client?: SupabaseClient | null): Promise<FieldworkRead<JournalPage>> {
  let filters: ReturnType<typeof parseJournalQuery>;
  try { filters = parseJournalQuery(input); }
  catch { return { ok: false, error: "Invalid fieldwork filter. Use a search or tag of at most 100 characters." }; }
  try {
    const { db, owner } = await readContext(client);
    const offset = filters.page * JOURNAL_PAGE_SIZE;
    let query = db.from("journal_entries").select("*", { count: "exact" })
      .eq("user_id", owner).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (filters.search) query = query.or(orIlikeContains(["title", "content", "location"], filters.search));
    if (filters.entry_type !== "all") query = query.eq("entry_type", filters.entry_type);
    if (filters.pinned_only) query = query.eq("is_pinned", true);
    if (filters.tag) query = query.contains("tags", [filters.tag]);
    const { data, error, count } = await query.range(offset, offset + JOURNAL_PAGE_SIZE - 1);
    if (error || !Array.isArray(data) || !validCount(count) || data.length > JOURNAL_PAGE_SIZE ||
        data.length !== Math.min(JOURNAL_PAGE_SIZE, Math.max(0, count - offset)) || data.some((row) => row.user_id !== owner ||
          typeof row.id !== "string" || typeof row.title !== "string" || typeof row.content !== "string" ||
          !Array.isArray(row.tags) || !Array.isArray(row.contact_ids) || !Array.isArray(row.attachments))) {
      return { ok: false, error: UNAVAILABLE };
    }
    return { ok: true, data: { entries: data as JournalEntry[], total: count, page: filters.page, has_more: offset + data.length < count } };
  } catch { return { ok: false, error: UNAVAILABLE }; }
}

/** Bounded supplementary lists, with exact inventory counts and visible truncation. */
export async function getFieldworkSupport(client?: SupabaseClient | null): Promise<FieldworkRead<FieldworkSupport>> {
  try {
    const { db, owner } = await readContext(client);
    const [contacts, templates, protocols] = await Promise.all([
      db.from("contacts").select("*", { count: "exact" }).eq("user_id", owner)
        .order("updated_at", { ascending: false }).order("id").limit(FIELDWORK_SUPPORT_LIMIT),
      db.from("protocols").select("*", { count: "exact" }).eq("user_id", owner).eq("status", "template")
        .order("updated_at", { ascending: false }).order("id").limit(FIELDWORK_SUPPORT_LIMIT),
      db.from("protocols").select("*", { count: "exact" }).eq("user_id", owner).eq("status", "in_progress")
        .order("updated_at", { ascending: false }).order("id").limit(FIELDWORK_SUPPORT_LIMIT),
    ]);
    for (const result of [contacts, templates, protocols]) {
      if (result.error || !Array.isArray(result.data) || !validCount(result.count) ||
          result.data.length !== Math.min(FIELDWORK_SUPPORT_LIMIT, result.count) || result.data.some((r) => r.user_id !== owner)) {
        return { ok: false, error: UNAVAILABLE };
      }
    }
    return { ok: true, data: {
      contacts: contacts.data as Contact[], templates: templates.data as FieldProtocol[], protocols: protocols.data as FieldProtocol[],
      contact_total: contacts.count!, template_total: templates.count!, protocol_total: protocols.count!,
    } };
  } catch { return { ok: false, error: UNAVAILABLE }; }
}
