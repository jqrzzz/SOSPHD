import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CoordinationTimeline } from "@/components/process-diagrams";
import { Button } from "@/components/ui/button";
import {
  PROTOCOL_VERSION,
  PROTOCOL_EFFECTIVE_DATE,
} from "@/lib/protocol";

export { PROTOCOL_VERSION, PROTOCOL_EFFECTIVE_DATE };

export const metadata = {
  title: "Intervention Protocol · SOSPHD",
  description:
    "The formal specification for the human-AI coordination intervention measured by Paper 2.",
};

/**
 * Intervention Protocol — the operational spec Paper 2 cites.
 *
 * Versioning: bump PROTOCOL_VERSION when material changes are made.
 * Git history IS the audit trail — every commit to this file is the
 * "what was the protocol on date X?" record a viva can cite.
 */
export default function ProtocolPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader
        eyebrow={`Spec · ${PROTOCOL_VERSION} · effective ${PROTOCOL_EFFECTIVE_DATE}`}
        title="Intervention Protocol"
        description="The formal specification for the human-AI coordination intervention measured by Paper 2. This document defines what the intervention IS — scope, confidence policy, override policy, provenance requirements, and escalation."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/paper2">Paper 2 dashboard →</Link>
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              What the intervention measures
            </p>
            <CoordinationTimeline />
          </CardContent>
        </Card>

        <Card className="surface-lifted">
          <CardContent className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/90">
              Citation
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When citing this protocol in a manuscript:{" "}
              <span className="text-foreground">
                SOSPHD Intervention Protocol {PROTOCOL_VERSION}, effective{" "}
                {PROTOCOL_EFFECTIVE_DATE}.
              </span>{" "}
              The protocol is version-controlled in the SOSPHD repository at{" "}
              <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
                app/protocol/page.tsx
              </code>
              ; git history is the canonical change record.
            </p>
          </CardContent>
        </Card>

        <Section
          number="1"
          title="Scope"
          subtitle="What the intervention is AI-assisted for, and what it is not."
        >
          <P>
            The AI-assisted coordination layer produces structured
            recommendations for the following decision categories. Each
            recommendation is grounded in observable case state (events,
            computed metrics) and is presented to a human operator for
            disposition.
          </P>
          <DefList
            items={[
              {
                term: "transport",
                desc: "Mode, urgency, and routing of patient movement — e.g. ambulance vs private car, hospital selection on a corridor.",
              },
              {
                term: "payment",
                desc: "Payer-side coordination — guarantee-of-payment triggers, pre-authorization sequencing, insurer outreach timing.",
              },
              {
                term: "triage",
                desc: "Severity refinement based on new information arriving on the timeline. Not a clinical diagnosis.",
              },
              {
                term: "facility",
                desc: "Receiving facility selection or escalation between facilities.",
              },
              {
                term: "follow_up",
                desc: "Post-event coordination tasks — discharge logistics, repatriation, claims handoff.",
              },
              {
                term: "data_capture",
                desc: "Identifying missing milestones on the timeline that block accurate metric computation.",
              },
            ]}
          />
          <P>
            <strong className="text-foreground">Out of scope.</strong>{" "}
            Clinical orders, drug dosing, definitive diagnosis, and patient-side
            advice are explicitly excluded. The intervention coordinates the
            system around the patient; it does not replace the clinician.
          </P>
        </Section>

        <Section
          number="2"
          title="Confidence policy"
          subtitle="How AI self-reported confidence governs operator workflow."
        >
          <P>
            Each recommendation carries a calibrated confidence value in{" "}
            <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
              [0, 1]
            </code>{" "}
            from the engine. Confidence bands and policy:
          </P>
          <Table
            headers={["Band", "Range", "Operator workflow"]}
            rows={[
              [
                <span key="lo" className="text-red-300">
                  Low
                </span>,
                "0.00 – 0.49",
                "Recommendation is informational only. Operator must consult prior cases or escalate before acting on it. Acceptance without override is permitted but discouraged.",
              ],
              [
                <span key="mid" className="text-amber-300">
                  Medium
                </span>,
                "0.50 – 0.79",
                "Standard human-in-loop. Operator reviews, accepts or overrides with a reason. This is the default operating zone.",
              ],
              [
                <span key="hi" className="text-emerald-300">
                  High
                </span>,
                "0.80 – 1.00",
                "Standard human-in-loop. Auto-accept is NOT permitted for v0.1; the goal of Paper 2 is to characterize operator behavior, not to remove the operator.",
              ],
            ]}
          />
          <P className="text-muted-foreground">
            Auto-accept is reserved for a future protocol version once the v0.1
            evaluation establishes acceptable calibration and error
            distributions.
          </P>
        </Section>

        <Section
          number="3"
          title="Override policy"
          subtitle="When override is required and what makes an override valid."
        >
          <P>
            An operator may always override any recommendation. An override is
            valid when it satisfies all three of the following:
          </P>
          <Ol
            items={[
              <>
                A <Mono>reason</Mono> string is provided. Empty or whitespace-only
                reasons are blocked at the UI layer.
              </>,
              <>
                The reason references either a piece of case state the AI did
                not have access to (e.g. an out-of-band phone call with the
                payer) or a clinical / operational judgement that supersedes
                the recommendation.
              </>,
              <>
                The override is recorded as part of the same human decision
                action that flipped <Mono>accepted = false</Mono>; reasons
                appended after the fact are out-of-policy.
              </>,
            ]}
          />
          <P>
            <strong className="text-foreground">Required overrides.</strong>{" "}
            When the recommendation references a decision the operator has
            already made differently in the past five minutes (visible on the
            timeline), the operator MUST override rather than dismiss, so the
            decision record stays complete.
          </P>
        </Section>

        <Section
          number="4"
          title="Provenance — required fields per decision"
          subtitle="The minimum schema every decision row must populate."
        >
          <P>
            Each accept / override populates a row on{" "}
            <Mono>research.recommendations</Mono> and emits a{" "}
            <Mono>NOTE</Mono> event on <Mono>research.case_events</Mono> with a
            structured payload. The fields below MUST be present:
          </P>
          <Table
            headers={["Field", "Source", "Why Paper 2 needs it"]}
            rows={[
              [
                <Mono key="f1">recommendation_id</Mono>,
                "engine",
                "Links the decision row back to the original recommendation. Joinable for time-to-decision analysis.",
              ],
              [
                <Mono key="f2">engine_type</Mono>,
                "engine",
                "Currently always llm; reserved for rule_based / ml_model in later versions.",
              ],
              [
                <Mono key="f3">engine_version</Mono>,
                "engine",
                "Identifies the prompt / model used. Enables side-by-side comparison across engine versions in the dashboard.",
              ],
              [
                <Mono key="f4">confidence_value</Mono>,
                "engine",
                "The AI's calibrated probability. Required for the reliability diagram in Paper 2 §Results.",
              ],
              [
                <Mono key="f5">decision</Mono>,
                "operator",
                "accepted | overridden. The dependent variable of the entire study.",
              ],
              [
                <Mono key="f6">override_reason</Mono>,
                "operator",
                "Free-text string; required when decision = overridden. Forms the basis of the thematic reason taxonomy.",
              ],
              [
                <Mono key="f7">actor_id</Mono>,
                "auth",
                "Who decided. Resolved from the authenticated Supabase user; never operator-typed.",
              ],
              [
                <Mono key="f8">occurred_at</Mono>,
                "system",
                "Decision wall-clock timestamp. Joined to recommendation.created_at to compute time-to-decision.",
              ],
            ]}
          />
        </Section>

        <Section
          number="5"
          title="Failure modes & escalation"
          subtitle="When AI behavior puts the operator in a degraded state."
        >
          <Ol
            items={[
              <>
                <strong className="text-foreground">Operationally infeasible suggestion.</strong>{" "}
                Operator overrides with reason class{" "}
                <Mono>infeasible</Mono>. Recommendations meeting this class are
                flagged in the dashboard and prompt a protocol-level review of
                the system prompt that produced them.
              </>,
              <>
                <strong className="text-foreground">Hallucinated case state.</strong>{" "}
                Recommendation cites events, metrics, or patient details that
                are not present in the source case. Operator overrides with
                reason class <Mono>hallucination</Mono>. These are
                quarantine-worthy — the engine version is paused until the prompt
                is reviewed.
              </>,
              <>
                <strong className="text-foreground">Engine outage.</strong>{" "}
                When the recommendation endpoint fails (network, rate limit,
                schema validation), no recommendation row is written. Operators
                continue without AI assistance; the case is recorded as a{" "}
                <Mono>no_ai</Mono> case for the period.
              </>,
              <>
                <strong className="text-foreground">Stale recommendations.</strong>{" "}
                Recommendations older than 30 minutes without a decision are
                marked stale on the UI; operators may either decide them late
                (still valid for the study, with the elapsed time captured) or
                regenerate.
              </>,
            ]}
          />
        </Section>

        <Section
          number="6"
          title="Versioning"
          subtitle="How this protocol changes — and how Paper 2 tracks the change."
        >
          <P>
            The version constant <Mono>PROTOCOL_VERSION</Mono> at the top of
            this file is the single source of truth. The recommendation
            engine&apos;s system prompt cites it explicitly, and the dashboard
            displays it next to every recommendation set.
          </P>
          <P>
            A material change — any change that affects scope, confidence
            policy, override policy, required provenance fields, or escalation —
            requires a version bump (v0.1 → v0.2) and a git commit on this
            file. Non-material edits (typos, wording) do not require a bump.
          </P>
          <P className="text-muted-foreground">
            Paper 2 results are reported per protocol version. Cross-version
            aggregation is permitted only when explicitly stated and only when
            the changed fields are excluded from the aggregated metric.
          </P>
        </Section>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          <span>
            SOSPHD Intervention Protocol · {PROTOCOL_VERSION} · effective{" "}
            {PROTOCOL_EFFECTIVE_DATE}
          </span>
          <Link
            href="/dashboard/paper2"
            className="text-primary/90 hover:text-primary"
          >
            ← back to paper 2 dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`sec-${number}`} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
          §{number}
        </span>
        <h2
          id={`sec-${number}`}
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/40 p-5">
        {children}
      </div>
    </section>
  );
}

