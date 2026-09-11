"use server";

import { revalidatePath } from "next/cache";
import { getRevisionStore, hashRevision } from "@/lib/data/doc-revision-store";
import { loadRevisionSource, saveSectionDraft } from "@/lib/docs/revision-service";
import { RevisionError } from "@/lib/docs/section-revision";

function safeError(error: unknown) {
  return error instanceof RevisionError
    ? { code: error.code, error: error.message }
    : { code: "unavailable", error: "Sign in with research access and try again. If the database is unavailable, export your proposal. No source was overwritten." };
}

export async function loadSectionRevisionAction(id: string) {
  try {
    const { store, owner } = await getRevisionStore();
    return { ok: true as const, source: await loadRevisionSource(store, owner, id, hashRevision) };
  } catch (error) { return { ok: false as const, ...safeError(error) }; }
}

export async function saveSectionRevisionAction(input: unknown) {
  try {
    // Authenticate before parsing or accessing any document. Next.js also enforces same-origin actions.
    const { store, owner } = await getRevisionStore();
    const saved = await saveSectionDraft(store, owner, input, hashRevision);
    // Cache invalidation cannot change a confirmed persistence result.
    try { revalidatePath("/docs"); } catch { /* The saved draft remains addressable by its ID. */ }
    return { ok: true as const, ...saved };
  } catch (error) { return { ok: false as const, ...safeError(error) }; }
}
