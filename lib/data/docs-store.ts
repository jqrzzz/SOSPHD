/* ─── Docs Store (Supabase) ────────────────────────────────────────────
 *  Queries phd_docs, phd_doc_versions.
 *  Falls back to seed data when Supabase is unavailable.
 *
 *  Note: DB column `change_note` maps to TypeScript `note` field.
 *  DB has no `site_id` or `user_id` on doc_versions — handled in mapping.
 * ────────────────────────────────────────────────────────────────────── */

import { getSupabase, getCurrentUserId } from "@/lib/supabase/db";
import type { Doc, DocVersion, DocStatus } from "./docs-types";

// ── Seed data (fallback) ─────────────────────────────────────────────

const DEMO_USER_ID = "user_demo";

const seedDocs: Doc[] = [
  {
    id: "doc_001",
    created_at: "2026-02-05T10:00:00Z",
    updated_at: "2026-02-11T14:30:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    title: "Paper 1: Measurement Framework",
    slug: "paper-1-measurement-framework",
    folder: "Papers",
    tags: ["paper-1", "ttdc", "ttgp"],
    content_md: `# Measuring TTDC and TTGP in Tourist Medical Emergencies

## Abstract

This paper introduces a standardized measurement framework for two novel time-based metrics in tourist medical emergency response: Time to Definitive Care (TTDC) and Time to Guaranteed Payment (TTGP).

## 1. Introduction

Tourist medical emergencies present unique coordination challenges that differ fundamentally from domestic emergency response. The absence of standardized metrics for measuring response quality creates a gap in both operational improvement and academic research.

### 1.1 Background

Current literature on emergency medical services (EMS) focuses predominantly on domestic response times (NFPA 1710 standards). However, tourist emergencies involve additional complexity:

- Cross-border insurance verification
- Language barriers in triage
- Unfamiliar healthcare systems
- Payment guarantee requirements before definitive care

### 1.2 Research Questions

1. Can TTDC and TTGP be reliably measured across diverse geographic and institutional contexts?
2. What is the relationship between TTGP and TTDC — does financial clearance delay clinical care?
3. Does a human-AI coordination layer reduce both metrics?

## 2. Definitions

**TTDC (Time to Definitive Care):** The interval from FIRST_CONTACT to DEFINITIVE_CARE_START, measured in minutes.

**TTGP (Time to Guaranteed Payment):** The interval from FIRST_CONTACT to GUARANTEED_PAYMENT, measured in minutes.

**TTTA (Time to Transport Activation):** The interval from FIRST_CONTACT to TRANSPORT_ACTIVATED, measured in minutes.

## 3. Methods

*[Draft in progress — see task list for next steps]*

## 4. Data Collection Protocol

*[Pending IRB approval]*

## References

*[To be compiled]*
`,
    status: "active",
    linked_case_id: null,
  },
  {
    id: "doc_002",
    created_at: "2026-02-08T09:00:00Z",
    updated_at: "2026-02-10T16:45:00Z",
    user_id: DEMO_USER_ID,
    site_id: "site_001",
    title: "Weekly Field Log - Feb W2",
    slug: "weekly-field-log-feb-w2",
    folder: "Field Logs",
    tags: ["field-log", "week-2"],
    content_md: `# Field Log: February Week 2

## Cases Observed

### Case 001 (PT-2026-0401) — Heat Stroke
- Full provenance chain captured successfully
- Helicopter dispatch recommendation accepted by operator
- TTDC: 52 minutes (within target)
- TTGP: 35 minutes (insurance pre-auth smooth)
- **Key insight:** Payment arrived BEFORE definitive care — ideal scenario

### Case 004 (PT-2026-0404) — DCS / Diving
- Payment delayed 22 hours due to insurer dispute
- TTGP >> TTDC pattern — this is the harm we need to measure
- Supervisor intervention required to resolve
- **Key insight:** Activity exclusion clauses are the primary TTGP blocker

## System Observations

- Rule-based recommendation engine performed well for facility selection
- Operators accepted 2/2 recommendations this week
- No overrides recorded — need more cases for override analysis

## Next Week Focus

- Expect 2-3 more cases based on tourism season patterns
- Need to follow up on Case 002 missing milestones
`,
    status: "active",
    linked_case_id: null,
  },
  {
    id: "doc_003",
    created_at: "2026-02-09T11:00:00Z",
    updated_at: "2026-02-09T11:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    title: "Research Statement Draft",
    slug: "research-statement-draft",
    folder: "Planning",
    tags: ["planning", "phd"],
    content_md: `# Research Statement

## Working Title

"Decision Provenance in Tourist Medical Emergency Coordination: Measuring and Reducing Time to Definitive Care Through Human-AI Collaboration"

## Thesis Summary

This research demonstrates that an audit-grade human-AI coordination layer, deployed via stepped-wedge rollout across tourist medical emergency sites, measurably reduces Time to Definitive Care (TTDC) and Time to Guaranteed Payment (TTGP), while generating publishable decision provenance data.

## Contribution

1. **Novel metrics** (TTDC, TTGP) for tourist emergency response quality
2. **Decision provenance framework** capturing AI recommendations, human decisions, and outcomes
3. **Stepped-wedge evaluation** showing causal impact of the coordination layer

## Timeline

- Q1 2026: Paper 1 (Measurement Framework)
- Q2-Q3 2026: Multi-site rollout + data collection
- Q4 2026: Paper 2 (Intervention Design with Provenance)
- Q1 2027: Paper 3 (Multi-site Evaluation Results)
`,
    status: "draft",
    linked_case_id: null,
  },
  {
    id: "doc_004",
    created_at: "2026-02-10T15:00:00Z",
    updated_at: "2026-02-10T15:00:00Z",
    user_id: DEMO_USER_ID,
    site_id: null,
    title: "Stepped-Wedge Design Notes",
    slug: "stepped-wedge-design",
    folder: "Methods",
    tags: ["methodology", "stepped-wedge"],
    content_md: `# Stepped-Wedge Cluster Randomized Trial Design

## Overview

The stepped-wedge design is ideal because:
1. Site onboarding is sequential (practical constraint = research advantage)
2. Each site serves as its own control (pre vs post activation)
3. Temporal trends are captured across all sites

## Design Parameters

- **Clusters:** Individual sites (clinics/regions)
- **Steps:** Site activation dates (when Tourist SOS coordination layer goes live)
- **Observation periods:** Continuous data collection before and after activation
- **Primary outcomes:** TTDC, TTGP
- **Secondary outcomes:** Override rate, recommendation acceptance rate

## Power Calculation

*[Need to compute — depends on expected effect size and ICC]*

## Ethical Considerations

- No patient randomization (system-level intervention only)
- De-identification at point of collection
- Consent framework for operator participation
`,
    status: "draft",
    linked_case_id: null,
  },
];

