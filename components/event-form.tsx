"use client";

import { useActionState } from "react";
import { useEffect, useRef } from "react";
import { addEventAction } from "@/lib/actions";
import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

function getNowLocalISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function EventForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState(addEventAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      toast.success("Event added to timeline");
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <h3 className="text-sm font-semibold">Add Event</h3>

      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-400"
        >
          {state.error}
        </div>
      )}

      <input type="hidden" name="case_id" value={caseId} />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="event_type" className="text-xs">
            Event Type
          </Label>
          <Select name="event_type" required>
            <SelectTrigger id="event_type" className="h-8 text-xs">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="text-xs">
                  {EVENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="occurred_at" className="text-xs">
            Occurred At
          </Label>
          <Input
            id="occurred_at"
            name="occurred_at"
            type="datetime-local"
            defaultValue={getNowLocalISO()}
            required
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="payload" className="text-xs">
          Details
        </Label>
        <Textarea
          id="payload"
          name="payload"
          placeholder="What happened? Include clinical details, transport info, financial status..."
          rows={2}
          className="text-xs"
        />
      </div>

      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Adding..." : "Add Event"}
        </Button>
      </div>
    </form>
  );
}
