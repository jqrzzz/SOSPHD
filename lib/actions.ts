"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCase, addEvent } from "@/lib/data/store";
import { EVENT_TYPES } from "@/lib/data/types";

// ── Schemas ──────────────────────────────────────────────────────────

const createCaseSchema = z.object({
  patient_ref: z.string().min(1, "Patient reference is required"),
  severity: z.coerce.number().int().min(1).max(5),
  chief_complaint: z.string().min(1, "Chief complaint is required"),
  notes: z.string().default(""),
});

const addEventSchema = z.object({
  case_id: z.string().min(1),
  event_type: z.enum(EVENT_TYPES),
  occurred_at: z.string().min(1, "Event time is required"),
  payload: z.string().default(""),
});

// ── Actions ─────────────────────────────────────────────────────────

export async function createCaseAction(
  _prevState: { error?: string } | null,
  formData: FormData,
) {
  const raw = {
    patient_ref: formData.get("patient_ref"),
    severity: formData.get("severity"),
    chief_complaint: formData.get("chief_complaint"),
    notes: formData.get("notes") ?? "",
  };

  const parsed = createCaseSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const newCase = createCase({
    severity: parsed.data.severity as 1 | 2 | 3 | 4 | 5,
    chief_complaint: parsed.data.chief_complaint,
    patient_ref: parsed.data.patient_ref,
    notes: parsed.data.notes,
  });

  redirect(`/cases/${newCase.id}`);
}

export async function addEventAction(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const raw = {
    case_id: formData.get("case_id"),
    event_type: formData.get("event_type"),
    occurred_at: formData.get("occurred_at"),
    payload: formData.get("payload") ?? "",
  };

  const parsed = addEventSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  addEvent(parsed.data);

  revalidatePath(`/cases/${parsed.data.case_id}`);
  return { success: true };
}
