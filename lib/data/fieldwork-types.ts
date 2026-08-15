import type { ConsentStatus } from "./types";

/* ─── Fieldwork Module Types ──────────────────────────────────────────
 *  Field Journal entries, Contacts (research network), and
 *  Field Protocols (site-visit checklists).
 *  Mirror the live research.{journal_entries,contacts,protocols} rows
 *  (migrations 007 + 011).
 * ────────────────────────────────────────────────────────────────────── */

// ── Field Journal ───────────────────────────────────────────────────

export type JournalEntryType =
  | "observation"    // walked into a clinic, noticed something
  | "conversation"   // had a meeting / call
  | "interview"      // formal research interview
  | "site_visit"     // structured visit with protocol
  | "event"          // conference, talk, workshop
  | "idea"           // thought / reflection
  | "media"          // primarily attaching a recording, photo, video

export interface JournalAttachment {
  id: string;
  filename: string;
  mime_type: string;
  url: string;             // Supabase Storage URL or placeholder
  thumbnail_url?: string;  // for images/videos
  size_bytes: number;
}

export interface JournalEntry {
  id: string;
  created_at: string;        // ISO 8601
  updated_at: string;
  user_id: string;
  entry_type: JournalEntryType;
  title: string;
  content: string;           // rich text / markdown
  location: string | null;   // free text: "Bumrungrad Hospital, Bangkok"
  corridor: string | null;   // corridor archetype: "Koh Samui → Bangkok"
  tags: string[];
  contact_ids: string[];     // linked contacts
  linked_case_id: string | null;
  attachments: JournalAttachment[];
  is_pinned: boolean;
  // Consent gate (migration 011) — see ConsentStatus in ../types
  consent_status: ConsentStatus;
  consent_method: string | null;       // "verbal" | "written" | "recorded_verbal" | free text
  consent_jurisdiction: string | null; // ISO country code in force at capture
  consent_captured_at: string | null;
}

// ── Contacts (Research Network) ─────────────────────────────────────

export type ContactRole =
  | "doctor"
  | "nurse"
  | "hospital_admin"
  | "insurance"
  | "embassy"
  | "transport"         // ambulance, helicopter, medevac
  | "government"
  | "academic"
  | "ngo"
  | "fixer"             // local facilitator
  | "other";

export interface Contact {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  name: string;
  role: ContactRole;
  organization: string | null;    // "Bumrungrad International Hospital"
  title: string | null;           // "Head of Emergency Department"
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  location: string | null;        // city / country
  corridor: string | null;        // which corridor they operate in
  tags: string[];
  notes: string;
  linked_journal_ids: string[];   // journal entries where they appear
  business_card_url: string | null; // photo of business card

  // ── Outreach linkage (migration 019) ──
  // Prospective supervisors and funder programme officers are the same
  // shape as the rest of the research network, so they live here too.
  institution_id: string | null;  // the PhD programme they belong to
  opportunity_id: string | null;  // or the funder they administer
  research_focus: string | null;
  recent_work: string | null;     // what a tailored email would reference
  /** Where the email address was actually seen. An address with no
   *  source is unverified: pattern-guessed addresses either bounce or
   *  reach a stranger, and a wrong first contact cannot be undone. */
  email_source_url: string | null;
  email_verified_at: string | null;
  outreach_priority: OutreachPriority | null;
}

export type OutreachPriority = "first_wave" | "second_wave" | "background";

export const OUTREACH_PRIORITY_LABELS: Record<OutreachPriority, string> = {
  first_wave: "First wave",
  second_wave: "Second wave",
  background: "Background",
};

/** An email is only safe to send to if we saw it on an official page. */
export function emailIsVerified(c: Pick<Contact, "email" | "email_source_url">): boolean {
  return Boolean(c.email && c.email_source_url);
}

// ── Field Protocols (Checklists) ────────────────────────────────────

export type ProtocolStatus = "template" | "in_progress" | "completed";

export interface ProtocolItem {
  id: string;
  label: string;
  checked: boolean;
  notes: string;
}

export interface ProtocolSection {
  title: string;
  items: ProtocolItem[];
}

export interface FieldProtocol {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  template_id: string | null;  // which template it was cloned from
  status: ProtocolStatus;
  title: string;
  description: string;
  sections: ProtocolSection[];
  location: string | null;
  corridor: string | null;
  linked_journal_id: string | null;  // auto-created journal entry
  linked_contact_ids: string[];
}
