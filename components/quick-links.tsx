"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
}

const DEFAULT_LINKS: QuickLink[] = [
  {
    id: "gdrive",
    label: "Google Drive",
    url: "https://drive.google.com",
    icon: "GD",
  },
  {
    id: "overleaf",
    label: "Overleaf",
    url: "https://www.overleaf.com",
    icon: "OL",
  },
  {
    id: "scholar",
    label: "Google Scholar",
    url: "https://scholar.google.com",
    icon: "GS",
  },
  {
    id: "zotero",
    label: "Zotero",
    url: "https://www.zotero.org/mylibrary",
    icon: "ZT",
  },
  {
    id: "sos",
    label: "Tourist SOS",
    url: "https://tourist-sos.com",
    icon: "TS",
  },
];

const STORAGE_KEY = "sosphd_quick_links";

function loadLinks(): QuickLink[] {
  if (typeof window === "undefined") return DEFAULT_LINKS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_LINKS;
  } catch {
    return DEFAULT_LINKS;
  }
}

function saveLinks(links: QuickLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function QuickLinks() {
  const [links, setLinks] = useState<QuickLink[]>(loadLinks);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = (fd.get("label") as string).trim();
    const url = (fd.get("url") as string).trim();
    if (!label || !url) return;

    const newLink: QuickLink = {
      id: crypto.randomUUID(),
      label,
      url: url.startsWith("http") ? url : `https://${url}`,
      icon: label.slice(0, 2).toUpperCase(),
    };
    const updated = [...links, newLink];
    setLinks(updated);
    saveLinks(updated);
    setAddOpen(false);
    toast.success(`Added "${label}"`);
  };

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editId) return;
    const fd = new FormData(e.currentTarget);
    const label = (fd.get("label") as string).trim();
    const url = (fd.get("url") as string).trim();
    if (!label || !url) return;

    const updated = links.map((l) =>
      l.id === editId
        ? { ...l, label, url: url.startsWith("http") ? url : `https://${url}`, icon: label.slice(0, 2).toUpperCase() }
        : l,
    );
    setLinks(updated);
    saveLinks(updated);
    setEditId(null);
    toast.success(`Updated "${label}"`);
  };

  const handleDelete = (id: string) => {
    const updated = links.filter((l) => l.id !== id);
    setLinks(updated);
    saveLinks(updated);
    toast.success("Link removed");
  };

  const editingLink = editId ? links.find((l) => l.id === editId) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Quick Links</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Add Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Quick Link</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <input
                name="label"
                placeholder="Label (e.g. My Drive)"
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                name="url"
                placeholder="URL (e.g. https://drive.google.com/...)"
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" size="sm">
                Add
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {links.map((link) => (
          <div key={link.id} className="group relative">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-2 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {link.icon}
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">
                    {link.label}
                  </span>
                </CardContent>
              </Card>
            </a>
            {/* Edit/Delete on hover */}
            <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setEditId(link.id);
                }}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(link.id);
                }}
                className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/20"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          {editingLink && (
            <form onSubmit={handleEdit} className="flex flex-col gap-3">
              <input
                name="label"
                defaultValue={editingLink.label}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                name="url"
                defaultValue={editingLink.url}
                required
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
