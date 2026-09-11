import { it } from "vitest";
import * as text from "../section-revision";
import * as service from "../revision-service";
import { registerRevisionTests } from "./section-revision.cases.mjs";
registerRevisionTests(it, { ...text, ...service });
