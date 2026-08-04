import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requireWithinAILimit,
  AIRateLimitError,
  _resetRateLimitState,
  _bucketCount,
  _sweepNow,
} from "../rate-limit";

describe("requireWithinAILimit", () => {
  beforeEach(() => {
    _resetRateLimitState();
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => requireWithinAILimit("u1", "paper_builder")).not.toThrow();
    }
  });

  it("throws AIRateLimitError when over the per-surface limit", () => {
    // paper_builder limit is 5/min — 6th call should fail.
    for (let i = 0; i < 5; i++) {
      requireWithinAILimit("u1", "paper_builder");
    }
    expect(() => requireWithinAILimit("u1", "paper_builder")).toThrow(
      AIRateLimitError,
    );
  });

  it("isolates buckets by user", () => {
    for (let i = 0; i < 5; i++) {
      requireWithinAILimit("u1", "paper_builder");
    }
    // u2 still has full budget.
    expect(() => requireWithinAILimit("u2", "paper_builder")).not.toThrow();
  });

  it("isolates buckets by surface", () => {
    for (let i = 0; i < 5; i++) {
      requireWithinAILimit("u1", "paper_builder");
    }
    // advisor has its own 30/min budget.
    expect(() => requireWithinAILimit("u1", "advisor")).not.toThrow();
  });

  it("AIRateLimitError carries retry_after_ms within the window", () => {
    for (let i = 0; i < 5; i++) {
      requireWithinAILimit("u1", "paper_builder");
    }
    try {
      requireWithinAILimit("u1", "paper_builder");
      expect.fail("expected AIRateLimitError");
    } catch (err) {
      expect(err).toBeInstanceOf(AIRateLimitError);
      const e = err as AIRateLimitError;
      expect(e.status).toBe(429);
      expect(e.retry_after_ms).toBeGreaterThan(0);
      expect(e.retry_after_ms).toBeLessThanOrEqual(60_000);
    }
  });

  it("permits a new request after the window slides past", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    for (let i = 0; i < 5; i++) {
      requireWithinAILimit("u1", "paper_builder");
    }
    expect(() => requireWithinAILimit("u1", "paper_builder")).toThrow();
    // Advance past the 60s window so the earliest stamps fall out.
    vi.setSystemTime(60_001);
    expect(() => requireWithinAILimit("u1", "paper_builder")).not.toThrow();
  });
});

/* ─── Bucket retention ─────────────────────────────────────────────────
 *  Each bucket's timestamp array was always bounded, but the MAP was not:
 *  pruning only touched the key being read, so a user who made one request
 *  and never returned kept their entry for the life of the process. These
 *  cover the sweep that evicts them.
 * ────────────────────────────────────────────────────────────────────── */
describe("bucket retention", () => {
  beforeEach(() => {
    _resetRateLimitState();
    vi.useRealTimers();
  });

  it("retains a bucket per (user, surface) pair", () => {
    requireWithinAILimit("u1", "advisor");
    requireWithinAILimit("u1", "paper_builder");
    requireWithinAILimit("u2", "advisor");
    expect(_bucketCount()).toBe(3);
  });

  it("evicts buckets whose window has fully elapsed", () => {
    requireWithinAILimit("gone-1", "advisor");
    requireWithinAILimit("gone-2", "paper_builder");
    expect(_bucketCount()).toBe(2);

    // Every advisor/paper_builder window is 60s; sweep from well past it.
    _sweepNow(Date.now() + 120_000);
    expect(_bucketCount()).toBe(0);
  });

  it("keeps buckets that are still inside their window", () => {
    requireWithinAILimit("active", "advisor");
    _sweepNow(Date.now());
    expect(_bucketCount()).toBe(1);
    // ...and the surviving bucket still enforces its limit.
    for (let i = 1; i < 30; i++) requireWithinAILimit("active", "advisor");
    expect(() => requireWithinAILimit("active", "advisor")).toThrow(
      AIRateLimitError,
    );
  });

  it("a swept user is not penalised — their next request starts clean", () => {
    for (let i = 0; i < 5; i++) requireWithinAILimit("u1", "paper_builder");
    expect(() => requireWithinAILimit("u1", "paper_builder")).toThrow();

    _sweepNow(Date.now() + 120_000);
    expect(_bucketCount()).toBe(0);
    expect(() => requireWithinAILimit("u1", "paper_builder")).not.toThrow();
  });
});
