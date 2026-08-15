/* ─── Fieldwork Store — READ paths (client-safe, injectable client) ────
 *  Queries research.journal_entries, research.contacts, research.protocols.
 *
 *  IMPORTANT: this file is imported by client components
 *  (/app/fieldwork/page.tsx, /app/contacts/page.tsx), so it must never
 *  import the server Supabase client. It therefore defaults to the
 *  BROWSER client — which carries no session on the server. Every read
 *  function accepts an optional trailing `client` param for that reason:
 *
 *    - Client components: omit it (browser client, session cookies).
 *    - Server callers (lib/agent/tools.ts, fieldwork-mutations.ts):
 *      MUST pass a server client, or the query runs as `anon`, RLS
 *      returns nothing, and the fallback path fires.
 *
 *  Fallback policy (lib/data/degraded.ts): seed data in dev, EMPTY in
 *  production, always with a [SOSPHD:DEGRADED] warning.
 *
 *  Write paths live in fieldwork-mutations.ts (server-only).
 * ────────────────────────────────────────────────────────────────────── */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/db";
import { warnDegradedMode, seedOrEmpty } from "@/lib/data/degraded";
import type {
  JournalEntry,
  JournalEntryType,
  Contact,
  ContactRole,
  FieldProtocol,
  ProtocolStatus,
} from "./fieldwork-types";

// ── Seed data (fallback when Supabase unavailable) ─────────────────

const DEMO_USER_ID = "user_demo";

const seedJournalRaw: Omit<JournalEntry, "consent_status" | "consent_method" | "consent_jurisdiction" | "consent_captured_at">[] = [
  {
    id: "je_001",
    created_at: "2026-03-15T09:30:00Z",
    updated_at: "2026-03-15T09:30:00Z",
    user_id: DEMO_USER_ID,
    entry_type: "site_visit",
    title: "Bumrungrad International Hospital — ER walkthrough",
    content:
      "Met with Dr. Somchai (ER head). They handle ~40 foreign patients/month in ER. " +
      "Key bottleneck: insurance verification before treatment starts. Average 45min wait " +
      "for pre-authorization on non-emergency cases. They have a dedicated international " +
      "patient coordinator desk but it closes at 8pm. After hours, everything goes through " +
      "the main Thai-language ER intake.\n\n" +
      "Transport: hospital has its own ambulance fleet (3 units). Also receives patients " +
      "from Bangkok Hospital network transfers. No helicopter pad — nearest is at BNH.",
    location: "Bumrungrad International Hospital, Bangkok",
    corridor: "Bangkok Hub",
    tags: ["hospital", "er-workflow", "insurance-bottleneck", "transport"],
    contact_ids: ["ct_001"],
    linked_case_id: null,
    attachments: [],
    is_pinned: true,
  },
  {
    id: "je_002",
    created_at: "2026-03-18T14:00:00Z",
    updated_at: "2026-03-18T14:00:00Z",
    user_id: DEMO_USER_ID,
    entry_type: "conversation",
    title: "Call with Allianz Partners — claims workflow",
    content:
      "Spoke with regional claims manager about their process for tourist emergency claims. " +
      "Key insight: they have a 'fast track' for cases over $5k USD that bypasses normal " +
      "adjudication. Below that threshold, standard 48hr review applies.\n\n" +
      "They're open to sharing anonymized claims processing time data for the research. " +
      "Need to send them a formal data-sharing agreement. This could be huge for TTGP analysis.",
    location: null,
    corridor: null,
    tags: ["insurance", "ttgp", "data-source", "partnership"],
    contact_ids: ["ct_002"],
    linked_case_id: null,
    attachments: [],
    is_pinned: false,
  },
  {
    id: "je_003",
    created_at: "2026-03-22T11:15:00Z",
    updated_at: "2026-03-22T11:15:00Z",
    user_id: DEMO_USER_ID,
    entry_type: "observation",
    title: "Koh Samui clinic — first-contact delays",
    content:
      "Small clinic near Chaweng Beach. Only 1 English-speaking nurse on staff. " +
      "Observed a tourist with suspected fracture — 25min before anyone could communicate " +
      "with the patient about insurance and transport options. The patient's hotel concierge " +
      "eventually came and translated.\n\n" +
      "This is exactly the TTTA friction point. The delay isn't medical — it's coordination.",
    location: "Chaweng Beach Clinic, Koh Samui",
    corridor: "Koh Samui → Bangkok",
    tags: ["ttta", "language-barrier", "first-contact", "island-clinic"],
    contact_ids: [],
    linked_case_id: null,
    attachments: [],
    is_pinned: true,
  },
  {
    id: "je_004",
    created_at: "2026-03-25T16:30:00Z",
    updated_at: "2026-03-25T16:30:00Z",
    user_id: DEMO_USER_ID,
    entry_type: "idea",
    title: "WhatsApp as first-contact channel",
    content:
      "Most tourists already have WhatsApp. What if the coordination layer starts there? " +
      "Tourist texts a WhatsApp number → AI triage bot asks key questions (location, " +
      "symptoms, insurance) → routes to nearest facility with capacity → pre-alerts the ER.\n\n" +
      "This could dramatically cut TTTA by removing the 'find a phone number, make a call, " +
      "explain in English' friction. Need to check with SOSCOMMAND team if this aligns with their roadmap.",
    location: null,
    corridor: null,
    tags: ["whatsapp", "ttta", "automation", "soscommand"],
    contact_ids: [],
    linked_case_id: null,
    attachments: [],
    is_pinned: false,
  },
];

