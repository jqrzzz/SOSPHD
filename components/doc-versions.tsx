"use client";

import { useActionState, useState, useTransition } from "react";
import { saveVersionAction, restoreVersionAction } from "@/lib/docs-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DocVersion } from "@/lib/data/docs-types";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function DocVersions({
  docId,
  versions,
}: {
  docId: string;
  versions: DocVersion[];
}) {
  const [saveState, saveAction, isSaving] = useActionState(
    saveVersionAction,
    null,
  );
  const [isRestoring, startRestoring] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleRestore = (version: DocVersion) => {
    startRestoring(async () => {
      const result = await restoreVersionAction({
        doc_id: docId,
        version_content: version.content_md,
      });
      if (result.success) {
        toast.success("Version restored (previous content auto-saved)");
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Save version form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Save Version
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveAction} className="flex flex-col gap-2">
            <input type="hidden" name="doc_id" value={docId} />
            <div className="flex flex-col gap-1">
              <Label htmlFor="version_note" className="text-xs">
                Note (optional)
              </Label>
              <Input
                id="version_note"
                name="note"
                placeholder="e.g., Added methods section"
                className="h-7 text-xs"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isSaving}
              className="text-xs"
            >
              {isSaving ? "Saving..." : "Save Snapshot"}
            </Button>
            {saveState?.error && (
              <p className="text-xs text-destructive" role="alert">
                {saveState.error}
              </p>
            )}
            {saveState?.success && (
              <p className="text-xs text-[hsl(var(--status-closed))]">
                Version saved.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Version history */}
      {versions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              History ({versions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-64">
              <div className="flex flex-col">
                {versions.map((v, i) => (
                  <div key={v.id}>
                    {i > 0 && <Separator />}
                    <div className="flex flex-col gap-1 px-4 py-2">
                      <button
                        className="flex items-center justify-between text-left"
                        onClick={() =>
                          setExpandedId(expandedId === v.id ? null : v.id)
                        }
                        aria-expanded={expandedId === v.id}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground font-tabular">
                          {formatDate(v.created_at, "datetime")}
                        </span>
                        <ChevronIcon
                          className={`h-3 w-3 text-muted-foreground transition-transform ${expandedId === v.id ? "rotate-180" : ""}`}
                        />
                      </button>
                      {v.note && (
                        <p className="text-[11px] text-foreground/70">
                          {v.note}
                        </p>
                      )}
                      {expandedId === v.id && (
                        <div className="mt-1 flex flex-col gap-2">
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-secondary/50 p-2 font-mono text-[10px] leading-relaxed text-foreground/60">
                            {v.content_md.slice(0, 500)}
                            {v.content_md.length > 500 ? "..." : ""}
                          </pre>
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start text-[10px]"
                            disabled={isRestoring}
                            onClick={() => handleRestore(v)}
                          >
                            {isRestoring ? "Restoring..." : "Restore this version"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
