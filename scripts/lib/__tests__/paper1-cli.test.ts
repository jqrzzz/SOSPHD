import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { main } from "../../verify-paper-figures.mjs";
import { BASELINE_SOURCE, PAPER1_CHECKS } from "../../../lib/data/paper1-evidence.mjs";

const cliPath = fileURLToPath(new URL("../../verify-paper-figures.mjs", import.meta.url));
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
let directory: string;
let snapshotFile: string;

// Synthetic expected aggregates test CLI mechanics, never actual research results.
function syntheticSnapshot() {
  return {
    meta: {
      id: "00000000-0000-4000-8000-000000000900", label: "paper1-baseline-v1",
      created_at: "2026-09-05T02:00:02Z",
    },
    payload: { paper1: {
      version: 1, source: BASELINE_SOURCE,
      capture: { started_at: "2026-09-05T02:00:00Z", ended_at: "2026-09-05T02:00:01Z" },
      case_count: 836, event_count: 844, interval_count: 835,
      figures: Object.fromEntries(PAPER1_CHECKS.map(({ key, expected }) => [key, expected])),
    } },
  };
}

async function runJson(args: string[]) {
  const output = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    const code = await main([...args, "--json"]);
    return { code, report: JSON.parse(output.mock.calls.map((call) => call.join(" ")).join("\n")) };
  } finally { output.mockRestore(); }
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "sosphd-paper1-cli-"));
  snapshotFile = join(directory, "synthetic snapshot.json");
  writeFileSync(snapshotFile, JSON.stringify(syntheticSnapshot()));
});

afterEach(() => {
  vi.restoreAllMocks();
  // Only remove the exact private directory returned by mkdtemp for this test.
  rmSync(directory, { recursive: true, force: true });
});

