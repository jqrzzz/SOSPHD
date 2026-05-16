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
import { createTaskAction, updateTaskStatusAction, updateTaskAction, deleteTaskAction } from "@/lib/advisor-actions";
import { toast } from "sonner";
import type { ResearchTask, TaskStatus } from "@/lib/data/advisor-types";
import { cn, formatDate } from "@/lib/utils";

const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "doing", label: "In Progress" },
  { status: "done", label: "Done" },
];

const PRIORITY_LABELS: Record<number, { label: string; className: string }> = {
  1: { label: "High", className: "bg-destructive/15 text-destructive border-destructive/30" },
  2: { label: "Medium", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  3: { label: "Low", className: "bg-muted text-muted-foreground border-border" },
};

export function WorkspaceTasks({
  initialTasks,
}: {
  initialTasks: ResearchTask[];
}) {
  const [open, setOpen] = useState(false);
  const [editTask, setEditTask] = useState<ResearchTask | null>(null);

  const [createState, createAction, createPending] = useActionState(async (prev: { error?: string; success?: boolean } | null, fd: FormData) => {
    const result = await createTaskAction(prev, fd);
    if (result?.success) {
      setOpen(false);
      toast.success("Task created");
    }
    return result;
  }, null);

  const [, statusAction] = useActionState(updateTaskStatusAction, null);

  const [editState, editAction, editPending] = useActionState(async (prev: { error?: string; success?: boolean } | null, fd: FormData) => {
    const result = await updateTaskAction(prev, fd);
    if (result?.success) {
      setEditTask(null);
      toast.success("Task updated");
    }
    return result;
  }, null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialTasks.length} task{initialTasks.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <form action={createAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-title">Title</Label>
                <Input id="task-title" name="title" required placeholder="What needs to be done?" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea id="task-desc" name="description" rows={3} placeholder="Details..." />
              </div>
              <div className="flex gap-4">
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select name="priority" defaultValue="2">
                    <SelectTrigger id="task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">High</SelectItem>
                      <SelectItem value="2">Medium</SelectItem>
                      <SelectItem value="3">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="task-case">Case</Label>
                  <Input id="task-case" name="linked_case_id" placeholder="case_001" />
                </div>
              </div>
              {createState?.error && (
                <p className="text-sm text-destructive" role="alert">{createState.error}</p>
              )}
              <Button type="submit" disabled={createPending}>
                {createPending ? "Creating..." : "Create Task"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {STATUS_COLUMNS.map(({ status, label }) => {
          const columnTasks = initialTasks.filter((t) => t.status === status);
          return (
            <div key={status} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 pb-1">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    status === "todo" && "bg-muted-foreground",
                    status === "doing" && "bg-amber-400",
                    status === "done" && "bg-emerald-400",
                  )}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">({columnTasks.length})</span>
              </div>

              {columnTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-xs text-muted-foreground">No tasks</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {columnTasks.map((task) => {
                    const pri = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS[2];
                    return (
                      <Card key={task.id} className="group">
                        <CardContent className="flex flex-col gap-2 p-3">
                          <h4 className="text-sm font-medium text-foreground leading-snug">
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between pt-1">
                            <Badge variant="outline" className={cn("text-xs", pri.className)}>
                              {pri.label}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <form action={statusAction}>
                                <input type="hidden" name="id" value={task.id} />
                                {status === "todo" && (
                                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                    <input type="hidden" name="status" value="doing" />
                                    Start
                                  </Button>
                                )}
                                {status === "doing" && (
                                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                    <input type="hidden" name="status" value="done" />
                                    Complete
                                  </Button>
                                )}
                                {status === "done" && (
                                  <span className="text-xs text-emerald-400">Done</span>
                                )}
                              </form>
                            </div>
                          </div>
                          {/* Edit/Delete — visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setEditTask(task)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={async () => {
                                await deleteTaskAction(task.id);
                                toast.success("Task deleted");
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground font-mono">
                              Due: {formatDate(task.due_date, "short")}
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          {editTask && (
            <form action={editAction} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={editTask.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-title">Title</Label>
                <Input id="edit-task-title" name="title" required defaultValue={editTask.title} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-desc">Description</Label>
                <Textarea id="edit-task-desc" name="description" rows={3} defaultValue={editTask.description ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-task-pri">Priority</Label>
                <Select name="priority" defaultValue={String(editTask.priority)}>
                  <SelectTrigger id="edit-task-pri">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
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
