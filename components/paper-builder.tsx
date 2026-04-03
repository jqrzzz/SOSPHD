"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

const SECTIONS = [
  {
    key: "abstract",
    label: "Abstract",
    description: "Structured abstract (250 words)",
  },
  {
    key: "methods",
    label: "Methods",
    description: "Study design, measures, data collection",
  },
  {
    key: "results",
    label: "Results",
    description: "Sample characteristics, TTDC/TTGP, provenance",
  },
  {
    key: "discussion",
    label: "Discussion",
    description: "Findings, limitations, future work",
  },
  {
    key: "full_draft",
    label: "Full Draft",
    description: "Complete paper (~3000-4000 words)",
  },
] as const;

interface GeneratedSection {
  section: string;
  output: string;
  data_snapshot: {
    total_cases: number;
    closed_cases: number;
    generated_at: string;
  };
}

interface PaperBuilderProps {
  totalCases: number;
  closedCases: number;
}

export function PaperBuilder({ totalCases, closedCases }: PaperBuilderProps) {
  const [result, setResult] = useState<GeneratedSection | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");

  const generate = (section: string) => {
    setActiveSection(section);
    startTransition(async () => {
      try {
        const res = await fetch("/api/paper-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section,
            custom_instructions: customInstructions || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Generation failed");
          setActiveSection(null);
          return;
        }

        const data: GeneratedSection = await res.json();
        setResult(data);
        toast.success(
          `${SECTIONS.find((s) => s.key === section)?.label ?? section} generated from ${data.data_snapshot.total_cases} cases`,
        );
      } catch {
        toast.error("Failed to connect to AI service");
      } finally {
        setActiveSection(null);
      }
    });
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.output);
    toast.success("Copied to clipboard");
  };

  const sendToDoc = () => {
    if (!result) return;
    // Store in sessionStorage so the docs/new page can pick it up
    sessionStorage.setItem(
      "paper_builder_content",
      JSON.stringify({
        title: `Paper 1 - ${SECTIONS.find((s) => s.key === result.section)?.label ?? result.section}`,
        content: result.output,
        folder: "Papers",
        tags: ["paper-1", "generated"],
      }),
    );
    window.location.href = "/docs/new";
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Left: Section selector */}
      <div className="flex flex-col gap-3 lg:w-72">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Generate Section</CardTitle>
            <CardDescription className="text-xs">
              Each section uses live case data (N={totalCases}, {closedCases}{" "}
              closed) to draft academic content.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.key}
                variant={activeSection === s.key ? "default" : "outline"}
                size="sm"
                className="flex flex-col items-start gap-0.5 py-3 text-left"
                disabled={isPending}
                onClick={() => generate(s.key)}
              >
                <span className="text-xs font-medium">
                  {isPending && activeSection === s.key ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      Generating...
                    </span>
                  ) : (
                    s.label
                  )}
                </span>
                {!(isPending && activeSection === s.key) && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {s.description}
                  </span>
                )}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Custom Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="E.g., Focus on the TTGP finding, emphasize the stepped-wedge design..."
              className="min-h-20 resize-none text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Data source</span>
                <span className="font-mono tabular-nums">{totalCases} cases</span>
              </div>
              <div className="flex justify-between">
                <span>Closed cases</span>
                <span className="font-mono tabular-nums">{closedCases}</span>
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                  Live
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: Generated output */}
      <div className="flex flex-1 flex-col">
        {result ? (
          <Card className="flex flex-1 flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {SECTIONS.find((s) => s.key === result.section)?.label ??
                    result.section}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    N={result.data_snapshot.total_cases}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {formatDate(result.data_snapshot.generated_at, "time")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <ScrollArea className="flex-1 rounded-md border border-border bg-secondary/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                  {result.output}
                </pre>
              </ScrollArea>

              <Separator />

              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={copyToClipboard}>
                  Copy Markdown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={sendToDoc}
                >
                  Save as Doc
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs text-muted-foreground"
                  onClick={() => {
                    const blob = new Blob([result.output], {
                      type: "text/markdown",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `paper-${result.section}-${new Date().toISOString().slice(0, 10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download .md
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <PenIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-medium text-foreground">
                  Paper Builder
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Select a section to generate academic content from your live
                  case data. Every metric and finding is computed from the actual
                  provenance chain.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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

function PenIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
