"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { DOC_AI_MODE_LABELS, type DocAIMode } from "@/lib/data/docs-types";
import { toast } from "sonner";

interface AIResult {
  mode: DocAIMode;
  output: string;
  can_apply?: boolean;
  tasks_created?: number;
}

export function DocAITools({ docId }: { docId: string }) {
  const [result, setResult] = useState<AIResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeMode, setActiveMode] = useState<DocAIMode | null>(null);

  const runAI = (mode: DocAIMode, selectionText?: string) => {
    setActiveMode(mode);
    startTransition(async () => {
      try {
        const res = await fetch("/api/docs/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc_id: docId,
            mode,
            selection_text: selectionText || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "AI processing failed");
          setActiveMode(null);
          return;
        }

        const data = await res.json();
        setResult(data);

        if (data.tasks_created) {
          toast.success(`${data.tasks_created} task(s) created from document`);
        }
      } catch {
        toast.error("Failed to connect to AI service");
      } finally {
        setActiveMode(null);
      }
    });
  };

  const handleApplyContent = () => {
    if (!result?.output) return;
    const apply = (
      window as unknown as Record<string, (c: string) => void>
    ).__docEditorApplyContent;
    if (apply) {
      apply(result.output);
      toast.success("Content applied to document");
      setResult(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            AI Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(
            Object.entries(DOC_AI_MODE_LABELS) as [DocAIMode, string][]
          ).map(([mode, label]) => (
            <Button
              key={mode}
              variant="outline"
              size="sm"
              className="justify-start text-xs"
              disabled={isPending}
              onClick={() => runAI(mode)}
            >
              {isPending && activeMode === mode ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  Processing...
                </span>
              ) : (
                label
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Result
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                {DOC_AI_MODE_LABELS[result.mode]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {result.tasks_created && (
              <p className="text-xs text-[hsl(var(--status-closed))]">
                {result.tasks_created} task(s) added to your task list.
              </p>
            )}

            <ScrollArea className="max-h-64">
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
                {result.output}
              </pre>
            </ScrollArea>

            <Separator />

            <div className="flex gap-2">
              {result.can_apply && (
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={handleApplyContent}
                >
                  Apply to Document
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(result.output);
                  toast.success("Copied to clipboard");
                }}
              >
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs text-muted-foreground"
                onClick={() => setResult(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
