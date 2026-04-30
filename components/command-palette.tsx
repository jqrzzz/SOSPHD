"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createNoteAction, createTaskAction } from "@/lib/advisor-actions";
import { toast } from "sonner";

const NAV_ITEMS = [
  { label: "PhD Spine", href: "/spine", group: "Navigate" },
  { label: "Field Journal", href: "/fieldwork", group: "Navigate" },
  { label: "Contacts", href: "/contacts", group: "Navigate" },
  { label: "Cases", href: "/cases", group: "Navigate" },
  { label: "Documents", href: "/docs", group: "Navigate" },
  { label: "Workspace", href: "/workspace", group: "Navigate" },
  { label: "Dashboard", href: "/dashboard", group: "Navigate" },
  { label: "Advisor Chat", href: "/advisor", group: "Navigate" },
  { label: "Corridor Briefings", href: "/dashboard/corridors", group: "Navigate" },
  { label: "Paper Builder", href: "/dashboard/paper-builder", group: "Navigate" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [quickForm, setQuickForm] = useState<"note" | "task" | null>(null);
  const router = useRouter();

  // Cmd+K to open
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={() => {
                setOpen(false);
                setQuickForm("note");
              }}
            >
              <NoteIcon className="mr-2 h-4 w-4 text-primary" />
              <span>New Note</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Quick capture</kbd>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setOpen(false);
                setQuickForm("task");
              }}
            >
              <TaskIcon className="mr-2 h-4 w-4 text-amber-400" />
              <span>New Task</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Quick capture</kbd>
            </CommandItem>
            <CommandItem onSelect={() => navigate("/fieldwork")}>
              <JournalIcon className="mr-2 h-4 w-4 text-emerald-400" />
              <span>New Journal Entry</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Opens fieldwork</kbd>
            </CommandItem>
            <CommandItem onSelect={() => navigate("/docs/new")}>
              <DocIcon className="mr-2 h-4 w-4 text-teal-400" />
              <span>New Document</span>
            </CommandItem>
            <CommandItem onSelect={() => navigate("/contacts")}>
              <ContactIcon className="mr-2 h-4 w-4 text-blue-400" />
              <span>New Contact</span>
              <kbd className="ml-auto text-[10px] text-muted-foreground">Opens contacts</kbd>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigate">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Quick Note Form */}
      <Dialog open={quickForm === "note"} onOpenChange={(o) => !o && setQuickForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Quick Note</DialogTitle>
          </DialogHeader>
          <QuickNoteForm onDone={() => setQuickForm(null)} />
        </DialogContent>
      </Dialog>

      {/* Quick Task Form */}
      <Dialog open={quickForm === "task"} onOpenChange={(o) => !o && setQuickForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Quick Task</DialogTitle>
          </DialogHeader>
          <QuickTaskForm onDone={() => setQuickForm(null)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuickNoteForm({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await createNoteAction(null, fd);
    setPending(false);
    if (result?.success) {
      toast.success("Note created");
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qn-title" className="text-xs">Title (optional)</Label>
        <Input id="qn-title" name="title" placeholder="Quick thought..." className="text-sm" autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qn-content" className="text-xs">Content</Label>
        <Textarea id="qn-content" name="content" rows={4} required placeholder="What are you thinking about..." className="text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save Note"}
      </Button>
    </form>
  );
}

function QuickTaskForm({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [priority, setPriority] = useState("2");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await createTaskAction(null, fd);
    setPending(false);
    if (result?.success) {
      toast.success("Task created");
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qt-title" className="text-xs">Title</Label>
        <Input id="qt-title" name="title" required placeholder="What needs to be done?" className="text-sm" autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qt-desc" className="text-xs">Description (optional)</Label>
        <Textarea id="qt-desc" name="description" rows={2} placeholder="Details..." className="text-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">High</SelectItem>
            <SelectItem value="2">Medium</SelectItem>
            <SelectItem value="3">Low</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="priority" value={priority} />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save Task"}
      </Button>
    </form>
  );
}

/* ── Icons ── */

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function JournalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 13H8" />
      <path d="M16 17H8" />
      <path d="M16 13h-2" />
    </svg>
  );
}

function ContactIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