// Pseudonymized fixtures only. Realistic-looking names were removed
// per the Phase 6 hygiene audit so that demo / degraded-mode views
// never display anything resembling a real research contact. Real
// contacts live in research.contacts (Supabase) and are scoped per
// user_id via RLS.
// Seed entries predate the consent columns (migration 011); mark them
// explicitly not_required rather than editing every literal.
const seedJournal: JournalEntry[] = seedJournalRaw.map((e) => ({
  ...e,
  consent_status: "not_required" as const,
  consent_method: null,
  consent_jurisdiction: null,
  consent_captured_at: null,
}));

const seedContacts: Contact[] = [
  {
    id: "ct_001",
    created_at: "2026-03-15T09:00:00Z",
    updated_at: "2026-03-15T09:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Demo Contact A — ER physician",
    role: "doctor",
    organization: "Demo Hospital A",
    title: "Head of Emergency Department",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Bangkok, Thailand",
    corridor: "Bangkok Hub",
    tags: ["er", "key-informant"],
    notes: "Pseudonymized seed contact. Replace via /contacts when running against Supabase.",
    linked_journal_ids: ["je_001"],
    business_card_url: null,
    institution_id: null,
    opportunity_id: null,
    research_focus: null,
    recent_work: null,
    email_source_url: null,
    email_verified_at: null,
    outreach_priority: null,
  },
  {
    id: "ct_002",
    created_at: "2026-03-18T13:00:00Z",
    updated_at: "2026-03-18T13:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Demo Contact B — claims manager",
    role: "insurance",
    organization: "Demo Insurer B",
    title: "Regional Claims Manager",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Singapore",
    corridor: null,
    tags: ["insurance", "data-partner", "ttgp"],
    notes: "Pseudonymized seed contact. Replace via /contacts when running against Supabase.",
    linked_journal_ids: ["je_002"],
    business_card_url: null,
    institution_id: null,
    opportunity_id: null,
    research_focus: null,
    recent_work: null,
    email_source_url: null,
    email_verified_at: null,
    outreach_priority: null,
  },
  {
    id: "ct_003",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Demo Contact C — academic advisor",
    role: "academic",
    organization: "Demo University C",
    title: "Associate Professor, Health Systems",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Singapore",
    corridor: null,
    tags: ["advisor", "methodology", "stepped-wedge"],
    notes: "Pseudonymized seed contact. Replace via /contacts when running against Supabase.",
    linked_journal_ids: [],
    business_card_url: null,
    institution_id: null,
    opportunity_id: null,
    research_focus: null,
    recent_work: null,
    email_source_url: null,
    email_verified_at: null,
    outreach_priority: null,
  },
  {
    id: "ct_004",
    created_at: "2026-03-20T08:00:00Z",
    updated_at: "2026-03-20T08:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Demo Contact D — local coordinator",
    role: "fixer",
    organization: null,
    title: "Local Coordinator",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Koh Samui, Thailand",
    corridor: "Koh Samui → Bangkok",
    tags: ["local", "koh-samui", "transport"],
    notes: "Pseudonymized seed contact. Replace via /contacts when running against Supabase.",
    linked_journal_ids: [],
    business_card_url: null,
    institution_id: null,
    opportunity_id: null,
    research_focus: null,
    recent_work: null,
    email_source_url: null,
    email_verified_at: null,
    outreach_priority: null,
  },
];

