import Link from "next/link";

const STEPS = [
  {
    number: "1",
    title: "Log a Case",
    page: "/cases",
    pageLabel: "Cases",
    description:
      "Start by creating a medical-emergency case. Each case tracks a tourist patient, their condition, severity, and current status. This is the raw data your research is built on.",
    actions: ["Click 'New Case' and fill in the details", "Update status as the case progresses", "Add timeline events to record what happened and when"],
  },
  {
    number: "2",
    title: "Check the Dashboard",
    page: "/dashboard",
    pageLabel: "Dashboard",
    description:
      "The dashboard gives you a live overview of all your cases — total counts, severity breakdown, response times, and trends. Use it to spot patterns at a glance.",
    actions: ["Review summary stats across all cases", "Use Paper Builder to draft research narratives from your data"],
  },
  {
    number: "3",
    title: "Write & Organise Docs",
    page: "/docs",
    pageLabel: "Docs",
    description:
      "Create research documents — paper drafts, field logs, one-pagers. Docs are version-tracked so you never lose earlier work. Organise them into folders and tag them.",
    actions: ["Create a new doc from a template or start blank", "Edit with Markdown — every save creates a version", "Use AI polish to clean up your writing"],
  },
  {
    number: "4",
    title: "Use the Workspace",
    page: "/workspace",
    pageLabel: "Workspace",
    description:
      "The workspace is your research bench — capture quick notes, track tasks, log file metadata, and build mind maps to connect your ideas visually.",
    actions: ["Jot notes and tag them to cases or themes", "Create tasks to track your research to-dos", "Build mind maps to visualise how concepts connect"],
  },
  {
    number: "5",
    title: "Ask the Advisor",
    page: "/advisor",
    pageLabel: "Advisor",
    description:
      "The AI advisor knows your cases, docs, and workspace. Ask it questions about your research, get methodology suggestions, or brainstorm hypotheses. It also has Quick Capture for fast note/task creation.",
    actions: ["Start a session and ask a research question", "Use Quick Capture to log a note or task on the fly"],
  },
];

export default function GuidePage() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          How to Use ResearchOS
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A simple walkthrough of the platform — what each section does and what you should do in it.
        </p>
      </header>

      <div className="px-6 pt-6">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">What is this app?</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            ResearchOS is a PhD research platform for studying tourist medical-emergency coordination.
            It connects to a live operational database so you can observe real cases, document your
            research, and build publications — all in one place. Think of it as five tools in one:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Cases = data", "Dashboard = overview", "Docs = writing", "Workspace = organising", "Advisor = AI help"].map(
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

      <div className="flex flex-col gap-4 px-6 py-6">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="relative rounded-lg border border-border bg-card p-5 pl-14"
          >
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

      <div className="border-t border-border px-6 py-4">
        <p className="text-xs text-muted-foreground">
          Tip: You can always get back here from the sidebar. If something feels broken, check the
          Dashboard first — it tells you if data is flowing correctly.
        </p>
      </div>
    </div>
  );
}
