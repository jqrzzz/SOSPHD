"use client";

import { useState, useEffect, useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { autoCategorize } from "@/lib/agent";

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

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Field Journal</h1>
          <p className="text-sm text-muted-foreground">
            Capture observations, conversations, and evidence from the field
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (templates.length > 0) {
              startProtocolAction(templates[0].id, {}).then(() => {
                window.location.reload();
              });
            }
          }}>
            Start Protocol
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)}>
            New Entry
          </Button>
        </div>
      </header>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-auto p-6">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs text-sm"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(ENTRY_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {/* Pinned entries */}
          {pinned.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pinned
              </p>
              <div className="flex flex-col gap-2">
                {pinned.map((entry) => (
                  <JournalCard
                    key={entry.id}
                    entry={entry}
                    contacts={contacts}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All entries */}
          <div className="flex flex-col gap-2">
            {unpinned.map((entry) => (
              <JournalCard
                key={entry.id}
                entry={entry}
                contacts={contacts}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-20">
              <p className="text-sm text-muted-foreground">
                No journal entries yet. Click &quot;New Entry&quot; to capture your first field observation.
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar — Active Protocols */}
        <div className="hidden w-72 flex-shrink-0 border-l border-border p-4 lg:block overflow-auto">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active Protocols
          </p>
          {activeProtocols.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active protocols</p>
          ) : (
            <div className="flex flex-col gap-3">
              {activeProtocols.map((protocol) => {
                const progress = getProtocolProgress(protocol);
                return (
                  <Card
                    key={protocol.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => setActiveProtocol(protocol)}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{protocol.title}</p>
                      {protocol.location && (
                        <p className="text-xs text-muted-foreground">{protocol.location}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {progress.checked}/{progress.total}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Protocol Templates
          </p>
          {templates.map((t) => (
            <Card key={t.id} className="mb-2">
              <CardContent className="p-3">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-6 px-2 text-xs"
                  onClick={() => {
                    startProtocolAction(t.id, {}).then(() => {
                      window.location.reload();
                    });
                  }}
                >
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}

          <p className="mb-3 mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quick Stats
          </p>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>{entries.length} journal entries</p>
            <p>{contacts.length} contacts</p>
            <p>{entries.filter((e) => e.entry_type === "site_visit").length} site visits</p>
            <p>{new Set(entries.map((e) => e.corridor).filter(Boolean)).size} corridors covered</p>
          </div>
        </div>
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
  const linkedContacts = contacts.filter((c) => entry.contact_ids.includes(c.id));
  const date = new Date(entry.created_at);
  const typeIcon = ENTRY_TYPE_ICONS[entry.entry_type];
  const typeLabel = ENTRY_TYPE_LABELS[entry.entry_type];

  return (
    <Card
      className="transition-colors hover:bg-accent/30 cursor-pointer"
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg" role="img" aria-label={typeLabel}>
            {typeIcon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground truncate">
                {entry.title}
              </h3>
              {entry.is_pinned && (
                <span className="text-xs text-primary">pinned</span>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{typeLabel}</span>
              <span>·</span>
              <span>{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              {entry.location && (
                <>
                  <span>·</span>
                  <span>{entry.location}</span>
                </>
              )}
              {entry.corridor && (
                <>
                  <span>·</span>
                  <span className="text-primary/80">{entry.corridor}</span>
                </>
              )}
            </div>

            {/* Preview (collapsed) */}
            {!expanded && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {entry.content}
              </p>
            )}

            {/* Expanded content */}
            {expanded && (
              <div className="mt-3">
                <div className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                  {entry.content}
                </div>

                {linkedContacts.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Contacts:</span>
                    {linkedContacts.map((c) => (
                      <Badge key={c.id} variant="outline" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {entry.attachments.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-muted-foreground">
                      {entry.attachments.length} attachment(s)
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
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

            {/* Tags */}
            {entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
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
  const [state, formAction, isPending] = useActionState(createJournalAction, null);
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
