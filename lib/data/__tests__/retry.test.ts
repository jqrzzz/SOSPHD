import { describe, it, expect, vi } from "vitest";
import { withSupabaseRetry } from "../retry";

describe("withSupabaseRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const op = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const result = await withSupabaseRetry(op, "test");
    expect(result.data).toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries on a 503 and returns the eventual success", async () => {
    const op = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "boom", status: 503 },
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await withSupabaseRetry(op, "test");
    expect(result.data).toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on a 4xx error", async () => {
    const op = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "forbidden", status: 403 },
    });
    const result = await withSupabaseRetry(op, "test");
    expect(result.error?.status).toBe(403);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries on a network-style error (no status)", async () => {
    const op = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { message: "fetch failed" },
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await withSupabaseRetry(op, "test");
    expect(result.data).toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("gives up after MAX_ATTEMPTS (3) on persistent transient failure", async () => {
    const op = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "still down", status: 502 },
    });
    const result = await withSupabaseRetry(op, "test");
    expect(result.error?.message).toBe("still down");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("treats a thrown exception as a transient error and retries", async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const result = await withSupabaseRetry(op, "test");
    expect(result.data).toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(2);
  });
});
