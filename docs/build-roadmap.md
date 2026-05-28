# SOSPHD — Build Roadmap

> The master plan. Companion to [`agent-strategy.md`](./agent-strategy.md) (the long arc) and [`audit-action-plan.md`](./audit-action-plan.md) (the data-layer cleanup).
>
> **What we're building, in three sentences:**
> 1. A finished PhD with defensible, provenance-rich research evidence
> 2. An **AI-native PhD workbench** that's productizable as a template for other PhD candidates in adjacent applied-research fields
> 3. A credentialed, externally-callable agent in the tourist-medical-coordination niche (per the agent strategy doc)
>
> **Built mostly in-house. No slop. Mature tools used as backends where they'd take years to replicate (Pandoc, R/Python, Anthropic Web Search), but the workflow + UI + provenance layer is ours.**

**Last updated**: 2026-05-19
**Owner**: Juan Quiroz Jr.

---

## 1. Three tracks

Each track has its own pace; they sequence with some parallelism.

| Track | Doc | Effort | Status |
|---|---|---|---|
| **A** — Data layer cleanup | [`audit-action-plan.md`](./audit-action-plan.md) | 2-3 weeks | Plan drafted; awaiting Decisions A-D |
| **B** — AI-native PhD workbench | **This doc** | 3-6 months | Designing now |
| **C** — Agent economy / external API | [`agent-strategy.md`](./agent-strategy.md) | 6-12 months (after A+B basics) | Plan drafted |

**Sequencing rule**: Track A's Phase 1-3 must finish before Track B writes start. Track B's foundation (B1) can begin in parallel with Track A's Phase 4-6. Track C waits until Track B's basics are usable (~B2 minimum).

---

## 2. What "AI-native PhD workbench" actually means

Five claims that distinguish it from a folder full of Word docs + Zotero:

1. **The research is captured continuously, not in batches.** Every case decision, every override reason, every metric snapshot has provenance. The dissertation cites the database, not the other way around.
2. **The methodology section writes itself from the code.** When `mapStatus` and `mapPriority` change, the prose describing them auto-updates with a "review needed" flag. The code IS the methods.
3. **Literature is a continuous feed, not a year-1 snapshot.** Weekly cron surfaces new papers in the niche; gaps are re-detected as the field evolves.
4. **The defense is rehearsed against the actual audit trail.** Examiner-mode AI asks "show me how you classified case X" and you point at the provenance row. Not theoretical.
5. **The dissertation is the surface of a queryable research database.** Reviewers can drill into any claim. The PDF is the rendered view; the database is the truth.

Three of these are already partially in place (provenance ✓, agent context ✓, paper-builder drafts ✓). Track B finishes the other two and tightens what exists.

---

## 3. Build-in-house vs use-mature-tool decisions

The "no slop" line means picking the right things to build. Some categories have mature tools where rebuilding is rabbit-hole; others have nothing serviceable for our use case.

### Build in-house (these become the productizable template)

| Capability | Why in-house | Effort |
|---|---|---|
| **Provenance-rich case + recommendation tracking** | Already built; no equivalent exists | Done (Track A finishes it) |
| **Literature library + paper notes** | Zotero is fine for solo use; integration into our UI + AI search agent + gap analysis is the unique value | 2-3 weeks |
| **Citation metadata + inline citations in paper-builder** | Zotero doesn't integrate with our paper-builder; building our own with BibTeX-compatible schema lets us export to Zotero later | 1-2 weeks |
| **Methods-prose auto-generator from code** | Nothing exists. Connects code → docs automatically | 1 week |
| **Viva rehearsal / examiner-mode advisor** | Extension of existing advisor; ~1 day of work for huge value | 1 day |
| **Dissertation compile UI (chapter ordering, ToC, progress)** | Generic enough to template; lightweight wrapper around Pandoc | 1-2 weeks |
| **Defense slide outline generator** | AI prompt + our research context. Renders to Marp markdown | 2-3 days |

### Use mature tools as backends (wrap, don't replace)

| Capability | Tool | How we integrate |
|---|---|---|
| Web search for literature | Anthropic Web Search MCP / OpenAlex / Semantic Scholar API | Our library calls these; we own the cache, ranking, UI |
| Markdown → PDF / LaTeX | Pandoc (server-side) | Our compile UI calls Pandoc; we own the templating |
| Statistical analysis (R/Python) | Sandboxed R kernel (Plumber API) or Python (Jupyter kernel via API) | Our analysis UI sends code → kernel → results; we render |
| Slides backend | Marp (Markdown → HTML/PDF) | We generate Marp markdown; user opens in Marp/VSCode |
| DOI metadata lookup | Crossref API | Direct calls from citation library |
| BibTeX import/export | citation-js / @citation-js/core | Library wrapper; we extend with our schema |

### Explicitly out of scope (use external tools, don't integrate)

