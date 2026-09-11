#!/usr/bin/env node
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { MAX_BYTES, verifyManuscriptRelease } from "./lib/manuscript-release.mjs";

const HELP = `Verify a private manuscript/evidence pairing without changing files.
node scripts/verify-manuscript-release.mjs --manifest FILE --manuscript FILE --evidence ID=FILE [--evidence ID=FILE] [--json]
All file paths come from the command line, never from untrusted manifest contents.
Input maximum: 4 MiB per file. Existing verify-paper-figures.mjs remains unchanged.
Exit 0: declared checks agree; 1: mismatch; 2: invalid input. None grants publication clearance.
`;
export async function boundedRead(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) throw new Error();
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used < 1 || used > MAX_BYTES) throw new Error();
    return buffer.subarray(0, used);
  } finally { await handle?.close(); }
}
export async function main(args) {
  try {
    const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
      manifest: { type: "string" }, manuscript: { type: "string" },
      evidence: { type: "string", multiple: true }, json: { type: "boolean" }, help: { type: "boolean" },
    } });
    if (values.help) { console.log(HELP); return 0; }
    if (!values.manifest || !values.manuscript || !values.evidence?.length || values.evidence.length > 4) throw new Error();
    const evidence = new Map();
    for (const pair of values.evidence) {
      const split = pair.indexOf("="); const id = pair.slice(0, split); const path = pair.slice(split + 1);
      if (split < 1 || !path || !/^[a-z][a-z0-9._-]{0,63}$/.test(id) || evidence.has(id)) throw new Error();
      evidence.set(id, await boundedRead(path));
    }
    const report = verifyManuscriptRelease(await boundedRead(values.manifest), await boundedRead(values.manuscript), evidence);
    if (values.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Paper 1 v${report.version}: ${report.result}`);
      for (const c of report.checks) console.log(`${c.agrees ? "AGREE" : "MISMATCH"} ${c.id}`);
      console.log("Only declared claims and byte identities checked. No fresh database read, source authentication, full-text scientific review or submission clearance.");
    }
    return report.result === "mismatch" ? 1 : 0;
  } catch {
    console.error("Invalid or unreadable release input. Use --help. Private contents and paths were not echoed.");
    return 2;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = await main(process.argv.slice(2));
