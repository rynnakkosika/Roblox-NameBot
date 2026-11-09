// Name generation and the naming rules (FR-020 to FR-026). Pure functions.

import {
  ADJACENT_BONUS,
  DIVERSITY_DECAY,
  MAX_NAME_CHARS,
  MAX_NAME_WORDS,
  MAX_NAMES,
  MIN_NAME_WORDS,
  MODIFIER_POOL,
  PHRASE_BONUS,
  SUGGESTION_CANDIDATES,
  TYPE_BONUS,
  TYPE_POOL,
} from './constants.js';
import { round } from './scoring.js';
import {
  findPhrase,
  isGenreVariant,
  isNameWord,
  isTypeWord,
  stem,
  titleCase,
  tokenize,
} from './text.js';

/** Finds the genre as one contiguous phrase (by stem) in a word list; -1 if absent. */
export const findGenre = findPhrase;

/**
 * Checks one name against every naming rule. `words` are lower-case.
 * ctx: { genreWords, vocabulary (Set of stems) }.
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function validateName(words, ctx) {
  const { genreWords, vocabulary } = ctx;
  const fail = (reason) => ({ ok: false, reason });
  if (words.length < MIN_NAME_WORDS || words.length > MAX_NAME_WORDS) return fail('word-count');
  if (words.map(titleCase).join(' ').length > MAX_NAME_CHARS) return fail('too-long');

  const pos = findGenre(words, genreWords);
  if (pos < 0) return fail('genre-missing');
  const genreEnd = pos + genreWords.length;
  const inGenre = (i) => i >= pos && i < genreEnd;

  const stems = words.map(stem);
  if (new Set(stems).size !== stems.length) return fail('repeated-word');

  const outsideTypes = [];
  let genreHasType = false;
  words.forEach((w, i) => {
    if (!isTypeWord(w)) return;
    if (inGenre(i)) genreHasType = true;
    else outsideTypes.push(i);
  });
  if (outsideTypes.length + (genreHasType ? 1 : 0) > 1) return fail('two-type-words');
  if (outsideTypes.length === 1 && outsideTypes[0] !== words.length - 1) {
    return fail('type-word-not-last');
  }
  if (isTypeWord(genreWords[genreWords.length - 1]) && genreEnd !== words.length) {
    return fail('type-word-not-last');
  }

  for (let i = 0; i < words.length; i++) {
    if (inGenre(i)) continue;
    if (!isNameWord(words[i])) return fail('bad-word');
    if (isGenreVariant(words[i], genreWords)) return fail('genre-misspelling');
    if (vocabulary && !vocabulary.has(stems[i])) return fail('word-not-in-data');
  }
  return { ok: true };
}

/** Key that is equal for near-identical names: same words regardless of order or number. */
export function nearDuplicateKey(words) {
  return [...new Set(words.map(stem))].sort().join(' ');
}

function cmpText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Builds up to MAX_NAMES names, best first.
 * input: { genreWords, ranked (suggestions sorted by score), scores (from wordScores),
 *          games (collectGames output) }
 */
