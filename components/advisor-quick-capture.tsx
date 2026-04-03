"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createNoteAction, createTaskAction } from "@/lib/advisor-actions";

export function QuickCaptureNote() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await createNoteAction(prev, formData);
      if (result?.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <NoteIcon className="mr-1.5 h-3.5 w-3.5" />
          Add Note
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm">Quick Note</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-title" className="text-xs">
              Title (optional)
            </Label>
            <Input
              id="note-title"
              name="title"
              placeholder="Note title"
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-content" className="text-xs">
              Content
            </Label>
            <Textarea
              id="note-content"
              name="content"
              placeholder="Write your research note..."
              className="min-h-[80px] text-sm"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-case" className="text-xs">
              Link to case (optional)
            </Label>
            <Input
              id="note-case"
              name="linked_case_id"
              placeholder="e.g. case_001"
              className="font-mono text-sm"
            />
          </div>
          {state?.error && (
            <p className="text-xs text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Save Note"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickCaptureTask() {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("2");
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    async (prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const result = await createTaskAction(prev, formData);
      if (result?.success) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <TaskIcon className="mr-1.5 h-3.5 w-3.5" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm">Quick Task</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-title" className="text-xs">
              Title
            </Label>
            <Input
              id="task-title"
              name="title"
              placeholder="Task title"
              className="text-sm"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-description" className="text-xs">
              Description (optional)
            </Label>
            <Textarea
              id="task-description"
              name="description"
              placeholder="What needs to be done?"
              className="min-h-[60px] text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-priority" className="text-xs">
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="task-priority" className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">P1 - High</SelectItem>
                <SelectItem value="2">P2 - Normal</SelectItem>
                <SelectItem value="3">P3 - Low</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="priority" value={priority} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-case" className="text-xs">
              Link to case (optional)
            </Label>
            <Input
              id="task-case"
              name="linked_case_id"
              placeholder="e.g. case_004"
              className="font-mono text-sm"
            />
          </div>
          {state?.error && (
            <p className="text-xs text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Saving..." : "Save Task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
