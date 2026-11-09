import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNames, findGenre, nearDuplicateKey, validateName } from '../src/engine/naming.js';
import { aggregateSuggestions, collectGames, rankedSuggestions, wordScores } from '../src/engine/scoring.js';
import { isTypeWord, sameStem, stem } from '../src/engine/text.js';

const ctx = (genreWords) => ({ genreWords, vocabulary: null });
const ok = (words, genre) => validateName(words, ctx(genre));

function namesFor(genre, suggestionLists, gameList = []) {
  const genreWords = genre.split(' ');
  const searches = suggestionLists.map((s, i) => ({ text: i === 0 ? genre : `${genre} ${i}`, suggestions: s }));
  const ranked = rankedSuggestions(aggregateSuggestions(searches, genreWords));
  const games = collectGames([{ text: genre, games: gameList }]);
  return buildNames({ genreWords, ranked, scores: wordScores(ranked, games), games });
}

test('2–5 words', () => {
  assert.equal(ok(['forest'], ['forest']).reason, 'word-count');
  assert.equal(ok(['dark', 'forest'], ['forest']).ok, true);
  assert.equal(ok(['big', 'dark', 'deep', 'wild', 'forest'], ['forest']).ok, true);
  assert.equal(ok(['big', 'dark', 'deep', 'wild', 'old', 'forest'], ['forest']).reason, 'word-count');
});

test('at most 50 characters', () => {
  const fifty = ['extraordinarily', 'magnificent', 'forest', 'adventuressssss']; // 50 chars
  assert.equal(fifty.join(' ').length, 50);
  assert.equal(ok(fifty, ['forest']).ok, true);
  const long = ['extraordinarily', 'magnificent', 'forest', 'adventuresssssss']; // 51 chars
  assert.equal(ok(long, ['forest']).reason, 'too-long');
});

test('genre words are all present and stay together in the user order', () => {
  const g = ['anime', 'tower', 'defense'];
  assert.equal(ok(['anime', 'tower', 'defense'], g).ok, true);
  assert.equal(ok(['ultimate', 'anime', 'tower', 'defense'], g).ok, true);
  assert.equal(ok(['tower', 'anime', 'defense'], g).reason, 'genre-missing');
  assert.equal(ok(['anime', 'defense', 'tower'], g).reason, 'genre-missing');
  assert.equal(ok(['tower', 'defense', 'anime'], ['tower', 'defense']).reason, 'type-word-not-last');
  assert.equal(ok(['anime', 'tower', 'defense'], ['tower', 'defense']).ok, true);
  assert.equal(findGenre(['wild', 'animals', 'forest'], ['animal', 'forest']), 1);
});

test('one game-type word at most, always last', () => {
  const g = ['forest'];
  assert.equal(ok(['forest', 'tycoon'], g).ok, true);
  assert.equal(ok(['tycoon', 'forest'], g).reason, 'type-word-not-last');
  assert.equal(ok(['forest', 'tycoon', 'simulator'], g).reason, 'two-type-words');
  assert.equal(ok(['forest', 'obby', 'camp'], g).reason, 'type-word-not-last');
  // Genre ending in a type word ends the name and counts as the type word.
  const td = ['tower', 'defense'];
  assert.equal(ok(['toilet', 'tower', 'defense'], td).ok, true);
  assert.equal(ok(['tower', 'defense', 'simulator'], td).reason, 'two-type-words');
});

test('no repeated word and no singular/plural pair', () => {
  assert.equal(ok(['animal', 'animals', 'forest'], ['forest']).reason, 'repeated-word');
  assert.equal(ok(['forest', 'forests'], ['forest']).reason, 'repeated-word');
  assert.equal(ok(['berry', 'berries', 'forest'], ['forest']).reason, 'repeated-word');
});

test('words must come from the data, and filler or numbers are not used', () => {
  const vocab = new Set(['forest', 'camp'].map(stem));
  assert.equal(validateName(['camp', 'forest'], { genreWords: ['forest'], vocabulary: vocab }).ok, true);
  assert.equal(
    validateName(['magic', 'forest'], { genreWords: ['forest'], vocabulary: vocab }).reason,
    'word-not-in-data',
  );
  assert.equal(ok(['the', 'forest'], ['forest']).reason, 'bad-word');
  assert.equal(ok(['forest', '67'], ['forest']).reason, 'bad-word');
});

test('near-identical names share a key', () => {
  assert.equal(nearDuplicateKey(['dark', 'forest']), nearDuplicateKey(['forest', 'darks']));
  assert.notEqual(nearDuplicateKey(['dark', 'forest']), nearDuplicateKey(['dark', 'forest', 'tycoon']));
});

