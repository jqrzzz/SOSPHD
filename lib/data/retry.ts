/* ─── Supabase Transient-Error Retry Wrapper ───────────────────────────
 *  Supabase requests fail occasionally for transient reasons: a brief
 *  upstream network blip, a Postgres connection-pool stall, a 5xx
 *  from the Realtime sidecar, etc. The fix is a small bounded retry
 *  with exponential backoff — not a full retry library.
 *
 *  Scope:
 *   - Wraps a single Supabase call. Caller decides when retry is
 *     safe (i.e. the call is idempotent — see notes below).
 *   - Retries network-class errors and 5xx response errors. Never
 *     retries 4xx (those are deterministic — auth, validation,
 *     conflict, RLS — retrying won't help and may double-write).
 *   - Capped at 3 attempts total with jittered backoff.
 *
 *  Idempotency note: most SOSPHD mutations are NOT idempotent (an
 *  INSERT creates a new row each call). Wrap reads freely; wrap
 *  writes only when the function checks a uniqueness constraint and
 *  treats duplicate-key as success, or when the cost of an
 *  occasional duplicate row is acceptable. Currently used for
 *  read-paths and the auth/identity lookups in mutations.
 * ────────────────────────────────────────────────────────────────────── */

// Match Supabase's response shape loosely so callers don't need to
// pin a generic — the type narrows from the caller's return value.
type SupabaseLikeResult<T> = {
  data: T | null;
  error: { code?: string; message: string; status?: number } | null;
};

// Supabase query builders implement PromiseLike (.then) but aren't
// real Promise instances. Accept both via PromiseLike<T> so the
// helper composes cleanly with `.from(...).select(...)` chains.
type Thenable<T> = PromiseLike<T> | Promise<T>;

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 150;

function isTransient(err: SupabaseLikeResult<unknown>["error"]): boolean {
  if (!err) return false;
  // Network / fetch failures don't carry a status — assume transient.
  if (err.status === undefined) {
    const msg = err.message?.toLowerCase() ?? "";
    return (
      msg.includes("fetch failed") ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("connection reset") ||
      msg.includes("connection refused") ||
      msg.includes("socket hang up")
    );
  }
  // 5xx and 408 (request timeout) are transient. 4xx (auth, validation,
  // RLS denial, conflict) are not — retrying won't fix them.
  return err.status >= 500 || err.status === 408;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a Supabase-style operation with bounded retries on transient
 * errors. Returns the final result (success or last failure).
 *
 * Example:
 *   const { data, error } = await withSupabaseRetry(() =>
 *     supabase.schema("research").from("notes").select("*").eq("id", id).single()
 *   );
 *
 * The argument is a thunk so each attempt builds a fresh query — many
 * Supabase query builders are single-use.
 */
export async function withSupabaseRetry<T>(
  op: () => Thenable<SupabaseLikeResult<T>>,
  label: string = "supabase",
): Promise<SupabaseLikeResult<T>> {
  let last: SupabaseLikeResult<T> = { data: null, error: null };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      last = await op();
    } catch (thrown) {
      last = {
        data: null,
        error: {
          message: thrown instanceof Error ? thrown.message : "unknown error",
        },
      };
    }

    if (!last.error) return last;
    if (!isTransient(last.error) || attempt === MAX_ATTEMPTS) return last;

    // Exponential backoff with full jitter. 150ms, ~300ms, ~600ms.
    const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
    const jittered = Math.floor(Math.random() * backoff);
    console.warn(
      `[SOSPHD] ${label}: transient supabase error on attempt ${attempt}/${MAX_ATTEMPTS}, retrying in ${jittered}ms:`,
      last.error.message,
    );
    await sleep(jittered);
  }
  return last;
}