| Item | Why |
|---|---|
| Full Word/Google Docs editing | Pandoc + Quarto/Markdown is the AI-native way; Word is for the committee, not for daily work |
| IRB submission workflows | Each university's portal is bespoke; not generalizable |
| ORCID / ProQuest integration | One-time submission; manual is fine |
| Slack/Teams integration | Email/MCP is enough for an AI-native single-user workbench |
| Multi-user collaboration features | This is a solo PhD tool; multi-user is a productization concern (Phase B6) |
| Replacing Zotero entirely | Our citation library is BibTeX-compatible; users can export and use Zotero alongside if they want |

---

## 4. The phases of Track B

Each phase has a concrete deliverable. Sequenced.

### Phase B1 — AI-native foundations (1 week, can parallel Track A Phase 4-6)

The smallest shippable additions that prove the AI-native pattern.

- [ ] **Viva rehearsal mode** on the advisor. Add `mode: "examiner"` to `/api/advisor` with a system prompt that role-plays a skeptical PhD examiner. Uses existing case + metric + provenance context. (~1 day)
- [ ] **Methods-prose generator v1** in paper-builder. Reads tagged functions (`mapStatus`, `mapPriority`, `findEvent`) and emits prose like "Cases were classified into three operational states via the function defined in lib/data/store.ts:31. The mapping was: ..." with hyperlinks. (~2-3 days)
- [ ] **Daily research digest improvements** — beyond current digest, surface deltas ("override rate dropped 2% vs last week"). (~2 days)

**Why first**: short, high-value, and proves the AI-native pattern before bigger investments.

### Phase B2 — Literature module (3-4 weeks)

