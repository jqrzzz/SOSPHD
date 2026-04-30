/* ─── Fieldwork Module Types ──────────────────────────────────────────
 *  Field Journal entries, Contacts (research network), and
 *  Field Protocols (site-visit checklists).
 *  Mirror the target Postgres schema — swap for Supabase later.
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
