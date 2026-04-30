/**
 * PhD Spine — master structure for the research program.
 *
 * This is the single source of truth for phases, steps, and open
 * definitional questions.  Everything is plain data so the UI can
 * render it without side-effects.
 */

/* ── Types ─────────────────────────────────────────────────────── */

export type StepStatus = "done" | "in_progress" | "next" | "pending";

export interface Step {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  /** Which deliverable / artifact this step produces */
  deliverable?: string;
}

export interface Phase {
  id: string;
  label: string;
  summary: string;
  steps: Step[];
}

export interface OpenQuestion {
  id: string;
  /** Short label shown in the list */
  label: string;
  /** Full question text */
  question: string;
  /** Where this question comes from (e.g. "Definitions Appendix v1.0") */
  source: string;
  /** Options or guidance to help decide */
  options?: string[];
  /** Once resolved, store the answer here */
  answer?: string;
}

/* ── Phases & Steps ───────────────────────────────────────────── */

export const PHD_PHASES: Phase[] = [
  {
    id: "phase-0",
    label: "Phase 0 — Lock the Spine",
    summary:
      "Standards, definitions, and scope. The measurement foundation everything else depends on.",
    steps: [
      {
        id: "step-1",
        label: "Definitions Appendix",
        description:
          "Milestone events (FIRST_CONTACT, TRANSPORT_ACTIVATED, GUARANTEED_PAYMENT, DEFINITIVE_CARE_START), timestamp standards, evidence rules, edge cases, metric definitions (TTTA, TTGP, TTDC).",
        status: "done",
        deliverable: "Definitions Appendix v1.1",
      },
      {
        id: "step-2",
        label: "Minimum Dataset Schema",
        description:
          "CASE_TABLE fields (category, severity, payer, transport, disposition), EVENT_TABLE taxonomy (required milestones + recommended gate events), METRICS_TABLE derivation rules.",
        status: "done",
        deliverable: "Minimum Dataset Schema v1.1",
      },
      {
        id: "step-3",
        label: "Baseline Workflow",
        description:
          "Hub-and-spoke flow: remote → initial clinic/EMS → imaging/diagnosis → payment → transport → hub → specialist acceptance. Identifies dominant gates and friction points.",
        status: "done",
        deliverable: "Baseline Workflow v1.0 (Indonesia framing)",
      },
      {
        id: "step-3-5",
        label: "Medical Maps + ECL Framework",
        description:
          "Emergency Capability Level (ECL 1–5) definitions, facility registry + transport registry templates. Variables: marketed vs functional ECL, English support, specialist acceptance reliability.",
        status: "done",
        deliverable: "ECL Framework v0.2",
      },
    ],
  },
  {
    id: "phase-1",
    label: "Phase 1 — Baseline Capture",
    summary:
      "Make it real. Pilot design, first cases, and the data needed for Paper 1.",
    steps: [
      {
        id: "step-4",
        label: "Corridor Map + Pilot Brief",
        description:
          "Indonesia corridors (Penida/Lembongan/Ubud/Gili/Lombok → Denpasar). Initial partner/hub list + transport reality. Cohort definition for first 20 cases. Logging SOP. Seed registry: 10–20 facilities + key transport providers.",
        status: "done",
        deliverable: "Corridor Archetypes A1–A6 v1.1",
      },
      {
        id: "step-5a",
        label: "Backfill (2018–2023 data)",
        description:
          "843 historical cases from operational spreadsheet. Needs insurer normalization (448 strings → ~30 entities) and diagnosis bucketing (free text → coarse categories).",
        status: "in_progress",
        deliverable: "Baseline Case Registry CSV",
      },
      {
        id: "step-5b",
        label: "Prospective Logging (2026 onward)",
        description:
          "Capture milestones per Step 1 definitions. Populate minimum dataset per Step 2. Maintain failure log + missingness log.",
        status: "pending",
      },
      {
        id: "step-6",
        label: "Descriptive Stats + Paper 1 Scaffold",
        description:
          "Distributions: TTDC/TTGP/TTTA. Missingness rates + estimation rates. Delay decomposition (where time is lost: imaging vs payment vs transport). Early ECL validity signals.",
        status: "next",
        deliverable: "Paper 1 draft v0.1",
      },
    ],
  },
  {
    id: "phase-2",
    label: "Phase 2 — Intervention + Evaluation",
    summary:
      "The Tourist SOS coordination layer as the 'treatment'. Stepped-wedge rollout design.",
    steps: [
      {
        id: "step-7",
        label: "Intervention Protocol",
        description:
          "What changes operationally vs baseline. Human-in-loop rules, override policy, uncertainty labeling. Decision provenance requirements.",
        status: "pending",
        deliverable: "Intervention Protocol v1.0",
      },
      {
        id: "step-8",
        label: "Stepped-Wedge Rollout Plan",
        description:
          "Staggered site activation schedule. Outcome model (before/after within site; across-site inference). Pre-registration style analysis plan.",
        status: "pending",
        deliverable: "Evaluation Design v1.0",
      },
      {
        id: "step-9",
        label: "Multi-site Results + Failure Modes",
        description:
          "Effect sizes by corridor, payer category, ECL band. Failure modes (weather, capacity, payer delay, misclassification).",
        status: "pending",
        deliverable: "Paper 3 results",
      },
    ],
  },
  {
    id: "phase-3",
    label: "Phase 3 — Publication Factory",
    summary: "Turn the research into a dissertation and publishable papers.",
    steps: [
      {
        id: "paper-1",
        label: "Paper 1 — Dataset + ECL + Descriptive Stats",
        description:
          "Define the event taxonomy, TTDC/TTGP/TTTA, data quality strategy, corridor archetypes, ECL framework, and early descriptive stats.",
        status: "pending",
      },
      {
        id: "paper-2",
        label: "Paper 2 — Human–AI Coordination + Provenance",
        description:
          "Describe the human–AI coordination layer, uncertainty design, and provenance logging method.",
        status: "pending",
      },
      {
        id: "paper-3",
        label: "Paper 3 — Stepped-Wedge Impact Evaluation",
        description:
          "Show stepped-wedge results across sites: effects, variance by region/payer, and failure modes.",
        status: "pending",
      },
      {
        id: "dissertation",
        label: "Dissertation Assembly",
        description:
          "Narrative stitching of Papers 1–3 into a cohesive dissertation.",
        status: "pending",
      },
    ],
  },
];

