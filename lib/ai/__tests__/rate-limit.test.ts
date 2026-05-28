import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requireWithinAILimit,
  AIRateLimitError,
  _resetRateLimitState,
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