const seedVersions: DocVersion[] = [
  {
    id: "ver_001",
    created_at: "2026-02-05T10:00:00Z",
    doc_id: "doc_001",
    user_id: DEMO_USER_ID,
    content_md: "# Measuring TTDC and TTGP in Tourist Medical Emergencies\n\n*Initial outline*",
    note: "Initial creation",
  },
  {
    id: "ver_002",
    created_at: "2026-02-08T12:00:00Z",
    doc_id: "doc_001",
    user_id: DEMO_USER_ID,
    content_md: seedDocs[0].content_md.replace("## 3. Methods\n\n*[Draft in progress", "## 3. Methods\n\n*[Not yet started"),
    note: "Added introduction and definitions sections",
  },
];

// ── Helper: map DB row → DocVersion (column name difference) ────────

function mapDbVersion(row: Record<string, unknown>): DocVersion {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    doc_id: row.doc_id as string,
    user_id: DEMO_USER_ID,
    content_md: row.content_md as string,
    note: (row.change_note as string) ?? null,
  };
}

// ── Helper: map DB row → Doc (no site_id in DB) ────────────────────

function mapDbDoc(row: Record<string, unknown>): Doc {
  return {
    ...(row as unknown as Doc),
    site_id: null,
  };
}

// ── Query functions ─────────────────────────────────────────────────

