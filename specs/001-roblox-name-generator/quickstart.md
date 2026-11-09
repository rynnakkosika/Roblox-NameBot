# Quickstart: validating Roblox-NameBot

## Prerequisites

- Node.js 20+ (no `npm install`; there are no dependencies).
- A GitHub repository for the project (assumed `rynnakkosika/roblox-namebot`) with Pages set to
  "Deploy from a branch → main / (root)" and Actions allowed to write (Settings → Actions →
  Workflow permissions → Read and write).

## 1. Automated tests (no network)

```bash
node --test tests/
```

Expected: all tests pass. They cover expansion order (FR-005/006), scoring (FR-010…014), every
name rule (FR-020…026) and re-scoring determinism (SC-006) using `tests/fixtures/`.

## 2. Local collector run (live, manual)

```bash
node src/collector/run.js --genre forest --budget 300 --out tmp-data
```

Expected: progress lines per 50 searches; finishes in about 4 minutes; exit code 0;
`tmp-data/runs/<runId>.json` has 25 names that all contain "Forest", and
`tmp-data/index.json` lists the run. Re-score check:

```bash
node src/collector/rescore.js --run <runId> --out tmp-data --check
```

Expected: "identical" (SC-006).

## 3. Viewer locally

```bash
npx --yes http-server . -p 8080
```

(any static server works; `npx` is only a dev convenience, not a project dependency.) Open
`http://localhost:8080/#/`, check the history, open a result, copy a name, and resize to 360 px:
no horizontal scrolling (FR-034).

## 4. End-to-end on GitHub (from a phone)

1. Open `https://rynnakkosika.github.io/roblox-namebot/`.
2. Enter "horror", choose 300, tap **Start run** → GitHub issue form opens pre-filled → submit.
3. Back on the page the run shows as running with an ETA.
4. Within ~8 minutes (SC-002) the issue gets a comment with the result link and closes; the
   result appears in the history.
5. Open an issue as a non-owner account (or check the run log): the workflow job is skipped.

## 5. Spot checks on the result

- "anime tower defense" run: no name contains "Tower Anime Defense"; no name has two type words;
  none ends with a non-type word after "Defense".
- No name contains `[`, `]`, emojis, "The", "Of" or "Game".
- No two names differ only by word order or singular/plural.
