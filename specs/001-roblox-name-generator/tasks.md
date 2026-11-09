# Tasks: Roblox-NameBot Name Generator

**Input**: Design documents from `/specs/001-roblox-name-generator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: included — Constitution Principle IV requires a test for every scoring and naming
rule. Tests use recorded fixtures only, never live Roblox calls.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 = name suggestions, US2 = evidence on the result page, US3 = history

## Path Conventions

Engine `src/engine/`, collector `src/collector/`, viewer `index.html` + `web/`, data
`web/data/`, tests `tests/`, GitHub config `.github/` (see plan.md).

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create folder layout from plan.md and a minimal `package.json` (`"type": "module"`, `"scripts": {"test": "node --test tests/"}`, no dependencies) in package.json
- [x] T002 [P] Add `.gitignore` (tmp-data/, node_modules/) and `.editorconfig` in .gitignore
- [x] T003 [P] Record Roblox fixtures for `forest`, `horror`, `tower defense`: autocomplete responses for every query a 300-budget plan makes and omni-search responses for the 10 game searches, with a one-off script in tools/record-fixtures.js writing tests/fixtures/{genre}/
- [x] T004 [P] Create empty data files `web/data/index.json` (`{"schemaVersion":1,"runs":[]}`), `web/data/runs/.gitkeep`, `web/data/raw/.gitkeep`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared text handling and constants used by expansion, scoring, naming and the viewer.

- [x] T005 Define all tunables in src/engine/constants.js: budgets `[300, 1000, 2000]` default 1000, `BREADTH_DECAY = 0.6`, `GAME_WEIGHT`, `PHRASE_BONUS`, `TYPE_BONUS`, `MAX_NAMES = 25`, `MAX_NAME_CHARS = 50`, name words 2–5, filler words (the, of, a, an, and, in, on, to, for, with, game, games, roblox, new, best, update, …), game-type words (Simulator, Tycoon, Obby, RP, Roleplay, Survival, Defense, Battlegrounds, Clicker, Incremental, Racing, Shooter, Story, Escape, Parkour), stem exceptions (obby, rpg, bus, …), rate limits (autocomplete 90/60 s, game search 3/s), `ENGINE_VERSION = "1.0.0"`
- [x] T006 [P] Write tests for text helpers in tests/text.test.js: tag removal (`[UPDATE]`, `(NEW)`, `[✨CHANGES]`, `🎃EVENT`), emoji/symbol removal, version numbers (`v2`, `2.0`), filler removal, case-insensitive tokenize, stem pairs (animal/animals, berry/berries, wolf/wolves, box/boxes, bus≠bu, obby), Title Case incl. `RP`, genre validation ("1–50 chars; `[a-z0-9 ]` after cleaning; at least one letter")
- [x] T007 Implement `cleanText`, `tokenize`, `stem`, `sameStem`, `titleCase`, `validateGenre`, `isTypeWord`, `isFiller` in src/engine/text.js until tests/text.test.js passes

**Checkpoint**: text layer ready; engine modules can be built.

---

## Phase 3: User Story 1 - Get name suggestions for a genre (Priority: P1) 🎯 MVP

**Goal**: entering a genre and budget produces a saved result with 25 rule-abiding names, each copyable.

**Independent Test**: run the collector for "forest" at 300 (or the fixture pipeline), open `#/run/{id}`, check 25 names obey FR-021…FR-026 and the copy button copies the exact name.

### Tests for User Story 1