const FOREST = [
  ['forest', '99 nights in the forest', 'forest tycoon', 'forest animals', 'dark forest', 'forest survival', 'forest camp', 'forest animal simulator', 'the forest', 'forest obby'],
  ['forest animals', 'forest camp', 'dark forest', 'forest tycoon', 'forest survival'],
  ['dark forest survival', 'forest camp', 'animal forest', 'forest animals rp', 'forest tycoon'],
  ['forest animals', 'forest tycoon', 'forest camp tycoon', 'dark forest obby', 'forest berries'],
  ['berry forest', 'forest wolves', 'wolf forest survival', 'forest hunt', 'forest hunters'],
];

test('buildNames produces rule-abiding names, best first, with no near-duplicates', () => {
  const { names } = namesFor('forest', FOREST, [
    { universeId: 1, name: '[UPDATE] 99 Nights in the Forest 🔦', playerCount: 100000 },
    { universeId: 2, name: 'Forest Camp Tycoon', playerCount: 2000 },
  ]);
  assert.ok(names.length > 10, `got ${names.length}`);
  const keys = new Set();
  names.forEach((n, i) => {
    const words = n.words.map((w) => w.toLowerCase());
    assert.equal(n.position, i + 1);
    assert.ok(words.length >= 2 && words.length <= 5, n.name);
    assert.ok(n.name.length <= 50, n.name);
    assert.ok(words.some((w) => sameStem(w, 'forest')), n.name);
    const types = words.filter(isTypeWord);
    assert.ok(types.length <= 1, n.name);
    if (types.length) assert.ok(isTypeWord(words[words.length - 1]), n.name);
    assert.ok(!/[[\]()]/.test(n.name) && !/\b(The|Of|Game)\b/.test(n.name), n.name);
    const key = nearDuplicateKey(words);
    assert.ok(!keys.has(key), `near-duplicate ${n.name}`);
    keys.add(key);
    if (i > 0) assert.ok(names[i - 1].score >= n.score);
  });
});

test('multi-word genre stays one phrase and ends the name when it ends in a type word', () => {
  const { names } = namesFor('anime tower defense', [
    ['anime tower defense', 'anime tower defense x', 'tower defense anime', 'anime tower defense simulator', 'anime last stand tower defense'],
    ['anime tower defense codes', 'anime tower defense new', 'anime tower defense ultimate', 'anime tower defense rng'],
  ]);
  assert.ok(names.length > 0);
  for (const n of names) {
    assert.ok(n.name.includes('Anime Tower Defense'), n.name);
    assert.ok(n.name.endsWith('Anime Tower Defense'), n.name);
    assert.ok(!n.name.includes('Tower Anime Defense'), n.name);
  }
});

test('fewer than 25 names sets a note', () => {
  const { names, namesNote } = namesFor('forest', [['forest', 'dark forest']]);
  assert.ok(names.length < 25);
  assert.match(namesNote, /Only \d+ names/);
});

test('deterministic: same input gives identical names and order', () => {
  const a = namesFor('forest', FOREST);
  const b = namesFor('forest', FOREST);
  assert.deepEqual(a, b);
});

test('misspellings and fuzzy matches of the genre are never name words', () => {
  assert.equal(ok(['horor', 'horror', 'obby'], ['horror']).reason, 'genre-misspelling');
  assert.equal(ok(['first', 'forest'], ['forest']).reason, 'genre-misspelling');
  assert.equal(ok(['frost', 'forest'], ['forest']).reason, 'genre-misspelling');
  const { names } = namesFor('horror', [
    ['horror obby', 'horor', 'horor obby', 'horror hospital', 'horor game'],
    ['horor horror', 'horror house', 'horror obby', 'horor impact'],
  ]);
  for (const n of names) assert.ok(!/horor/i.test(n.name.replace(/Horror/g, '')), n.name);
});

test('names vary: one strong word does not end all 25 names', () => {
  const lists = [['horror obby', 'horror hospital', 'horror house', 'horror school', 'horror elevator']];
  for (let i = 0; i < 30; i++) lists.push([`horror obby`, `horror word${String.fromCharCode(97 + (i % 26))}x${i} obby`]);
  const { names } = namesFor('horror', lists);
  const endsObby = names.filter((n) => n.name.endsWith('Obby')).length;
  assert.ok(endsObby < names.length, `${endsObby} of ${names.length} end in Obby`);
});
