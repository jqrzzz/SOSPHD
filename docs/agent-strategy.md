# SOSPHD Agent Strategy

> Long-term plan for evolving SOSPHD from a research workbench into a credentialed, citable, callable AI agent in the tourist-medical-emergency-coordination niche. This doc is meant to evolve — update it when decisions are made, items are completed, or the landscape shifts.

**Last updated**: 2026-05-18
**Owner**: Juan Quiroz Jr.
**Companion docs**: [`CLAUDE.md`](../CLAUDE.md) (project rules), [`app/protocol/page.tsx`](../app/protocol/page.tsx) (intervention protocol v0.1)

---

## 1. Vision

**12-month outcome (May 2027).** SOSPHD is a publicly-callable, MCP-registered agent that any AI app (Claude, ChatGPT, Cursor, custom orchestrators) can discover and consult about tourist medical emergency coordination in Southeast Asia. Every response carries a structured provenance receipt citing real cases, computed metrics, and protocol version. At least one organization (travel insurer, evacuation provider, or hospital network) is paying for sustained API access. The PhD is defended and Paper 1 + Paper 2 are published; the agent's authority derives from peer-reviewed work, not pre-prints.

**24–36-month outcome.** SOSPHD operates as a credentialed third-party expert in the agent economy — invoked by insurer claims agents during real cases, by travel-app safety agents during incidents, by other research agents seeking citations. Revenue comes from per-org API contracts + per-call billing via x402 micropayments. Outcome data flows back from external callers, closing the learning loop. A second corridor (e.g. Indonesia or Vietnam) has been studied and added to the credentialed scope.

---

## 2. What already exists

Built between Feb–May 2026. Don't rebuild these.

| Asset | File / route | Status |
|---|---|---|
| External-callable agent endpoint | [`POST /api/agent`](../app/api/agent/route.ts) | ✓ Live. Caller field, capability discovery, 10 actions |
| Structured domain knowledge | [`lib/agent/domain.ts`](../lib/agent/domain.ts) | ✓ Live. Thesis, 3 papers, 3 metrics, 6 corridors, event taxonomy |
| Agent core orchestrator | [`lib/agent/core.ts`](../lib/agent/core.ts) | ✓ Live. `executeAgent`, action→tool mapping, meta receipts shape |
| Tool definitions | [`lib/agent/tools.ts`](../lib/agent/tools.ts) | ✓ Live. Function-calling interface |
| High-level workflows | [`lib/agent/workflows.ts`](../lib/agent/workflows.ts) | ✓ Live. `detectGaps`, `getResearchPulse`, `getCorridorBriefing`, `handleAgentContract` |
| Intervention protocol (citable, versioned) | [`/protocol`](../app/protocol/page.tsx), [`lib/protocol.ts`](../lib/protocol.ts) | ✓ Live. v0.1, six numbered sections, git-versioned audit trail |
| Recommendation engine with provenance | [`lib/recommendations.ts`](../lib/recommendations.ts), [`POST /api/recommendations/generate`](../app/api/recommendations/generate/route.ts) | ✓ Live. engine_version, confidence, protocol cited in prompt |
| First-class decision audit | `research.recommendations.decided_by`, `decided_at` | ✓ Live. Migration `20260516_005` + CHECK constraint |
| Operational data sync | [`lib/data/sync.ts`](../lib/data/sync.ts) | ✓ Live. SOSCOMMAND → research.case_events, idempotent |
| Pure analytics (no DB N+1) | [`lib/data/analytics.ts`](../lib/data/analytics.ts) | ✓ Live. 3 queries regardless of dataset size |
| Centralized AI config | [`lib/ai/config.ts`](../lib/ai/config.ts) | ✓ Live. Per-surface model overrides via env var |
| Auth gates on all LLM endpoints | All `app/api/*/route.ts` | ✓ Live. `requireAuthenticatedUser` |
| Server-side auth helper | [`lib/supabase/server-auth.ts`](../lib/supabase/server-auth.ts) | ✓ Live |
| Tests for new analytics + sync | `lib/data/__tests__/*` | ✓ 48 passing |
| CI gates: lint, typecheck, build, test | `.github/workflows/ci.yml` | ✓ Green |

**Key implication**: the agent-shaped scaffold is already there. The work ahead is wrapping it for external consumption, not rebuilding it.

---

## 3. The agent-economy landscape (as of May 2026)

What I learned researching this:

**Standards have consolidated.** [MCP](https://modelcontextprotocol.io) is the de facto agent-integration protocol. Anthropic donated it to the Agentic AI Foundation (with OpenAI and Block as co-founders). The MCP registry hit 9,400+ servers by April 2026 (407% growth in 7 months).

**Discovery happens via well-known endpoints.** [SEP-1649](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127) standardizes `/.well-known/mcp/server-card.json` for tool/service discovery. A2A protocol's parallel `/.well-known/agent-card.json` covers agent-to-agent. Any AI client pointed at our domain can auto-detect capabilities without manual configuration.

**Payments are HTTP-native.** [x402](https://docs.stripe.com/payments/machine/x402) — HTTP 402 status code + machine-readable payment instructions + on-chain settlement (USDC on Base/Solana). Stripe launched x402 support Feb 2026. By April 2026: 75M+ transactions, 69k active agents, ~$50M cumulative volume. AWS Bedrock AgentCore Payments shipped on the same protocol.

**Citations are THE trust signal.** G2's 2026 AI Search Insight Report ranks "citation from a review site" as the #1 factor increasing user confidence in AI-generated answers. Glean, Dust, and Deep Research all lead with citations. Documentation frameworks ("model cards", "AI nutrition facts", "data provenance cards") are now expected.

**Discovery is the bottleneck, not building.** Three biggest MCP hubs: mcp.so, Smithery, PulseMCP. Eight broader marketplaces (Claude Skills, GPT Store, MCP Hubs, HF Spaces, Replit, LangChain, Vercel, Cloudflare). Most agency-built agents fail to gain traction not because they're broken but because they're invisible.

**Our niche specifically.** International SOS launched AI-supported assistance capabilities; AXA is investing heavily in claims AI. **Both keep their AI internal** — neither exposes it as a callable, citable third-party API. The niche has no MCP-registered, peer-reviewed, externally-consultable expert. That's the gap.

---

## 4. Positioning — why our agent is unique

What no generic agent has, and what our competitors won't have:

1. **A version-controlled intervention protocol** that the engine prompt cites verbatim and external callers can read at `/protocol`
2. **Operational ground truth** via SOSCOMMAND sync — real cases, real timestamps, real decisions, not a benchmark dataset
3. **The PhD itself** — when the thesis is defended and papers are published, the agent answers from peer-reviewed work. International SOS can't claim that. AXA can't claim that. Generic LLMs can't claim that.
4. **A single niche done deeply** — Southeast Asia corridors (Koh Samui, Phuket, Chiang Mai, Pattaya, Krabi, Bangkok hub). Not "global travel medicine." The niche IS the moat.

Phrased as a one-line value proposition: *"The only externally-callable AI agent operating under a peer-reviewed intervention protocol for tourist medical emergency coordination in Southeast Asia."*

---

## 5. Roadmap

### Phase 1 — Foundation for external consumption (Q3 2026)

Goal: another agent can authenticate, call, and receive a self-justifying response.

- [ ] **Service tokens** — `phd_service_tokens(token_hash, owner_email, scopes, rate_limit_qpm, monthly_quota, expires_at, last_used_at)`. SHA-256 hashed storage (pattern already in `service_account_tokens` in SOSCOMMAND). Bearer auth middleware on `/api/agent` and `/api/recommendations/generate`. Admin page at `/admin/tokens`.
- [ ] **Usage metering** — `phd_api_usage(token_id, route, action, model_used, tokens_in, tokens_out, latency_ms, cents_charged, occurred_at)`. Surfaced as a chart on the admin page.
- [ ] **Provenance receipts on every response** — extend `AgentResponse.meta` to include: `engine_version`, `protocol_version`, `queries_run[]`, `citations[]` (case ids, paper sections, doc ids), `confidence`, `confidence_basis`, `data_window`. Make this the default response shape, not an opt-in.
- [ ] **PHI redaction tier** — token scopes: `aggregate` (counts, rates, distributions only) vs `case-level` (individual rows with patient_ref). Default new tokens to `aggregate`. The `case-level` tier requires manual approval + a documented business reason.
- [ ] **Hard scope rejection** — when a caller asks something outside the protocol's §1 scope (clinical orders, regions outside SEA, etc.), return a structured `{ refusal: "out_of_scope", reason, suggested_alternatives }` rather than attempting a low-confidence answer.

### Phase 2 — Discoverability & wrapping (Q4 2026)

Goal: the agent shows up when external systems look for it.

- [ ] **`.well-known/agent-card.json`** ([SEP-1960 / A2A spec](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1649)) — name, description, scope, endpoints, auth requirements, pricing, protocol version, citation policy. This is the agent's resume.
- [ ] **MCP server wrap** — `@modelcontextprotocol/sdk`, expose the existing `executeAgent` actions as MCP tools. Hosted at `mcp.sosphd.tourist-sos.com` or similar. One binary, both REST + MCP transports.
- [ ] **OpenAPI / JSON Schema** — full schemas for every action's input/output, derived from the existing zod schemas. Published at `/api/openapi.json`.
- [ ] **Registry submission** — submit to mcp.so, Smithery, PulseMCP. Each has its own curation; the agent-card.json makes submission mechanical.
- [ ] **Public capability docs at `/agent`** — human-readable equivalent of agent-card.json. Lives next to `/protocol`.

### Phase 3 — Credentialing (Q4 2026 → Q1 2027)

Goal: claims of expertise are backed by peer review, not just code.

- [ ] **PhD viva / defense** (target Q4 2026)
- [ ] **Paper 1 published** — Measurement Framework. The TTTA/TTGP/TTDC standardization paper. The agent now cites it for any metric question.
- [ ] **Paper 2 published** — Intervention Design. The protocol becomes peer-reviewed. The agent cites it for any coordination question.
- [ ] **Citation harvesting** — when a paper is cited externally, log it. Surface "n academic citations, m operational uses" on the agent card.

### Phase 4 — Monetization (Q1–Q2 2027)

Goal: first paid integration. One named buyer >> ten marketplace listings.

- [ ] **x402 endpoint** — gated routes return HTTP 402 with payment instructions. Per-call pricing: cheap for dashboard lookups (cents), moderate for AI recs (~$0.10), expensive for multi-turn consultations with citations (~$1+).
- [ ] **Pricing tiers** — free aggregate read (rate-limited), metered case-level (per call), subscription (named org, agreed monthly volume).
- [ ] **First paid integration** — target candidates: travel insurance assistance company (AXA Partners / Allianz Worldwide / TrueAssist), evacuation provider (Air Ambulance Worldwide, SkyMed), embassy consular AI tools. One signed contract > a dozen registry listings.

### Phase 5 — Closed loop (Q2–Q3 2027)

Goal: the agent improves on its niche over time, not just answers from a fixed prompt.

- [ ] **Outcome reporting** — `POST /api/v1/outcomes` for external callers: `{ recommendation_id, action_taken, observed_outcome, occurred_at }`. Feeds an outcomes table the eval harness uses.
- [ ] **Eval harness** — curated benchmark cases (n≥200, sampled across corridors, severities, time periods) with known-good answers. Run nightly. Track engine accuracy by corridor / severity / category. Surface a public scoreboard.
- [ ] **Drift detection** — alert when accept rate or accuracy drops >5% week-over-week for any engine_version on any slice.
- [ ] **Engine A/B framework** — parallel `engine_version` runs on the same case, compare downstream acceptance + accuracy. Auto-promote winning variant after N cases at p<0.05.
- [ ] **Prompt evolution loop** — weekly digest of overrides + low-confidence accepts → suggested prompt amendments → human review → versioned engine bump.

---

## 6. Open questions

Decisions we haven't made yet. Revisit when relevant.

- **Hosting**: Vercel for the Next.js app, but does the MCP server live there or somewhere else (Cloudflare Workers, dedicated VPS)? Affects pricing and latency floor.
- **Payment rail**: x402 (Base/Solana USDC) vs traditional Stripe vs both. Crypto-native callers want x402; traditional buyers want invoices.
- **Liability / disclaimer language**: an agent that recommends coordination decisions for medical emergencies is brushing up against medical-device territory. Need legal review before going public — likely an explicit "advisory, not clinical" disclaimer on every receipt + a terms-of-service for service tokens.
- **PHI handling under different jurisdictions**: data originates in Thailand (PDPA), callers may be in EU (GDPR) or US (HIPAA). Aggregate tier sidesteps most of this; case-level tier needs documented DPA per buyer.
- **Naming for the public agent**: "SOSPHD" is the research project. The hireable agent might want a separate brand (e.g. "Tourist SOS Coordination Advisor"). Affects domain choices and marketing.
- **Should the agent ever take action**, not just advise? E.g. "I will call the payer for you." That's an order of magnitude more dangerous and gated. Probably no for v1.

---

## 7. Anti-goals — what we're NOT building

Stay disciplined. These are not in scope.

- A generic travel-medical chatbot for consumers (someone else is building this; we're B2B/B2A)
- A clinical decision support tool (out of scope per protocol §1; we coordinate, we don't diagnose)
- Coverage outside Southeast Asia in v1 (depth > breadth)
- Action-taking (calling payers, dispatching transport) — only advisory
- A subscription product to individual patients

---

## 8. Living log

Update this section when items complete or get reprioritized.

### Done
- 2026-05-18 · Plan drafted (this doc)
- 2026-05-18 · Critical security + race fixes from pre-Codex audit (PR #3)
- 2026-05-18 · pnpm lockfile + CI migration (PR #4 + follow-up branch)

### In progress
- _(nothing yet — next phase awaits explicit greenlight)_

### Abandoned / reconsidered
- _(nothing yet)_

---

## 9. References

Landscape research that informed this doc.

- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP Server Discovery via .well-known/mcp.json (SEP-1649)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127)
- [x402 Payment Protocol — Stripe docs](https://docs.stripe.com/payments/machine/x402)
- [x402 vs Stripe MPP for AI agents (WorkOS, 2026)](https://workos.com/blog/x402-vs-stripe-mpp-how-to-choose-payment-infrastructure-for-ai-agents-and-mcp-tools-in-2026)
- [AI Agent Marketplaces 2026 — Discovery and Distribution](https://www.digitalapplied.com/blog/ai-agent-marketplaces-2026-discovery-distribution)
- [International SOS — AI-supported Assistance](https://www.internationalsos.com/newsroom/press-announcements/ai-supported-assistance-capabilities)
- [G2 2026 AI Search Insight Report](https://learn.g2.com/g2-2026-ai-search-insight-report)
- [MCP 2026 Roadmap](https://a2a-mcp.org/blog/mcp-2026-roadmap)
- [WEF — AI agents could be worth $236B by 2034](https://www.weforum.org/stories/2026/01/ai-agents-trust/)
