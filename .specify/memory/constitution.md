<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: all placeholders replaced (initial ratification)
- Added principles: I. Roblox Data, Politely Collected; II. Pure Deterministic Engine;
  III. Zero-Install Browser Use; IV. Tested Naming Rules; V. Explainable Results
- Added sections: Technical Constraints, Development Workflow
- Removed sections: none
- Templates reviewed: plan-template.md (Constitution Check reads this file at runtime),
  spec-template.md, tasks-template.md: no changes needed
- Deferred TODOs: none
-->

# Roblox-NameBot Constitution

## Core Principles

### I. Roblox Data, Politely Collected

Every name suggestion MUST be derived from Roblox's own public search data: the search
autocomplete suggestions and the public game search results (names and current player counts).
The collector MUST use only public, unauthenticated endpoints, MUST stay under the rate limits
Roblox advertises in its response headers (back off and retry on HTTP 429), and MUST identify
itself with a generic client name. No Roblox account, cookie or login is ever used, and the tool
never changes anything on Roblox.

Rationale: the value of the tool is that the names reflect what players actually type. Staying
within published limits keeps the tool working and within the terms.

### II. Pure Deterministic Engine

Search expansion order, scoring, name cleaning and name generation MUST live in a pure engine
with no network, file system, DOM or clock access. Given the same collected search data and the
same settings, the engine MUST produce the same keywords and the same 25 names in the same order.
Network access lives only in the collector, which feeds the engine raw responses.

Rationale: scoring and naming rules are the product. Keeping them pure makes them testable from
recorded fixtures and lets results be recomputed without re-querying Roblox.

### III. Zero-Install Browser Use

The result viewer MUST be a static site served from GitHub Pages that works in a current desktop
or phone browser (360 px wide and up) with no install, build step, server or login to the tool.
The collector runs in GitHub Actions on Node.js with no third-party runtime dependencies. Third-
party runtime libraries are not allowed in either part.

Rationale: the user opens a link on a phone like their other GitHub projects. Roblox's endpoints
do not allow cross-origin browser calls, so the queries run in GitHub's runner, which the user
already has, instead of a self-hosted proxy.

### IV. Tested Naming Rules

Every scoring rule and every name rule in the spec (position and frequency weighting, broad-query
weighting, player-count weighting, tag/emoji/filler cleaning, word count, 50-character limit,
genre words kept together, one game-type word last, no repeated word or singular/plural pair,
near-duplicate removal) MUST have at least one automated test. A rule change MUST update its
test in the same change.

Rationale: the rules interact; a silent regression produces names that look plausible but break
the stated rules.

### V. Explainable Results

The result page MUST show the evidence behind the names: the top searches with their ranks and
how often they appeared, the top games with player counts, and the keywords used. Each saved
result MUST record the genre, the query budget, the number of queries actually made and the date
it was collected.

Rationale: the user decides the final name; they need to see why a name was suggested and how
fresh the data is.

## Technical Constraints

- Language: modern JavaScript as ES modules, HTML and CSS only. The engine modules are shared
  unchanged by the Node collector and the browser.
- Layout: engine under `src/engine/`, collector under `src/collector/`, viewer under `web/`,
  stored results under `web/data/`, tests under `tests/`. The viewer and collector may use the
  engine, never the reverse.
- Tuning constants (weights, budgets, filler words, game-type words) live in one file,
  `src/engine/constants.js`, so tuning never touches logic.
- Stored results are plain JSON committed to the repository; the viewer reads them read-only.
- A 1000-query run MUST finish within 30 minutes of runner time.

## Development Workflow

- Features follow Spec Kit: constitution → specify → plan → tasks → implement.
- Tests run with `node --test` and use recorded Roblox responses as fixtures, never live calls.
  All tests MUST pass before a change is done.
- A live collector run against Roblox is a manual check, not part of the automated test suite.

## Governance

This constitution supersedes other project practices. Amendments are made by editing this file,
bumping the version (MAJOR for removed or redefined principles, MINOR for new principles or
sections, PATCH for wording) and updating the Last Amended date. Every plan MUST include a
Constitution Check against these principles, and any violation MUST be justified in that plan's
Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-11-09 | **Last Amended**: 2026-11-09
