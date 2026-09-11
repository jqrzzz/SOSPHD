// The same cases run without installing application dependencies.
import { test } from "node:test";
import { reviewCases } from "./paper1-review.cases.mjs";
for (const [name, check] of reviewCases) test(name, check);
