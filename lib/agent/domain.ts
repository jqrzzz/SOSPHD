/* ─── PhD Agent Domain Knowledge ──────────────────────────────────────
 *  Structured research context for the AI agent.
 *  This is NOT a prompt string — it's typed data the agent reasons over.
 *  Every field is something the agent can reference, compute on, or
 *  use to identify gaps in the research.
 * ────────────────────────────────────────────────────────────────────── */

// ── Thesis & Research Design ────────────────────────────────────────

export const RESEARCH_DOMAIN = {
  thesis: {
    claim:
      "Human-AI coordination reduces measurable delay and access friction in tourist emergencies across heterogeneous health systems.",
    keywords: [
      "human-AI coordination",
      "tourist medical emergency",
      "time to definitive care",
      "payment guarantee delay",
      "Southeast Asia health systems",
      "stepped-wedge trial",
      "decision provenance",
    ],
    discipline: "Health Services Research / Health Informatics",
    methodology: "Stepped-wedge cluster randomized controlled trial",
  },

  /** The 3-paper dissertation structure */
  papers: [
    {
      id: "paper_1",
      title: "Measurement Framework",
      fullTitle:
        "Measuring TTDC and TTGP in Tourist Medical Emergencies: A Standardized Framework",
      focus: "Define and validate TTTA, TTGP, TTDC as reproducible metrics",
      status: "drafting" as const,
      dataNeeds: [
        "Historical case timestamps (843 cases, 2018-2020)",
        "Baseline TTTA/TTGP/TTDC distributions per corridor",
        "Inter-rater reliability for event classification",
      ],
      deliverables: [
        "Metric definitions with computation rules",
        "Data collection protocol",
        "Baseline descriptive statistics",
      ],
    },
    {
      id: "paper_2",
      title: "Intervention Design",
      fullTitle:
        "Decision Provenance in Emergency Coordination: Designing the Human-AI Layer",
      focus: "Design and document the coordination layer intervention",
      status: "planning" as const,
      dataNeeds: [
        "Operator workflow observations",
        "AI recommendation acceptance/override rates",
        "Provenance chain completeness scores",
      ],
      deliverables: [
        "Intervention specification (TIDieR checklist)",
        "Decision provenance data model",
        "Operator interaction analysis",
      ],
    },
    {
      id: "paper_3",
      title: "Impact Evaluation",
      fullTitle:
        "Reducing Time to Definitive Care: A Stepped-Wedge Evaluation of Human-AI Emergency Coordination",
      focus: "Measure causal impact of the coordination layer",
      status: "design" as const,
      dataNeeds: [
        "Pre/post activation metrics per site",
        "Temporal trends across all sites",
        "Cost-effectiveness data",
      ],
      deliverables: [
        "Stepped-wedge analysis results",
        "Effect size estimates with CIs",
        "Policy recommendations",
      ],
    },
  ],

  /** PhD metrics — the core measurements */
  metrics: {
    TTTA: {
      name: "Time to Transport Activation",
      from: "FIRST_CONTACT",
      to: "TRANSPORT_ACTIVATED",
      unit: "minutes",
      description:
        "How long from initial contact until transport (ambulance, helicopter, boat) is dispatched.",
      researchQuestion:
        "Does the AI coordination layer reduce transport activation delays?",
    },
    TTGP: {
      name: "Time to Guaranteed Payment",
      from: "FIRST_CONTACT",
      to: "GUARANTEED_PAYMENT",
      unit: "minutes",
      description:
        "How long from initial contact until financial clearance (insurance pre-auth, cash deposit, or embassy guarantee).",
      researchQuestion:
        "Does payment friction delay clinical care? Can AI reduce TTGP?",
    },
    TTDC: {
      name: "Time to Definitive Care",
      from: "FIRST_CONTACT",
      to: "DEFINITIVE_CARE_START",
      unit: "minutes",
      description:
        "How long from initial contact until the patient receives definitive treatment (surgery, HBO, ICU admission).",
      researchQuestion:
        "Is the primary outcome metric. Does the full intervention reduce TTDC?",
    },
  },

  /** Research corridors — geographic scope */
  corridors: [
    {
      id: "koh_samui_bkk",
      name: "Koh Samui → Bangkok",
      characteristics: [
        "Island to mainland",
        "Flight or ferry + road",
        "Limited local capacity",
        "High tourist volume",
      ],
      knownBottlenecks: [
        "Ferry schedule constraints",
        "Single small airport",
        "Language barriers at island clinics",
      ],
    },
    {
      id: "phuket_bkk",
      name: "Phuket → Bangkok",
      characteristics: [
        "Major tourist hub",
        "International hospital presence",
        "Good air connectivity",
      ],
      knownBottlenecks: [
        "Traffic congestion to airport",
        "Insurance pre-auth delays",
        "High case volume during peak season",
      ],
    },
    {
      id: "chiang_mai_bkk",
      name: "Chiang Mai → Bangkok",
      characteristics: [
        "Northern hub",
        "Good hospital infrastructure",
        "Regular flights",
      ],
      knownBottlenecks: [
        "Altitude-related cases from trekking",
        "Rural access for surrounding areas",
      ],
    },
    {
      id: "pattaya_bkk",
      name: "Pattaya → Bangkok",
      characteristics: [
        "Close to Bangkok (2hr drive)",
        "High nightlife-related incidents",
        "Mixed facility quality",
      ],
      knownBottlenecks: [
        "Road traffic variability",
        "Clinic quality inconsistency",
      ],
    },
    {
      id: "krabi_bkk",
      name: "Krabi → Bangkok",
      characteristics: [
        "Island access (Phi Phi, Lanta)",
        "Remote beach areas",
        "Limited local capacity",
      ],
      knownBottlenecks: [
        "Boat transfers from islands",
        "Limited after-hours staffing",
      ],
    },
    {
      id: "bangkok_hub",
      name: "Bangkok Hub",
      characteristics: [
        "Destination for all corridors",
        "International hospitals (Bumrungrad, BNH, Bangkok Hospital)",
        "Full specialist capacity",
      ],
      knownBottlenecks: [
        "Inter-hospital transfer coordination",
        "Insurance verification backlogs",
      ],
    },
  ],

  /** Event taxonomy — the provenance spine */
  eventTypes: [
    "FIRST_CONTACT",
    "TRIAGE_COMPLETE",
    "TRANSPORT_ACTIVATED",
    "FACILITY_ARRIVAL",
    "GUARANTEED_PAYMENT",
    "DEFINITIVE_CARE_START",
    "DISCHARGE",
    "NOTE",
  ] as const,

  /** Milestone events that should appear in a complete case */
  requiredMilestones: [
    "FIRST_CONTACT",
    "TRIAGE_COMPLETE",
    "TRANSPORT_ACTIVATED",
    "FACILITY_ARRIVAL",
    "GUARANTEED_PAYMENT",
    "DEFINITIVE_CARE_START",
    "DISCHARGE",
  ] as const,

  /** Historical data reference */
  historicalData: {
    caseCount: 843,
    dateRange: "2018-2020",
    source: "Google Sheets (not yet in Supabase)",
    status: "pending_import" as const,
  },
} as const;

// ── Types ───────────────────────────────────────────────────────────

export type PaperStatus = "design" | "planning" | "drafting" | "submitted" | "published";
export type MetricKey = keyof typeof RESEARCH_DOMAIN.metrics;
export type CorridorId = (typeof RESEARCH_DOMAIN.corridors)[number]["id"];
export type EventType = (typeof RESEARCH_DOMAIN.eventTypes)[number];
