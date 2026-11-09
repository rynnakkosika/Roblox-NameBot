# Contract: Stored result files

The collector writes these files; the viewer reads them read-only. Field meanings are in
[../data-model.md](../data-model.md). `schemaVersion` changes when a field is removed or renamed.

## `web/data/index.json`

```json
{
  "schemaVersion": 1,
  "runs": [
    {
      "runId": "20261109-101500-tower-defense",
      "genre": "tower defense",
      "budget": 1000,
      "searchesMade": 1000,
      "status": "complete",
      "finishedAt": "2026-11-09T10:27:12Z",
      "topName": "Anime Tower Defense"
    }
  ]
}
```

Rules: newest first; only `complete` and `partial` runs appear; the collector rewrites it after
pulling the latest version so concurrent runs do not drop each other's entries.

## `web/data/runs/{runId}.json` (result, loaded by the page)

```json
{
  "schemaVersion": 1,
  "engineVersion": "1.0.0",
  "run": {
    "runId": "20261109-101500-tower-defense",
    "genre": "tower defense",
    "genreWords": ["tower", "defense"],
    "budget": 1000,
    "searchesMade": 1000,
    "gameSearchesMade": 10,
    "status": "complete",
    "stopReason": "budget",
    "startedAt": "2026-11-09T10:15:00Z",
    "finishedAt": "2026-11-09T10:27:12Z"
  },
  "names": [
    { "position": 1, "name": "Anime Tower Defense", "score": 41.2,
      "words": ["Anime", "Tower", "Defense"],
      "supportedBy": ["tower defense anime", "anime tower defense"] }
  ],
  "namesNote": null,
  "keywords": [ { "text": "anime", "score": 18.4 }, { "text": "tower defense", "score": 52.0 } ],
  "topSearches": [
    { "rank": 1, "text": "tower defense", "score": 52.0, "appearances": 214, "bestRank": 1 }
  ],
  "topGames": [
    { "name": "Cameraman Tower Defense", "rawName": "[🌟FIX] Cameraman Tower Defense",
      "playerCount": 37288, "url": "https://www.roblox.com/games/132929771812494/Cameraman-Tower-Defense",
      "foundBy": "tower defense" }
  ]
}
```

Rules: `names` ≤ 25; `namesNote` explains when fewer than 25 (FR edge case); `topSearches` 20
rows; `topGames` deduplicated, sorted by `playerCount` desc, at most 30; `keywords` ≤ 30.

## `web/data/raw/{runId}.json` (input for re-scoring, not loaded by the page)

```json
{
  "schemaVersion": 1,
  "run": { "runId": "…", "genre": "tower defense", "budget": 1000 },
  "searches": [
    { "order": 0, "step": 1, "text": "tower defense",
      "suggestions": ["tower defense anime", "tower defense", "tower defense x"] }
  ],
  "gameSearches": [
    { "text": "tower defense",
      "games": [ { "universeId": 4920386849, "name": "[🌟FIX] Cameraman Tower Defense",
                   "playerCount": 37288, "canonicalUrlPath": "/games/132929771812494/…" } ] }
  ]
}
```

Rule: `engine.score(raw)` MUST reproduce the result file's `names`, `keywords` and
`topSearches` exactly (SC-006).
