"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAnalysisSnapshot,
  getSnapshotPayload,
} from "@/lib/data/snapshots";

const freezeSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(120, "Label must be 120 characters or fewer"),
  note: z.string().max(2000).optional().default(""),
});

export async function freezeSnapshotAction(
  _prevState: { error?: string; success?: boolean; id?: string } | null,
  formData: FormData,
) {
  const parsed = freezeSchema.safeParse({
    label: formData.get("label"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const meta = await createAnalysisSnapshot(
      parsed.data.label,
      parsed.data.note || null,
    );
    revalidatePath("/dashboard");
    return { success: true, id: meta.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to freeze snapshot",
    };
  }
}

/**
 * Returns the frozen payload as a JSON string for client-side download.
 * Server action (not a route) so it inherits middleware auth + RLS with
 * no extra surface.
 */
export async function downloadSnapshotAction(
  id: string,
): Promise<{ error?: string; filename?: string; json?: string }> {
  if (!id) return { error: "Missing snapshot id" };
  try {
    const result = await getSnapshotPayload(id);
    if (!result) return { error: "Snapshot not found" };
    const safeLabel = result.meta.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return {
      filename: `sosphd-snapshot-${safeLabel}-${result.meta.created_at.slice(0, 10)}.json`,
      json: JSON.stringify({ meta: result.meta, payload: result.payload }, null, 2),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to load snapshot",
    };
  }
}
