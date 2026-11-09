import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { score, validateName } from '../src/engine/index.js';
import { nearDuplicateKey } from '../src/engine/naming.js';
import { isTypeWord, stem, tokenize } from '../src/engine/text.js';

const dir = new URL('./fixtures/', import.meta.url);
const fixtures = readdirSync(dir).filter((f) => f.endsWith('.raw.json'));

test('recorded fixtures are present', () => {
  assert.ok(fixtures.length >= 3, `expected 3 fixtures, found ${fixtures.length}`);
});

for (const file of fixtures) {
  const raw = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  const genreWords = raw.run.genre.split(' ');

  test(`${file}: up to 25 names, all passing every naming rule`, () => {
    const result = score(raw);
    const vocabulary = new Set(genreWords.map(stem));
    for (const s of raw.searches) for (const q of s.suggestions) for (const w of tokenize(q)) vocabulary.add(stem(w));
    for (const gs of raw.gameSearches) for (const g of gs.games) for (const w of tokenize(g.name)) vocabulary.add(stem(w));

    assert.ok(result.names.length > 0 && result.names.length <= 25);
    const keys = new Set();
    for (const n of result.names) {
      const words = n.words.map((w) => w.toLowerCase());
      const check = validateName(words, { genreWords, vocabulary });
      assert.ok(check.ok, `${n.name}: ${check.reason}`);
      assert.ok(n.name.length <= 50);
      assert.ok(words.filter(isTypeWord).length <= 1 || genreWords.some(isTypeWord), n.name);
      const key = nearDuplicateKey(words);
      assert.ok(!keys.has(key), `near-duplicate ${n.name}`);
      keys.add(key);
    }
    if (result.names.length < 25) assert.ok(result.namesNote);
  });

  test(`${file}: re-scoring gives identical output (SC-006)`, () => {
    assert.deepEqual(score(structuredClone(raw)), score(structuredClone(raw)));
  });

  test(`${file}: evidence sections are filled`, () => {
    const result = score(raw);
    assert.equal(result.keywords[0].text, raw.run.genre);
    assert.ok(result.topSearches.length > 0 && result.topSearches.length <= 50);
    assert.ok(result.topGames.length > 0);
    for (let i = 1; i < result.topGames.length; i++) {
      assert.ok(result.topGames[i - 1].playerCount >= result.topGames[i].playerCount);
    }
  });
}