export async function getDocs(filters?: {
  folder?: string;
  status?: DocStatus;
  search?: string;
  tag?: string;
}): Promise<Doc[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      let query = sb
        .from("phd_docs")
        .select("*")
        .order("updated_at", { ascending: false });

      if (filters?.folder) query = query.eq("folder", filters.folder);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.tag) query = query.contains("tags", [filters.tag]);
      if (filters?.search) query = query.or(
        `title.ilike.%${filters.search}%,content_md.ilike.%${filters.search}%`
      );

      const { data, error } = await query;
      if (!error && data) return data.map((r) => mapDbDoc(r as Record<string, unknown>));
    } catch { /* fall through */ }
  }

  let result = [...seedDocs];
  if (filters?.folder) result = result.filter((d) => d.folder === filters.folder);
  if (filters?.status) result = result.filter((d) => d.status === filters.status);
  if (filters?.tag) result = result.filter((d) => d.tags.includes(filters.tag!));
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content_md.toLowerCase().includes(q) ||
        d.tags.some((t: string) => t.toLowerCase().includes(q)),
    );
  }
  return result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function getDocById(id: string): Promise<Doc | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("phd_docs")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return mapDbDoc(data as Record<string, unknown>);
    } catch { /* fall through */ }
  }
  return seedDocs.find((d) => d.id === id) ?? null;
}

export async function createDoc(data: {
  title: string;
  folder?: string;
  tags?: string[];
  content_md?: string;
  linked_case_id?: string | null;
}): Promise<Doc | null> {
  const sb = getSupabase();
  const userId = await getCurrentUserId();

  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (sb && userId) {
    const { data: row, error } = await sb
      .from("phd_docs")
      .insert({
        user_id: userId,
        title: data.title,
        slug,
        folder: data.folder ?? "General",
        tags: data.tags ?? [],
        content_md: data.content_md ?? "",
        status: "draft",
        linked_case_id: data.linked_case_id ?? null,
      })
      .select()
      .single();
    if (!error && row) return mapDbDoc(row as Record<string, unknown>);
  }
  return null;
}

export async function updateDoc(
  id: string,
  updates: Partial<Pick<Doc, "title" | "content_md" | "folder" | "tags" | "status" | "linked_case_id">>,
): Promise<Doc | null> {
  const sb = getSupabase();
  if (sb) {
    const { data: row, error } = await sb
      .from("phd_docs")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (!error && row) return mapDbDoc(row as Record<string, unknown>);
  }
  return null;
}

// ── Versions ────────────────────────────────────────────────────────

export async function getVersionsByDocId(docId: string): Promise<DocVersion[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("phd_doc_versions")
        .select("*")
        .eq("doc_id", docId)
        .order("created_at", { ascending: false });
      if (!error && data) return data.map((r) => mapDbVersion(r as Record<string, unknown>));
    } catch { /* fall through */ }
  }
  return seedVersions
    .filter((v) => v.doc_id === docId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createVersion(data: {
  doc_id: string;
  content_md: string;
  note?: string | null;
}): Promise<DocVersion | null> {
  const sb = getSupabase();
  if (sb) {
    const { data: row, error } = await sb
      .from("phd_doc_versions")
      .insert({
        doc_id: data.doc_id,
        content_md: data.content_md,
        change_note: data.note ?? "",
      })
      .select()
      .single();
    if (!error && row) return mapDbVersion(row as Record<string, unknown>);
  }
  return null;
}

export async function getVersionById(id: string): Promise<DocVersion | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("phd_doc_versions")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return mapDbVersion(data as Record<string, unknown>);
    } catch { /* fall through */ }
  }
  return seedVersions.find((v) => v.id === id) ?? null;
}

// ── Unique tags ─────────────────────────────────────────────────────

export async function getAllTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("research")
    .from("docs")
    .select("tags");

  if (error || !data) return [];

export async function getAllTags(): Promise<string[]> {
  const docs = await getDocs();
  const tagSet = new Set<string>();
  for (const doc of data) {
    for (const tag of (doc.tags as string[]) ?? []) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