- [x] T008 [P] [US1] Expansion order tests in tests/expansion.test.js: step 1 genre; step 2 `genre a`…`genre z`; step 3 suggestions from steps 1–2 in discovery order; step 4 `genre aa`…`genre zz`; step 5 top-scored searches + letter, re-ranked as data arrives; never repeats a text; stops at budget or when queues are empty (`stopReason` `budget` / `exhausted`)
- [x] T009 [P] [US1] Scoring tests in tests/scoring.test.js: `rankPts(1)=1.0`, `rankPts(10)=0.1`; more appearances → higher score; breadth weights `forest`1.0 > `forest a`≈0.77 > `forest animals`0.6 > `forest animals qx`≈0.46; game words weighted by `log10(1+players)`; one 1M-player game does not outrank 5 games of 10k; cleaned texts merged before scoring
- [x] T010 [P] [US1] Naming rule tests in tests/naming.test.js: 2–5 words; ≤ 50 chars; all genre words present and contiguous in user order ("Anime Tower Defense" ok, "Tower Anime Defense" rejected); ≤ 1 type word and it is last; genre ending in a type word ends the name; no repeated word or singular/plural pair ("Animal Animals" rejected); near-duplicates (same words in any order or number) removed keeping higher score; words only from genre/suggestions/game names; deterministic order with ties alphabetical; fewer than 25 → `namesNote` set
- [x] T011 [P] [US1] End-to-end engine tests in tests/engine.test.js: `score(raw)` on each fixture returns ≤ 25 names all passing `validateName`, and running it twice gives deep-equal output (SC-006)
- [x] T012 [P] [US1] Collector tests in tests/collector.test.js with a fake fetch: throttle never exceeds configured rate; 429 → exponential back-off 2 s→60 s, ≤ 6 retries; 10 consecutive failures → `partial`; sponsored games skipped; first 10 games per game search; `index.json` merge keeps entries from a concurrent run

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement `QueryPlanner` (`next()`, `record(text, suggestions)`, `done`, `stopReason`) for the five steps in src/engine/expansion.js until T008 passes
- [x] T014 [P] [US1] Implement `breadthWeight`, `rankPts`, suggestion aggregation (score, appearances, bestRank), word scores and game weights in src/engine/scoring.js until T009 passes
- [x] T015 [US1] Implement candidate generation (suggestion-derived + templates `[mod]{0,2} GENRE [type]?`, `GENRE [mod] [type]?` from top 40 keyword words), `validateName`, near-duplicate removal and top-25 selection in src/engine/naming.js until T010 passes
- [x] T016 [US1] Implement pure `score(raw)` → result object per contracts/result-files.md (`names`, `namesNote`, run header fields) in src/engine/index.js until T011 passes
- [x] T017 [P] [US1] Implement token bucket that also honours `x-ratelimit-remaining`/`x-ratelimit-reset` in src/collector/throttle.js
- [x] T018 [US1] Implement Roblox clients `getSuggestions(prefix)` (games-autocomplete v1, top 10 `searchQuery`) and `searchGames(query)` (omni-search, non-sponsored `Game` entries, first 10, with `playerCount`, `universeId`, `canonicalUrlPath`) with retry/back-off and `User-Agent: Roblox-NameBot/1.0` in src/collector/roblox.js until T012 passes
- [x] T019 [US1] Implement store: write `web/data/runs/{runId}.json` and `web/data/raw/{runId}.json`, merge `web/data/index.json` by `runId` newest first (only `complete`/`partial`) in src/collector/store.js
- [x] T020 [US1] Implement CLI `node src/collector/run.js --genre --budget [--out] [--issue]`: validate genre ("1–50 chars"), drive QueryPlanner, run 10 game searches (genre + 9 top searches, outside budget), call `score`, save, progress log every 50 searches, exit 0/2/1 per contracts/run-trigger.md in src/collector/run.js
- [x] T021 [P] [US1] Create issue form with `genre` (required, max 50) and `budget` dropdown (300 / 1000 default / 2000), label `namebot-run` in .github/ISSUE_TEMPLATE/run.yml
- [x] T022 [US1] Create workflow: `issues: opened` (label `namebot-run` and `author_association == 'OWNER'`) + `workflow_dispatch`; parse issue body; run collector; commit `web/data/**` with pull --rebase retry ×3; comment result link and close issue; on failure comment reason + label `namebot-failed`; permissions `contents: write`, `issues: write`; timeout 45 min in .github/workflows/namebot.yml
- [x] T023 [P] [US1] Create viewer shell: `index.html` (viewport meta, module script `web/app.js`), `styles.css` (360 px+ layout, light/dark), hash router for `#/` and `#/run/{runId}`, "Result not found" view in web/app.js
- [x] T024 [P] [US1] Create config with owner `rynnakkosika`, repo `roblox-namebot`, autocomplete rate for ETA in web/config.js
- [x] T025 [US1] Implement start form: genre input validated with `validateGenre` from src/engine/text.js, budget select (default 1000), "Start run" opens the pre-filled issue URL from contracts/run-trigger.md, shows ETA `budget / 90 + 2` min in web/start.js
- [x] T026 [US1] Implement names section: 25 names with a copy button each (Clipboard API, selectable-text fallback, "Copied" for 1.5 s), `namesNote` when fewer, header with genre/budget/searches/status/date in web/result.js

**Checkpoint**: a run started from the page produces a result with 25 copyable names (MVP).

---

## Phase 4: User Story 2 - See why the names were suggested (Priority: P2)

**Goal**: result page shows keywords, top searches and top games with player counts.

**Independent Test**: open a fixture-based result; four sections present; searches ordered by score with rank and appearances; games sorted by players with links.

### Tests for User Story 2

