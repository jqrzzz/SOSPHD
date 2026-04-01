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
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Research Network</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} contacts across {Object.keys(roleCounts).length} roles
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          Add Contact
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Contact list */}
        <div className="flex w-full flex-col overflow-auto lg:w-[400px] lg:border-r lg:border-border">
          {/* Filters */}
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          <div className="flex flex-col gap-1 p-2">
            {filtered.map((contact) => (
              <button
                key={contact.id}
                onClick={() => setSelectedId(contact.id)}
                className={`flex items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                  selectedId === contact.id
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                  {contact.organization && (
                    <p className="text-xs text-muted-foreground truncate">{contact.organization}</p>
                  )}
                  <Badge
                    variant="outline"
                    className={`mt-1 text-[10px] ${ROLE_COLORS[contact.role]}`}
                  >
                    {ROLE_LABELS[contact.role]}
                  </Badge>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No contacts found
              </p>
            )}
          </div>
        </div>

        {/* Contact detail (desktop) */}
        <div className="hidden flex-1 overflow-auto p-6 lg:block">
          {selected ? (
            <ContactDetail contact={selected} journal={journal} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Select a contact to view details
              </p>
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
  const linkedEntries = journal.filter((e) => e.contact_ids.includes(contact.id));

  return (
    <div className="max-w-xl">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{contact.name}</h2>
          {contact.title && (
            <p className="text-sm text-muted-foreground">{contact.title}</p>
          )}
          {contact.organization && (
            <p className="text-sm text-muted-foreground">{contact.organization}</p>
          )}
          <Badge
            variant="outline"
            className={`mt-1 ${ROLE_COLORS[contact.role]}`}
          >
            {ROLE_LABELS[contact.role]}
          </Badge>
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {contact.email && (
          <InfoField label="Email" value={contact.email} />
        )}
        {contact.phone && (
          <InfoField label="Phone" value={contact.phone} />
        )}
        {contact.whatsapp && (
          <InfoField label="WhatsApp" value={contact.whatsapp} />
        )}
        {contact.location && (
          <InfoField label="Location" value={contact.location} />
        )}
        {contact.corridor && (
          <InfoField label="Corridor" value={contact.corridor} />
        )}
      </div>

      {/* Notes */}
      {contact.notes && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            Notes
          </p>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {contact.notes}
          </p>
        </div>
      )}

      {/* Tags */}
      {contact.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {contact.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Linked journal entries */}
      {linkedEntries.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Journal Entries ({linkedEntries.length})
          </p>
          <div className="flex flex-col gap-2">
            {linkedEntries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {entry.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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

      <p className="mt-6 text-xs text-muted-foreground">
        Added {new Date(contact.created_at).toLocaleDateString("en-US", {
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
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
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
  const [state, formAction, isPending] = useActionState(createContactAction, null);

  if (state?.success) {
    onClose();
  }

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
