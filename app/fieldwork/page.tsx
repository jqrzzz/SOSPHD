"use client";

import { useState, useEffect, useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getJournalEntries,
  getContacts,
  getProtocolTemplates,
  getProtocols,
  getProtocolProgress,
} from "@/lib/data/fieldwork-store";
import {
  createJournalAction,
  togglePinAction,
  startProtocolAction,
  updateProtocolAction,
} from "@/lib/fieldwork-actions";
import type { JournalEntry, JournalEntryType, Contact, FieldProtocol } from "@/lib/data/fieldwork-types";
import { APP_CONFIG } from "@/lib/config";
import { autoCategorize } from "@/lib/agent/categorize";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";
import { FadeIn } from "@/components/motion/fade-in";

/* ── Entry type config ──────────────────────────────────────────────── */

const ENTRY_TYPE_LABELS: Record<JournalEntryType, string> = {
  observation: "Observation",
  conversation: "Conversation",
  interview: "Interview",
  site_visit: "Site Visit",
  event: "Event",
  idea: "Idea",
  media: "Media",
};

const ENTRY_TYPE_ICONS: Record<JournalEntryType, string> = {
  observation: "👁",
  conversation: "💬",
  interview: "🎙",
  site_visit: "🏥",
  event: "📅",
  idea: "💡",
  media: "📎",
};

const CORRIDORS = APP_CONFIG.research.corridors;

/* ── Component ──────────────────────────────────────────────────────── */

