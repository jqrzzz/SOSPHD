"use client";

import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
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

import { toast } from "sonner";
import type { ResearchNote } from "@/lib/data/advisor-types";

export function WorkspaceNotes({
  initialNotes,
}: {
  initialNotes: ResearchNote[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <Card key={note.id} className="flex flex-col group">
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
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setEditNote(note)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={async () => {
                        await deleteNoteAction(note.id);
                        toast.success("Note deleted");
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Note Dialog */}
      <Dialog open={!!editNote} onOpenChange={(o) => !o && setEditNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          {editNote && (
            <form action={editAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={editNote.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-note-title">Title</Label>
                <Input id="edit-note-title" name="title" defaultValue={editNote.title ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-note-content">Content</Label>
                <Textarea
                  id="edit-note-content"
                  name="content"
                  rows={5}
                  required
                  defaultValue={editNote.content}
                />
              </div>
              {editState?.error && (
                <p className="text-sm text-destructive">{editState.error}</p>
              )}
              <Button type="submit" disabled={editPending}>
                {editPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
