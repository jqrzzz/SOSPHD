"use client";

/* ─── Admissions interactive controls ──────────────────────────────────
 *  The parts of the application tracker you actually operate: tick a
 *  requirement off, move a school along the pipeline, confirm a date
 *  against the official page, and write supervisor emails.
 * ────────────────────────────────────────────────────────────────────── */

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOutreachAction,
  deleteOutreachAction,
  setInstitutionStageAction,
  setRequirementStatusAction,
  updateInstitutionNotesAction,
  updateOutreachAction,
  verifyRequirementAction,
} from "@/lib/admissions-actions";
import {
  APPLICATION_STAGE_LABELS,
  REQUIREMENT_STATUS_LABELS,
  daysUntil,
  deadlineUrgency,
  type ApplicationStage,
  type InstitutionRequirement,
  type Outreach,
  type RequirementStatus,
} from "@/lib/data/admissions-types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const URGENCY_CLASS = {
  past: "text-muted-foreground",
  critical: "text-destructive",
  soon: "text-amber-400",
  later: "text-muted-foreground",
} as const;

// Clicking cycles the common path; the dropdown covers the rest.
const NEXT_STATUS: Record<RequirementStatus, RequirementStatus> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
  waived: "not_started",
  not_applicable: "not_started",
};

const STATUS_STYLE: Record<RequirementStatus, string> = {
  not_started: "border-border text-muted-foreground",
  in_progress: "border-amber-500/40 text-amber-400",
  done: "border-emerald-500/40 text-emerald-400",
  waived: "border-border text-muted-foreground line-through",
  not_applicable: "border-border text-muted-foreground",
};

export function RequirementCard({
  r,
  institutionId,
}: {
  r: InstitutionRequirement;
  institutionId: string;
}) {
  const [isPending, start] = useTransition();
  const days = r.due_date ? daysUntil(r.due_date) : null;
  const settled = r.status === "done" || r.status === "waived";

  const setStatus = (status: RequirementStatus) => {
    start(async () => {
      const res = await setRequirementStatusAction({
        id: r.id,
        institution_id: institutionId,
        status,
      });
      if (res.error) toast.error(res.error);
    });
  };

  const verify = () => {
    start(async () => {
      const res = await verifyRequirementAction({
        id: r.id,
        institution_id: institutionId,
      });
      if (res.error) toast.error(res.error);
      else toast.success("Marked verified");
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-opacity",
        settled && "opacity-60",
        isPending && "opacity-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatus(NEXT_STATUS[r.status])}
          disabled={isPending}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] transition-colors",
            STATUS_STYLE[r.status],
          )}
          aria-label={`Mark ${r.label} as ${REQUIREMENT_STATUS_LABELS[NEXT_STATUS[r.status]]}`}
          title={`Click: ${REQUIREMENT_STATUS_LABELS[NEXT_STATUS[r.status]]}`}
        >
          {r.status === "done" ? "✓" : r.status === "in_progress" ? "•" : ""}
        </button>

        <span
          className={cn(
            "text-sm font-medium text-foreground",
            r.status === "waived" && "line-through",
          )}
        >
          {r.label}
        </span>

        {!r.mandatory && (
          <Badge variant="secondary" className="text-[9px]">
            Optional
          </Badge>
        )}
        {!r.verified_at && (
          <button
            onClick={verify}
            disabled={isPending}
            className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-400 hover:bg-amber-500/10"
            title="I have checked this against the official page"
          >
            Unverified — confirm
          </button>
        )}

        <div className="ml-auto">
          <Select
            value={r.status}
            onValueChange={(v) => setStatus(v as RequirementStatus)}
          >
            <SelectTrigger className="h-6 w-28 text-[10px]" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.keys(REQUIREMENT_STATUS_LABELS) as RequirementStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {REQUIREMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {r.detail && (
        <p className="pl-7 text-xs leading-relaxed text-muted-foreground">
          {r.detail}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pl-7 text-[10px]">
        {days !== null && (
          <span className={cn("font-mono", URGENCY_CLASS[deadlineUrgency(days)])}>
            {r.due_date} · {days < 0 ? "passed" : `${days} days`}
          </span>
        )}
        {r.source_url && (
          <a
            href={r.source_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-2"
          >
            source ↗
          </a>
        )}
        {r.verified_at && (
          <span className="text-muted-foreground">
            verified {r.verified_at.slice(0, 10)}
          </span>
        )}
      </div>
    </div>
  );
}

export function StageControl({
  institutionId,
  stage,
}: {
  institutionId: string;
  stage: ApplicationStage;
}) {
  const [isPending, start] = useTransition();
  return (
    <Select
      value={stage}
      onValueChange={(v) =>
        start(async () => {
          const res = await setInstitutionStageAction({
            id: institutionId,
            stage: v as ApplicationStage,
          });
          if (res.error) toast.error(res.error);
          else toast.success(`Moved to ${APPLICATION_STAGE_LABELS[v as ApplicationStage]}`);
        })
      }
    >
      <SelectTrigger
        className={cn("h-7 w-48 text-xs", isPending && "opacity-50")}
        aria-label="Application stage"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(APPLICATION_STAGE_LABELS) as ApplicationStage[]).map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {APPLICATION_STAGE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function NotesEditor({
  institutionId,
  notes,
}: {
  institutionId: string;
  notes: string;
}) {
  const [value, setValue] = useState(notes);
  const [isPending, start] = useTransition();
  const dirty = value !== notes;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-20 resize-y text-xs"
        placeholder="What you have learned about this programme, who you spoke to, what to do next…"
      />
      {dirty && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() =>
              start(async () => {
                const res = await updateInstitutionNotesAction({
                  id: institutionId,
                  notes: value,
                });
                if (res.error) toast.error(res.error);
                else toast.success("Notes saved");
              })
            }
          >
            Save notes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setValue(notes)}
          >
            Revert
          </Button>
        </div>
      )}
    </div>
  );
}

export function OutreachPanel({
  institutionId,
  outreach,
  supervisorRequired,
}: {
  institutionId: string;
  outreach: Outreach[];
  supervisorRequired: boolean;
}) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          Supervisor outreach
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setComposing((c) => !c)}
        >
          {composing ? "Cancel" : "+ New email"}
        </Button>
      </div>

      {supervisorRequired && (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          This programme requires an agreed supervisor before you can apply —
          outreach is the critical path here, not the form.
        </p>
      )}

      {composing && (
        <OutreachComposer
          institutionId={institutionId}
          onDone={() => setComposing(false)}
        />
      )}

      {outreach.length === 0 && !composing && (
        <p className="text-xs text-muted-foreground">
          No outreach yet. Drafts written by the research agent land here for
          you to review and send — nothing is ever sent automatically.
        </p>
      )}

      {outreach.map((o) => (
        <OutreachCard key={o.id} o={o} institutionId={institutionId} />
      ))}
    </div>
  );
}

