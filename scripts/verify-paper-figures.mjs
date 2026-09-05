#!/usr/bin/env node
// Offline by default. Only the explicit, standalone --live route loads a client.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DEFAULT_BASELINE_LABEL, verifyPaper1Snapshot } from "../lib/data/paper1-evidence.mjs";
import { scanDocument } from "./lib/superseded.mjs";

const HELP = `Verify Paper 1 figures against one downloaded snapshot, offline.

Usage:
  node scripts/verify-paper-figures.mjs --snapshot FILE [options]
  node scripts/verify-paper-figures.mjs --live

Options:
  --snapshot FILE     Required downloaded snapshot JSON
  --label LABEL       Expected snapshot label (default: ${DEFAULT_BASELINE_LABEL})
  --sha256 HEX        Optional SHA-256 pin for the exact snapshot file bytes
  --manuscript FILE   Also scan this local Markdown file for known stale phrases
  --json              Emit a machine-readable report
  --help              Show this help
  --live              Legacy live-registry diagnostic; must be used alone

The checksum identifies file bytes; it does not authenticate their origin.
Without --manuscript, manuscript text is explicitly unchecked.
Exit codes: 0 assertions pass; 1 figure drift or stale phrases; 2 invalid input.
`;

const hashBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function readInput(path, name) {
  try {
    return await readFile(path);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "read error";
    throw new Error(`Cannot read ${name} file (${code}).`);
  }
}

function printReport(report) {
  console.log(`Paper 1 snapshot: ${report.id} (${JSON.stringify(report.label)})`);
  console.log(`Created: ${report.created_at}`);
  console.log(`Source: ${report.source}`);
  console.log(`Captured: ${report.capture.started_at} to ${report.capture.ended_at}`);
  console.log(`SHA-256: ${report.hash}`);
  for (const check of report.checks) {
    console.log(`${check.pass ? "PASS" : "DRIFT"} ${check.label}: ${JSON.stringify(check.actual)} (expected ${JSON.stringify(check.expected)})`);
  }
  if (report.manuscript.checked) {
    console.log(`Manuscript SHA-256: ${report.manuscript.hash}`);
    console.log(`Known stale phrases found: ${report.manuscript.stale.length}`);
    for (const hit of report.manuscript.stale) console.log(`STALE ${hit.wrong} (corrected to ${hit.right})`);
  } else {
    console.log("Manuscript text: unchecked (supply --manuscript to scan known stale phrases).");
  }
  console.log(`Result: ${report.result}`);
}

/** @param {string[]} args @returns {Promise<number>} */
export async function main(args) {
  let json = args.includes("--json");
  try {
    let values;
    try {
      ({ values } = parseArgs({
        args, strict: true, allowPositionals: false,
        options: {
          snapshot: { type: "string" }, label: { type: "string" },
          sha256: { type: "string" }, manuscript: { type: "string" },
          json: { type: "boolean" }, help: { type: "boolean" }, live: { type: "boolean" },
        },
      }));
    } catch {
      throw new Error("Invalid command-line arguments. Use --help for supported options.");
    }
    json = values.json === true;
    if (values.live) {
      if (args.length !== 1 || args[0] !== "--live") throw new Error("--live must be used alone; it cannot verify a frozen snapshot.");
      await import("./verify-paper-figures-live.mjs");
      return 0;
    }
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    if (!values.snapshot) throw new Error("--snapshot FILE is required. Use --help for offline verification options.");
    if (values.label !== undefined && !values.label.trim()) throw new Error("--label must not be empty.");
    if (values.manuscript !== undefined && !values.manuscript) throw new Error("--manuscript FILE must not be empty.");
    if (values.sha256 !== undefined && !/^[a-f\d]{64}$/i.test(values.sha256)) throw new Error("--sha256 must contain exactly 64 hexadecimal characters.");

    const bytes = await readInput(values.snapshot, "snapshot");
    const hash = hashBytes(bytes);
    if (values.sha256 !== undefined && hash !== values.sha256.toLowerCase()) throw new Error("Snapshot SHA-256 does not match the supplied file pin.");
    let snapshot;
    try { snapshot = JSON.parse(bytes.toString("utf8")); }
    catch { throw new Error("Snapshot file is not valid JSON."); }
    const verified = verifyPaper1Snapshot(snapshot, values.label ?? DEFAULT_BASELINE_LABEL);
    let manuscript = { checked: false };
    if (values.manuscript !== undefined) {
      const manuscriptBytes = await readInput(values.manuscript, "manuscript");
      manuscript = {
        checked: true, hash: hashBytes(manuscriptBytes),
        scope: "known superseded phrases only",
        stale: scanDocument("Provided manuscript", manuscriptBytes.toString("utf8")),
      };
    }
    const drifted = verified.checks.some((check) => !check.pass) ||
      (manuscript.checked && manuscript.stale.length > 0);
    const report = {
      id: verified.meta.id, label: verified.meta.label, created_at: verified.meta.created_at,
      hash, source: verified.evidence.source, capture: verified.evidence.capture,
      checks: verified.checks, manuscript, result: drifted ? "drift" : "pass",
    };
    if (json) console.log(JSON.stringify(report, null, 2));
    else printReport(report);
    return drifted ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Figure verification failed.";
    if (json) console.log(JSON.stringify({ result: "invalid_input", error: message }, null, 2));
    else console.error(`ERROR ${message}`);
    return 2;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
