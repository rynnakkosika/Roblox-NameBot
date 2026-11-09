import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestRunPerGenre, popularSearches } from '../src/engine/popular.js';

const result = (genre, runId, searches) => ({
  run: { genre, runId },
  topSearches: searches.map(([text, score, appearances], i) => ({ rank: i + 1, text, score, appearances, bestRank: 1 })),
});

const forest = result('forest', 'f1', [['forest donation', 40, 91], ['forest survival', 20, 54], ['forest rpg', 10, 38]]);
const horror = result('horror', 'h1', [['horror obby', 200, 173], ['horror games', 150, 149], ['horror house', 50, 73]]);

test('latest run per genre keeps the newest of each genre', () => {
  const runs = [
    { runId: 'f2', genre: 'forest' },
    { runId: 'h1', genre: 'horror' },
    { runId: 'f1', genre: 'forest' },
  ];
  assert.deepEqual(latestRunPerGenre(runs).map((r) => r.runId), ['f2', 'h1']);
});

test('one genre: searches in their own order, index relative to the best search', () => {
  const rows = popularSearches([forest, horror], { genre: 'forest' });
  assert.deepEqual(rows.map((r) => r.text), ['forest donation', 'forest survival', 'forest rpg']);
  assert.deepEqual(rows.map((r) => r.index), [100, 50, 25]);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3]);
  assert.ok(rows.every((r) => r.genre === 'forest'));
});

test('all genres: merged by popularity index, so genres with bigger runs do not dominate', () => {
  const rows = popularSearches([forest, horror]);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.text), ['horror obby', 'forest donation', 'horror games']);
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3, 4, 5, 6]);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].index >= rows[i].index);
});

test('limit caps the list', () => {
  assert.equal(popularSearches([forest, horror], { limit: 4 }).length, 4);
});
