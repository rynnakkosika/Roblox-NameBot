// Scoring of autocomplete suggestions, words, phrases and games (FR-010 to FR-014, research R7).
// Pure functions; ties are always broken alphabetically so output is deterministic.

import {
  BREADTH_DECAY,
  FRAGMENT_LENGTH,
  FRAGMENT_WEIGHT,
  GAME_WEIGHT,
  OFF_GENRE_FACTOR,
  PHRASE_SHARE,
  TOP_GAMES,
  TOP_KEYWORDS,
  TOP_SEARCHES,
} from './constants.js';
import {
  cleanDisplayName,
  cleanText,
  contentWords,
  findPhrase,
  isFiller,
  isGenreVariant,
  stem,
  tokenize,
} from './text.js';

/** Rank 1 scores 1.0, rank 10 scores 0.1. */
export function rankPts(rank) {
  return Math.max(0, (11 - rank) / 10);
}

/**
 * Weight of a search: broad searches weigh more than narrow ones (FR-011).
 * Every word beyond the genre narrows by BREADTH_DECAY; a word of 1–2 characters counts half.
 * forest 1.0, forest a ≈0.77, forest animals 0.6, forest animals qx ≈0.46.
 */
export function breadthWeight(query, genreWords) {
  const remaining = genreWords.map(stem);
  let extra = 0;
  for (const word of tokenize(query)) {
    const i = remaining.indexOf(stem(word));
    if (i >= 0) {
      remaining.splice(i, 1);
      continue;
    }
    extra += word.length <= FRAGMENT_LENGTH ? FRAGMENT_WEIGHT : 1;
  }
  return BREADTH_DECAY ** extra;
}

export function compareScored(a, b) {
  return b.score - a.score || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0);
}

/**
 * Adds up suggestions over all searches: Σ breadthWeight(search) · rankPts(rank).
 * Suggestions are merged by their cleaned text.
 * @returns {Map<string, {text, score, appearances, bestRank}>}
 */
export function aggregateSuggestions(searches, genreWords) {
  const map = new Map();
  for (const search of searches) {
    const weight = breadthWeight(search.text, genreWords);
    const seenHere = new Set();
    search.suggestions.forEach((raw, i) => {
      const text = cleanText(raw);
      if (!text) return;
      const rank = i + 1;
      let entry = map.get(text);
      if (!entry) {
        entry = { text, score: 0, appearances: 0, bestRank: rank };
        map.set(text, entry);
      }
      entry.score += weight * rankPts(rank);
      entry.bestRank = Math.min(entry.bestRank, rank);
      if (!seenHere.has(text)) {
        entry.appearances += 1;
        seenHere.add(text);
      }
    });
  }
  return map;
}

export function rankedSuggestions(suggestionMap) {
  return [...suggestionMap.values()].sort(compareScored);
}

export function gameWeight(playerCount) {
  return GAME_WEIGHT * Math.log10(1 + Math.max(0, Number(playerCount) || 0));
}