/* ── Open Questions ───────────────────────────────────────────── */

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: "oq-1",
    label: "FIRST_CONTACT anchor",
    question:
      "Should FIRST_CONTACT be the first inbound contact to Tourist SOS, or first contact to any provider (clinic/EMS)?",
    source: "Definitions Appendix v1.0, Milestone A",
    options: [
      "Option 1: First inbound contact to Tourist SOS (recommended — clean, consistent)",
      "Option 2: First contact to any provider (harder — often missing)",
    ],
    answer:
      "Option 1 — First inbound contact to Tourist SOS. We control the timestamp, it's consistent across sites, and INCIDENT_OCCURRED can be logged separately as an optional event.",
  },
  {
    id: "oq-2",
    label: "Private vehicle for TTTA",
    question:
      "Does PRIVATE_VEHICLE count for TTTA if it is the actual executed transport?",
    source: "Definitions Appendix v1.0, Milestone B",
    options: [
      "Yes — TTTA captures practical reality",
      "No — TTTA only counts professional transport activation (cleaner, but may miss real movement)",
    ],
    answer:
      "Yes — count it. In under-resourced corridors, private vehicle IS the transport reality. Tag transport_mode = PRIVATE_VEHICLE and filter in analysis for sensitivity checks.",
  },
  {
    id: "oq-3",
    label: "Most common payment gate",
    question:
      "In practice, what is the most common gating point for GUARANTEED_PAYMENT? Imaging, admission, surgery, or transport/evac?",
    source: "Definitions Appendix v1.0, Milestone C",
    options: ["Imaging (CT/MRI)", "Admission", "Surgery", "Transport/evac"],
    answer:
      "Transport/evac — baseline data shows 46/48 evac cases were insured, meaning the money question becomes decisive when the patient needs to be moved to a higher-capability facility. Payment gates care escalation, not initial treatment.",
  },
  {
    id: "oq-4",
    label: "DEFINITIVE_CARE_START rule",
    question:
      "Which rule should define when definitive care starts? Strict (OR/ICU/cath), Broad (specialist acceptance), or Hybrid (strict if available, else broad)?",
    source: "Definitions Appendix v1.0, Milestone D",
    options: [
      "Strict — OR, ICU, cath lab, stroke pathway only",
      "Broad — specialist acceptance or admission order",
      "Hybrid (recommended) — strict if available, else broad",
    ],
    answer:
      "Hybrid — use strict markers (OR, ICU, cath lab) when available, fall back to specialist acceptance when clinical data is sparse. Label definitive_marker_type on every case for transparency.",
  },
  {
    id: "oq-5",
    label: "Severity assignment method",
    question:
      "Should severity be assigned by operator judgment, clinician input, or rule-based from symptoms/vitals?",
    source: "Definitions Appendix v1.0, Section 4",
    options: [
      "Operator judgment (acceptable for v1.0 if logged as such)",
      "Clinician input",
      "Rule-based from symptoms/vitals",
    ],
    answer:
      "AI-assisted with operator confirmation for v1.0. Use AI models to suggest severity from available symptoms/vitals/chief complaint, operator confirms or overrides. Log method as 'ai_assisted'. Upgrade to clinician validation in v2.0 for inter-rater reliability.",
  },
  {
    id: "oq-6",
    label: "FIRST_CONTACT triggers",
    question:
      "Does Tourist SOS currently have internal triggers that auto-detect/open cases, or is FIRST_CONTACT always a human-initiated event?",
    source: "Definitions Appendix v1.0, Milestone A",
    options: [
      "Always human-initiated (call, message, referral)",
      "Some triggers exist (describe which)",
    ],
    answer:
      "Currently human-initiated (call, WhatsApp, clinic referral). Designing for future auto-triggers from SOSTRAVEL (SOS button, geofence alerts). When auto-triggers activate, FIRST_CONTACT will be machine-timestamped with source = 'app_trigger'.",
  },
  {
    id: "oq-7",
    label: "Baseline vs Intervention boundary",
    question:
      "What is the exact operational difference between how cases are handled today (baseline) vs under the Tourist SOS coordination layer (intervention)? This defines the treatment.",
    source: "Research Execution Plan, Step 7",
  },
];

/* ── Helper functions ─────────────────────────────────────────── */

export function getPhaseProgress(phase: Phase): {
  done: number;
  total: number;
  percent: number;
} {
  const total = phase.steps.length;
  const done = phase.steps.filter((s) => s.status === "done").length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getOverallProgress(): {
  done: number;
  total: number;
  percent: number;
} {
  const allSteps = PHD_PHASES.flatMap((p) => p.steps);
  const total = allSteps.length;
  const done = allSteps.filter((s) => s.status === "done").length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getNextStep(): Step | null {
  for (const phase of PHD_PHASES) {
    const next = phase.steps.find(
      (s) => s.status === "next" || s.status === "in_progress"
    );
    if (next) return next;
  }
  return null;
}

export function getUnresolvedQuestions(): OpenQuestion[] {
  return OPEN_QUESTIONS.filter((q) => !q.answer);
}
