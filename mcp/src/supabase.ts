/* ─── Supabase client for the MCP server ───────────────────────────────
 *  Signs in AS THE OWNER (email + password from env / .env.local) so every
 *  query runs under RLS — the server holds no service-role key and cannot
 *  reach beyond what the owner's account can (AGENTS.md rules 1, 5).
 *
 *  Credentials are resolved lazily on the first tool call, so the server
 *  boots and lists tools even when env is missing; the tool call then
 *  returns a clear setup error instead of the process dying at startup.
 * ────────────────────────────────────────────────────────────────────── */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Minimal .env parser (KEY=VALUE lines, # comments) — avoids a dotenv dep. */
function parseEnvFile(url: URL): Record<string, string> {
  let raw: string;
  try {
    raw = readFileSync(fileURLToPath(url), "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

interface Credentials {
  url: string;
  anonKey: string;
  email: string;
  password: string;
}

function loadCredentials(): Credentials {
  // Precedence: process env → mcp/.env.local → repo root .env.local
  // (the root file supplies the NEXT_PUBLIC_* pair the app already uses).
  const local = parseEnvFile(new URL("../.env.local", import.meta.url));
  const root = parseEnvFile(new URL("../../.env.local", import.meta.url));
  const get = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = process.env[k] ?? local[k] ?? root[k];
      if (v) return v;
    }
    return undefined;
  };

  const url = get("SOSPHD_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = get("SOSPHD_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const email = get("SOSPHD_EMAIL");
  const password = get("SOSPHD_PASSWORD");

  const missing = [
    !url && "SOSPHD_SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)",
    !anonKey && "SOSPHD_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    !email && "SOSPHD_EMAIL",
    !password && "SOSPHD_PASSWORD",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `SOSPHD MCP is not configured — missing credentials: ${missing.join(", ")}. ` +
        `Copy mcp/.env.example to mcp/.env.local and fill it in (see mcp/README.md).`,
    );
  }
  return { url: url!, anonKey: anonKey!, email: email!, password: password! };
}

let client: SupabaseClient | null = null;
let userId: string | null = null;

/** Signed-in, RLS-scoped client + the owner's auth uid (for user_id columns). */
export async function getSession(): Promise<{ sb: SupabaseClient; userId: string }> {
  if (client && userId) return { sb: client, userId };
  const creds = loadCredentials();
  const sb = createClient(creds.url, creds.anonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (error || !data.user) {
    throw new Error(
      `SOSPHD MCP: Supabase sign-in failed — ${error?.message ?? "no user returned"}`,
    );
  }
  client = sb;
  userId = data.user.id;
  return { sb: client, userId };
}

/** Convenience: `research`-schema query builder for a table. */
export async function research(table: string) {
  const { sb, userId: uid } = await getSession();
  return { q: sb.schema("research").from(table), userId: uid };
}
