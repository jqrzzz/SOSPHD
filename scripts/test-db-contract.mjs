#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_FILE = path.join(REPOSITORY_ROOT, "supabase", "tests", "compose.yml");
const MIGRATIONS_DIRECTORY = path.join(REPOSITORY_ROOT, "supabase", "migrations");
const PLATFORM_FIXTURE = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "tests",
  "fixtures",
  "platform.sql",
);
const PRE_CONTAINMENT_FIXTURE = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "tests",
  "fixtures",
  "pre_containment.sql",
);
const WRONG_DEDUP_CONSTRAINT_FIXTURE = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "tests",
  "fixtures",
  "wrong_dedup_constraint.sql",
);
const CONTAINMENT_CONTRACT = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "tests",
  "contracts",
  "containment.sql",
);
const PREFLIGHT_GUARD_CONTRACT = path.join(
  REPOSITORY_ROOT,
  "supabase",
  "tests",
  "contracts",
  "preflight_guard.sql",
);
const SUMMARY_FILE = path.join(
  REPOSITORY_ROOT,
  "test-results",
  "db-contract-summary.json",
);

const POSTGRES_IMAGE =
  "postgres:15.18-bookworm@sha256:e8db9bd3e9e1751eb639fb17be53cc6d1b62a322adf75b99e791767a7a16ce69";
const POSTGRES_SERVICE = "postgres";
const POSTGRES_USER = "postgres";
const DATABASES = Object.freeze({
  fresh: "sosphd_contract_fresh",
  guard: "sosphd_contract_guard",
  upgrade: "sosphd_contract_upgrade",
});

// A Compose project owns the container, network, and volume. A unique name
// prevents simultaneous local or CI runs from sharing any of those resources.
const COMPOSE_PROJECT = `sosphd-db-contract-${process.pid}-${randomBytes(4).toString("hex")}`;
const COMPOSE_ARGUMENTS = [
  "compose",
  "--file",
  COMPOSE_FILE,
  "--project-name",
  COMPOSE_PROJECT,
];

// The contract harness has no reason to know how to reach a hosted database.
// Keep Docker's own connection settings, but remove database and Supabase
// settings before invoking Docker or anything inside the disposable service.
const DATABASE_ENVIRONMENT_PATTERN = /^(?:PG|POSTGRES|SUPABASE|NEXT_PUBLIC_SUPABASE|SOSPHD_SUPABASE)/i;
const DATABASE_ENVIRONMENT_NAMES = new Set([
  "DATABASE_URL",
  "DIRECT_URL",
]);

function sanitizedEnvironment() {
  const environment = { ...process.env };
  let ignored = 0;

  for (const name of Object.keys(environment)) {
    if (DATABASE_ENVIRONMENT_PATTERN.test(name) || DATABASE_ENVIRONMENT_NAMES.has(name)) {
      delete environment[name];
      ignored += 1;
    }
  }

  return { environment, ignored };
}

const { environment: CHILD_ENVIRONMENT, ignored: IGNORED_DATABASE_ENVIRONMENT_COUNT } =
  sanitizedEnvironment();

function outputTail(previous, chunk) {
  return `${previous}${chunk}`.slice(-16_384);
}

