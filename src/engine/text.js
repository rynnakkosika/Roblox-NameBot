// Text helpers shared by the engine, the collector and the viewer. Pure functions only.

import {
  BUDGETS,
  FILLER_WORDS,
  MAX_GENRE_CHARS,
  MIN_WORD_LENGTH,
  NUMBER_BOUND_WORDS,
  STEM_EXCEPTIONS,
  TYPE_WORDS,
  WORD_CASE,
} from './constants.js';

/**
 * Lower-cases a Roblox text and removes tags ([UPDATE], (NEW), {X}), emojis, symbols,
 * apostrophes and version numbers (v2, 2.0, v1.5.3). Returns words separated by single spaces.
 */
export function cleanText(input) {
  let s = String(input ?? '').normalize('NFKC');
  s = s.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】|「[^」]*」/g, ' ');
  s = s.toLowerCase();
  s = s.replace(/\bv?\d+(?:\.\d+)+\b/g, ' ').replace(/\bv\d+\b/g, ' ');
  s = s.replace(/['’`´]/g, '');
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ');
  return s.trim().replace(/ +/g, ' ');
}

/** Cleans a game name for display: tags, emojis and symbols removed, original case kept. */
export function cleanDisplayName(input) {
  let s = String(input ?? '').normalize('NFKC');
  s = s.replace(/\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|【[^】]*】|「[^」]*」/g, ' ');
  s = s.replace(/[^\p{L}\p{N}'’&:\-! ]+/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.replace(/^[-:!& ]+|[-:& ]+$/g, '').trim();
}

export function tokenize(input) {
  const s = cleanText(input);
  return s ? s.split(' ') : [];
}

export function isFiller(word) {
  return FILLER_WORDS.has(word);
}

/** Words of a text without filler words. */
export function contentWords(input) {
  return tokenize(input).filter((w) => !isFiller(w));
}

/**
 * Canonical singular form used only for comparisons (never displayed):
 * animals → animal, berries/berry → berrie, boxes → box, wolves → wolf, bus → bus.
 */
export function stem(word) {
  const w = String(word).toLowerCase();
  if (Object.hasOwn(STEM_EXCEPTIONS, w)) return STEM_EXCEPTIONS[w];
  if (w.length <= 2) return w;
  if (w.endsWith('ies')) return w.slice(0, -1);
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ie`;
  if (/(ss|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (/(ss|us|is)$/.test(w)) return w;
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function sameStem(a, b) {
  return stem(a) === stem(b);
}

const TYPE_STEMS = new Set(TYPE_WORDS.map(stem));

export function isTypeWord(word) {
  return TYPE_STEMS.has(stem(word));
}

/** A word that may appear in a generated name (genre words are always allowed). */
export function isNameWord(word) {
  return (
    /^[a-z][a-z0-9]*$/.test(word) &&
    word.length >= MIN_WORD_LENGTH &&
    !isFiller(word) &&
    !NUMBER_BOUND_WORDS.has(word)
  );
}

/** Position of a phrase (by stem) in a word list, or -1. */
export function findPhrase(words, phraseWords) {
  const st = words.map(stem);
  const ps = phraseWords.map(stem);
  for (let i = 0; i + ps.length <= st.length; i++) {
    if (ps.every((p, j) => st[i + j] === p)) return i;
  }
  return -1;
}

export function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * A misspelling or fuzzy match of a genre word that Roblox autocomplete returns
 * ("horor", "frost" and "first" for "forest", "foresto"). Never used as a name word.
 */
export function isGenreVariant(word, genreWords) {
  const w = word.toLowerCase();
  return genreWords.some((g) => {
    if (stem(w) === stem(g)) return false;
    if (w.length >= 3 && (w.startsWith(g) || g.startsWith(w))) return true;
    if (w[0] !== g[0]) return false;
    return editDistance(w, g) <= (g.length >= 6 ? 2 : 1);
  });
}

export function titleCase(word) {
  const w = String(word).toLowerCase();
  if (Object.hasOwn(WORD_CASE, w)) return WORD_CASE[w];
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Validates the genre typed by the user (FR-001): 1–50 characters, letters, digits and spaces,
 * at least one letter. Returns { ok, genre, words } or { ok: false, error }.
 */
export function validateGenre(input) {
  const raw = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'Enter a genre, for example "forest".' };
  if (raw.length > MAX_GENRE_CHARS) {
    return { ok: false, error: `The genre can be at most ${MAX_GENRE_CHARS} characters.` };
  }
  if (!/^[A-Za-z0-9 ]+$/.test(raw)) {
    return { ok: false, error: 'Use only letters, digits and spaces.' };
  }
  if (!/[A-Za-z]/.test(raw)) return { ok: false, error: 'The genre needs at least one letter.' };
  const genre = raw.toLowerCase();
  return { ok: true, genre, words: genre.split(' ') };
}

export function validateBudget(input) {
  const n = Number(input);
  return BUDGETS.includes(n) ? n : null;
}

export function slugify(genre) {
  return String(genre).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
