/* ─── In-Memory Fieldwork Store ────────────────────────────────────────
 *  Same pattern as store.ts — swap for Supabase client calls later.
 *  Covers: Field Journal, Contacts, Field Protocols.
 * ────────────────────────────────────────────────────────────────────── */

import type {
  JournalEntry,
  JournalEntryType,
  JournalAttachment,
  Contact,
  ContactRole,
  FieldProtocol,
  ProtocolStatus,
  ProtocolSection,
} from "./fieldwork-types";

// ── Constants ───────────────────────────────────────────────────────

const DEMO_USER_ID = "user_demo";

// ── Seed: Journal Entries ───────────────────────────────────────────

const seedJournal: JournalEntry[] = [
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

// ── Seed: Contacts ──────────────────────────────────────────────────

const seedContacts: Contact[] = [
  {
    id: "ct_001",
    created_at: "2026-03-15T09:00:00Z",
    updated_at: "2026-03-15T09:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Dr. Somchai Rattanakorn",
    role: "doctor",
    organization: "Bumrungrad International Hospital",
    title: "Head of Emergency Department",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Bangkok, Thailand",
    corridor: "Bangkok Hub",
    tags: ["er", "key-informant", "bumrungrad"],
    notes: "Very supportive of the research. Offered to provide de-identified case flow data. Follow up after IRB approval.",
    linked_journal_ids: ["je_001"],
    business_card_url: null,
  },
  {
    id: "ct_002",
    created_at: "2026-03-18T13:00:00Z",
    updated_at: "2026-03-18T13:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Maria Chen",
    role: "insurance",
    organization: "Allianz Partners Asia",
    title: "Regional Claims Manager",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Singapore",
    corridor: null,
    tags: ["insurance", "data-partner", "ttgp"],
    notes: "Open to data-sharing agreement. Send formal request with IRB approval letter.",
    linked_journal_ids: ["je_002"],
    business_card_url: null,
  },
  {
    id: "ct_003",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Dr. Anil Gupta",
    role: "academic",
    organization: "National University of Singapore",
    title: "Associate Professor, Health Systems",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Singapore",
    corridor: null,
    tags: ["advisor", "methodology", "stepped-wedge"],
    notes: "Potential PhD supervisor or committee member. Expert in stepped-wedge designs for health interventions.",
    linked_journal_ids: [],
    business_card_url: null,
  },
  {
    id: "ct_004",
    created_at: "2026-03-20T08:00:00Z",
    updated_at: "2026-03-20T08:00:00Z",
    user_id: DEMO_USER_ID,
    name: "Nong Ploy",
    role: "fixer",
    organization: null,
    title: "Local Coordinator",
    email: null,
    phone: null,
    whatsapp: null,
    location: "Koh Samui, Thailand",
    corridor: "Koh Samui → Bangkok",
    tags: ["local", "koh-samui", "transport"],
    notes: "Knows every clinic and ambulance driver on the island. Essential for field logistics.",
    linked_journal_ids: [],
    business_card_url: null,
  },
];

// ── Seed: Protocol Templates ────────────────────────────────────────

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

// ── Mutable store ───────────────────────────────────────────────────

const journal = [...seedJournal];
const contacts = [...seedContacts];
const protocols = [...seedProtocols];

let nextJournalNum = 5;
let nextContactNum = 5;
let nextProtocolNum = 3;
let nextAttachmentNum = 1;

// ── Journal ─────────────────────────────────────────────────────────

export function getJournalEntries(filters?: {
  entry_type?: JournalEntryType;
  tag?: string;
  search?: string;
  pinned_only?: boolean;
  limit?: number;
}): JournalEntry[] {
  let result = [...journal];

  if (filters?.entry_type) {
    result = result.filter((e) => e.entry_type === filters.entry_type);
  }
  if (filters?.tag) {
    result = result.filter((e) => e.tags.includes(filters.tag!));
  }
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
  if (filters?.pinned_only) {
    result = result.filter((e) => e.is_pinned);
  }

  result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return result.slice(0, filters?.limit ?? 50);
}

export function getJournalEntryById(id: string): JournalEntry | undefined {
  return journal.find((e) => e.id === id);
}

export function createJournalEntry(data: {
  entry_type: JournalEntryType;
  title: string;
  content: string;
  location?: string | null;
  corridor?: string | null;
  tags?: string[];
  contact_ids?: string[];
  linked_case_id?: string | null;
  attachments?: JournalAttachment[];
}): JournalEntry {
  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id: `je_${String(nextJournalNum++).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
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
  };
  journal.push(entry);
  return entry;
}

export function updateJournalEntry(
  id: string,
  data: Partial<Pick<JournalEntry, "title" | "content" | "entry_type" | "location" | "corridor" | "tags" | "contact_ids" | "linked_case_id" | "is_pinned" | "attachments">>,
): JournalEntry | null {
  const entry = journal.find((e) => e.id === id);
  if (!entry) return null;
  Object.assign(entry, data, { updated_at: new Date().toISOString() });
  return entry;
}

export function deleteJournalEntry(id: string): boolean {
  const idx = journal.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  journal.splice(idx, 1);
  return true;
}

export function createAttachmentId(): string {
  return `att_${String(nextAttachmentNum++).padStart(3, "0")}`;
}

// ── Contacts ────────────────────────────────────────────────────────

export function getContacts(filters?: {
  role?: ContactRole;
  tag?: string;
  search?: string;
  limit?: number;
}): Contact[] {
  let result = [...contacts];

  if (filters?.role) {
    result = result.filter((c) => c.role === filters.role);
  }
  if (filters?.tag) {
    result = result.filter((c) => c.tags.includes(filters.tag!));
  }
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

  result.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return result.slice(0, filters?.limit ?? 100);
}

export function getContactById(id: string): Contact | undefined {
  return contacts.find((c) => c.id === id);
}

export function createContact(data: {
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
}): Contact {
  const now = new Date().toISOString();
  const contact: Contact = {
    id: `ct_${String(nextContactNum++).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
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
  };
  contacts.push(contact);
  return contact;
}

export function updateContact(
  id: string,
  data: Partial<Pick<Contact, "name" | "role" | "organization" | "title" | "email" | "phone" | "whatsapp" | "location" | "corridor" | "tags" | "notes" | "business_card_url" | "linked_journal_ids">>,
): Contact | null {
  const contact = contacts.find((c) => c.id === id);
  if (!contact) return null;
  Object.assign(contact, data, { updated_at: new Date().toISOString() });
  return contact;
}

export function deleteContact(id: string): boolean {
  const idx = contacts.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  contacts.splice(idx, 1);
  return true;
}

// ── Protocols ───────────────────────────────────────────────────────

export function getProtocols(filters?: {
  status?: ProtocolStatus;
  limit?: number;
}): FieldProtocol[] {
  let result = [...protocols];

  if (filters?.status) {
    result = result.filter((p) => p.status === filters.status);
  }

  result.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return result.slice(0, filters?.limit ?? 50);
}

export function getProtocolById(id: string): FieldProtocol | undefined {
  return protocols.find((p) => p.id === id);
}

export function getProtocolTemplates(): FieldProtocol[] {
  return protocols.filter((p) => p.status === "template");
}

export function createProtocolFromTemplate(
  templateId: string,
  data: { location?: string; corridor?: string; linked_contact_ids?: string[] },
): FieldProtocol | null {
  const template = protocols.find((p) => p.id === templateId);
  if (!template) return null;

  const now = new Date().toISOString();
  const protocol: FieldProtocol = {
    id: `fp_${String(nextProtocolNum++).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
    template_id: templateId,
    status: "in_progress",
    title: template.title,
    description: template.description,
    sections: JSON.parse(JSON.stringify(template.sections)),
    location: data.location ?? null,
    corridor: data.corridor ?? null,
    linked_journal_id: null,
    linked_contact_ids: data.linked_contact_ids ?? [],
  };
  protocols.push(protocol);
  return protocol;
}

export function updateProtocol(
  id: string,
  data: Partial<Pick<FieldProtocol, "status" | "sections" | "location" | "corridor" | "linked_journal_id" | "linked_contact_ids">>,
): FieldProtocol | null {
  const protocol = protocols.find((p) => p.id === id);
  if (!protocol) return null;
  Object.assign(protocol, data, { updated_at: new Date().toISOString() });
  return protocol;
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