const seedProtocols: FieldProtocol[] = [
  {
    id: "fp_template_clinic",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    user_id: DEMO_USER_ID,
    template_id: null,
    status: "template",
    title: "Clinic / Hospital Site Visit",
    description: "Standard checklist for visiting a medical facility. Covers capacity, workflow, transport links, and data collection opportunities.",
    sections: [
      {
        title: "Before Visit",
        items: [
          { id: "p1_1", label: "Confirm appointment / point of contact", checked: false, notes: "" },
          { id: "p1_2", label: "Prepare consent forms (if interviewing)", checked: false, notes: "" },
          { id: "p1_3", label: "Charge phone, bring backup battery", checked: false, notes: "" },
          { id: "p1_4", label: "Review existing data for this facility", checked: false, notes: "" },
        ],
      },
      {
        title: "Facility Assessment",
        items: [
          { id: "p2_1", label: "ER capacity: beds, staff, hours", checked: false, notes: "" },
          { id: "p2_2", label: "Foreign patient volume (monthly estimate)", checked: false, notes: "" },
          { id: "p2_3", label: "Language capabilities (English, other)", checked: false, notes: "" },
          { id: "p2_4", label: "Insurance pre-authorization process", checked: false, notes: "" },
          { id: "p2_5", label: "Transport: ambulance fleet, helicopter access", checked: false, notes: "" },
          { id: "p2_6", label: "Referral pathways for complex cases", checked: false, notes: "" },
        ],
      },
      {
        title: "Coordination & Workflow",
        items: [
          { id: "p3_1", label: "Who handles first contact with foreign patients?", checked: false, notes: "" },
          { id: "p3_2", label: "How is insurance verified? (phone, portal, fax)", checked: false, notes: "" },
          { id: "p3_3", label: "What triggers transport activation?", checked: false, notes: "" },
          { id: "p3_4", label: "Average time from arrival to treatment decision", checked: false, notes: "" },
          { id: "p3_5", label: "After-hours process differences", checked: false, notes: "" },
        ],
      },
      {
        title: "Data & Follow-up",
        items: [
          { id: "p4_1", label: "Business cards collected", checked: false, notes: "" },
          { id: "p4_2", label: "Photos taken (with permission)", checked: false, notes: "" },
          { id: "p4_3", label: "Data-sharing interest discussed", checked: false, notes: "" },
          { id: "p4_4", label: "Follow-up actions noted", checked: false, notes: "" },
          { id: "p4_5", label: "Journal entry created", checked: false, notes: "" },
        ],
      },
    ],
    location: null,
    corridor: null,
    linked_journal_id: null,
    linked_contact_ids: [],
  },
  {
    id: "fp_template_corridor",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    user_id: DEMO_USER_ID,
    template_id: null,
    status: "template",
    title: "Corridor Assessment",
    description: "Assess a full transport/care corridor from incident site to definitive care. Maps the ECL (Emergency Coordination Layer) for a specific route.",
    sections: [
      {
        title: "Corridor Overview",
        items: [
          { id: "c1_1", label: "Define corridor endpoints (origin → destination)", checked: false, notes: "" },
          { id: "c1_2", label: "Distance and typical travel time", checked: false, notes: "" },
          { id: "c1_3", label: "Transport modes available (road, air, sea)", checked: false, notes: "" },
          { id: "c1_4", label: "Known bottlenecks or failure points", checked: false, notes: "" },
        ],
      },
      {
        title: "Facility Chain",
        items: [
          { id: "c2_1", label: "First-response facility (clinic/hospital at origin)", checked: false, notes: "" },
          { id: "c2_2", label: "Intermediate facilities (if any)", checked: false, notes: "" },
          { id: "c2_3", label: "Definitive care facility (destination)", checked: false, notes: "" },
          { id: "c2_4", label: "Facility capabilities at each tier", checked: false, notes: "" },
        ],
      },
      {
        title: "Payment & Insurance",
        items: [
          { id: "c3_1", label: "Common insurers in this corridor", checked: false, notes: "" },
          { id: "c3_2", label: "Pre-authorization requirements at each facility", checked: false, notes: "" },
          { id: "c3_3", label: "Payment guarantee bottlenecks", checked: false, notes: "" },
          { id: "c3_4", label: "Cash-pay fallback options", checked: false, notes: "" },
        ],
      },
      {
        title: "Metrics Baseline",
        items: [
          { id: "c4_1", label: "Estimated baseline TTTA for this corridor", checked: false, notes: "" },
          { id: "c4_2", label: "Estimated baseline TTGP for this corridor", checked: false, notes: "" },
          { id: "c4_3", label: "Estimated baseline TTDC for this corridor", checked: false, notes: "" },
          { id: "c4_4", label: "Data sources identified for baseline metrics", checked: false, notes: "" },
        ],
      },
    ],
    location: null,
    corridor: null,
    linked_journal_id: null,
    linked_contact_ids: [],
  },
];

// ── Journal ─────────────────────────────────────────────────────────

