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
import {
  PAPER_IDS,
  PAPER_PROFILES,
  resolveWritingProfile,
  type PaperId,
  type WritingStage,
  type WritingProfile,
} from "@/lib/ai/research-writing";
import { toast } from "sonner";

const SECTIONS = [
  { key: "abstract", label: "Abstract", description: "Structured summary of this paper and stage" },
  { key: "introduction", label: "Introduction", description: "Research question and bounded contribution" },
  { key: "methods", label: "Methods", description: "Design, definitions and data collection" },
  { key: "analysis_plan", label: "Analysis plan", description: "Assumptions, denominators and sensitivity checks" },
  { key: "results", label: "Results", description: "Exploratory evidence, or a planned-reporting placeholder" },
  { key: "discussion", label: "Discussion", description: "Interpretation, limitations and alternatives" },
  { key: "full_draft", label: "Working scaffold", description: "A starting structure, not a finished manuscript" },
] as const;

interface GeneratedSection {
  section: string;
  profile: WritingProfile;
  output: string;
  provisional: boolean;
  model_id: string | null;
  writing_policy_version: string;
  warnings: string[];
  data_snapshot: {
    total_cases: number | null;
    closed_cases: number | null;
    generated_at: string;
    source: "live_workbench_unfrozen" | "not_loaded";
    frozen: false;
  };
}

interface PaperBuilderProps {
  totalCases: number;
  closedCases: number;
}

export function PaperBuilder({ totalCases, closedCases }: PaperBuilderProps) {
  const [profile, setProfile] = useState<WritingProfile>(resolveWritingProfile());
  const [result, setResult] = useState<GeneratedSection | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");

  const generate = (section: string) => {
    setActiveSection(section);
    // Do not present an older draft as the result of a failed new request.
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/paper-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section,
            ...profile,
            custom_instructions: customInstructions || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Generation failed");
          return;
        }
        const data: GeneratedSection = await res.json();
        setResult(data);
        toast.success(`${PAPER_PROFILES[data.profile.paper].label} working output ready for review`);
      } catch {
        toast.error("Failed to connect to AI service");
      } finally {
        setActiveSection(null);
      }
    });
  };

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.output);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard access failed. The draft remains on screen.");
    }
  };

  const sendToDoc = () => {
    if (!result) return;
    try {
      sessionStorage.setItem("paper_builder_content", JSON.stringify({
        title: `${PAPER_PROFILES[result.profile.paper].label} - ${SECTIONS.find((s) => s.key === result.section)?.label ?? result.section} (${result.profile.stage})`,
        content: result.output,
        folder: "Papers",
        tags: [result.profile.paper.replace("paper", "paper-"), "generated", "provisional", result.profile.stage],
      }));
      window.location.href = "/docs/new";
    } catch {
      toast.error("Could not open a new document. Copy or download the draft instead.");
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div className="flex flex-col gap-3 lg:w-72">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Paper and stage</CardTitle>
            <CardDescription className="text-xs">Choose the research purpose before generating text.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label htmlFor="writing-paper" className="text-xs">Paper</label>
            <select
              id="writing-paper"
              value={profile.paper}
              disabled={isPending}
              className="w-full rounded-md border border-border bg-background p-2 text-xs"
              onChange={(e) => {
                setProfile(resolveWritingProfile(e.target.value as PaperId));
                setResult(null);
              }}
            >
              {PAPER_IDS.map((id) => <option key={id} value={id}>{PAPER_PROFILES[id].label}</option>)}
            </select>
            <label htmlFor="writing-stage" className="text-xs">Stage</label>
            <select
              id="writing-stage"
              value={profile.stage}
              disabled={isPending}
              className="w-full rounded-md border border-border bg-background p-2 text-xs"
              onChange={(e) => {
                setProfile({ ...profile, stage: e.target.value as WritingStage });
                setResult(null);
              }}
            >
              <option value="exploratory">Exploratory working draft</option>
              <option value="protocol">Protocol / planned study</option>
            </select>
            <p className="text-xs leading-relaxed text-muted-foreground">{PAPER_PROFILES[profile.paper].purpose}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Generate Section</CardTitle>
            <CardDescription className="text-xs">Working text for review. No generation replaces an existing manuscript.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.key}
                variant={activeSection === s.key ? "default" : "outline"}
                size="sm"
                className="flex h-auto w-full flex-col items-start gap-0.5 py-3 text-left"
                disabled={isPending}
                onClick={() => generate(s.key)}
              >
                <span className="text-xs font-medium">
                  {isPending && activeSection === s.key ? (
                    <span className="flex items-center gap-2"><LoadingSpinner />Generating...</span>
                  ) : s.label}
                </span>
                <span className="w-full whitespace-normal text-[10px] font-normal leading-snug text-muted-foreground">{s.description}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Research directions</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              aria-label="Research directions"
              value={customInstructions}
              disabled={isPending}
              maxLength={4000}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="E.g., compare two designs, restructure the argument, or explain which assumptions need testing."
              className="min-h-20 resize-none text-xs"
            />
            <p className="mt-2 text-[10px] text-muted-foreground">Your directions can change the purpose and structure, but cannot turn assumptions into findings.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground">
            <p>Workbench inventory: {totalCases} records, {closedCases} marked closed.</p>
            <p className="mt-2">This is not a selected paper cohort or a frozen analysis. Protocols and Papers 2–3 do not import these records as study results.</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {result ? (
          <Card className="flex flex-1 flex-col">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">{PAPER_PROFILES[result.profile.paper].label}: {SECTIONS.find((s) => s.key === result.section)?.label ?? result.section}</CardTitle>
                <Badge variant="outline" className="text-[10px]">Provisional · {formatDate(result.data_snapshot.generated_at, "time")}</Badge>
              </div>
              <CardDescription className="text-xs">{result.model_id ? `Model: ${result.model_id}` : "No AI call needed"} · {result.writing_policy_version}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div role="status" className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
              <ScrollArea className="flex-1 rounded-md border border-border bg-secondary/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">{result.output}</pre>
              </ScrollArea>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="text-xs" onClick={copyToClipboard}>Copy Markdown</Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={sendToDoc}>Save as new Doc</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs text-muted-foreground"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([result.output], { type: "text/markdown" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${result.profile.paper}-${result.section}-${new Date().toISOString().slice(0, 10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >Download .md</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <PenIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Paper Builder</p>
              <p className="max-w-sm text-xs text-muted-foreground">Select a paper, stage and section. Develop the argument without prescribing findings. Long manuscripts are best developed section by section.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
