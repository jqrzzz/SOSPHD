"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  freezeSnapshotAction,
  downloadSnapshotAction,
} from "@/lib/snapshot-actions";
import type { SnapshotMeta } from "@/lib/data/snapshots";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Freeze-and-list UI for research.analysis_snapshots. Snapshots are
 * append-only frozen datasets — papers cite these by label, not the
 * live dashboard.
 */
export function SnapshotControls({ snapshots }: { snapshots: SnapshotMeta[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    async (
      prev: { error?: string; success?: boolean; id?: string } | null,
      fd: FormData,
    ) => {
      const result = await freezeSnapshotAction(prev, fd);
      if (result?.success) {
        toast.success("Snapshot frozen — this dataset is now citable.");
        setOpen(false);
      }
      return result;
    },
    null,
  );
  const [isDownloading, startDownload] = useTransition();

  function download(id: string) {
    startDownload(async () => {
      const result = await downloadSnapshotAction(id);
      if (result.error || !result.json) {
        toast.error(result.error ?? "Download failed");
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "sosphd-snapshot.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Frozen analysis snapshots
          <span className="ml-2 text-foreground/70">{snapshots.length}</span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          Freeze current dataset
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-xs leading-relaxed text-muted-foreground">
              No snapshots yet. Freeze one before drafting results — papers
              cite a named frozen dataset, not a live dashboard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20">
                  <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Label
                  </th>
                  <th className="hidden px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:table-cell">
                    Frozen
                  </th>
                  <th className="hidden px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:table-cell">
                    Cases / Events / Recs
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="px-4 py-2">
                      <span className="text-sm font-medium text-foreground">
                        {s.label}
                      </span>
                      {s.note && (
                        <p className="max-w-md truncate text-xs text-muted-foreground">
                          {s.note}
                        </p>
                      )}
                    </td>
                    <td className="hidden px-4 py-2 font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {formatDate(s.created_at, "datetime")}
                    </td>
                    <td className="hidden px-4 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground md:table-cell">
                      {s.case_count} / {s.event_count} / {s.rec_count}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDownloading}
                        onClick={() => download(s.id)}
                      >
                        Download JSON
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freeze analysis snapshot</DialogTitle>
            <DialogDescription>
              Captures the full analysis batch — summary, per-case metrics,
              missingness, intervention classifications — as an immutable,
              citable dataset. Snapshots cannot be edited or deleted.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="snapshot-label">Label</Label>
              <Input
                id="snapshot-label"
                name="label"
                placeholder="e.g. paper1-baseline-2026-09"
                required
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="snapshot-note">Note (optional)</Label>
              <Textarea
                id="snapshot-note"
                name="note"
                rows={2}
                placeholder="What analysis is this snapshot for?"
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Freezing…" : "Freeze snapshot"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
