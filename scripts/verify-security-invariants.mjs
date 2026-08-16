#!/usr/bin/env node
/* ─── Security invariant verification ──────────────────────────────────
 *  Probes the live API for the things the schema PROMISES rather than
 *  the things it contains: that an anonymous client sees nothing, can
 *  write nothing, and that the one security_invoker view has not been
 *  quietly recreated without its guard.
 *
 *  Why probes rather than catalog checks. `security_invoker=true` in
 *  pg_class is a setting; "anon gets zero rows from case_intervals" is
 *  the fact the setting exists to produce. Settings can be checked in
 *  migrations; facts should be checked against the running system,
 *  because the failure mode that matters — someone recreates the view
 *  in a later migration and forgets the option — changes the catalog
 *  *consistently* with its own mistake. The probe cannot be fooled that
 *  way: if anon suddenly sees 835 rows, this exits loudly.
 *
 *  Like verify-paper-figures.mjs, this is deliberately NOT a unit test:
 *  it talks to the live API and must never gate CI. Run it by hand
 *  after any migration touching RLS, grants, views, or triggers — and
 *  note it cannot run from the agent's remote container (egress-blocked
 *  to supabase.co); run it from a machine that can reach the project.
 *
 *  Usage:  pnpm verify:security
 *  Env:    NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
 *          (.env.local is read), plus SOSPHD_EMAIL / SOSPHD_PASSWORD
 *          for the owner-side checks (optional but recommended — they
 *          prove the allowlist still admits the owner, so a lockout
 *          cannot masquerade as "anon sees nothing, all good").
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SOSPHD_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SOSPHD_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials. See mcp/README.md for the env vars.");
  process.exit(2);
}

let failures = 0;
let errors = 0;
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
const err = (label, e) => { errors += 1; console.log(`  ERROR ${label}: ${e.message ?? e}`); };

const anon = createClient(url, key, { auth: { persistSession: false } }).schema("research");

// ── 1. Anonymous reads return nothing ──────────────────────────────────
// User-scoped tables are RLS'd on auth.uid(); the research spine is
// gated by the SD-001 allowlist; case_intervals inherits through
// security_invoker. For every one of these, anon must see ZERO rows —
// an error (permission denied) also counts as blocked.
const ANON_MUST_BE_EMPTY = [
  "cases",
  "case_events",
  "case_intervals", // the migration-020 view — THE regression probe
  "recommendations",
  "docs",
  "doc_versions",
  "institutions",
  "institution_requirements",
  "outreach",
  "contacts",
  "journal_entries",
  "notes",
  "tasks",
  "funding_opportunities",
];

console.log("\nSecurity invariants — anonymous client\n");
for (const table of ANON_MUST_BE_EMPTY) {
  try {
    const { data, error } = await anon.from(table).select("*").limit(5);
    if (error) pass(`anon read ${table}: blocked (${error.code ?? "error"})`);
    else if ((data ?? []).length === 0) pass(`anon read ${table}: zero rows`);
    else fail(`anon read ${table}: SEES ${data.length}+ ROWS — RLS or security_invoker regression`);
  } catch (e) {
    err(`anon read ${table}`, e);
  }
}

// ── 2. Anonymous writes are rejected ───────────────────────────────────
try {
  const { data, error } = await anon
    .from("notes")
    .insert({ title: "security-probe", content: "must never land" })
    .select();
  if (error) pass(`anon insert notes: rejected (${error.code ?? "error"})`);
  else {
    fail("anon insert notes: WRITE SUCCEEDED — grants/RLS regression");
    // Best-effort cleanup so the probe row does not linger.
    for (const row of data ?? []) await anon.from("notes").delete().eq("id", row.id);
  }
} catch (e) {
  err("anon insert notes", e);
}

// ── 3. The or-filter grammar the app relies on ────────────────────────
// These literals mirror lib/data/__tests__/pgrst.test.ts: the unit tests
// pin helper → string, these probes pin string → PostgREST. If either
// side changes, the other must be re-verified. A parse failure comes
// back as a PostgREST error; zero rows with no error means the grammar
// accepted the quoted value.
const GRAMMAR_PROBES = [
  ['title.ilike."%dengue%",content_md.ilike."%dengue%"', "plain quoted term"],
  ['title.ilike."%x,title.eq.y%",content_md.ilike."%x,title.eq.y%"', "comma + dots inside quotes"],
  ['title.ilike."%a)b(c%",content_md.ilike."%a)b(c%"', "parens inside quotes"],
  ['title.ilike."%say \\"hi\\"%"', "escaped double quote"],
  ['title.ilike."%a\\\\%"', "escaped trailing backslash"],
];

console.log("");
for (const [filter, label] of GRAMMAR_PROBES) {
  try {
    const { error } = await anon.from("docs").select("id").or(filter).limit(1);
    if (error) fail(`or-filter grammar (${label}): rejected — ${error.message}`);
    else pass(`or-filter grammar (${label}): parses`);
  } catch (e) {
    err(`or-filter grammar (${label})`, e);
  }
}

// ── 4. The owner is still admitted ─────────────────────────────────────
// Without this, a lockout (broken allowlist, broken view) would pass
// every anon probe above and look like success.
const email = process.env.SOSPHD_EMAIL;
const password = process.env.SOSPHD_PASSWORD;
console.log("");
if (!email || !password) {
  console.log("  SKIP  owner-side checks (set SOSPHD_EMAIL / SOSPHD_PASSWORD to enable)");
} else {
  const ownerClient = createClient(url, key, { auth: { persistSession: false } });
  const { error: authErr } = await ownerClient.auth.signInWithPassword({ email, password });
  if (authErr) {
    err("owner sign-in", authErr);
  } else {
    const owner = ownerClient.schema("research");
    for (const [table, min] of [["cases", 800], ["case_events", 800], ["case_intervals", 800], ["docs", 3]]) {
      try {
        const { count, error } = await owner.from(table).select("*", { count: "exact", head: true });
        if (error) fail(`owner read ${table}: ${error.message}`);
        else if ((count ?? 0) >= min) pass(`owner read ${table}: ${count} rows (≥ ${min})`);
        else fail(`owner read ${table}: only ${count} rows (expected ≥ ${min}) — allowlist or view regression`);
      } catch (e) {
        err(`owner read ${table}`, e);
      }
    }
  }
}

console.log(
  `\n${failures === 0 && errors === 0 ? "All security invariants hold." : `${failures} failed, ${errors} errored.`}\n`,
);
if (failures > 0 || errors > 0) process.exit(1);
