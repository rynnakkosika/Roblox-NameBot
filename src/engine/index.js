// Pure entry point: raw collected data → result shown on the page (contracts/result-files.md).

import { ENGINE_VERSION, SCHEMA_VERSION } from './constants.js';
import { buildNames } from './naming.js';
import {
  aggregateSuggestions,
  buildKeywords,
  buildTopGames,
  buildTopSearches,
  collectGames,
  rankedSuggestions,
  wordScores,
} from './scoring.js';

export { QueryPlanner } from './expansion.js';
export { validateName } from './naming.js';
export { topSearchTexts } from './scoring.js';

/**
 * @param raw { run: {genre, ...}, searches: [{text, step, order, suggestions}],
 *              gameSearches: [{text, games: [...]}] }
 */
export function score(raw) {
  const genre = raw.run.genre;
  const genreWords = genre.split(' ');
  const ranked = rankedSuggestions(aggregateSuggestions(raw.searches, genreWords));
  const games = collectGames(raw.gameSearches);
  const scores = wordScores(ranked, games, genreWords);
  const { names, namesNote } = buildNames({ genreWords, ranked, scores, games });
  return {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    run: { ...raw.run, genreWords },
    names,
    namesNote,
    keywords: buildKeywords(genre, genreWords, scores),
    topSearches: buildTopSearches(ranked),
    topGames: buildTopGames(games),
  };
}
