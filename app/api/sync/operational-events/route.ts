/* ─── Operational Event Backfill ───────────────────────────────────────
 *  Materializes SOSCOMMAND timestamps as research.case_events rows
 *  across many cases at once. Use this once after initial deployment
 *  or whenever bulk operational data has been imported.
 *
 *  POST /api/sync/operational-events
 *  Body: { limit?: number }  (default 200; max 1000)
 *
 *  Auth: requires an authenticated user. The actor_id on the
 *  resulting events is 'soscommand_sync' regardless — the caller's
 *  auth is checked only to gate the endpoint.
 * ────────────────────────────────────────────────────────────────────── */

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { syncAllCasesFromOperational } from "@/lib/data/sync";

export const maxDuration = 300;

const requestSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(200),
});

export async function POST(req: Request) {
  // Auth gate.
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error
            ? `Auth check failed: ${err.message}`
            : "Auth check failed",
      },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { scanned, results } = await syncAllCasesFromOperational(
    parsed.data.limit,
  );

  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const cases_with_writes = results.filter((r) => r.inserted > 0).length;

  return Response.json({
    scanned,
    inserted,
    cases_with_writes,
    results,
  });
}