- [x] T027 [P] [US2] Tests in tests/scoring.test.js for keywords (≤ 30, genre words first, no filler, two-word phrases allowed), `topSearches` (20 rows, rank, appearances, bestRank) and `topGames` (deduplicated by universeId, sorted by playerCount desc, ≤ 30, cleaned name + raw name)

### Implementation for User Story 2

- [x] T028 [US2] Add `keywords`, `topSearches`, `topGames` to `score(raw)` output in src/engine/scoring.js and src/engine/index.js until T027 passes
- [ ] T029 [US2] Render keywords with copy-all (comma-separated), top searches table (rank, text, appearances) and top games list (name, player count formatted, Roblox link, found-by search) in web/result.js
- [ ] T030 [P] [US2] Show partial-run warning and data age ("collected 3 days ago") in the result header in web/result.js

**Checkpoint**: US1 + US2 give names plus the evidence behind them.

---

## Phase 5: User Story 3 - Browse earlier genres on any device (Priority: P3)

**Goal**: history of all runs, running runs with ETA, every result linkable.

**Independent Test**: with two saved runs, open the page on a 360 px phone: both listed newest first, each opens its result; a re-run of the same genre is a separate entry.

### Tests for User Story 3

- [ ] T031 [P] [US3] Test that saving a second run with the same genre adds a new `runId` entry and keeps the old one, in tests/collector.test.js

### Implementation for User Story 3

- [x] T032 [US3] Render history from `web/data/index.json` (genre, date, budget, status, top name, newest first) on `#/` in web/start.js
- [ ] T033 [US3] Fetch open `namebot-run` issues from `api.github.com/repos/{owner}/{repo}/issues` and show them as running with ETA; poll every 60 s while any is open; hide the section silently if the call fails in web/start.js
- [ ] T034 [US3] Add `rescore.js --run <id> | --all [--check]` that re-scores raw files and reports "identical" or the diff in src/collector/rescore.js

**Checkpoint**: all three stories work independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T035 [P] README with what the tool does, the phone link, how to start a run, Pages/Actions setup and the scoring rules in README.md
- [ ] T036 [P] Rule-compliance sweep: script that checks every saved result's names against `validateName` (SC-003) in tools/check-results.js
- [ ] T037 Live validation per quickstart.md (local 300 run, re-score check, end-to-end from phone, non-owner issue skipped) and record timings against SC-002 in specs/001-roblox-name-generator/quickstart.md
- [ ] T038 Tune constants in src/engine/constants.js after reviewing names for 10 genres; update affected tests in the same change

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → user stories.
- US1 (Phase 3) is the MVP and must finish first: US2 extends `score()` output and the result page, US3 reads files US1 writes.
- Polish after the stories you want to ship.

### User Story Dependencies

- **US1**: needs Phase 2 only.
- **US2**: needs T016 (engine output) and T026 (result page) from US1.
- **US3**: needs T019 (store/index) and T023/T025 (viewer, start page) from US1; independent of US2.

### Within Each User Story

- Tests first and failing, then implementation until they pass.
- Engine (expansion, scoring, naming, index) before collector `run.js`; collector before workflow.
- Viewer shell before sections.

### Parallel Opportunities

- T002, T003, T004 together after T001.
- T008–T012 (all US1 tests) together.
- T013 and T014 together; T017, T021, T023, T024 alongside engine work.
- US2 and US3 in parallel once US1 is done.

## Parallel Example: User Story 1

```text
# All US1 tests at once:
T008 tests/expansion.test.js
T009 tests/scoring.test.js
T010 tests/naming.test.js
T011 tests/engine.test.js
T012 tests/collector.test.js

# Independent implementation files at once:
T013 src/engine/expansion.js
T014 src/engine/scoring.js
T017 src/collector/throttle.js
T021 .github/ISSUE_TEMPLATE/run.yml
T023 index.html + styles.css + web/app.js
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phases 1–2.
2. Phase 3 (US1): engine → collector → workflow → start form + names.
3. Stop and validate: local 300-search run for "forest", then one run from the phone.

### Incremental Delivery

1. MVP → names on the phone.
2. + US2 → evidence and description keywords.
3. + US3 → history and running list.
4. Polish → README, compliance sweep, tuning.

### Parallel Team Strategy

Single developer; the parallel markers mainly help when splitting work between agent sessions.

## Notes

- 38 tasks: Setup 4, Foundational 3, US1 19, US2 4, US3 4, Polish 4.
- Live Roblox calls happen only in T003 (fixture recording) and T037 (manual validation).
- Commit after each task or logical group.
