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
import { getContacts, getJournalEntries } from "@/lib/data/fieldwork-store";
import { createContactAction } from "@/lib/fieldwork-actions";
import type { Contact, ContactRole, JournalEntry } from "@/lib/data/fieldwork-types";
import { APP_CONFIG } from "@/lib/config";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CountUp } from "@/components/motion/count-up";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger";

/* ── Role config ────────────────────────────────────────────────────── */

const ROLE_LABELS: Record<ContactRole, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  hospital_admin: "Hospital Admin",
  insurance: "Insurance",
  embassy: "Embassy",
  transport: "Transport",
  government: "Government",
  academic: "Academic",
  ngo: "NGO",
  fixer: "Local Fixer",
  other: "Other",
};

const ROLE_COLORS: Record<ContactRole, string> = {
  doctor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  nurse: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  hospital_admin: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  insurance: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  embassy: "bg-red-500/10 text-red-400 border-red-500/20",
  transport: "bg-green-500/10 text-green-400 border-green-500/20",
  government: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  academic: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  ngo: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  fixer: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const CORRIDORS = APP_CONFIG.research.corridors;

/* ── Component ──────────────────────────────────────────────────────── */

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  useEffect(() => {
    Promise.all([
      getContacts(),
      getJournalEntries({ limit: 100 }),
    ]).then(([c, j]) => {
      setContacts(c);
      setJournal(j);
    });
  }, []);

  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = contacts.filter((c) => {
    if (roleFilter !== "all" && c.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.tags.some((t) => t.includes(q))
      );
    }
    return true;
  });

  const selected = contacts.find((c) => c.id === selectedId);

  // Count contacts by role for stats
  const roleCounts = contacts.reduce<Record<string, number>>((acc, c) => {
    acc[c.role] = (acc[c.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        eyebrow="Research network"
        title="Contacts"
        description={
          <>
            <CountUp value={contacts.length} duration={1} /> across{" "}
            <CountUp value={Object.keys(roleCounts).length} duration={1} />{" "}
            roles — doctors, fixers, payers, academics.
          </>
        }
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <span className="mr-1 text-base leading-none">+</span> Add contact
          </Button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Contact list */}
        <div className="flex w-full flex-col overflow-auto lg:w-[420px] lg:border-r lg:border-border/60">
          {/* Filters */}
          <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 p-3 backdrop-blur-md">
            <Input
              placeholder="Search name, org, tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role distribution chips (top 5 roles) */}
          {Object.keys(roleCounts).length > 1 && (
            <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-3 py-2">
              {Object.entries(roleCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([role, count]) => (
                  <button
                    key={role}
                    onClick={() =>
                      setRoleFilter(roleFilter === role ? "all" : role)
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors ${
                      roleFilter === role
                        ? ROLE_COLORS[role as ContactRole]
                        : "border-border/50 bg-muted/30 text-muted-foreground/80 hover:bg-accent/40 hover:text-foreground"
                    }`}
                  >
                    {ROLE_LABELS[role as ContactRole]}
                    <span className="text-foreground">{count}</span>
                  </button>
                ))}
            </div>
          )}

          {/* List */}
          <StaggerContainer className="flex flex-col gap-1 p-2" stagger={0.03}>
            {filtered.map((contact) => (
              <StaggerItem key={contact.id}>
                <button
                  onClick={() => setSelectedId(contact.id)}
                  className={`group relative flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-150 ${
                    selectedId === contact.id
                      ? "bg-gradient-to-r from-accent/80 to-accent/30"
                      : "hover:bg-accent/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${
                      selectedId === contact.id
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-30"
                    }`}
                  />
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 font-mono text-xs font-semibold text-primary ring-1 ring-primary/15">
                    {contact.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {contact.name}
                    </p>
                    {contact.organization && (
                      <p className="truncate text-xs text-muted-foreground">
                        {contact.organization}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`font-mono text-[9.5px] uppercase tracking-[0.08em] ${ROLE_COLORS[contact.role]}`}
                      >
                        {ROLE_LABELS[contact.role]}
                      </Badge>
                      {contact.corridor && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary/70">
                          {contact.corridor}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </StaggerItem>
            ))}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-background/40 text-base text-muted-foreground/50">
                  ✶
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground/80">
                  No contacts match this filter.
                </p>
              </div>
            )}
          </StaggerContainer>
        </div>

        {/* Contact detail (desktop) */}
        <div className="hidden flex-1 overflow-auto p-6 lg:block">
          {selected ? (
            <ContactDetail contact={selected} journal={journal} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/50 bg-card/40 font-mono text-base text-muted-foreground/60">
                  ←
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a contact to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Contact Dialog */}
      <NewContactDialog open={showNew} onClose={() => setShowNew(false)} />

      {/* Mobile detail dialog */}
      {selected && (
        <Dialog
          open={!!selectedId}
          onOpenChange={() => setSelectedId(null)}
        >
          <DialogContent className="max-w-lg max-h-[85vh] overflow-auto lg:hidden">
            <ContactDetail contact={selected} journal={journal} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ── Contact Detail ─────────────────────────────────────────────────── */

function ContactDetail({
  contact,
  journal,
}: {
  contact: Contact;
  journal: JournalEntry[];
}) {
  const linkedEntries = journal.filter((e) =>
    e.contact_ids.includes(contact.id),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-xl"
          />
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 font-mono text-lg font-bold text-primary ring-1 ring-primary/20">
            {contact.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-balance text-xl font-semibold tracking-tight">
            {contact.name}
          </h2>
          {contact.title && (
            <p className="text-sm text-muted-foreground">{contact.title}</p>
          )}
          {contact.organization && (
            <p className="text-sm text-muted-foreground">
              {contact.organization}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase tracking-[0.08em] ${ROLE_COLORS[contact.role]}`}
            >
              {ROLE_LABELS[contact.role]}
            </Badge>
            {contact.corridor && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-primary/90">
                {contact.corridor}
              </span>
            )}
          </div>
        </div>
      </div>

      {(contact.email ||
        contact.phone ||
        contact.whatsapp ||
        contact.location) && (
        <Card className="mt-6">
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            {contact.email && <InfoField label="Email" value={contact.email} />}
            {contact.phone && <InfoField label="Phone" value={contact.phone} />}
            {contact.whatsapp && (
              <InfoField label="WhatsApp" value={contact.whatsapp} />
            )}
            {contact.location && (
              <InfoField label="Location" value={contact.location} />
            )}
          </CardContent>
        </Card>
      )}

      {contact.notes && (
        <div className="mt-5">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Notes
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {contact.notes}
          </p>
        </div>
      )}

      {contact.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {contact.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {linkedEntries.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Journal entries · {linkedEntries.length}
          </p>
          <div className="flex flex-col gap-2">
            {linkedEntries.map((entry) => (
              <Card key={entry.id} className="lift">
                <CardContent className="flex flex-col gap-1 p-3">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {entry.content}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
                    {new Date(entry.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
        Added{" "}
        {new Date(contact.created_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

/* ── New Contact Dialog ─────────────────────────────────────────────── */

function NewContactDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(async (prev: { error?: string; success?: boolean } | null, fd: FormData) => {
    const result = await createContactAction(prev, fd);
    if (result?.success) {
      toast.success("Contact added");
      onClose();
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="ct-name">Name</Label>
              <Input id="ct-name" name="name" placeholder="Full name" required />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select name="role" defaultValue="other">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-org">Organization</Label>
              <Input id="ct-org" name="organization" placeholder="Hospital, company..." />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="ct-title">Title / Position</Label>
              <Input id="ct-title" name="title" placeholder="e.g. Head of Emergency" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-email">Email</Label>
              <Input id="ct-email" name="email" type="email" placeholder="email@example.com" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-phone">Phone</Label>
              <Input id="ct-phone" name="phone" placeholder="+66 ..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-whatsapp">WhatsApp</Label>
              <Input id="ct-whatsapp" name="whatsapp" placeholder="+66 ..." />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ct-location">Location</Label>
              <Input id="ct-location" name="location" placeholder="City, Country" />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label>Corridor</Label>
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

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="ct-tags">Tags</Label>
              <Input id="ct-tags" name="tags" placeholder="Comma-separated: key-informant, data-partner" />
            </div>

            <div className="flex flex-col gap-2 col-span-2">
              <Label htmlFor="ct-notes">Notes</Label>
              <Textarea
                id="ct-notes"
                name="notes"
                placeholder="Context about this contact, how you met, what they can help with..."
                rows={3}
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Add Contact"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
