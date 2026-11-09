# Implementation Plan: Roblox-NameBot Name Generator

**Branch**: `001-roblox-name-generator` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-roblox-name-generator/spec.md`

## Summary

The user enters a genre and a search budget on a static GitHub Pages site. Because Roblox's
autocomplete and game-search endpoints do not allow browser (CORS) calls, the start button opens a
pre-filled GitHub issue; an Actions workflow (owner-only) runs a dependency-free Node collector
that makes up to 300/1000/2000 autocomplete searches in the five-step expansion order, plus 10
game searches for player counts, while honouring Roblox's advertised rate limits. A pure engine
scores suggestions (rank × breadth weight, game player counts on a log scale), cleans tags, emojis
and filler words, and builds 25 rule-checked names and description keywords. Results are
committed as JSON; the Pages site lists history and shows each result with copy buttons.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules); Node.js 20 in GitHub Actions; current
Chrome/Safari/Firefox on desktop and phone.

**Primary Dependencies**: none at runtime. Node built-ins only (`fetch`, `node:fs`,
`node:test`). GitHub Actions official `actions/checkout`.

**Storage**: JSON files committed to the repository (`web/data/index.json`,
`web/data/runs/*.json`, `web/data/raw/*.json`).

**Testing**: `node --test` with recorded Roblox responses in `tests/fixtures/`.

**Target Platform**: GitHub Pages (static) + GitHub Actions (ubuntu-latest).

**Project Type**: static web app + scheduled-on-demand collector (CLI) sharing one engine.

**Performance Goals**: 1000-search run ≤ 20 min end to end (≈ 11 min of queries at 90/min);
result page interactive in < 3 s on a phone; engine scores 2000 searches in < 2 s.

**Constraints**: Roblox limits — autocomplete 100 per 60 s, game search 4 per s; no secrets in
the page; no build step; pages usable at 360 px.

**Scale/Scope**: one owner, tens to a few hundred saved runs; result file ~30 KB, raw ~0.6 MB.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Roblox data, politely collected | Only public autocomplete + omni-search, no auth; token-bucket throttle below advertised limits, back-off on 429, generic User-Agent; never writes to Roblox. | PASS |
| II. Pure deterministic engine | `src/engine/` has no I/O; collector injects responses; stable tie-breaks; `rescore --check` proves identical output. | PASS |
| III. Zero-install browser use | Static Pages site from repo root, no build; collector on Node built-ins; no third-party libraries. Start uses GitHub's own issue form (no tool login). | PASS |
| IV. Tested naming rules | One test file per rule group (expansion, cleaning, scoring, naming, dedupe), fixture-based. | PASS |
| V. Explainable results | Result page shows top searches with rank and appearances, top games with players, keywords, budget, searches made, status and timestamp. | PASS |
| Tech constraints | Engine/collector/viewer/data/tests in the mandated folders; all weights and word lists in `src/engine/constants.js`; 1000-run ≈ 12 min < 30 min. | PASS |

Post-design re-check (after data model and contracts): still PASS. Note: the viewer's entry
`index.html` sits at the repository root rather than in `web/` so Pages can serve both
`web/` and `src/engine/` without a build; viewer code itself stays in `web/`. This is a
placement detail, not a violation.

## Project Structure

### Documentation (this feature)

```text
specs/001-roblox-name-generator/
├── plan.md              # This file
├── research.md          # Phase 0: endpoints, CORS, trigger, limits, formulas
├── data-model.md        # Phase 1: entities and validation rules
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── result-files.md  # index / result / raw JSON shapes
│   ├── run-trigger.md   # issue form, workflow, collector CLI
│   └── viewer-routes.md # page routes and behaviour
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
index.html                     # viewer entry (Pages root)
styles.css
web/
├── app.js                     # router (#/, #/run/:id), rendering
├── start.js                   # start form → issue link, running list (GitHub issues API)
├── result.js                  # result sections, copy buttons
├── config.js                  # owner, repo, query rates for ETA
└── data/
    ├── index.json
    ├── runs/{runId}.json
    └── raw/{runId}.json
src/
├── engine/
│   ├── constants.js           # weights, budgets, filler words, type words, stem exceptions
│   ├── text.js                # cleanText, tokenize, stem, titleCase, validateGenre
│   ├── expansion.js           # QueryPlanner: steps 1–5, dedupe, budget stop
│   ├── scoring.js             # breadth weight, suggestion/word/game scores, keywords
│   ├── naming.js              # candidate generation, rule checks, near-duplicate removal
│   └── index.js               # score(raw) → result (pure)
└── collector/
    ├── roblox.js              # autocomplete + omni-search clients, throttle, retry
    ├── throttle.js            # token bucket driven by rate-limit headers
    ├── run.js                 # CLI: plan → fetch → score → write files
    ├── store.js               # write run/raw files, merge index.json
    └── rescore.js             # re-score saved raw files (--check)
.github/
├── ISSUE_TEMPLATE/run.yml
└── workflows/namebot.yml
tests/
├── fixtures/                  # recorded responses: forest, horror, tower-defense
├── text.test.js
├── expansion.test.js
├── scoring.test.js
├── naming.test.js
├── engine.test.js             # end-to-end score(raw) on fixtures, determinism
└── collector.test.js          # throttle/retry with fake fetch, store merge
```

**Structure Decision**: single repository with a pure shared engine (`src/engine/`), a Node
collector (`src/collector/`) run by GitHub Actions, and a static viewer (`index.html` + `web/`)
served by GitHub Pages from the repository root. Dependency direction: viewer → engine,
collector → engine; engine depends on nothing.

## Design Notes

- **Expansion (FR-005)**: `QueryPlanner` keeps a `seen` set and five queues. It is driven by the
  collector: `next()` returns the next text; `record(text, suggestions)` feeds results and
  updates running scores so step 5 re-ranks as data arrives. Step 3 is bounded to suggestions
  discovered in steps 1–2 (later ones feed step 5 via scores), which guarantees termination.
- **Name generation (FR-020…026)**: candidates come from (a) top cleaned suggestions that contain
  the genre phrase, normalised to Title Case with the type word moved last, and (b) templates
  `[mod]{0,2} + GENRE + [type]?` and `GENRE + [mod] + [type]?` using the top 40 keyword words
  as modifiers and type words seen in the data. Every candidate passes `validateName()`; then
  sorted by score (tie → alphabetical), near-duplicates removed, first 25 kept.
- **Concurrency**: two simultaneous runs each write their own run files; `store.js` re-reads
  `index.json` after `git pull --rebase` and merges by `runId` before pushing.
- **ETA**: `budget / 90 per min + 2 min`, shown on the running list.

## Complexity Tracking

No constitution violations; table intentionally empty.
