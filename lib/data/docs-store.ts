/* ─── In-Memory Docs Store ─────────────────────────────────────────────
 *  Same pattern as store.ts / advisor-store.ts — swap for Supabase later.
 * ────────────────────────────────────────────────────────────────────── */

import type { Doc, DocVersion, DocStatus } from "./docs-types";

const DEMO_USER_ID = "user_demo";

// ── Seed data ────────────────────────────────────────────────────────

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

// ── Mutable store ────────────────────────────────────────────────────

const docs = [...seedDocs];
const versions = [...seedVersions];

let nextDocNum = 5;
let nextVersionNum = 3;

// ── Query functions ─────────────────────────────────────────────────

export function getDocs(filters?: {
  folder?: string;
  status?: DocStatus;
  search?: string;
  tag?: string;
}): Doc[] {
  let result = [...docs];

  if (filters?.folder) {
    result = result.filter((d) => d.folder === filters.folder);
  }
  if (filters?.status) {
    result = result.filter((d) => d.status === filters.status);
  }
  if (filters?.tag) {
    result = result.filter((d) => d.tags.includes(filters.tag));
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content_md.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return result.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function getDocById(id: string): Doc | undefined {
  return docs.find((d) => d.id === id);
}

export function createDoc(data: {
  title: string;
  folder?: string;
  tags?: string[];
  content_md?: string;
  linked_case_id?: string | null;
}): Doc {
  const now = new Date().toISOString();
  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const newDoc: Doc = {
    id: `doc_${String(nextDocNum++).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
    user_id: DEMO_USER_ID,
    site_id: null,
    title: data.title,
    slug,
    folder: data.folder ?? "General",
    tags: data.tags ?? [],
    content_md: data.content_md ?? "",
    status: "draft",
    linked_case_id: data.linked_case_id ?? null,
  };
  docs.push(newDoc);
  return newDoc;
}

export function updateDoc(
  id: string,
  updates: Partial<Pick<Doc, "title" | "content_md" | "folder" | "tags" | "status" | "linked_case_id">>,
): Doc | null {
  const doc = docs.find((d) => d.id === id);
  if (!doc) return null;

  if (updates.title !== undefined) doc.title = updates.title;
  if (updates.content_md !== undefined) doc.content_md = updates.content_md;
  if (updates.folder !== undefined) doc.folder = updates.folder;
  if (updates.tags !== undefined) doc.tags = updates.tags;
  if (updates.status !== undefined) doc.status = updates.status;
  if (updates.linked_case_id !== undefined) doc.linked_case_id = updates.linked_case_id;

  doc.updated_at = new Date().toISOString();

  return doc;
}

// ── Versions ─────────────────────────────────────────────────────────

export function getVersionsByDocId(docId: string): DocVersion[] {
  return versions
    .filter((v) => v.doc_id === docId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export function createVersion(data: {
  doc_id: string;
  content_md: string;
  note?: string | null;
}): DocVersion {
  const version: DocVersion = {
    id: `ver_${String(nextVersionNum++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
    doc_id: data.doc_id,
    user_id: DEMO_USER_ID,
    content_md: data.content_md,
    note: data.note ?? null,
  };
  versions.push(version);
  return version;
}

export function getVersionById(id: string): DocVersion | undefined {
  return versions.find((v) => v.id === id);
}

// ── Unique tags across all docs ──────────────────────────────────────

export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  for (const doc of docs) {
    for (const tag of doc.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}
