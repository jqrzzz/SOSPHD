"use client";

import { useActionState } from "react";
import { createCaseAction } from "@/lib/actions";
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

export function CaseForm() {
  const [state, formAction, isPending] = useActionState(
    createCaseAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="patient_ref">Patient Reference</Label>
        <Input
          id="patient_ref"
          name="patient_ref"
          placeholder="PT-2026-0405"
          required
          className="max-w-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          A unique, de-identified reference for this patient.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="severity">Severity</Label>
        <Select name="severity" defaultValue="3" required>
          <SelectTrigger id="severity" className="max-w-48">
            <SelectValue placeholder="Select severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 - Low</SelectItem>
            <SelectItem value="2">2 - Moderate</SelectItem>
            <SelectItem value="3">3 - Elevated</SelectItem>
            <SelectItem value="4">4 - High</SelectItem>
            <SelectItem value="5">5 - Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="chief_complaint">Chief Complaint</Label>
        <Textarea
          id="chief_complaint"
          name="chief_complaint"
          placeholder="Describe the primary medical concern..."
          required
          rows={3}
          className="max-w-lg"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Additional context, travel details, medical history..."
          rows={3}
          className="max-w-lg"
        />
      </div>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Case"}
        </Button>
      </div>
    </form>
  );
}
