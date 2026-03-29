"use client";

import { useState, useActionState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { createNoteAction } from "@/lib/advisor-actions";
import type { ResearchNote } from "@/lib/data/advisor-types";

export function WorkspaceNotes({
  initialNotes,
}: {
  initialNotes: ResearchNote[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createNoteAction, null);

  const filtered = initialNotes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (n.title?.toLowerCase().includes(q) ?? false) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Search notes"
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Note</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Note</DialogTitle>
            </DialogHeader>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="note-title">Title (optional)</Label>
                <Input id="note-title" name="title" placeholder="Quick thought..." />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note-content">Content</Label>
                <Textarea
                  id="note-content"
                  name="content"
                  rows={5}
                  required
                  placeholder="What are you thinking about..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="note-case">Link to case (optional)</Label>
                <Input
                  id="note-case"
                  name="linked_case_id"
                  placeholder="case_001"
                />
              </div>
              {state?.error && (
                <p className="text-sm text-destructive" role="alert">{state.error}</p>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save Note"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {search ? "No notes match your search." : "No notes yet. Add one above."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <Card key={note.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                {note.title && (
                  <h3 className="text-sm font-semibold text-foreground">
                    {note.title}
                  </h3>
                )}
                <p className="flex-1 text-sm text-muted-foreground line-clamp-4">
                  {note.content}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatDate(note.created_at, "short")}
                  </span>
                  {note.linked_case_id && (
                    <Badge variant="outline" className="text-xs">
                      {note.linked_case_id}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
