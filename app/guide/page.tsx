import Link from "next/link";

import { CorridorJourney } from "@/components/process-diagrams";

const STEPS = [
  {
    number: "1",
    title: "Track the PhD Spine",
    page: "/spine",
    pageLabel: "Spine",
    description:
      "The spine is home base: phases, steps, open definitional questions, and where the program stands. Start every session here.",
    actions: [
      "Check the current phase and the 'up next' step",
      "Review open questions before making methodology calls",
    ],
  },
  {
    number: "2",
    title: "Observe Cases (read-only)",
    page: "/cases",
    pageLabel: "Cases",
    description:
      "Cases arrive automatically from SOSCOMMAND — SOSPHD never creates or edits them. Open one to see its milestone timeline, computed TTTA/TTGP/TTDC, operational context, and the AI recommendation surface Paper 2 measures.",
    actions: [
      "Open a case to review its timeline and metrics",
      "Add milestone events the sync missed (operator-entered, provenance-stamped)",
      "Generate recommendations, then accept or override each with a reason — every decision is the Paper 2 audit trail",
    ],
  },
  {
    number: "3",
    title: "Capture Fieldwork & Contacts",
    page: "/fieldwork",
    pageLabel: "Field Journal",
    description:
      "Site visits, conversations, interviews, ideas — with corridor tagging and the research-consent gate. Contacts is the research network CRM. Records involving other people need consent captured AT THE TIME to be usable in a paper.",
    actions: [
      "Log entries same-day; set consent status, method, and jurisdiction",
      "Use the consent script in docs/consent-framework.md before recording anyone",
      "Link entries to contacts and corridors so coverage analysis sees them",
    ],
  },
  {
    number: "4",
    title: "Check the Dashboard & Freeze Datasets",
    page: "/dashboard",
    pageLabel: "Dashboard",
    description:
      "Distributions of TTTA, TTGP, and TTDC across all cases, the Paper 2 coordination view, corridor coverage, and the weekly digest. Before drafting results, freeze an analysis snapshot — papers cite a named frozen dataset, not a live dashboard.",
    actions: [
      "Review metric distributions and missing milestones",
      "Freeze a labeled snapshot before any analysis you intend to cite",
      "Use Paper Builder to draft sections from the live provenance data",
    ],
  },
  {
    number: "5",
    title: "Write & Organise Docs",
    page: "/docs",
    pageLabel: "Docs",
    description:
      "Research documents — paper drafts, field logs, methods notes. Version-tracked, foldered, tagged. The /protocol page holds the versioned Intervention Protocol the recommendation engine cites.",
    actions: [
      "Draft in Markdown; save versions at meaningful checkpoints",
      "Use the AI tools (summarize, outline, extract tasks) on any doc",
    ],
  },
  {
    number: "6",
    title: "Use the Workspace & Advisor",
    page: "/workspace",
    pageLabel: "Workspace",
    description:
      "The bench: notes, tasks, mind maps, and real file uploads (private bucket, consent-tagged). The Advisor is a streaming AI assistant that sees your cases, metrics, gaps, and tasks.",
    actions: [
      "Upload recordings/documents with their consent status",
      "Ask the Advisor 'what should I work on next?' — it reads the live gap analysis",
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Header */}
      <header className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          How to Use SOS PHD
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A simple walkthrough of the platform — what each section does and what you should do in it.
        </p>
      </header>

      {/* The journey being studied */}
      <div className="px-6 pt-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            The journey this research measures
          </p>
          <CorridorJourney />
        </div>
      </div>

      {/* Overview card */}
      <div className="px-6 pt-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">What is this app?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            SOS PHD is the research workbench for studying tourist medical-emergency coordination.
            It reads live operational cases (read-only — cases originate in SOSCOMMAND), computes the
            TTTA/TTGP/TTDC metrics, runs the human-AI recommendation loop Paper 2 measures, and holds
            all of the researcher's own material:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Spine = plan", "Cases = data (read-only)", "Fieldwork = capture", "Dashboard = analysis", "Docs = writing", "Workspace = bench", "Advisor = AI help"].map(
              (label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground"
                >
                  {label}
                </span>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4 px-6 py-6">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="relative rounded-lg border border-border bg-card p-5 pl-14"
          >
            {/* Step number */}
            <div className="absolute left-4 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {step.number}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>

                <ul className="mt-3 flex flex-col gap-1.5">
                  {step.actions.map((action) => (
                    <li key={action} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={step.page}
                className="shrink-0 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Go to {step.pageLabel} &rarr;
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Footer tip */}
      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Tip: If something feels broken, check the Dashboard first — it tells you whether data is
          flowing. A [SOSPHD:DEGRADED] warning in the server logs means a read fell back to empty
          data and needs attention.
        </p>
      </div>
    </div>
  );
}
