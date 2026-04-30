/* ─── Instructor — runtime API ────────────────────────────────────────
 *  Reads the mandate (instructor's brief) and memory (running notes
 *  across sessions). Writes are best-effort — if the filesystem is
 *  read-only (Vercel prod), reads still work, writes degrade silently.
 *
 *  Storage today is file-based (markdown). When we move to a managed
 *  schema later, swap the read/write functions and keep the surface.
 * ────────────────────────────────────────────────────────────────────── */

import { promises as fs } from "node:fs";
import path from "node:path";

const MANDATE_PATH = path.join(process.cwd(), "lib", "instructor", "mandate.md");
const MEMORY_PATH = path.join(process.cwd(), "lib", "instructor", "memory.md");

/** Read the instructor's mandate. Returns the markdown source. */
export async function readMandate(): Promise<string> {
  try {
    return await fs.readFile(MANDATE_PATH, "utf-8");
  } catch {
    return "";
  }
}

/** Read the instructor's running memory. Returns the markdown source. */
export async function readMemory(): Promise<string> {
  try {
    return await fs.readFile(MEMORY_PATH, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Persist updated memory. Best-effort — silently degrades on read-only
 * filesystems (e.g. Vercel serverless). The instructor still benefits
 * from the in-request memory; only cross-session continuity is lost.
 */
export async function writeMemory(markdown: string): Promise<boolean> {
  try {
    await fs.writeFile(MEMORY_PATH, markdown, "utf-8");
    return true;
  } catch {
    return false;
  }
}
