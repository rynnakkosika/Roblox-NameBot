# Research: Roblox-NameBot Name Generator

All findings below were checked against live Roblox endpoints on 2026-11-09.

## R1. Where the autocomplete suggestions come from

- **Decision**: `GET https://apis.roblox.com/games-autocomplete/v1/get-suggestion/{prefix}`
  (prefix URL-encoded, e.g. `tower%20defense%20a`).
- **Findings**: unauthenticated, returns `{ prefix, algorithmName, entries[] }` with exactly the
  10 entries the Roblox search box shows; each entry has `type` (1 = search text),
  `searchQuery`, `universeId` (0 for plain searches). Response headers advertise
  `x-ratelimit-limit: 100, 100;w=60` (100 requests per 60 s) and `cache-control: max-age=28800`.
- **Rationale**: it is the same list players see, so it reflects real search demand (FR-004).
- **Alternatives considered**: scraping the website HTML (fragile, heavier); third-party Roblox
  trend sites (not Roblox's own data, violates Principle I).

## R2. Where top games and player counts come from

- **Decision**: `GET https://apis.roblox.com/search-api/omni-search?searchQuery={q}&pageType=all&sessionId={uuid}`
  and keep the first 10 entries with `contentGroupType == "Game"` and `isSponsored == false`.
- **Findings**: unauthenticated; each game has `name`, `playerCount` (live), `universeId`,
  `rootPlaceId`, `canonicalUrlPath`, `totalUpVotes`, `isSponsored`. Rate limit header
  `4, 4;w=1` (4 per second). Names contain tags and emojis (`[✨CHANGES] Toilet Tower Defense`),
  confirming the cleaning rule (FR-013).
- **Rationale**: one call per search returns names and current players together (FR-007).
- **Alternatives considered**: `games.roblox.com/v1/games?universeIds=` for player counts —
  an extra call per batch with no added value since omni-search already includes `playerCount`.

## R3. Running the searches: browser vs. server (CORS)

- **Decision**: run the collector in **GitHub Actions** (Node.js 20+) and commit results as JSON
  to the repository; the viewer is a static **GitHub Pages** site that reads those files.
- **Findings**: neither endpoint returns `Access-Control-Allow-Origin`, so a page on
  `*.github.io` cannot call them from the browser. A 1000-query run takes ~11 minutes at the
  advertised limit, too long for a browser tab on a phone anyway.
- **Rationale**: the user already hosts projects on GitHub and opens them as links on the phone
  (Principle III). Actions needs no server, account or secret beyond the repo's built-in
  `GITHUB_TOKEN`. Runs survive closing the phone's browser.
- **Alternatives considered**: Cloudflare Worker / Vercel proxy (new account and service to
  maintain, phone tab must stay open for ~11 min); public CORS proxies (unreliable, would send
  traffic through a third party, likely blocked by Roblox).

## R4. Starting a run from the phone without secrets in the page

- **Decision**: the start form opens a pre-filled **GitHub issue form**
  (`/issues/new?template=run.yml&genre=…&budget=…`). Opening the issue (label `namebot-run`)
  triggers the workflow, which only proceeds when `author_association` is `OWNER` or `COLLABORATOR` (collaborators were allowed after the MVP). The workflow
  comments with the result link and closes the issue. `workflow_dispatch` with the same inputs is
  kept as a second way to start from the Actions tab.
- **Rationale**: the user is signed in to GitHub on phone and desktop; no token is stored in the
  public page; issues double as a run log; strangers cannot spend the owner's Actions minutes.
- **Alternatives considered**: calling the `workflow_dispatch` API from the page (needs a
  personal access token in the browser — rejected); repository_dispatch via a proxy (needs a
  server).

## R5. Showing "running" state

- **Decision**: the viewer fetches open issues labelled `namebot-run` from the public, CORS-enabled
  `api.github.com/repos/{owner}/{repo}/issues` endpoint (unauthenticated, 60 requests/hour per
  IP) and lists them as running, with an ETA from budget ÷ query rate. Polls every 60 s while any
  run is open.
- **Alternatives considered**: a status JSON committed at start (extra commits and Pages
  rebuilds per run).

## R6. Staying within Roblox limits

- **Decision**: a token-bucket throttle per endpoint, configured from constants (autocomplete 90
  per 60 s, game search 3 per s) and adjusted from `x-ratelimit-remaining/reset` headers. On 429
  or 5xx: exponential back-off 2 s → 60 s, up to 6 retries per request; after 10 consecutive
  failures the run stops and saves as `partial` (FR-008, SC-007). Requests run sequentially
  with a generic `User-Agent: Roblox-NameBot/1.0`.
- **Expected duration**: 300 ≈ 3.5 min, 1000 ≈ 11 min, 2000 ≈ 22 min plus ~1 min runner start
  and ~1 min Pages deploy.

## R7. Scoring formulas (tunable in `src/engine/constants.js`)

- **Rank points**: `rankPts(r) = (11 − r) / 10` → rank 1 = 1.0, rank 10 = 0.1 (FR-010).
- **Search breadth weight**: `w(q) = BREADTH_DECAY ^ extra(q)` with `BREADTH_DECAY = 0.6`, where
  `extra` counts words beyond the genre and a trailing 1–2 letter fragment counts 0.5:
  `forest` 1.0, `forest a` 0.77, `forest animals` 0.6, `forest animals qx` 0.46 (FR-011).
- **Suggestion score**: `Σ w(q) · rankPts(r)` over every search where it appeared; appearance
  count kept separately for display.
- **Game weight**: `GAME_WEIGHT · log10(1 + playerCount)` per game, added to every cleaned word
  and two-word phrase in its name (FR-012, diminishing returns via log).
- **Word score**: each suggestion's score is shared among its non-filler words; plus game weight.
- **Name score**: sum of its non-genre word scores + `PHRASE_BONUS ×` score of the exact phrase if
  it is itself a suggestion + `TYPE_BONUS ×` type-word score; ties broken alphabetically for
  determinism (Principle II, SC-006).

## R8. Singular/plural and near-duplicates

- **Decision**: a small rule-based stemmer (`ies→y`, `ves→f`, `es` after s/x/z/ch/sh, final `s`
  except `ss`/`us`/`is`) plus an exception list in constants (e.g. `obby`, `rpg`, `bus`).
  Near-duplicate key = sorted set of stems (filler words never reach names); names with the same
  key are duplicates and the higher score is kept (FR-024, FR-025). A Jaccard ≥ 0.75 rule was
  dropped during implementation: it treated "Anime Tower Defense" and "Anime Tower Defense
  Simulator" as the same name, which the spec does not ask for.
- **Alternatives considered**: Porter stemmer (over-stems game words like "Simulator" → "simul";
  bigger code).

## R9. Testing

- **Decision**: `node --test` over `tests/`, with recorded autocomplete and omni-search
  responses for three genres (`forest`, `horror`, `tower defense`) under `tests/fixtures/`.
  The collector's fetch is injected so the expansion order is tested without network.
- **Rationale**: no dependencies; satisfies Principle IV and the "no live calls in tests" rule.

## R10. Storage format and size

- **Decision**: per run, `web/data/runs/{runId}.json` (result shown on the page, ~30 KB) and
  `web/data/raw/{runId}.json` (all searches and games for re-scoring, ~0.6 MB at 2000 queries);
  `web/data/index.json` lists runs. `runId = {yyyymmdd-hhmmss}-{genre-slug}`.
- **Rationale**: the page loads only the small file; raw data keeps SC-006 checkable and lets a
  later scoring change re-score old runs with `node src/collector/rescore.js`.
