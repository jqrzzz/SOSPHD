import "server-only";

/* ─── Research API health ──────────────────────────────────────────────
 *  One cheap probe that answers "can this app actually read its own
 *  schema?". Without it, a platform-level misconfiguration renders as
 *  zeros and empty lists everywhere — indistinguishable from "no data
 *  yet", which cost real debugging time (ARCHITECTURE §8.15). The app
 *  should say what is wrong, not quietly show nothing.
 * ────────────────────────────────────────────────────────────────────── */

import { getServerSupabase } from "@/lib/supabase/server-auth";

export interface ResearchApiHealth {
  ok: boolean;
  /** PostgREST error code, when the probe failed. */
  code?: string;
  /** Short human-readable statement of what is broken. */
  title?: string;
  /** What to do about it. */
  fix?: string;
}

export async function getResearchApiHealth(): Promise<ResearchApiHealth> {
  const sb = await getServerSupabase();
  if (!sb) {
    return {
      ok: false,
      title: "Supabase is not configured for this environment.",
      fix: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.",
    };
  }

  try {
    const { error } = await sb
      .schema("research")
      .from("docs")
      .select("id")
      .limit(1);
    if (!error) return { ok: true };

    // PGRST106: PostgREST refuses to address a schema that is not in its
    // exposed-schemas list. Grants and RLS are irrelevant until it is.
    if (error.code === "PGRST106") {
      return {
        ok: false,
        code: error.code,
        title:
          "The research schema is not exposed to the API, so no research data can load.",
        fix: "Supabase Dashboard → Project Settings → Data API → Exposed schemas → add “research” → Save. Nothing in the codebase can set this.",
      };
    }

    if (error.code === "42501" || /permission denied/i.test(error.message)) {
      return {
        ok: false,
        code: error.code,
        title: "The signed-in role cannot read the research schema.",
        fix: "Check the GRANTs in supabase/migrations (009 normalizes them) and that your user is on research.allowed_users.",
      };
    }

    return {
      ok: false,
      code: error.code,
      title: "Research data could not be loaded.",
      fix: error.message,
    };
  } catch (e) {
    return {
      ok: false,
      title: "Research data could not be loaded.",
      fix: e instanceof Error ? e.message : "Unknown error reaching Supabase.",
    };
  }
}
