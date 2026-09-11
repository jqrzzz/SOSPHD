#!/usr/bin/env node
// Standalone, offline review. No app imports, credentials, AI calls or database writes.
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { buildPaper1ReviewReport, renderPaper1ReviewMarkdown, ReviewInputError } from "./lib/paper1-review-report.mjs";

export const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const HELP = `Read-only Paper 1 reconciliation report from the PRIVATE v0.12 evidence package.
Usage: node scripts/review-paper1-reconciliation.mjs --source FILE --retained FILE [--json]
Optional: --source-sha256 HEX --retained-sha256 HEX
Reads source_reconciliation.json and retained_database_evidence.json, not raw ledgers.
Output goes to stdout. Keep private outputs outside the public repository.
Exit: 0 defined checks agree (NOT research clearance); 1 discrepancy; 2 invalid input.
No source data is changed, no records are merged, and no live connection is made.
`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function readEvidence(file, pin) {
  let handle;
  try {
    // NONBLOCK avoids hanging on a named pipe; NOFOLLOW rejects symlink inputs where supported.
    handle = await open(file, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_INPUT_BYTES) throw new Error();
    const bytes = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > MAX_INPUT_BYTES) throw new Error();
    const content = bytes.subarray(0, total);
    const sha256 = hash(content);
    if (pin !== undefined && sha256 !== pin.toLowerCase()) throw new Error();
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content));
    return { value, sha256 };
  } catch {
    throw new ReviewInputError("Cannot read evidence: use a regular UTF-8 JSON file within 4 MiB and check any supplied SHA-256 pin.");
  } finally {
    await handle?.close();
  }
}

export async function main(args) {
  let json = args.includes("--json");
  try {
    let values;
    try {
      const parsed = parseArgs({ args, strict: true, allowPositionals: false, tokens: true, options: {
        source: { type: "string" }, retained: { type: "string" }, json: { type: "boolean" }, help: { type: "boolean" },
        "source-sha256": { type: "string" }, "retained-sha256": { type: "string" },
      } });
      const names = parsed.tokens.filter((token) => token.kind === "option").map((token) => token.name);
      if (new Set(names).size !== names.length) throw new Error();
      values = parsed.values;
    } catch { throw new ReviewInputError("Invalid or repeated options. Use --help."); }
    json = values.json === true;
    if (values.help) { console.log(HELP); return 0; }
    if (!values.source?.trim() || !values.retained?.trim()) throw new ReviewInputError("--source FILE and --retained FILE are required.");
    for (const key of ["source-sha256", "retained-sha256"]) {
      if (values[key] !== undefined && !/^[a-f0-9]{64}$/i.test(values[key])) throw new ReviewInputError("SHA-256 pins require 64 hexadecimal characters.");
    }
    const source = await readEvidence(values.source, values["source-sha256"]);
    const retained = await readEvidence(values.retained, values["retained-sha256"]);
    const report = { ...buildPaper1ReviewReport(source.value, retained.value),
      input_sha256: { source: source.sha256, retained: retained.sha256 } };
    console.log(json ? JSON.stringify(report, null, 2)
      : `${renderPaper1ReviewMarkdown(report)}\nSource evidence SHA-256: ${source.sha256}\nRetained evidence SHA-256: ${retained.sha256}\n`);
    return report.result === "consistent" ? 0 : 1;
  } catch (error) {
    const message = error instanceof ReviewInputError ? error.message : "Review failed without changing evidence. No raw error details are exposed.";
    if (json) console.log(JSON.stringify({ result: "invalid_input", error: message }));
    else console.error(message);
    return 2;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}
