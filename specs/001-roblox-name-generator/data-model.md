# Data Model: Roblox-NameBot Name Generator

All stored data is JSON committed under `web/data/`. Exact file shapes are in
[contracts/](contracts/). This file describes entities, rules and state.

## RunRequest

Input that starts a run (from the issue form or `workflow_dispatch`).

| Field | Type | Rules |
|---|---|---|
| genre | string | trimmed, lower-cased for searching; 1–50 chars; `[a-z0-9 ]` after cleaning; at least one letter (FR-001) |
| budget | int | one of 300, 1000, 2000; default 1000 |
| requestedBy | string | GitHub login; must be the repo owner (R4) |
| issueNumber | int? | present when started from an issue |

## Run

| Field | Type | Notes |
|---|---|---|
| runId | string | `yyyymmdd-hhmmss-{genre-slug}` (UTC), unique |
| genre | string | as entered, cleaned |
| genreWords | string[] | genre split on spaces |
| budget | int | 300 / 1000 / 2000 |
| searchesMade | int | autocomplete calls that returned data |
| gameSearchesMade | int | 0–10 |
| status | enum | see state machine |
| stopReason | enum | `budget`, `exhausted`, `rate-limited`, `error` |
| startedAt / finishedAt | ISO-8601 UTC | |
| engineVersion | string | version of scoring rules used, for re-scoring |

**State machine**: `requested` (open issue) → `running` → `complete` | `partial` | `failed`.
`partial` = stopped by repeated Roblox errors but ≥ 1 search; saved and shown with a warning.
`failed` = invalid request or no data; nothing saved to the index, issue gets an error comment.

## Search (raw)

| Field | Type | Notes |
|---|---|---|
| text | string | lower-case text sent to autocomplete |
| step | 1–5 | expansion step (FR-005) |
| order | int | 0-based position in the run |
| weight | number | breadth weight `w(q)` (R7) |
| suggestions | string[] | ≤ 10, Roblox's order, raw text |

Rule: `text` is unique within a run (FR-005 "skip already searched").

## GameHit (raw)

| Field | Type | Notes |
|---|---|---|
| universeId | int | dedupe key |
| name | string | raw, with tags |
| cleanName | string | after cleaning (FR-013) |
| playerCount | int | at collection time |
| url | string | `https://www.roblox.com` + canonicalUrlPath |
| foundBy | string | the search text that found it |

Rules: sponsored results excluded; first 10 games per game search; deduplicated by universeId
across the 10 game searches.

## SuggestionScore (derived)

| Field | Type | Notes |
|---|---|---|
| text | string | cleaned suggestion |
| score | number | Σ w(q)·rankPts(r) (R7) |
| appearances | int | number of searches it appeared in |
| bestRank | 1–10 | |

## Keyword (derived)

| Field | Type | Notes |
|---|---|---|
| text | string | one word or two-word phrase, not filler, not a bare stopword |
| score | number | word score incl. game weight |

Top 30 kept; genre words are included first.

## NameSuggestion (derived)

| Field | Type | Notes |
|---|---|---|
| position | 1–25 | |
| name | string | Title Case |
| score | number | name score (R7) |
| words | string[] | |
| supportedBy | string[] | up to 3 suggestion texts that contributed the most |

Validation (all MUST hold, FR-021…FR-026):
1. 2 ≤ words ≤ 5 and `name.length ≤ 50`.
2. contains the genre words as one contiguous phrase in the user's order (stem match).
3. ≤ 1 game-type word, and if present it is the last word (or the genre phrase ends the name
   when the genre ends in a type word).
4. no two words share a stem.
5. every word comes from the genre, a cleaned suggestion or a cleaned top-game name.
6. not near-identical to a higher-scored name (R8).

## RunIndexEntry

`runId`, `genre`, `budget`, `searchesMade`, `status`, `finishedAt`, `topName` — one per saved run,
newest first.

## Relationships

`Run 1 — * Search`, `Run 1 — * GameHit`; `SuggestionScore`, `Keyword`, `NameSuggestion` are
computed from a Run's Searches and GameHits by the engine and stored in the run's result file.
