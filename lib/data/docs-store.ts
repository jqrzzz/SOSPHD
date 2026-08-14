/* ─── Docs Store — READ paths (SERVER ONLY) ────────────────────────────
 *  Queries research.docs, research.doc_versions.
 *
 *  SERVER ONLY as of the Phase 2 client unification: every consumer is a
 *  server context (docs pages, /api/docs/ai, lib/docs-actions.ts,
 *  lib/agent/tools.ts), and the previous browser client carried no
 *  session cookies on the server — queries ran as `anon`, RLS returned
 *  nothing, and the seed fallback silently served a fabricated Paper 1
 *  draft. The `server-only` import makes any future client import a
 *  build error instead of a repeat of that bug.
 *
 *  Fallback policy (lib/data/degraded.ts): seed data in dev, EMPTY in
 *  production, always with a [SOSPHD:DEGRADED] warning.
 *
 *  research.docs has no `site_id` column; the TS `Doc.site_id` field
 *  is coerced to null in mapDbDoc. (Pending Phase 6 hygiene — remove
 *  site_id from the Doc type entirely.)
 * ────────────────────────────────────────────────────────────────────── */

import "server-only";

import { getServerSupabase } from "@/lib/supabase/server-auth";
import { warnDegradedMode, seedOrEmpty } from "@/lib/data/degraded";
import type { Doc, DocVersion, DocStatus, DocAnnotation } from "./docs-types";

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
    user_id: (row.user_id as string) ?? DEMO_USER_ID,
    content_md: row.content_md as string,
    note: (row.note as string | null) ?? null,
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
  const sb = await getServerSupabase();
  if (sb) {
    try {
      let query = sb
        .schema("research")
        .from("docs")
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
      if (error) warnDegradedMode("getDocs", error.message);
    } catch (e) {
      warnDegradedMode(
        "getDocs",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getDocs", "supabase env vars missing");
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
  return seedOrEmpty(
    result.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    ),
    [],
  );
}

export async function getDocById(id: string): Promise<Doc | null> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("docs")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return mapDbDoc(data as Record<string, unknown>);
      if (error) warnDegradedMode("getDocById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getDocById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getDocById", "supabase unavailable");
  }
  return seedOrEmpty(seedDocs.find((d) => d.id === id) ?? null, null);
}

// ── Versions (reads only — writes in docs-mutations.ts) ─────────────

export async function getVersionsByDocId(docId: string): Promise<DocVersion[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("doc_versions")
        .select("*")
        .eq("doc_id", docId)
        .order("created_at", { ascending: false });
      if (!error && data) return data.map((r) => mapDbVersion(r as Record<string, unknown>));
      if (error) warnDegradedMode("getVersionsByDocId", error.message);
    } catch (e) {
      warnDegradedMode(
        "getVersionsByDocId",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getVersionsByDocId", "supabase unavailable");
  }
  return seedOrEmpty(
    seedVersions
      .filter((v) => v.doc_id === docId)
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [],
  );
}

export async function getVersionById(id: string): Promise<DocVersion | null> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("doc_versions")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) return mapDbVersion(data as Record<string, unknown>);
      if (error) warnDegradedMode("getVersionById", error.message);
    } catch (e) {
      warnDegradedMode(
        "getVersionById",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getVersionById", "supabase unavailable");
  }
  return seedOrEmpty(seedVersions.find((v) => v.id === id) ?? null, null);
}

// ── Unique tags ─────────────────────────────────────────────────────

export async function getAllTags(): Promise<string[]> {
  const docs = await getDocs();
  const tagSet = new Set<string>();
  for (const doc of docs) {
    for (const tag of doc.tags ?? []) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

// ── Annotations ─────────────────────────────────────────────────────

export async function getAnnotationsByDocId(
  docId: string,
): Promise<DocAnnotation[]> {
  const sb = await getServerSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .schema("research")
        .from("doc_annotations")
        .select("*")
        .eq("doc_id", docId)
        .order("resolved", { ascending: true })
        .order("created_at", { ascending: false });
      if (!error && data) return data as DocAnnotation[];
      if (error) warnDegradedMode("getAnnotationsByDocId", error.message);
    } catch (e) {
      warnDegradedMode(
        "getAnnotationsByDocId",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  } else {
    warnDegradedMode("getAnnotationsByDocId", "supabase unavailable");
  }
  // No seed annotations — an empty margin is the correct empty state.
  return [];
}

// ── Paper overviews (the /papers surface) ───────────────────────────

export interface PaperOverview {
  doc: Doc;
  version_count: number;
  open_annotations: number;
}

/**
 * Docs in the Papers folder with their version and open-annotation
 * counts. Three queries total (docs, versions, annotations) grouped in
 * memory rather than one query per paper — the paper set is small and
 * this keeps the page a fixed cost.
 */
export async function getPaperOverviews(): Promise<PaperOverview[]> {
  const docs = await getDocs({ folder: "Papers" });
  if (docs.length === 0) return [];

  const ids = docs.map((d) => d.id);
  const counts = new Map<string, number>();
  const openNotes = new Map<string, number>();

  const sb = await getServerSupabase();
  if (sb) {
    try {
      const [versions, annotations] = await Promise.all([
        sb
          .schema("research")
          .from("doc_versions")
          .select("doc_id")
          .in("doc_id", ids),
        sb
          .schema("research")
          .from("doc_annotations")
          .select("doc_id")
          .eq("resolved", false)
          .in("doc_id", ids),
      ]);
      for (const row of (versions.data ?? []) as { doc_id: string }[]) {
        counts.set(row.doc_id, (counts.get(row.doc_id) ?? 0) + 1);
      }
      for (const row of (annotations.data ?? []) as { doc_id: string }[]) {
        openNotes.set(row.doc_id, (openNotes.get(row.doc_id) ?? 0) + 1);
      }
      if (versions.error) warnDegradedMode("getPaperOverviews.versions", versions.error.message);
      if (annotations.error) {
        warnDegradedMode("getPaperOverviews.annotations", annotations.error.message);
      }
    } catch (e) {
      warnDegradedMode(
        "getPaperOverviews",
        e instanceof Error ? e.message : "supabase query threw",
      );
    }
  }

  return docs.map((doc) => ({
    doc,
    version_count: counts.get(doc.id) ?? 0,
    open_annotations: openNotes.get(doc.id) ?? 0,
  }));
}