export default function FieldworkPage() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getJournalEntries>>>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof getContacts>>>([]);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof getProtocolTemplates>>>([]);
  const [activeProtocols, setActiveProtocols] = useState<Awaited<ReturnType<typeof getProtocols>>>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getJournalEntries(),
      getContacts(),
      getProtocolTemplates(),
      getProtocols({ status: "in_progress" }),
    ]).then(([e, c, t, p]) => {
      setEntries(e);
      setContacts(c);
      setTemplates(t);
      setActiveProtocols(p);
      setLoaded(true);
    });
  }, []);

  const [showNew, setShowNew] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeProtocol, setActiveProtocol] = useState<FieldProtocol | null>(null);

  // Filter entries
  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.entry_type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q))
      );
    }
    return true;
  });

  const pinned = filtered.filter((e) => e.is_pinned);
  const unpinned = filtered.filter((e) => !e.is_pinned);

  const siteVisits = entries.filter((e) => e.entry_type === "site_visit").length;
  const corridorsCovered = new Set(
    entries.map((e) => e.corridor).filter(Boolean),
  ).size;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <PageHeader
        eyebrow="Field · capture"
        title="Field Journal"
        description="Observations, conversations, and evidence from the field. Every entry is auto-tagged and indexed against your corridor map."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (templates.length > 0) {
                  startProtocolAction(templates[0].id, {}).then(() => {
                    window.location.reload();
                  });
                }
              }}
            >
              Start protocol
            </Button>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <span className="mr-1 text-base leading-none">+</span> New entry
            </Button>
          </>
        }
      />

      <div className="flex flex-1 gap-0 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
          {/* Quick stats row */}
          <FadeIn>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniTile
                label="Entries"
                value={
                  <CountUp value={entries.length} duration={1} />
                }
              />
              <MiniTile
                label="Contacts"
                value={
                  <CountUp value={contacts.length} duration={1} />
                }
              />
              <MiniTile
                label="Site visits"
                value={
                  <CountUp value={siteVisits} duration={1} />
                }
              />
              <MiniTile
                label="Corridors"
                value={
                  <CountUp value={corridorsCovered} duration={1} />
                }
                sub={`of ${CORRIDORS.length}`}
              />
            </div>
          </FadeIn>

          {/* Type filter pills */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search entries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs text-sm"
            />
            <div className="flex flex-wrap items-center gap-1">
              <FilterPill
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
              >
                All · {entries.length}
              </FilterPill>
              {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => {
                const count = entries.filter(
                  (e) => e.entry_type === key,
                ).length;
                if (count === 0) return null;
                return (
                  <FilterPill
                    key={key}
                    active={typeFilter === key}
                    onClick={() => setTypeFilter(key)}
                    icon={ENTRY_TYPE_ICONS[key as JournalEntryType]}
                  >
                    {label} · {count}
                  </FilterPill>
                );
              })}
            </div>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} shown
            </span>
          </div>

          {/* Pinned entries */}
          {pinned.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="text-amber-400">★</span> Pinned
              </p>
              <StaggerContainer className="flex flex-col gap-2" stagger={0.04}>
                {pinned.map((entry) => (
                  <StaggerItem key={entry.id}>
                    <JournalCard
                      entry={entry}
                      contacts={contacts}
                      expanded={expandedId === entry.id}
                      onToggle={() =>
                        setExpandedId(
                          expandedId === entry.id ? null : entry.id,
                        )
                      }
                    />
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          )}

          {/* All entries */}
          {unpinned.length > 0 && (
            <StaggerContainer className="flex flex-col gap-2" stagger={0.04}>
              {unpinned.map((entry) => (
                <StaggerItem key={entry.id}>
                  <JournalCard
                    entry={entry}
                    contacts={contacts}
                    expanded={expandedId === entry.id}
                    onToggle={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}

          {loaded && filtered.length === 0 && (
            <FadeIn>
              <div className="flex flex-1 items-center justify-center py-20">
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                  <div className="relative">
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-2xl bg-primary/15 blur-2xl"
                    />
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-2xl">
                      ✎
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      {search || typeFilter !== "all"
                        ? "Nothing matches that filter."
                        : "No journal entries yet."}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {search || typeFilter !== "all"
                        ? "Try a different keyword or clear the filter."
                        : "Capture your first field observation. The AI will auto-suggest a type, corridor, and tags as you type."}
                    </p>
                  </div>
                  {!search && typeFilter === "all" && (
                    <Button size="sm" onClick={() => setShowNew(true)}>
                      <span className="mr-1 text-base leading-none">+</span> New entry
                    </Button>
                  )}
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        {/* Right sidebar — Active Protocols */}
        <aside className="hidden w-72 shrink-0 overflow-auto border-l border-border/60 bg-background/40 p-4 lg:block">
          <p className="mb-3 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Active protocols
          </p>
          {activeProtocols.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="font-mono text-base text-muted-foreground/50">
                  ☐
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                  None running. Start one from a template below.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {activeProtocols.map((protocol) => {
                const progress = getProtocolProgress(protocol);
                return (
                  <Card
                    key={protocol.id}
                    className="lift cursor-pointer"
                    onClick={() => setActiveProtocol(protocol)}
                  >
                    <CardContent className="flex flex-col gap-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium leading-tight">
                          {protocol.title}
                        </p>
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {progress.checked}/{progress.total}
                        </span>
                      </div>
                      {protocol.location && (
                        <p className="text-[10.5px] text-muted-foreground">
                          {protocol.location}
                        </p>
                      )}
                      <div className="relative h-1 overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="mb-3 mt-6 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Protocol templates
          </p>
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <Card key={t.id} className="lift">
                <CardContent className="flex flex-col gap-1.5 p-3">
                  <p className="text-[13px] font-medium leading-tight">
                    {t.title}
                  </p>
                  <p className="line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                  <button
                    onClick={() => {
                      startProtocolAction(t.id, {}).then(() => {
                        window.location.reload();
                      });
                    }}
                    className="mt-1 inline-flex w-fit items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary transition-colors hover:border-primary/40 hover:bg-primary/15"
                  >
                    Use template →
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </aside>
      </div>

      {/* New Entry Dialog */}
      <NewEntryDialog open={showNew} onClose={() => setShowNew(false)} contacts={contacts} />

      {/* Protocol Checklist Dialog */}
      {activeProtocol && (
        <ProtocolDialog
          protocol={activeProtocol}
          onClose={() => setActiveProtocol(null)}
        />
      )}
    </div>
  );
}

/* ── Journal Card ───────────────────────────────────────────────────── */

function MiniTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-card/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
        {sub && (
          <span className="ml-1 text-[11px] font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors"
          : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-accent/40 hover:text-foreground"
      }
    >
      {icon && (
        <span aria-hidden="true" className="text-sm leading-none">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

function JournalCard({
  entry,
  contacts,
  expanded,
  onToggle,
}: {
  entry: JournalEntry;
  contacts: Contact[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const linkedContacts = contacts.filter((c) =>
    entry.contact_ids.includes(c.id),
  );
  const date = new Date(entry.created_at);
  const typeIcon = ENTRY_TYPE_ICONS[entry.entry_type];
  const typeLabel = ENTRY_TYPE_LABELS[entry.entry_type];

  return (
    <Card
      className="lift cursor-pointer"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/40 text-base"
            role="img"
            aria-label={typeLabel}
          >
            {typeIcon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {entry.title}
              </h3>
              {entry.is_pinned && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300">
                  ★ pinned
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              <span>{typeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {entry.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="normal-case">{entry.location}</span>
                </>
              )}
              {entry.corridor && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-primary/90">{entry.corridor}</span>
                </>
              )}
            </div>

            {!expanded && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {entry.content}
              </p>
            )}

            {expanded && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {entry.content}
                </div>

                {linkedContacts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Contacts
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {linkedContacts.map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="border-primary/25 bg-primary/5 text-[10.5px] text-primary/90"
                        >
                          {c.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {entry.attachments.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {entry.attachments.length} attachment
                    {entry.attachments.length === 1 ? "" : "s"}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinAction(entry.id, !entry.is_pinned).then(() => {
                        window.location.reload();
                      });
                    }}
                  >
                    {entry.is_pinned ? "Unpin" : "Pin"}
                  </Button>
                </div>
              </div>
            )}

            {entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── New Entry Dialog ───────────────────────────────────────────────── */

function NewEntryDialog({
  open,
  onClose,
  contacts,
}: {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
}) {
  const [state, formAction, isPending] = useActionState(async (prev: { error?: string; success?: boolean } | null, fd: FormData) => {
    const result = await createJournalAction(prev, fd);
    if (result?.success) toast.success("Journal entry created");
    return result;
  }, null);
  const [entryType, setEntryType] = useState<JournalEntryType>("observation");
  const [aiSuggestions, setAiSuggestions] = useState<{
    suggestedType: string;
    suggestedTags: string[];
    suggestedCorridor: string | null;
    detectedMetrics: string[];
  } | null>(null);
  const [contentRef, setContentRef] = useState("");

  // Auto-categorize when content changes (debounced via onBlur)
  async function handleContentBlur() {
    if (contentRef.length < 20) return;
    const result = await autoCategorize(contentRef);
    if (result) setAiSuggestions(result);
  }

  // Apply AI suggestions
  function applySuggestions() {
    if (!aiSuggestions) return;
    if (aiSuggestions.suggestedType) {
      setEntryType(aiSuggestions.suggestedType as JournalEntryType);
    }
    // Tags and corridor are applied via the form refs below
  }

  if (state?.success) {
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>New Journal Entry</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="entry_type" value={entryType} />

          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEntryType(key as JournalEntryType)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    entryType === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {ENTRY_TYPE_ICONS[key as JournalEntryType]} {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="je-title">Title</Label>
            <Input
              id="je-title"
              name="title"
              placeholder="Brief description of what happened"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="je-content">Details</Label>
            <Textarea
              id="je-content"
              name="content"
              placeholder="What did you observe, hear, or learn? Include specifics — names, numbers, processes..."
              rows={6}
              required
              onChange={(e) => setContentRef(e.target.value)}
              onBlur={handleContentBlur}
            />
          </div>

          {/* AI Suggestions */}
          {aiSuggestions && (aiSuggestions.suggestedTags.length > 0 || aiSuggestions.suggestedCorridor || aiSuggestions.detectedMetrics.length > 0) && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-primary">AI Suggestions</span>
                <button
                  type="button"
                  onClick={applySuggestions}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Apply type suggestion
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {aiSuggestions.suggestedType !== entryType && (
                  <span className="text-muted-foreground">
                    Type: <strong className="text-foreground">{ENTRY_TYPE_LABELS[aiSuggestions.suggestedType as JournalEntryType] ?? aiSuggestions.suggestedType}</strong>
                  </span>
                )}
                {aiSuggestions.suggestedCorridor && (
                  <span className="text-muted-foreground">
                    Corridor: <strong className="text-foreground">{aiSuggestions.suggestedCorridor}</strong>
                  </span>
                )}
                {aiSuggestions.suggestedTags.length > 0 && (
                  <span className="text-muted-foreground">
                    Tags: {aiSuggestions.suggestedTags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0 mx-0.5">{t}</Badge>
                    ))}
                  </span>
                )}
                {aiSuggestions.detectedMetrics.length > 0 && (
                  <span className="text-muted-foreground">
                    Metrics: {aiSuggestions.detectedMetrics.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="je-location">Location</Label>
              <Input
                id="je-location"
                name="location"
                placeholder="e.g. Bumrungrad Hospital"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="je-corridor">Corridor</Label>
              <Select name="corridor" defaultValue="">
                <SelectTrigger>
                  <SelectValue placeholder="Select corridor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {CORRIDORS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="je-tags">Tags</Label>
            <Input
              id="je-tags"
              name="tags"
              placeholder="Comma-separated: ttta, insurance, hospital"
            />
          </div>

          {contacts.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Linked Contacts</Label>
              <p className="text-xs text-muted-foreground">
                Enter contact IDs (comma-separated). Available: {contacts.map((c) => `${c.id} (${c.name})`).join(", ")}
              </p>
              <Input name="contact_ids" placeholder="e.g. ct_001, ct_002" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="je-case">Linked Case ID</Label>
            <Input
              id="je-case"
              name="linked_case_id"
              placeholder="e.g. case_001"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save Entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Protocol Checklist Dialog ──────────────────────────────────────── */

function ProtocolDialog({
  protocol,
  onClose,
}: {
  protocol: FieldProtocol;
  onClose: () => void;
}) {
  const [sections, setSections] = useState(
    JSON.parse(JSON.stringify(protocol.sections)) as typeof protocol.sections,
  );
  const [saving, setSaving] = useState(false);

  const progress = (() => {
    let total = 0, checked = 0;
    for (const s of sections) for (const i of s.items) { total++; if (i.checked) checked++; }
    return { total, checked, percent: total === 0 ? 0 : Math.round((checked / total) * 100) };
  })();

  async function save() {
    setSaving(true);
    const allChecked = sections.every((s) => s.items.every((i) => i.checked));
    await updateProtocolAction(protocol.id, {
      sections,
      status: allChecked ? "completed" : "in_progress",
    });
    setSaving(false);
    onClose();
    window.location.reload();
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{protocol.title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{protocol.description}</p>

        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {progress.checked}/{progress.total}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {sections.map((section, si) => (
            <div key={si}>
              <p className="mb-2 text-sm font-medium text-foreground">
                {section.title}
              </p>
              <div className="flex flex-col gap-1.5">
                {section.items.map((item, ii) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {
                        const next = [...sections];
                        next[si].items[ii] = { ...item, checked: !item.checked };
                        setSections(next);
                      }}
                      className="mt-0.5 accent-primary"
                    />
                    <span className={item.checked ? "text-muted-foreground line-through" : ""}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? "Saving..." : "Save Progress"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
