"use client";

/* ─── Doc annotations panel ────────────────────────────────────────────
 *  Margin notes on a research doc — the review half of the writing loop:
 *  the owner selects a passage in the editor (or just types a general
 *  note), leaves a comment; agents read the open notes via the MCP
 *  server's list_doc_annotations and address them in the next version;
 *  addressed notes get resolved, staying as history.
 *
 *  Selection capture listens document-wide: when the selection lives in
 *  a textarea (the editor), it reads selectionStart/End; otherwise it
 *  takes window.getSelection() (works in preview panes). No coupling to
 *  the editor component.
 * ────────────────────────────────────────────────────────────────────── */

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createAnnotationAction,
  deleteAnnotationAction,
  setAnnotationResolvedAction,
} from "@/lib/docs-actions";
import type { DocAnnotation } from "@/lib/data/docs-types";
import { toast } from "sonner";

const QUOTE_MAX = 600;

function currentSelectionText(): string {
  const el = document.activeElement;
  if (
    el instanceof HTMLTextAreaElement &&
    el.selectionStart !== el.selectionEnd
  ) {
    return el.value.slice(el.selectionStart, el.selectionEnd);
  }
  return window.getSelection()?.toString() ?? "";
}

export function DocAnnotations({
  docId,
  annotations,
}: {
  docId: string;
  annotations: DocAnnotation[];
}) {
  const [quote, setQuote] = useState("");
  const [comment, setComment] = useState("");
  const [composing, setComposing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Track the live selection so "Annotate selection" always has the
  // latest passage — including textarea selections, which
  // window.getSelection() misses in some browsers.
  useEffect(() => {
    const onSelect = () => {
      if (composing) return; // don't clobber a note being written
      const text = currentSelectionText().trim();
      if (text) setQuote(text.slice(0, QUOTE_MAX));
    };
    document.addEventListener("selectionchange", onSelect);
    document.addEventListener("mouseup", onSelect);
    return () => {
      document.removeEventListener("selectionchange", onSelect);
      document.removeEventListener("mouseup", onSelect);
    };
  }, [composing]);

  const open = annotations.filter((a) => !a.resolved);
  const resolved = annotations.filter((a) => a.resolved);

  const save = () => {
    if (!comment.trim()) return;
    startTransition(async () => {
      const res = await createAnnotationAction({
        doc_id: docId,
        quote,
        comment: comment.trim(),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Annotation saved");
        setComment("");
        setQuote("");
        setComposing(false);
      }
    });
  };

  const toggle = (a: DocAnnotation) => {
    startTransition(async () => {
      const res = await setAnnotationResolvedAction({
        id: a.id,
        doc_id: docId,
        resolved: !a.resolved,
      });
      if (res.error) toast.error(res.error);
    });
  };

  const remove = (a: DocAnnotation) => {
    startTransition(async () => {
      const res = await deleteAnnotationAction({ id: a.id, doc_id: docId });
      if (res.error) toast.error(res.error);
      else toast.success("Annotation deleted");
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Annotations
        </h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {open.length} open
        </span>
      </div>

      {/* Composer */}
      {composing ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
          {quote ? (
            <blockquote className="border-l-2 border-primary/60 pl-2 text-[11px] italic leading-snug text-muted-foreground">
              “{quote.length > 180 ? `${quote.slice(0, 180)}…` : quote}”
            </blockquote>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              General note — or select text in the document first to attach
              this note to a passage.
            </p>
          )}
          <Textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What should change here? What's wrong, missing, or worth keeping?"
            className="min-h-16 resize-none text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={isPending || !comment.trim()}
              onClick={save}
            >
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setComposing(false);
                setComment("");
                setQuote("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 justify-start text-xs"
          onClick={() => setComposing(true)}
        >
          {quote
            ? `Annotate selection (“${quote.slice(0, 32)}${quote.length > 32 ? "…" : ""}”)`
            : "+ Add annotation"}
        </Button>
      )}

      {/* Open notes */}
      {open.length === 0 && resolved.length === 0 && !composing && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No annotations yet. Select a passage and annotate it — agents read
          open notes and address them in the next version of the draft.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {open.map((a) => (
          <AnnotationCard key={a.id} a={a} onToggle={toggle} onDelete={remove} />
        ))}
      </div>

      {resolved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
            {resolved.length} resolved
          </summary>
          <div className="mt-2 flex flex-col gap-2 opacity-70">
            {resolved.map((a) => (
              <AnnotationCard key={a.id} a={a} onToggle={toggle} onDelete={remove} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AnnotationCard({
  a,
  onToggle,
  onDelete,
}: {
  a: DocAnnotation;
  onToggle: (a: DocAnnotation) => void;
  onDelete: (a: DocAnnotation) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
      {a.quote && (
        <blockquote className="border-l-2 border-primary/60 pl-2 text-[11px] italic leading-snug text-muted-foreground">
          “{a.quote.length > 140 ? `${a.quote.slice(0, 140)}…` : a.quote}”
        </blockquote>
      )}
      <p className="text-xs leading-snug text-foreground">{a.comment}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] text-muted-foreground">
          {new Date(a.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={() => onToggle(a)}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
        >
          {a.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          onClick={() => onDelete(a)}
          className="text-[10px] text-muted-foreground hover:text-destructive"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