/** Collects top games from the game searches, deduplicated by universeId. */
export function collectGames(gameSearches) {
  const byId = new Map();
  for (const gs of gameSearches ?? []) {
    for (const g of gs.games ?? []) {
      const key = g.universeId ?? g.name;
      if (byId.has(key)) continue;
      byId.set(key, {
        name: cleanDisplayName(g.name) || g.name,
        rawName: g.name,
        cleanName: cleanText(g.name),
        playerCount: Number(g.playerCount) || 0,
        url: g.url ?? (g.canonicalUrlPath ? `https://www.roblox.com${g.canonicalUrlPath}` : null),
        foundBy: gs.text,
        universeId: g.universeId ?? null,
      });
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.playerCount - a.playerCount || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

function addSurface(entry, word, amount) {
  entry.surfaces.set(word, (entry.surfaces.get(word) ?? 0) + amount);
}

function bestSurface(surfaces) {
  let best = null;
  let bestCount = -1;
  for (const [word, count] of surfaces) {
    if (count > bestCount || (count === bestCount && word < best)) {
      best = word;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Word and two-word phrase scores keyed by stem. Each suggestion's score is shared among its
 * content words; each two-word phrase gets PHRASE_SHARE of it. Game names add
 * gameWeight(players) to each of their words and phrases (FR-012).
 * Suggestions without the genre (Roblox's fuzzy matches) count only OFF_GENRE_FACTOR.
 * Also records which word stems co-occur in a suggestion or game name.
 */
export function wordScores(suggestions, games, genreWords = []) {
  const words = new Map();
  const phrases = new Map();
  const cooccur = new Set();

  const addWord = (w, amount, fromSuggestion) => {
    const key = stem(w);
    let entry = words.get(key);
    if (!entry) {
      entry = { stem: key, score: 0, surfaces: new Map(), inSuggestions: 0 };
      words.set(key, entry);
    }
    entry.score += amount;
    if (fromSuggestion) entry.inSuggestions += 1;
    addSurface(entry, w, 1);
  };
  const addPhrase = (a, b, amount) => {
    const key = `${stem(a)} ${stem(b)}`;
    let entry = phrases.get(key);
    if (!entry) {
      entry = { stem: key, score: 0, surfaces: new Map() };
      phrases.set(key, entry);
    }
    entry.score += amount;
    addSurface(entry, `${a} ${b}`, 1);
  };
  const addText = (cleaned, amount, fromSuggestion) => {
    const ws = cleaned.split(' ').filter((w) => w && !isFiller(w));
    if (!ws.length) return;
    for (const w of ws) addWord(w, fromSuggestion ? amount / ws.length : amount, fromSuggestion);
    for (let i = 0; i + 1 < ws.length; i++) addPhrase(ws[i], ws[i + 1], amount * PHRASE_SHARE);
    const stems = [...new Set(ws.map(stem))];
    for (const a of stems) for (const b of stems) if (a !== b) cooccur.add(`${a}|${b}`);
  };

  for (const s of suggestions) {
    const onGenre = !genreWords.length || findPhrase(tokenize(s.text), genreWords) >= 0;
    addText(s.text, s.score * (onGenre ? 1 : OFF_GENRE_FACTOR), true);
  }
  for (const g of games) addText(g.cleanName, gameWeight(g.playerCount), false);

  const finish = (map) => {
    for (const entry of map.values()) entry.text = bestSurface(entry.surfaces);
    return map;
  };
  return { words: finish(words), phrases: finish(phrases), cooccur };
}

/** Description keywords: genre first, then words and two-word phrases by score (FR-014). */
export function buildKeywords(genre, genreWords, scores) {
  const genreStems = new Set(genreWords.map(stem));
  const out = [];
  const used = new Set();
  const push = (text, score) => {
    const key = text.split(' ').map(stem).join(' ');
    if (used.has(key)) return;
    used.add(key);
    out.push({ text, score: round(score) });
  };
  const genreScore = (genreWords.length === 1
    ? scores.words.get(stem(genreWords[0]))?.score
    : scores.phrases.get(genreWords.map(stem).join(' '))?.score) ?? 0;
  push(genre, genreScore);
  if (genreWords.length > 1) {
    for (const w of genreWords) {
      if (!isFiller(w)) push(w, scores.words.get(stem(w))?.score ?? 0);
    }
  }
  const rest = [
    ...[...scores.words.values()].filter((e) => !genreStems.has(e.stem)),
    ...[...scores.phrases.values()].filter((e) => e.stem.split(' ').some((s) => !genreStems.has(s))),
  ]
    .filter((e) => /^[a-z][a-z0-9 ]*$/.test(e.text) && e.text.replace(' ', '').length >= 3)
    .filter((e) => !e.text.split(' ').some((w) => isGenreVariant(w, genreWords)))
    .map((e) => ({ text: e.text, score: e.score }))
    .sort(compareScored);
  for (const e of rest) {
    if (out.length >= TOP_KEYWORDS) break;
    push(e.text, e.score);
  }
  return out.slice(0, TOP_KEYWORDS);
}

/** Top searches that contain the genre; Roblox's prefix and fuzzy matches are left out. */
export function buildTopSearches(ranked, genreWords = []) {
  const relevant = genreWords.length
    ? ranked.filter((s) => findPhrase(tokenize(s.text), genreWords) >= 0)
    : ranked;
  return relevant.slice(0, TOP_SEARCHES).map((s, i) => ({
    rank: i + 1,
    text: s.text,
    score: round(s.score),
    appearances: s.appearances,
    bestRank: s.bestRank,
  }));
}

export function buildTopGames(games) {
  return games.slice(0, TOP_GAMES).map((g) => ({
    name: g.name,
    rawName: g.rawName,
    playerCount: g.playerCount,
    url: g.url,
    foundBy: g.foundBy,
  }));
}

/** The best search texts to look up games for, excluding the genre itself (FR-007). */
export function topSearchTexts(searches, genre, genreWords, n) {
  const ranked = rankedSuggestions(aggregateSuggestions(searches, genreWords));
  const genreKey = contentWords(genre).map(stem).join(' ');
  const out = [];
  for (const s of ranked) {
    if (out.length >= n) break;
    if (contentWords(s.text).map(stem).join(' ') === genreKey) continue;
    out.push(s.text);
  }
  return out;
}

export function round(x) {
  return Math.round(x * 1000) / 1000;
}