function P({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm leading-relaxed text-foreground/90 ${className}`}>
      {children}
    </p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
      {children}
    </code>
  );
}

function DefList({
  items,
}: {
  items: { term: string; desc: React.ReactNode }[];
}) {
  return (
    <dl className="flex flex-col gap-2">
      {items.map((it) => (
        <div
          key={it.term}
          className="grid grid-cols-1 gap-1 rounded-lg border border-border/40 bg-background/40 px-3 py-2 sm:grid-cols-[140px_1fr] sm:gap-3"
        >
          <dt className="font-mono text-xs tracking-wide text-primary/90">
            {it.term}
          </dt>
          <dd className="text-xs leading-relaxed text-muted-foreground">
            {it.desc}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Ol({ items }: { items: React.ReactNode[] }) {
  // Items are static at render time (protocol §3/§5 enumerations), so
  // an index key is acceptable here — no reordering, no insertion.
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => {
        const key = `${i}`;
        return (
          <li
            key={key}
            className="flex gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-2"
          >
            <span className="flex-shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
              {i + 1}.
            </span>
            <span className="text-xs leading-relaxed text-foreground/90">
              {item}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full min-w-[520px] text-xs">
        <thead className="border-b border-border/40 bg-muted/30">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/30 last:border-b-0 align-top"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2.5 leading-relaxed ${j === 0 ? "whitespace-nowrap font-mono" : "text-foreground/85"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