export function buildNames({ genreWords, ranked, scores, games }) {
  const genreStems = new Set(genreWords.map(stem));
  const genreTypeLast = isTypeWord(genreWords[genreWords.length - 1]);
  const genreHasType = genreWords.some(isTypeWord);

  const vocabulary = new Set(genreWords.map(stem));
  for (const s of ranked) for (const w of tokenize(s.text)) vocabulary.add(stem(w));
  for (const g of games) for (const w of tokenize(g.cleanName)) vocabulary.add(stem(w));
  const ctx = { genreWords, vocabulary };

  const suggestionScore = new Map(ranked.map((s) => [s.text, s.score]));
  const wordScore = (w) => scores.words.get(stem(w))?.score ?? 0;
  const surface = (w) => scores.words.get(stem(w))?.text ?? w;

  const scoreName = (words) => {
    const pos = findGenre(words, genreWords);
    let total = 0;
    words.forEach((w, i) => {
      if (i >= pos && i < pos + genreWords.length) return;
      total += wordScore(w) * (isTypeWord(w) ? 1 + TYPE_BONUS : 1);
    });
    for (let i = 0; i + 1 < words.length; i++) {
      const key = `${stem(words[i])} ${stem(words[i + 1])}`;
      total += ADJACENT_BONUS * (scores.phrases.get(key)?.score ?? 0);
    }
    total += PHRASE_BONUS * (suggestionScore.get(words.join(' ')) ?? 0);
    return total;
  };

  const candidates = new Map();
  const consider = (words) => {
    const key = words.join(' ');
    if (candidates.has(key)) return;
    if (!validateName(words, ctx).ok) return;
    candidates.set(key, { words, score: scoreName(words) });
  };

  // (a) Suggestions that contain the genre, rearranged to follow the rules.
  for (const s of ranked.slice(0, SUGGESTION_CANDIDATES)) {
    const toks = tokenize(s.text);
    const pos = findGenre(toks, genreWords);
    if (pos < 0) continue;
    const usable = (w) => isNameWord(w) && !isGenreVariant(w, genreWords);
    const pre = toks.slice(0, pos).filter(usable);
    const post = toks.slice(pos + genreWords.length).filter(usable);
    const types = [...pre, ...post].filter(isTypeWord);
    const preMods = pre.filter((w) => !isTypeWord(w));
    const postMods = post.filter((w) => !isTypeWord(w));
    if (types.length > 1) continue;
    const type = genreHasType ? [] : types;
    if (genreTypeLast) consider([...preMods, ...postMods, ...genreWords]);
    else consider([...preMods, ...genreWords, ...postMods, ...type]);
  }

  // (b) Templates from the best-scoring words in the data.
  const pool = [...scores.words.values()]
    .filter((e) => !genreStems.has(e.stem) && isNameWord(e.text) && !isGenreVariant(e.text, genreWords))
    .sort((a, b) => b.score - a.score || cmpText(a.text, b.text));
  const mods = pool.filter((e) => !isTypeWord(e.text)).slice(0, MODIFIER_POOL).map((e) => e.text);
  const types = genreHasType
    ? []
    : pool.filter((e) => isTypeWord(e.text)).slice(0, TYPE_POOL).map((e) => surface(e.text));
  const typeOptions = [[], ...types.map((t) => [t])];

  for (const t of typeOptions) {
    if (t.length) consider([...genreWords, ...t]);
    for (const m of mods) {
      consider([m, ...genreWords, ...t]);
      if (!genreTypeLast) consider([...genreWords, m, ...t]);
    }
    for (const m1 of mods) {
      for (const m2 of mods) {
        // Two modifiers only in an order players actually type ("hospital run").
        if (m1 === m2 || !scores.phrases.has(`${stem(m1)} ${stem(m2)}`)) continue;
        consider([m1, m2, ...genreWords, ...t]);
      }
    }
  }

  const picked = pickDiverse([...candidates.values()], genreStems);

  const names = picked.map((c, i) => ({
    position: i + 1,
    name: c.words.map(titleCase).join(' '),
    score: round(c.score),
    words: c.words.map(titleCase),
    supportedBy: supportFor(c.words, genreStems, ranked),
  }));
  const namesNote =
    names.length < MAX_NAMES
      ? `Only ${names.length} names passed every naming rule; the search data for this genre is thin.`
      : null;
  return { names, namesNote };
}

/**
 * Picks up to MAX_NAMES names: always the best remaining one, where a candidate's score is
 * multiplied by DIVERSITY_DECAY for every earlier pick that used one of its (non-genre) words.
 * Near-identical names (same words in any order or number) are skipped.
 */
function pickDiverse(candidates, genreStems) {
  const pool = candidates
    .map((c) => ({ ...c, stems: c.words.map(stem).filter((s) => !genreStems.has(s)) }))
    .sort((a, b) => b.score - a.score || cmpText(a.words.join(' '), b.words.join(' ')));
  const uses = new Map();
  const keys = new Set();
  const picked = [];
  while (picked.length < MAX_NAMES) {
    let best = null;
    let bestValue = -Infinity;
    for (const c of pool) {
      if (c.score <= bestValue) break; // sorted: no later candidate can beat bestValue
      if (keys.has(nearDuplicateKey(c.words))) continue;
      const penalty = c.stems.reduce((n, s) => n + (uses.get(s) ?? 0), 0);
      const value = c.score * DIVERSITY_DECAY ** penalty;
      if (value > bestValue + 1e-9) {
        best = c;
        bestValue = value;
      }
    }
    if (!best) break;
    keys.add(nearDuplicateKey(best.words));
    for (const s of best.stems) uses.set(s, (uses.get(s) ?? 0) + 1);
    picked.push({ ...best, score: bestValue });
  }
  return picked;
}

function supportFor(words, genreStems, ranked) {
  const own = words.map(stem).filter((s) => !genreStems.has(s));
  const wanted = own.length ? own : [...genreStems];
  const out = [];
  for (const s of ranked) {
    const st = new Set(tokenize(s.text).map(stem));
    if (wanted.some((w) => st.has(w))) out.push(s.text);
    if (out.length >= 3) break;
  }
  return out;
}