function OutreachComposer({
  institutionId,
  onDone,
}: {
  institutionId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [isPending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Professor name"
          className="h-8 text-xs"
        />
        <Input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role / department"
          className="h-8 text-xs"
        />
      </div>
      <Input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="h-8 text-xs"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ground it in the actual research — the 836-case registry, the missing-timestamps finding, the running instrumentation."
        className="min-h-32 resize-y text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] text-muted-foreground">
          Follow up on
          <Input
            type="date"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            className="ml-2 inline-block h-7 w-36 text-xs"
          />
        </label>
        <Button
          size="sm"
          className="ml-auto h-7 text-xs"
          disabled={isPending || !name.trim() || !body.trim()}
          onClick={() =>
            start(async () => {
              const res = await createOutreachAction({
                institution_id: institutionId,
                person_name: name.trim(),
                person_role: role.trim() || undefined,
                subject: subject.trim() || undefined,
                body,
                follow_up_at: followUp || undefined,
              });
              if (res.error) toast.error(res.error);
              else {
                toast.success("Draft saved");
                onDone();
              }
            })
          }
        >
          Save draft
        </Button>
      </div>
    </div>
  );
}

const OUTREACH_STATUS_STYLE: Record<string, string> = {
  draft: "border-border text-muted-foreground",
  sent: "border-primary/40 text-primary",
  replied: "border-emerald-500/40 text-emerald-400",
  no_reply: "border-amber-500/40 text-amber-400",
  closed: "border-border text-muted-foreground",
};

function OutreachCard({
  o,
  institutionId,
}: {
  o: Outreach;
  institutionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, start] = useTransition();

  const update = (updates: Parameters<typeof updateOutreachAction>[0]) =>
    start(async () => {
      const res = await updateOutreachAction(updates);
      if (res.error) toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {o.person_name}
        </span>
        {o.person_role && (
          <span className="text-xs text-muted-foreground">{o.person_role}</span>
        )}
        <Badge
          variant="outline"
          className={cn("ml-auto text-[10px]", OUTREACH_STATUS_STYLE[o.status])}
        >
          {o.status}
        </Badge>
      </div>

      {o.subject && (
        <p className="text-xs font-medium text-foreground/80">{o.subject}</p>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="self-start text-[10px] text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide email" : "Show email"}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/30 p-3 font-sans text-xs leading-relaxed text-foreground/85">
          {o.body}
        </pre>
      )}

      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
        {o.sent_at && <span>sent {o.sent_at.slice(0, 10)}</span>}
        {o.follow_up_at && <span>follow up {o.follow_up_at}</span>}

        <div className="ml-auto flex items-center gap-2">
          {o.status === "draft" && (
            <>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    o.subject ? `${o.subject}\n\n${o.body}` : o.body,
                  );
                  toast.success("Copied — paste into your mail client");
                }}
                className="text-primary hover:underline"
              >
                Copy
              </button>
              <button
                disabled={isPending}
                onClick={() =>
                  update({ id: o.id, institution_id: institutionId, mark_sent: true })
                }
                className="text-primary hover:underline"
              >
                Mark sent
              </button>
            </>
          )}
          {o.status === "sent" && (
            <>
              <button
                disabled={isPending}
                onClick={() =>
                  update({
                    id: o.id,
                    institution_id: institutionId,
                    status: "replied",
                  })
                }
                className="text-emerald-400 hover:underline"
              >
                Replied
              </button>
              <button
                disabled={isPending}
                onClick={() =>
                  update({
                    id: o.id,
                    institution_id: institutionId,
                    status: "no_reply",
                  })
                }
                className="text-amber-400 hover:underline"
              >
                No reply
              </button>
            </>
          )}
          <button
            disabled={isPending}
            onClick={() =>
              start(async () => {
                const res = await deleteOutreachAction({
                  id: o.id,
                  institution_id: institutionId,
                });
                if (res.error) toast.error(res.error);
                else toast.success("Deleted");
              })
            }
            className="text-muted-foreground hover:text-destructive"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
