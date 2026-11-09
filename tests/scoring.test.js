import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateSuggestions,
  breadthWeight,
  buildKeywords,
  buildTopGames,
  buildTopSearches,
  collectGames,
  gameWeight,
  rankPts,
  rankedSuggestions,
  topSearchTexts,
  wordScores,
} from '../src/engine/scoring.js';

const close = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('rank points: rank 1 = 1.0, rank 10 = 0.1, decreasing', () => {
  assert.equal(rankPts(1), 1);
  close(rankPts(10), 0.1, 1e-9);
  for (let r = 1; r < 10; r++) assert.ok(rankPts(r) > rankPts(r + 1));
});

test('broad searches weigh more than narrow ones', () => {
  const g = ['forest'];
  assert.equal(breadthWeight('forest', g), 1);
  close(breadthWeight('forest a', g), 0.775);
  close(breadthWeight('forest animals', g), 0.6);
  close(breadthWeight('forest animals qx', g), 0.465);
  assert.ok(breadthWeight('forest', g) > breadthWeight('forest a', g));
  assert.ok(breadthWeight('forest a', g) > breadthWeight('forest animals', g));
  assert.ok(breadthWeight('forest animals', g) > breadthWeight('forest animals qx', g));
  // Multi-word genre and plural forms count as the genre.
  assert.equal(breadthWeight('tower defense', ['tower', 'defense']), 1);
  assert.equal(breadthWeight('Forests', g), 1);
});

test('higher rank and more appearances give a higher score', () => {
  const g = ['forest'];
  const map = aggregateSuggestions(
    [
      { text: 'forest', suggestions: ['forest a1', 'forest b1'] },
      { text: 'forest x', suggestions: ['forest b1', 'forest c1'] },
      { text: 'forest y', suggestions: ['forest c1'] },
    ],
    g,
  );
  assert.ok(map.get('forest a1').score > 0);
  assert.equal(map.get('forest b1').appearances, 2);
  assert.equal(map.get('forest b1').bestRank, 1);
  // b1 appears twice, so it beats a1 (rank 1 once in the broadest search)
  assert.ok(map.get('forest b1').score > map.get('forest a1').score);
  assert.ok(map.get('forest c1').score > 0);
});

test('suggestions are cleaned and merged before scoring', () => {
  const map = aggregateSuggestions(
    [{ text: 'forest', suggestions: ['[NEW] Forest Tycoon 🌲', 'forest tycoon'] }],
    ['forest'],
  );
  assert.equal(map.size, 1);
  const e = map.get('forest tycoon');
  close(e.score, rankPts(1) + rankPts(2), 1e-9);
  assert.equal(e.appearances, 1);
});

test('game weight follows player count with diminishing returns', () => {
  assert.equal(gameWeight(0), 0);
  assert.ok(gameWeight(10000) > gameWeight(100));
  // One 1M-player game does not outweigh five 10k-player games.
  assert.ok(gameWeight(1_000_000) < 5 * gameWeight(10_000));
});

test('game names add weight to their words', () => {
  const games = collectGames([
    { text: 'forest', games: [{ universeId: 1, name: '[UPD] Forest Camp 🔥', playerCount: 50000 }] },
  ]);
  const scores = wordScores([], games);
  close(scores.words.get('camp').score, gameWeight(50000), 1e-9);
  assert.ok(scores.phrases.has('forest camp'));
});

test('top games are deduplicated by universe and sorted by players', () => {
  const games = collectGames([
    {
      text: 'forest',
      games: [
        { universeId: 1, name: 'A', playerCount: 10, canonicalUrlPath: '/games/1/A' },
        { universeId: 2, name: '🔦 B', playerCount: 500 },
      ],
    },
    { text: 'forest camp', games: [{ universeId: 1, name: 'A', playerCount: 10 }] },
  ]);
  const top = buildTopGames(games);
  assert.deepEqual(top.map((g) => g.name), ['B', 'A']);
  assert.equal(top[1].url, 'https://www.roblox.com/games/1/A');
  assert.equal(top[1].foundBy, 'forest');
  assert.equal(top[0].rawName, '🔦 B');
});

test('top searches: 20 rows with rank, appearances and best rank', () => {
  const searches = [{ text: 'forest', suggestions: Array.from({ length: 10 }, (_, i) => `forest w${i}`) }];
  for (let i = 0; i < 20; i++) {
    searches.push({ text: `forest ${i}`, suggestions: [`forest q${i}`, `forest r${i}`] });
  }
  const top = buildTopSearches(rankedSuggestions(aggregateSuggestions(searches, ['forest'])));
  assert.equal(top.length, 20);
  assert.deepEqual(Object.keys(top[0]), ['rank', 'text', 'score', 'appearances', 'bestRank']);
  assert.equal(top[0].rank, 1);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].score >= top[i].score);
});

test('keywords: genre first, no filler, at most 30', () => {
  const ranked = rankedSuggestions(
    aggregateSuggestions(
      [{ text: 'tower defense', suggestions: ['tower defense anime', 'the tower defense game', 'anime tower defense x'] }],
      ['tower', 'defense'],
    ),
  );
  const kw = buildKeywords('tower defense', ['tower', 'defense'], wordScores(ranked, []));
  assert.equal(kw[0].text, 'tower defense');
  assert.ok(kw.some((k) => k.text === 'anime'));
  assert.ok(!kw.some((k) => ['the', 'game'].includes(k.text)));
  assert.ok(kw.length <= 30);
});

test('top search texts for game lookups skip the genre itself', () => {
  const searches = [{ text: 'forest', suggestions: ['forest', 'forest camp', 'forest tycoon'] }];
  assert.deepEqual(topSearchTexts(searches, 'forest', ['forest'], 9), ['forest camp', 'forest tycoon']);
});

test('top searches contain the genre; fuzzy and prefix matches are left out', () => {
  const searches = [
    {
      text: 'forest',
      suggestions: ['foresters', 'forest donation', 'first is owner', '99 nights in the forest', 'free stuff'],
    },
  ];
  const texts = buildTopSearches(rankedSuggestions(aggregateSuggestions(searches, ['forest'])), ['forest']).map((s) => s.text);
  assert.deepEqual(texts, ['forest donation', '99 nights in the forest']);
  assert.equal(buildTopSearches(rankedSuggestions(aggregateSuggestions(searches, ['forest'])), ['forest'])[0].rank, 1);
});
