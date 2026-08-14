"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createOutreach,
  deleteOutreach,
  setInstitutionStage,
  setRequirementStatus,
  updateInstitutionNotes,
  updateOutreach,
  verifyRequirement,
} from "@/lib/data/admissions-mutations";

const STAGES = [
  "researching",
  "shortlisted",
  "contacting",
  "preparing",
  "submitted",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

const STATUSES = [
  "not_started",
  "in_progress",
  "done",
  "waived",
  "not_applicable",
] as const;

type Envelope = { error?: string };

function fail(e: unknown, fallback: string): Envelope {
  return { error: e instanceof Error ? e.message : fallback };
}

export async function setRequirementStatusAction(data: {
  id: string;
  institution_id: string;
  status: (typeof STATUSES)[number];
}): Promise<Envelope> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      institution_id: z.string().uuid(),
      status: z.enum(STATUSES),
    })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid requirement update" };
  try {
    await setRequirementStatus(parsed.data.id, parsed.data.status);
    revalidatePath(`/apply/${parsed.data.institution_id}`);
    revalidatePath("/apply");
    return {};
  } catch (e) {
    return fail(e, "Failed to update requirement");
  }
}

export async function verifyRequirementAction(data: {
  id: string;
  institution_id: string;
}): Promise<Envelope> {
  const parsed = z
    .object({ id: z.string().uuid(), institution_id: z.string().uuid() })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid verification" };
  try {
    await verifyRequirement(parsed.data.id);
    revalidatePath(`/apply/${parsed.data.institution_id}`);
    return {};
  } catch (e) {
    return fail(e, "Failed to verify requirement");
  }
}

export async function setInstitutionStageAction(data: {
  id: string;
  stage: (typeof STAGES)[number];
}): Promise<Envelope> {
  const parsed = z
    .object({ id: z.string().uuid(), stage: z.enum(STAGES) })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid stage" };
  try {
    await setInstitutionStage(parsed.data.id, parsed.data.stage);
    revalidatePath(`/apply/${parsed.data.id}`);
    revalidatePath("/apply");
    return {};
  } catch (e) {
    return fail(e, "Failed to update stage");
  }
}

export async function updateInstitutionNotesAction(data: {
  id: string;
  notes: string;
}): Promise<Envelope> {
  const parsed = z
    .object({ id: z.string().uuid(), notes: z.string().max(20000) })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid notes" };
  try {
    await updateInstitutionNotes(parsed.data.id, parsed.data.notes);
    revalidatePath(`/apply/${parsed.data.id}`);
    return {};
  } catch (e) {
    return fail(e, "Failed to save notes");
  }
}

const outreachSchema = z.object({
  institution_id: z.string().uuid(),
  person_name: z.string().min(1, "Who is this to?"),
  person_role: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().min(1, "The email is empty"),
  follow_up_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export async function createOutreachAction(
  data: z.input<typeof outreachSchema>,
): Promise<Envelope> {
  const parsed = outreachSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid draft" };
  }
  try {
    await createOutreach({
      ...parsed.data,
      follow_up_at: parsed.data.follow_up_at || null,
    });
    revalidatePath(`/apply/${parsed.data.institution_id}`);
    return {};
  } catch (e) {
    return fail(e, "Failed to save draft");
  }
}

export async function updateOutreachAction(data: {
  id: string;
  institution_id: string;
  subject?: string;
  body?: string;
  status?: string;
  follow_up_at?: string | null;
  mark_sent?: boolean;
}): Promise<Envelope> {
  const parsed = z
    .object({
      id: z.string().uuid(),
      institution_id: z.string().uuid(),
      subject: z.string().optional(),
      body: z.string().optional(),
      status: z.enum(["draft", "sent", "replied", "no_reply", "closed"]).optional(),
      follow_up_at: z.string().nullable().optional(),
      mark_sent: z.boolean().optional(),
    })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid outreach update" };

  const { id, institution_id, mark_sent, ...rest } = parsed.data;
  try {
    await updateOutreach(id, {
      ...rest,
      // Marking sent stamps the time here rather than trusting a client clock.
      ...(mark_sent ? { status: "sent", sent_at: new Date().toISOString() } : {}),
    });
    revalidatePath(`/apply/${institution_id}`);
    return {};
  } catch (e) {
    return fail(e, "Failed to update outreach");
  }
}

export async function deleteOutreachAction(data: {
  id: string;
  institution_id: string;
}): Promise<Envelope> {
  const parsed = z
    .object({ id: z.string().uuid(), institution_id: z.string().uuid() })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid delete" };
  try {
    await deleteOutreach(parsed.data.id);
    revalidatePath(`/apply/${parsed.data.institution_id}`);
    return {};
  } catch (e) {
    return fail(e, "Failed to delete draft");
  }
}
