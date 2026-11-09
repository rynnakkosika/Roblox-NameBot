import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanDisplayName,
  cleanText,
  contentWords,
  isTypeWord,
  sameStem,
  stem,
  titleCase,
  tokenize,
  validateBudget,
  validateGenre,
} from '../src/engine/text.js';

test('cleanText removes bracketed tags', () => {
  assert.equal(cleanText('[UPDATE] Forest Tycoon'), 'forest tycoon');
  assert.equal(cleanText('Forest Tycoon (NEW)'), 'forest tycoon');
  assert.equal(cleanText('[✨CHANGES] Toilet Tower Defense'), 'toilet tower defense');
  assert.equal(cleanText('{BETA} Obby'), 'obby');
});

test('cleanText removes emojis and symbols', () => {
  assert.equal(cleanText('99 Nights in the Forest 🔦'), '99 nights in the forest');
  assert.equal(cleanText('🎃EVENT Horror Story!!'), 'event horror story');
  assert.equal(cleanText('SpongeBob Tower Defense🍍'), 'spongebob tower defense');
  assert.equal(cleanText("Dad's  Forest -- RP"), 'dads forest rp');
});

test('cleanText removes version numbers but keeps plain numbers', () => {
  assert.equal(cleanText('Forest Simulator v2'), 'forest simulator');
  assert.equal(cleanText('Forest Simulator 2.0'), 'forest simulator');
  assert.equal(cleanText('Horror v1.5.3 Update'), 'horror update');
  assert.equal(cleanText('WW2 Tower Defense'), 'ww2 tower defense');
  assert.equal(cleanText('tower defense 67'), 'tower defense 67');
});

test('filler words are removed from content words, case-insensitively', () => {
  assert.deepEqual(contentWords('The Legend of the FOREST Game'), ['legend', 'forest']);
  assert.deepEqual(contentWords('[UPDATE] New Roblox Horror'), ['horror']);
  assert.deepEqual(tokenize('HORROR horror'), ['horror', 'horror']);
});

test('stem treats singular and plural as the same word', () => {
  assert.ok(sameStem('animal', 'animals'));
  assert.ok(sameStem('berry', 'berries'));
  assert.ok(sameStem('wolf', 'wolves'));
  assert.ok(sameStem('box', 'boxes'));
  assert.ok(sameStem('zombie', 'zombies'));
  assert.ok(sameStem('army', 'armies'));
  assert.ok(sameStem('boss', 'bosses'));
  assert.ok(sameStem('horse', 'horses'));
  assert.ok(sameStem('obby', 'obbies'));
  assert.ok(sameStem('Forest', 'FORESTS'));
  assert.equal(stem('bus'), 'bus');
  assert.equal(stem('glass'), 'glass');
  assert.equal(stem('obby'), 'obby');
  assert.ok(!sameStem('forest', 'foresters'));
});

test('type words are recognised in any case and number', () => {
  assert.ok(isTypeWord('Simulator'));
  assert.ok(isTypeWord('simulators'));
  assert.ok(isTypeWord('RP'));
  assert.ok(isTypeWord('battlegrounds'));
  assert.ok(isTypeWord('defense'));
  assert.ok(!isTypeWord('forest'));
  assert.ok(isTypeWord('Sandbox'));
  assert.ok(isTypeWord('minigames'));
  assert.ok(isTypeWord('royale'));
});

test('titleCase handles acronyms', () => {
  assert.equal(titleCase('forest'), 'Forest');
  assert.equal(titleCase('rp'), 'RP');
  assert.equal(titleCase('ww2'), 'WW2');
  assert.equal(titleCase('HORROR'), 'Horror');
});

test('cleanDisplayName keeps case but removes tags and emojis', () => {
  assert.equal(cleanDisplayName('[🌟FIX] Cameraman Tower Defense'), 'Cameraman Tower Defense');
  assert.equal(cleanDisplayName('99 Nights in the Forest 🔦'), '99 Nights in the Forest');
});

test('validateGenre accepts 1–50 letters, digits and spaces with at least one letter', () => {
  assert.deepEqual(validateGenre('  Tower   Defense '), {
    ok: true,
    genre: 'tower defense',
    words: ['tower', 'defense'],
  });
  assert.equal(validateGenre('x').ok, true);
  assert.equal(validateGenre('a'.repeat(50)).ok, true);
  assert.equal(validateGenre('a'.repeat(51)).ok, false);
  assert.equal(validateGenre('').ok, false);
  assert.equal(validateGenre('   ').ok, false);
  assert.equal(validateGenre('!!!').ok, false);
  assert.equal(validateGenre('123').ok, false);
  assert.equal(validateGenre('forest; rm -rf').ok, false);
  assert.equal(validateGenre('ww2').ok, true);
});

test('validateBudget allows only 300, 1000 and 2000', () => {
  assert.equal(validateBudget('1000'), 1000);
  assert.equal(validateBudget(300), 300);
  assert.equal(validateBudget(2000), 2000);
  assert.equal(validateBudget(500), null);
  assert.equal(validateBudget('abc'), null);
});

test('genre variants: misspellings and fuzzy matches, not real other words', async () => {
  const { isGenreVariant } = await import('../src/engine/text.js');
  assert.ok(isGenreVariant('horor', ['horror']));
  assert.ok(isGenreVariant('first', ['forest']));
  assert.ok(isGenreVariant('foresto', ['forest']));
  assert.ok(!isGenreVariant('forests', ['forest']));
  assert.ok(!isGenreVariant('power', ['tower', 'defense']));
  assert.ok(!isGenreVariant('hospital', ['horror']));
});