function run(
  command,
  args,
  { capture = false, input, onStdout, quiet = false } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPOSITORY_ROOT,
      env: CHILD_ENVIRONMENT,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdinError;
    let settled = false;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout = capture ? `${stdout}${text}` : outputTail(stdout, text);
      onStdout?.(text);
      if (!quiet) process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = capture ? `${stderr}${text}` : outputTail(stderr, text);
      if (!quiet) process.stderr.write(chunk);
    });

    child.stdin.on("error", (error) => {
      // A failed psql process can close stdin before Node finishes streaming
      // the SQL. Preserve that error for the normal close-path diagnostic.
      stdinError = error;
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(`Could not start ${command}: ${error.message}`, {
          cause: error,
        }),
      );
    });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;

      if (code === 0 && !stdinError) {
        resolve({ stdout, stderr });
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      const detail = stderr.trim() || stdinError?.message || stdout.trim();
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${reason}${detail ? `\n${detail}` : ""}`,
        ),
      );
    });

    child.stdin.end(input);
  });
}

function docker(args, options) {
  return run("docker", args, options);
}

function compose(args, options) {
  return docker([...COMPOSE_ARGUMENTS, ...args], options);
}

function containerPsqlArguments(database, additionalArguments = []) {
  return [
    ...COMPOSE_ARGUMENTS,
    "exec",
    "--no-TTY",
    POSTGRES_SERVICE,
    "psql",
    "-X",
    "--set=ON_ERROR_STOP=1",
    "--no-password",
    "--host=/var/run/postgresql",
    `--username=${POSTGRES_USER}`,
    `--dbname=${database}`,
    ...additionalArguments,
  ];
}

async function createDatabase(database) {
  await docker(
    containerPsqlArguments("postgres", [
      `--command=CREATE DATABASE ${database}`,
    ]),
  );
}

async function applySqlFile(
  database,
  file,
  { scenario, singleTransaction = true } = {},
) {
  const relativeFile = path.relative(REPOSITORY_ROOT, file).split(path.sep).join("/");
  const sql = await readFile(file);
  const variables = scenario ? [`--set=scenario=${scenario}`] : [];

  console.log(`  APPLY ${database}: ${relativeFile}`);
  const transactionArguments = singleTransaction ? ["--single-transaction"] : [];
  await docker(
    containerPsqlArguments(database, [
      ...transactionArguments,
      ...variables,
      "--file=-",
    ]),
    { input: sql },
  );
}

async function migrationInventory() {
  const entries = await readdir(MIGRATIONS_DIRECTORY, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();

  if (names.length === 0) {
    throw new Error("No SQL migrations were found in supabase/migrations.");
  }

  const containmentNames = names.filter((name) =>
    name.endsWith("_privileged_function_containment.sql"),
  );
  if (containmentNames.length !== 1) {
    throw new Error(
      `Expected exactly one *_privileged_function_containment.sql migration; found ${containmentNames.length}.`,
    );
  }

  const containmentIndex = names.indexOf(containmentNames[0]);
  if (containmentIndex !== names.length - 1) {
    throw new Error(
      "The containment migration must be the newest migration so the legacy-upgrade scenario cannot silently skip later migrations.",
    );
  }

  const migrations = await Promise.all(
    names.map(async (name) => {
      const file = path.join(MIGRATIONS_DIRECTORY, name);
      const contents = await readFile(file);
      return {
        file,
        name,
        sha256: createHash("sha256").update(contents).digest("hex"),
      };
    }),
  );

  return {
    migrations,
    containmentIndex,
  };
}

async function assertHarnessInputsExist() {
  for (const file of [
    COMPOSE_FILE,
    PLATFORM_FIXTURE,
    PRE_CONTAINMENT_FIXTURE,
    WRONG_DEDUP_CONSTRAINT_FIXTURE,
    CONTAINMENT_CONTRACT,
    PREFLIGHT_GUARD_CONTRACT,
  ]) {
    try {
      await access(file);
    } catch {
      throw new Error(`Missing database harness input: ${path.relative(REPOSITORY_ROOT, file)}`);
    }
  }

  const compose = await readFile(COMPOSE_FILE, "utf8");
  const expectedImageLine = `image: ${POSTGRES_IMAGE}`;
  if (!compose.split(/\r?\n/).some((line) => line.trim() === expectedImageLine)) {
    throw new Error(
      "The Compose PostgreSQL image does not match the image recorded in the contract summary.",
    );
  }
}

async function serverVersion() {
  const { stdout } = await docker(
    containerPsqlArguments("postgres", [
      "--tuples-only",
      "--no-align",
      "--command=SHOW server_version",
    ]),
    { capture: true, quiet: true },
  );
  return stdout.trim();
}

async function runContentionContract(database) {
  const caseId = "70000000-0000-4000-8000-000000000001";
  const marker = "SOSPHD_FIRST_INSERT_PENDING";
  const helperCall = `
SELECT research.upsert_case_event(
  '${caseId}'::uuid,
  'NOTE'::research.event_type,
  '2026-02-20 08:00:00+00'::timestamptz,
  'contract-contention',
  'exact concurrent event',
  'measured'::research.clock_resolution
);`;
  const firstSessionSql = `\\set ON_ERROR_STOP on
BEGIN;
${helperCall}
\\echo ${marker}
SELECT pg_catalog.pg_sleep(3);
COMMIT;
`;
  const secondSessionSql = `\\set ON_ERROR_STOP on
BEGIN;
${helperCall}
COMMIT;
`;

  let markerSeen = false;
  let output = "";
  let resolveMarker;
  const markerReady = new Promise((resolve) => {
    resolveMarker = resolve;
  });
  const firstSession = docker(
    containerPsqlArguments(database, ["--file=-"]),
    {
      input: firstSessionSql,
      onStdout(text) {
        output = outputTail(output, text);
        if (!markerSeen && output.includes(marker)) {
          markerSeen = true;
          resolveMarker();
        }
      },
    },
  );

  await Promise.race([
    markerReady,
    firstSession.then(() => {
      if (!markerSeen) {
        throw new Error("The first contention session exited before its insert marker.");
      }
    }),
  ]);

  const secondSession = docker(
    containerPsqlArguments(database, ["--file=-"]),
    { input: secondSessionSql },
  );
  await Promise.all([firstSession, secondSession]);

  const { stdout } = await docker(
    containerPsqlArguments(database, [
      "--tuples-only",
      "--no-align",
      `--command=SELECT count(*) FROM research.case_events WHERE case_id = '${caseId}'::uuid AND event_type = 'NOTE'::research.event_type`,
    ]),
    { capture: true, quiet: true },
  );
  if (stdout.trim() !== "1") {
    throw new Error(
      `Concurrent exact helper calls should leave one event; observed ${stdout.trim() || "no count"}.`,
    );
  }

  console.log(`  PASS  ${database}: concurrent exact insert is atomic`);
}

async function writeSummary(summary) {
  await mkdir(path.dirname(SUMMARY_FILE), { recursive: true });
  await writeFile(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

async function main() {
  await assertHarnessInputsExist();
  const { migrations, containmentIndex } = await migrationInventory();
  const containmentMigration = migrations[containmentIndex];
  const summary = {
    image: POSTGRES_IMAGE,
    serverVersion: null,
    migrations: migrations.map(({ name, sha256 }) => ({ file: name, sha256 })),
    scenarios: {
      fresh: { contentionPass: false, pass: false },
      guard: { pass: false },
      upgrade: { contentionPass: false, pass: false },
    },
  };

  if (IGNORED_DATABASE_ENVIRONMENT_COUNT > 0) {
    console.log(
      `Ignoring ${IGNORED_DATABASE_ENVIRONMENT_COUNT} host database environment variable(s); this harness only uses its disposable PostgreSQL container.`,
    );
  }

  let composeStarted = false;
  let failure;

  try {
    await docker(["compose", "version"]);
    composeStarted = true;

    console.log(`\nPulling pinned PostgreSQL image:\n  ${POSTGRES_IMAGE}\n`);
    await compose(["pull", POSTGRES_SERVICE]);
    await compose([
      "up",
      "--detach",
      "--wait",
      "--wait-timeout",
      "90",
      "--pull",
      "never",
      POSTGRES_SERVICE,
    ]);

    summary.serverVersion = await serverVersion();
    console.log(`PostgreSQL ${summary.serverVersion} is healthy.`);

    await createDatabase(DATABASES.fresh);
    await createDatabase(DATABASES.guard);
    await createDatabase(DATABASES.upgrade);

    console.log("\nFresh-install contract\n");
    await applySqlFile(DATABASES.fresh, PLATFORM_FIXTURE);
    for (const migration of migrations) {
      await applySqlFile(DATABASES.fresh, migration.file);
    }
    await applySqlFile(DATABASES.fresh, CONTAINMENT_CONTRACT, {
      scenario: "fresh",
      singleTransaction: false,
    });
    await runContentionContract(DATABASES.fresh);
    summary.scenarios.fresh.contentionPass = true;
    summary.scenarios.fresh.pass = true;

    console.log("\nConstraint-drift rejection contract\n");
    await applySqlFile(DATABASES.guard, PLATFORM_FIXTURE);
    for (const migration of migrations.slice(0, containmentIndex)) {
      await applySqlFile(DATABASES.guard, migration.file);
    }
    await applySqlFile(DATABASES.guard, WRONG_DEDUP_CONSTRAINT_FIXTURE);
    let rejectedConstraintDrift = false;
    try {
      await applySqlFile(DATABASES.guard, containmentMigration.file);
    } catch (error) {
      if (!error.message.includes("Expected validated, non-deferrable")) {
        throw new Error("Containment failed for the wrong reason in the guard scenario.", {
          cause: error,
        });
      }
      rejectedConstraintDrift = true;
    }
    if (!rejectedConstraintDrift) {
      throw new Error("Containment accepted a structurally incorrect dedup constraint.");
    }
    await applySqlFile(DATABASES.guard, PREFLIGHT_GUARD_CONTRACT);
    summary.scenarios.guard.pass = true;

    console.log("\nRepresentative legacy-upgrade contract\n");
    await applySqlFile(DATABASES.upgrade, PLATFORM_FIXTURE);
    for (const migration of migrations.slice(0, containmentIndex)) {
      await applySqlFile(DATABASES.upgrade, migration.file);
    }
    await applySqlFile(DATABASES.upgrade, PRE_CONTAINMENT_FIXTURE);
    await applySqlFile(DATABASES.upgrade, containmentMigration.file);
    await applySqlFile(DATABASES.upgrade, CONTAINMENT_CONTRACT, {
      scenario: "upgrade",
      singleTransaction: false,
    });
    await runContentionContract(DATABASES.upgrade);
    summary.scenarios.upgrade.contentionPass = true;
    summary.scenarios.upgrade.pass = true;
  } catch (error) {
    failure = error;
  } finally {
    if (composeStarted) {
      try {
        await compose(["down", "--volumes", "--remove-orphans", "--timeout", "10"]);
      } catch (cleanupError) {
        if (failure) {
          console.error(`Database cleanup also failed: ${cleanupError.message}`);
        } else {
          failure = cleanupError;
        }
      }
    }

    try {
      await writeSummary(summary);
    } catch (summaryError) {
      if (failure) {
        console.error(`Could not write the database contract summary: ${summaryError.message}`);
      } else {
        failure = summaryError;
      }
    }
  }

  if (failure) throw failure;

  console.log(`\nDatabase contracts passed. Summary: ${path.relative(REPOSITORY_ROOT, SUMMARY_FILE)}`);
}

main().catch((error) => {
  console.error(`\nDatabase contract harness failed: ${error.message}\n`);
  process.exitCode = 1;
});