describe("offline Paper 1 CLI", () => {
  it("reports snapshot identity, exact-byte checksum, and all 30 checks without inventing a manuscript check", async () => {
    const { code, report } = await runJson(["--snapshot", snapshotFile]);
    expect(code).toBe(0);
    expect(report).toMatchObject({
      id: syntheticSnapshot().meta.id, label: "paper1-baseline-v1", result: "pass",
      hash: hash(readFileSync(snapshotFile)), source: BASELINE_SOURCE,
      manuscript: { checked: false },
    });
    expect(report.checks).toHaveLength(30);
    expect(report.checks.every((check: { pass: boolean }) => check.pass)).toBe(true);
    expect(report.manuscript).toEqual({ checked: false });
  });

  it("runs from another directory with fetch disabled and invalid credentials, without reading .env.local", () => {
    const preload = join(directory, "forbid-network.mjs");
    writeFileSync(preload, `
globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };
process.on("exit", () => {
  if (process.env.SOSPHD_ENV_SHOULD_REMAIN_UNREAD) process.exitCode = 99;
});
`);
    writeFileSync(join(directory, ".env.local"), "SOSPHD_ENV_SHOULD_REMAIN_UNREAD=yes\n");
    const child = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, cliPath, "--snapshot", snapshotFile, "--json"], {
      cwd: directory, encoding: "utf8", timeout: 20_000,
      env: {
        ...process.env,
        SOSPHD_SUPABASE_URL: "invalid-url", NEXT_PUBLIC_SUPABASE_URL: "invalid-url",
        SOSPHD_SUPABASE_ANON_KEY: "invalid-key", NEXT_PUBLIC_SUPABASE_ANON_KEY: "invalid-key",
        SOSPHD_EMAIL: "synthetic@example.test", SOSPHD_PASSWORD: "not-a-real-credential",
      },
    });
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout).result).toBe("pass");
    expect(child.stderr).not.toContain("NETWORK_FORBIDDEN");
  }, 30_000);

  it("pins the exact file bytes, including whitespace, with optional case-insensitive hex", async () => {
    const pin = hash(readFileSync(snapshotFile));
    expect((await runJson(["--snapshot", snapshotFile, "--sha256", pin.toUpperCase()])).code).toBe(0);
    writeFileSync(snapshotFile, `${readFileSync(snapshotFile, "utf8")}\n`);
    const changed = await runJson(["--snapshot", snapshotFile, "--sha256", pin]);
    expect(changed.code).toBe(2);
    expect(changed.report.error).toMatch(/SHA-256/);
  });

  it("returns drift for a changed frozen figure while leaving the file untouched", async () => {
    const snapshot = syntheticSnapshot();
    snapshot.payload.paper1.figures.gastro = 230;
    const bytes = JSON.stringify(snapshot);
    writeFileSync(snapshotFile, bytes);
    const { code, report } = await runJson(["--snapshot", snapshotFile]);
    expect(code).toBe(1);
    expect(report.result).toBe("drift");
    expect(report.checks.filter((check: { pass: boolean }) => !check.pass)).toHaveLength(1);
    expect(readFileSync(snapshotFile, "utf8")).toBe(bytes);
  });

  it("rejects old and incomplete downloads with no live fallback", async () => {
    for (const snapshot of [{ meta: syntheticSnapshot().meta, payload: { counts: { cases: 836 } } }, { payload: {} }]) {
      writeFileSync(snapshotFile, JSON.stringify(snapshot));
      const result = await runJson(["--snapshot", snapshotFile]);
      expect(result.code).toBe(2);
      expect(result.report.error).toMatch(/no live fallback/i);
    }
  });

  it("requires the correct label and supports an explicitly requested alternative", async () => {
    expect((await runJson(["--snapshot", snapshotFile, "--label", "wrong-label"])).code).toBe(2);
    const snapshot = syntheticSnapshot();
    snapshot.meta.label = "synthetic-alternative";
    writeFileSync(snapshotFile, JSON.stringify(snapshot));
    expect((await runJson(["--snapshot", snapshotFile, "--label", "synthetic-alternative"])).code).toBe(0);
  });

  it("scans only the supplied manuscript and hashes the same bytes it scans", async () => {
    const manuscript = join(directory, "synthetic manuscript.md");
    const text = "# Synthetic paper\nAcross 67 nationalities.\n";
    writeFileSync(manuscript, text);
    const stale = await runJson(["--snapshot", snapshotFile, "--manuscript", manuscript]);
    expect(stale.code).toBe(1);
    expect(stale.report.manuscript).toMatchObject({ checked: true, hash: hash(text), scope: "known superseded phrases only" });
    expect(stale.report.manuscript.stale).toEqual([{ title: "Provided manuscript", wrong: "67 nationalities", right: "68 nationalities" }]);
    writeFileSync(manuscript, "# Synthetic paper\nAcross 68 nationalities.\n");
    const clean = await runJson(["--snapshot", snapshotFile, "--manuscript", manuscript]);
    expect(clean.code).toBe(0);
    expect(clean.report.manuscript.stale).toEqual([]);
  });

  it.each([
    [], ["--unknown"], ["unexpected-positional"], ["--snapshot"],
    ["--snapshot", ""], ["--live", "--snapshot", "file.json"], ["--live"],
  ].map((args) => ({ args })))("rejects invalid or ambiguous invocation $args", async ({ args }) => {
    // runJson always adds --json, so even [--live] is deliberately a rejected combination.
    const result = await runJson(args);
    expect(result.code).toBe(2);
    expect(result.report.result).toBe("invalid_input");
  });

  it.each([
    ["--sha256", "short"], ["--sha256", "z".repeat(64)],
    ["--manuscript", ""], ["--label", " "],
  ].map((options) => ({ options })))("rejects invalid option values $options", async ({ options }) => {
    expect((await runJson(["--snapshot", snapshotFile, ...options])).code).toBe(2);
  });

  it("reports malformed JSON without echoing file contents", async () => {
    writeFileSync(snapshotFile, "SYNTHETIC_PRIVATE_INVALID_JSON");
    const result = await runJson(["--snapshot", snapshotFile]);
    expect(result.code).toBe(2);
    expect(result.report.error).toBe("Snapshot file is not valid JSON.");
    expect(JSON.stringify(result.report)).not.toContain("SYNTHETIC_PRIVATE_INVALID_JSON");
  });

  it("escapes control characters in human output and includes capture provenance", async () => {
    const snapshot = syntheticSnapshot();
    snapshot.meta.label = "synthetic\nLABEL\u001b[31m";
    snapshot.payload.paper1.figures.raw_ttta_hours = "0h\nACTUAL\u001b[31m";
    writeFileSync(snapshotFile, JSON.stringify(snapshot));
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await main(["--snapshot", snapshotFile, "--label", snapshot.meta.label])).toBe(1);
    const lines = output.mock.calls.map((call) => call.join(" "));
    expect(lines.some((line) => line.includes(JSON.stringify(snapshot.meta.label)))).toBe(true);
    expect(lines.some((line) => line.includes(JSON.stringify(snapshot.payload.paper1.figures.raw_ttta_hours)))).toBe(true);
    expect(lines.every((line) => !line.includes("\n") && !line.includes("\r") && !line.includes("\u001b"))).toBe(true);
    expect(lines).toContain(`Created: ${snapshot.meta.created_at}`);
    expect(lines).toContain(`Source: ${BASELINE_SOURCE}`);
  });

  it("does not echo unrecognized argument contents in error output", async () => {
    const result = await runJson(["--SYNTHETIC_PRIVATE_ARGUMENT\nFORGED_LINE"]);
    expect(result.code).toBe(2);
    expect(result.report.error).toBe("Invalid command-line arguments. Use --help for supported options.");
    expect(JSON.stringify(result.report)).not.toContain("SYNTHETIC_PRIVATE_ARGUMENT");
  });

  it("reports missing snapshot and manuscript files as invalid input", async () => {
    expect((await runJson(["--snapshot", join(directory, "absent.json")])).code).toBe(2);
    expect((await runJson(["--snapshot", snapshotFile, "--manuscript", join(directory, "absent.md")])).code).toBe(2);
  });

  it("provides help without needing a snapshot or a database", async () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await main(["--help"])).toBe(0);
    expect(output.mock.calls.flat().join("\n")).toContain("offline");
    expect(output.mock.calls.flat().join("\n")).toContain("does not authenticate");
  });
});
