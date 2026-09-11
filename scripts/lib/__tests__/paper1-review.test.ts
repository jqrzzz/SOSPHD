import { describe, it } from "vitest";
import { reviewCases } from "./paper1-review.cases.mjs";

describe("offline Paper 1 reconciliation report", () => {
  for (const [name, check] of reviewCases) it(name, check);
});