The biggest gap in the current system (item #2 on the PhD checklist).

- [ ] Schema: `research.papers` table (id, doi, title, authors, year, abstract, journal, our_notes, tags, added_at, last_relevance_check)
- [ ] Schema: `research.paper_references` table for cross-paper citations
- [ ] UI at `/library` — searchable, filterable paper list
- [ ] Add-paper flows: by DOI (Crossref lookup auto-fills), by manual entry, by BibTeX paste
- [ ] **Web search agent** — feeds a topic + our thesis, queries OpenAlex/Semantic Scholar, returns suggested papers to add. Calls Anthropic Web Search MCP for context outside academic databases
- [ ] **Per-paper AI summarization** — abstract + our notes → AI generates "why this matters for our thesis" paragraph
- [ ] **Gap analysis agent** — compares current library against thesis claim; surfaces "no coverage of stepped-wedge in tourist EMS; here are 3 papers to add"
- [ ] **Weekly cron** that re-runs gap analysis, posts findings to a digest

**Deliverable**: 50-200 papers in library, AI-summarized, with clear coverage map. Lit review chapter can be drafted from this.

### Phase B3 — Citations + Methods integration (2-3 weeks)

Wires the literature module into the paper-builder.

- [ ] Schema: `research.citation_slots` for inline citation markers in drafts
- [ ] Paper-builder inline citation insert UI — `@type` to search papers, insert as `[cite:paper_id]`
- [ ] **Citation resolver** that converts `[cite:paper_id]` → formatted citation per style (APA/Vancouver/Chicago via citation-js)
- [ ] **Bibliography generator** for any doc with citations
- [ ] **Citation validator** — flags `[cite:...]` slots referencing deleted papers
- [ ] **Methods-prose generator v2** — reads existing methods doc, detects code changes, flags stale prose for re-generation
- [ ] **Citation hallucination check** — AI-drafted prose that mentions "Smith (2023)" without a `[cite:...]` slot gets flagged

**Deliverable**: A paper-builder draft can be exported with a fully-resolved bibliography. No fake citations.

### Phase B4 — Dissertation compile (2-3 weeks)

Turning chapters into a single submittable document.

- [ ] Schema: `research.dissertation` (id, title, chapter_order, template, status)
- [ ] Chapter linking — assign existing docs to dissertation chapters
- [ ] UI at `/dissertation` — drag-reorder chapters, view word counts, see ToC
- [ ] **Pandoc backend** — server-side Pandoc invocation. Markdown chapters + university LaTeX template → PDF
- [ ] University template seeds — at least one (your institution's); structure to add more
- [ ] **Front/back matter generators** — title page, abstract, acknowledgments, ToC, bibliography
- [ ] **Word-count tracking** per chapter + dissertation total
- [ ] **Cross-reference resolution** — `[see:Chapter3.section2]` resolves at compile time

**Deliverable**: One-click "Compile dissertation" → PDF.

### Phase B5 — Defense prep (1-2 weeks)

The viva-mode advisor was a 1-day teaser; this phase is the full defense workbench.

- [ ] **Weak-points analyzer** — AI reads the dissertation, scores each section on "how hard would this be to defend?", surfaces a ranked list of likely examiner questions
- [ ] **Mock-defense rehearsal mode** — multi-turn examiner session that adapts difficulty based on your answers
- [ ] **Slide outline generator** — Marp markdown from chapter highlights + figures
- [ ] **"Things you'll need to know cold" study cards** — auto-generated from the audit trail (specific case IDs, key statistics, methodology decisions)
- [ ] **Committee tracker** — light schema for who's on the committee, their expertise, papers of theirs you've cited

**Deliverable**: Walking into the viva, you've rehearsed against every weak point your AI examiner could find.

### Phase B6 — Template extraction (the productization phase, ~ongoing)

Once B1-B5 are working for your PhD, extract the generic parts.

- [ ] Decision: open-source vs SaaS vs paid template?
- [ ] Generic-vs-specific schema split. Domain-specific stuff (cases, recs, protocols) stays in SOSPHD; generic PhD-workbench stuff (papers, citations, dissertations, defense, advisor) becomes a reusable package
- [ ] One adjacent-domain pilot (find a friendly PhD candidate in a different applied-research field to test the template)
- [ ] If pilot succeeds: README, docs, install flow, demo deployment

**Effort**: Variable. Earliest start: after B5. Could be PhD Year 2 work or PhD-and-beyond.

---

## 5. Sequencing across all three tracks

A visualization of the rough order:

```
Weeks 1-3:     Track A — Data layer cleanup (audit-action-plan Phases 1-3)
Weeks 4-6:     Track A — Measurement integrity + perf (Phases 4-5)
                ⤷ Track B1 starts in parallel (foundations)
Weeks 7-10:    Track B2 — Literature module
Weeks 11-13:   Track B3 — Citations + methods integration
Weeks 14-17:   Track B4 — Dissertation compile
Weeks 18-19:   Track B5 — Defense prep
Weeks 20+:     Track C — Agent economy (per agent-strategy.md)
                ⤷ Track B6 — Template extraction
```

That's roughly **5 months to "AI-native PhD workbench v1" + Track C starts**.

Track A on the critical path; Track C dependent on Track A + the protocol being credibly published.

**Adjustments to expect**: Paper deadlines compress; field discoveries pull priorities. Re-rank between phases as needed.

---

## 6. The agent-economy track (Track C — already documented)

Per [`agent-strategy.md`](./agent-strategy.md): once Track A + B basics are landed and Paper 1/Paper 2 are submitted, Track C kicks in:

- Service tokens (external agent auth)
- Provenance receipts (response shape with citations)
- PHI redaction tier (aggregate-only by default)
- `.well-known/agent-card.json` (MCP discovery)
- MCP server wrap
- First paid integration (insurance / evacuation provider)

The Track B work makes Track C credible — an externally-callable agent that's grounded in a peer-reviewed protocol AND backed by a productizable methodology has more authority than any current alternative.

---

## 7. Open questions (need owner input as we go)

- **Citation style for the dissertation** — APA, Vancouver, IEEE, university-specific? Affects citation-js config.
- **University template** — does your institution provide a LaTeX template? If yes, we wrap it. If no, we build one from style guide.
- **Statistical analysis kernel** — R or Python? Or both? R is conventional for health-services research; Python is easier to embed.
- **Open-source the template?** — affects whether we add multi-tenant support in B6.
- **What's the second PhD pilot for B6?** — adjacent applied research, single-author, supportive supervisor. Not critical for years.

---

## 8. Anti-goals (so we stay focused)

These are NOT what we're building, no matter how tempting:

- A replacement for Zotero / Mendeley / EndNote — we have a citation library that's BibTeX-compatible; that's enough
- A replacement for Word / Google Docs — Pandoc + markdown handles compile; for committee comments, use whatever the committee uses
- A multi-user collaboration tool — solo PhD now; multi-user is Phase B6 productization concern
- A general-purpose AI chat (we have it, scoped to research; not a ChatGPT competitor)
- A real-time operational ops platform — that's SOSCOMMAND's job; we read-only consume their data
- A research grants platform — out of scope

---

## 9. How this ties to your stated goals

- **"Help me get a PhD"** → B2 (literature), B3 (citations), B4 (compile), B5 (defense) are the chapter-production side of the PhD checklist. Combined with Track A's data-layer integrity, all 10 checklist items are covered with AI assistance.
- **"Productized template for other PhDs"** → B6 is the explicit productization phase. Built on top of B1-B5 working for one real PhD (yours).
- **"Make AI smart and ready"** → B1 (viva mode, methods generator) + Track C (agent economy) are the direct AI-native plays.
- **"In-house, no slop"** → §3's build-vs-buy table is the discipline. Build the workflow + provenance + UI; wrap mature backends; don't try to replace Zotero or Word.
- **"Human in the loop"** → AI drafts; you decide. Every B-phase tool surfaces AI output as proposals for human review, never auto-commits. Same pattern as the recommendation engine you already built.

---

## 10. Concrete next step

Two things need to happen:

1. **Greenlight Track A** — pick your answers to Decisions A-D in `audit-action-plan.md`. Without those, nothing else moves.
2. **Greenlight Track B start** — explicit yes on the B1 work starting alongside Track A's Phase 4-6.

After that, I'll start with B1's three items (viva mode, methods-prose generator v1, digest improvements) in parallel with Track A wrap-up.

---

## 11. Living log

Update as phases complete or scope shifts.

| Date | Track / Phase | Status | Notes |
|---|---|---|---|
| 2026-05-19 | — | Roadmap drafted | Awaiting greenlight on Track A decisions + Track B start |