export async function getJournalEntries(
  filters?: {
    entry_type?: JournalEntryType;
    tag?: string;
    search?: string;
    pinned_only?: boolean;
    limit?: number;
  },
  client?: SupabaseClient | null,
): Promise<JournalEntry[]> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("journal_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 50);

      if (filters?.entry_type) query = query.eq("entry_type", filters.entry_type);
      if (filters?.pinned_only) query = query.eq("is_pinned", true);
      if (filters?.tag) query = query.contains("tags", [filters.tag]);
      if (filters?.search) query = query.or(
        `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`
      );

      const { data, error } = await query;
      if (!error && data) return data as JournalEntry[];
      if (error) warnDegradedMode("getJournalEntries", error.message);
    } catch (e) {
      warnDegradedMode(
        "getJournalEntries",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getJournalEntries", "supabase env vars missing");
  }

  // Fallback: filter seed data in-memory
  let result = [...seedJournal];
  if (filters?.entry_type) result = result.filter((e) => e.entry_type === filters.entry_type);
  if (filters?.tag) result = result.filter((e) => e.tags.includes(filters.tag!));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters?.pinned_only) result = result.filter((e) => e.is_pinned);
  result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return seedOrEmpty(result.slice(0, filters?.limit ?? 50), []);
}

export async function getJournalEntryById(
  id: string,
  client?: SupabaseClient | null,
): Promise<JournalEntry | null> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("journal_entries")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return data as JournalEntry;
      if (error) warnDegradedMode("getJournalEntryById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getJournalEntryById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getJournalEntryById", "supabase unavailable");
  }
  return seedOrEmpty(seedJournal.find((e) => e.id === id) ?? null, null);
}

// ── Contacts ────────────────────────────────────────────────────────

export async function getContacts(
  filters?: {
    role?: ContactRole;
    tag?: string;
    search?: string;
    limit?: number;
  },
  client?: SupabaseClient | null,
): Promise<Contact[]> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("contacts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(filters?.limit ?? 100);

      if (filters?.role) query = query.eq("role", filters.role);
      if (filters?.tag) query = query.contains("tags", [filters.tag]);
      if (filters?.search) query = query.or(
        `name.ilike.%${filters.search}%,organization.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );

      const { data, error } = await query;
      if (!error && data) return data as Contact[];
      if (error) warnDegradedMode("getContacts", error.message);
    } catch (e) {
      warnDegradedMode(
        "getContacts",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getContacts", "supabase env vars missing");
  }

  let result = [...seedContacts];
  if (filters?.role) result = result.filter((c) => c.role === filters.role);
  if (filters?.tag) result = result.filter((c) => c.tags.includes(filters.tag!));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return seedOrEmpty(result.slice(0, filters?.limit ?? 100), []);
}

export async function getContactById(
  id: string,
  client?: SupabaseClient | null,
): Promise<Contact | null> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("contacts")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return data as Contact;
      if (error) warnDegradedMode("getContactById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getContactById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getContactById", "supabase unavailable");
  }
  return seedOrEmpty(seedContacts.find((c) => c.id === id) ?? null, null);
}

// ── Protocols ───────────────────────────────────────────────────────

export async function getProtocols(
  filters?: {
    status?: ProtocolStatus;
    limit?: number;
  },
  client?: SupabaseClient | null,
): Promise<FieldProtocol[]> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("protocols")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(filters?.limit ?? 50);

      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (!error && data) return data as FieldProtocol[];
      if (error) warnDegradedMode("getProtocols", error.message);
    } catch (e) {
      warnDegradedMode(
        "getProtocols",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getProtocols", "supabase unavailable");
  }

  let result = [...seedProtocols];
  if (filters?.status) result = result.filter((p) => p.status === filters.status);
  result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return seedOrEmpty(result.slice(0, filters?.limit ?? 50), []);
}

export async function getProtocolById(
  id: string,
  client?: SupabaseClient | null,
): Promise<FieldProtocol | null> {
  const sb = client ?? getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("protocols")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return data as FieldProtocol;
      if (error) warnDegradedMode("getProtocolById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getProtocolById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getProtocolById", "supabase unavailable");
  }
  return seedOrEmpty(seedProtocols.find((p) => p.id === id) ?? null, null);
}

export async function getProtocolTemplates(
  client?: SupabaseClient | null,
): Promise<FieldProtocol[]> {
  return getProtocols({ status: "template" }, client);
}

export function getProtocolProgress(protocol: FieldProtocol): {
  total: number;
  checked: number;
  percent: number;
} {
  let total = 0;
  let checked = 0;
  for (const section of protocol.sections) {
    for (const item of section.items) {
      total++;
      if (item.checked) checked++;
    }
  }
  return { total, checked, percent: total === 0 ? 0 : Math.round((checked / total) * 100) };
}
