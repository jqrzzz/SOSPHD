#!/usr/bin/env node
/* ─── Paper figure verification ────────────────────────────────────────
 *  Re-derives every headline figure Paper 1 asserts, straight from the
 *  live registry, and reports any that have drifted.
 *
 *  Why this exists. Paper 1's numbers are queried from a database that
 *  keeps changing — backfill batches land, classifications get revised,
 *  cases get reconciled. A figure that was right when it was written can
 *  quietly stop being right, and a stale number in a submitted paper is
 *  the kind of error that is very hard to explain afterwards. Writing
 *  the assertions down and re-checking them mechanically turns "I
 *  believe these are current" into something testable.
 *
 *  This is deliberately NOT a unit test. It talks to the live database,
 *  so it must never run in CI where a network blip would fail a build.
 *  Run it by hand before any draft leaves the building, and again after
 *  freezing an analysis snapshot.
 *
 *  Usage:
 *    node scripts/verify-paper-figures.mjs
 *
 *  Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 *  plus an owner session, or the service context the app already uses.
 *  Exits non-zero if anything drifted, so it can gate a release script.
 * ────────────────────────────────────────────────────────────────────── */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ── Load .env.local without adding a dependency ──
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const url = process.env.SOSPHD_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SOSPHD_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SOSPHD_EMAIL;
const password = process.env.SOSPHD_PASSWORD;

if (!url || !key) {
  console.error("Missing Supabase credentials. See mcp/README.md for the env vars.");
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

if (email && password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Sign-in failed: ${error.message}`);
    process.exit(2);
  }
}

const research = sb.schema("research");

/**
 * Every figure Paper 1 states, with the query that reproduces it.
 * `section` is where it appears, so a drift report points at the exact
 * paragraph that needs editing rather than at the paper as a whole.
 */
const CHECKS = [
  { section: "§5.1 / abstract", label: "total cases", expected: 836,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true })) },

  { section: "§5.1", label: "incidents in Thailand", expected: 790,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).ilike("country", "%thai%")) },

  { section: "§5.3 / abstract", label: "identified nationalities", expected: 68,
    run: async () => {
      const { data } = await research.from("cases").select("nationality");
      const set = new Set(
        (data ?? [])
          .map((r) => (r.nationality ?? "").trim().toLowerCase())
          .filter((n) => n && !["?", "-", "n/a", "unknown"].includes(n)),
      );
      return set.size;
    } },

  { section: "§5.3", label: "cases missing nationality", expected: 54,
    run: async () => {
      const { data } = await research.from("cases").select("nationality");
      return (data ?? []).filter((r) => {
        const n = (r.nationality ?? "").trim();
        return n === "" || ["?", "-"].includes(n);
      }).length;
    } },

  { section: "§5.4 / abstract", label: "gastrointestinal cases", expected: 231,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("diagnosis_bucket", "gastro")) },
  { section: "§5.4 / abstract", label: "trauma cases", expected: 179,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("diagnosis_bucket", "trauma")) },
  { section: "§5.4 / abstract", label: "animal bite cases", expected: 109,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("diagnosis_bucket", "animal_bite")) },
  { section: "§5.4", label: "marine cases", expected: 42,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("diagnosis_bucket", "marine")) },

  { section: "§5.5 / abstract", label: "evacuations", expected: 49,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("evacuated", true)) },
  { section: "§5.5", label: "evacuations WITH a transport timestamp", expected: 7,
    run: async () => {
      const { data: ev } = await research.from("cases").select("id").eq("evacuated", true);
      const ids = new Set((ev ?? []).map((r) => r.id));
      const { data: te } = await research.from("case_events").select("case_id").eq("event_type", "TRANSPORT_ACTIVATED");
      return new Set((te ?? []).map((r) => r.case_id).filter((id) => ids.has(id))).size;
    } },

  { section: "§5.6 / abstract", label: "self-pay cases", expected: 233,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("payer_entity", "Self-pay")) },
  { section: "§5.6 / abstract", label: "distinct payer entities", expected: 311,
    run: async () => {
      const { data } = await research.from("cases").select("payer_entity");
      return new Set((data ?? []).map((r) => r.payer_entity).filter(Boolean)).size;
    } },
  { section: "§5.6", label: "largest insurer (Allianz) cases", expected: 32,
    run: async () => count(research.from("cases").select("*", { count: "exact", head: true }).eq("payer_entity", "Allianz")) },

  // The title asserts a sixteen-month baseline, so the span is a figure
  // like any other. It was wrong once already ("five-year") and the
  // error reached the title, the contribution list and the conclusion.
  { section: "TITLE / §5.1", label: "first case date", expected: "2018-12-02",
    run: async () => {
      const { data } = await research.from("cases").select("intake_date")
        .not("intake_date", "is", null).order("intake_date", { ascending: true }).limit(1);
      return (data?.[0]?.intake_date ?? "").slice(0, 10);
    } },
  { section: "TITLE / §5.1", label: "last case date", expected: "2020-03-24",
    run: async () => {
      const { data } = await research.from("cases").select("intake_date")
        .not("intake_date", "is", null).order("intake_date", { ascending: false }).limit(1);
      return (data?.[0]?.intake_date ?? "").slice(0, 10);
    } },

  { section: "§5.7 — THE CENTRAL FINDING", label: "cases with FIRST_CONTACT", expected: 835,
    run: async () => distinctCases("FIRST_CONTACT") },
  { section: "§5.7 — THE CENTRAL FINDING", label: "cases with TRANSPORT_ACTIVATED", expected: 9,
    run: async () => distinctCases("TRANSPORT_ACTIVATED") },
];

// The five milestones the paper asserts are empty. Any non-zero here
// does not just change a number — it would weaken the paper's central
// claim, so they are checked separately and reported loudly.
const MUST_BE_EMPTY = [
  "TRIAGE_COMPLETE",
  "FACILITY_ARRIVAL",
  "GUARANTEED_PAYMENT",
  "DEFINITIVE_CARE_START",
  "DISCHARGE",
];

async function count(query) {
  const { count: c, error } = await query;
  if (error) throw new Error(error.message);
  return c ?? 0;
}

async function distinctCases(eventType) {
  const { data, error } = await research
    .from("case_events")
    .select("case_id")
    .eq("event_type", eventType);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.case_id)).size;
}

let drifted = 0;
let failed = 0;

console.log("\nPaper 1 — figure verification against the live registry\n");

for (const check of CHECKS) {
  try {
    const actual = await check.run();
    if (actual === check.expected) {
      console.log(`  PASS  ${check.label}: ${actual}`);
    } else {
      drifted += 1;
      console.log(
        `  DRIFT ${check.label}: paper says ${check.expected}, registry says ${actual}  [${check.section}]`,
      );
    }
  } catch (e) {
    failed += 1;
    console.log(`  ERROR ${check.label}: ${e.message}`);
  }
}

console.log("");
for (const t of MUST_BE_EMPTY) {
  try {
    const n = await distinctCases(t);
    if (n === 0) {
      console.log(`  PASS  ${t} is empty, as the paper asserts`);
    } else {
      drifted += 1;
      console.log(
        `  DRIFT ${t} now has ${n} case(s). The paper claims this milestone is`,
      );
      console.log(
        `        entirely absent — that claim is load-bearing and must be revised.`,
      );
    }
  } catch (e) {
    failed += 1;
    console.log(`  ERROR ${t}: ${e.message}`);
  }
}

console.log(
  `\n${drifted === 0 && failed === 0 ? "All figures current." : `${drifted} drifted, ${failed} errored.`}\n`,
);

if (drifted > 0 || failed > 0) process.exit(1);
