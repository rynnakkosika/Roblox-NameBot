// Popular searches across saved runs, for the "Popular searches" page. Pure functions.

/** The newest run of each genre; index.json lists runs newest first. */
export function latestRunPerGenre(indexRuns) {
  const seen = new Set();
  const out = [];
  for (const r of indexRuns ?? []) {
    if (seen.has(r.genre)) continue;
    seen.add(r.genre);
    out.push(r);
  }
  return out;
}

/**
 * Merges the top searches of the given results. Scores from different runs are not on the same
 * scale, so each search gets a popularity index: its score as a percentage of the best search
 * in its own run (the genre's most popular search is 100).
 * @param results result files (contracts/result-files.md)
 * @param options { genre?: string|null, limit?: number }
 */
export function popularSearches(results, { genre = null, limit = 100 } = {}) {
  const rows = [];
  for (const r of results) {
    if (genre && r.run.genre !== genre) continue;
    const list = r.topSearches ?? [];
    const max = list[0]?.score || 1;
    for (const s of list) {
      rows.push({
        text: s.text,
        genre: r.run.genre,
        runId: r.run.runId,
        index: Math.round((s.score / max) * 100),
        score: s.score,
        appearances: s.appearances,
        genreRank: s.rank,
      });
    }
  }
  rows.sort(
    (a, b) =>
      b.index - a.index ||
      b.score - a.score ||
      (a.text < b.text ? -1 : a.text > b.text ? 1 : 0),
  );
  return rows.slice(0, limit).map((row, i) => ({ rank: i + 1, ...row }));
}
