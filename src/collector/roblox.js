// Clients for Roblox's public, unauthenticated search endpoints (research R1, R2).

import { randomUUID } from 'node:crypto';
import {
  BACKOFF_MAX_MS,
  BACKOFF_START_MS,
  GAMES_PER_SEARCH,
  MAX_RETRIES,
  RATES,
  SUGGESTIONS_PER_SEARCH,
} from '../engine/constants.js';
import { Throttle, realClock } from './throttle.js';

export const USER_AGENT = 'Roblox-NameBot/1.0';
const AUTOCOMPLETE_URL = 'https://apis.roblox.com/games-autocomplete/v1/get-suggestion/';
const SEARCH_URL = 'https://apis.roblox.com/search-api/omni-search';

export class RequestFailed extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {{fetch?: Function, clock?: {now, sleep}, rates?: object, log?: Function,
 *          maxRetries?: number}} options
 */
export function createRobloxClient({
  fetch = globalThis.fetch,
  clock = realClock,
  rates = RATES,
  log = () => {},
  maxRetries = MAX_RETRIES,
} = {}) {
  const throttles = {
    autocomplete: new Throttle({ ...rates.autocomplete, clock }),
    gameSearch: new Throttle({ ...rates.gameSearch, clock }),
  };
  const sessionId = randomUUID();
  const stats = { requests: 0, retries: 0, waitedMs: 0 };

  async function request(url, throttle) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await throttle.take();
      stats.requests += 1;
      let res;
      try {
        res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        });
      } catch (err) {
        lastError = new RequestFailed(`network error: ${err.message}`, 0);
      }
      if (res) {
        throttle.observe(res.headers);
        if (res.ok) return res.json();
        lastError = new RequestFailed(`HTTP ${res.status}`, res.status);
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable) throw lastError;
      }
      if (attempt === maxRetries) break;
      const retryAfter = Number(res?.headers?.get?.('retry-after'));
      const backoff = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** attempt);
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
      stats.retries += 1;
      stats.waitedMs += wait;
      log(`  ${lastError.message}, retrying in ${Math.round(wait / 1000)} s`);
      throttle.pause(wait);
    }
    throw lastError;
  }

  /** Top 10 autocomplete suggestions for a text, in Roblox's order. */
  async function getSuggestions(prefix) {
    const json = await request(AUTOCOMPLETE_URL + encodeURIComponent(prefix), throttles.autocomplete);
    return (json.entries ?? [])
      .map((e) => e.searchQuery)
      .filter((q) => typeof q === 'string' && q.trim())
      .slice(0, SUGGESTIONS_PER_SEARCH);
  }

  /** Top 10 non-sponsored games for a search, with current player counts. */
  async function searchGames(query) {
    const params = new URLSearchParams({ searchQuery: query, pageType: 'all', sessionId });
    const json = await request(`${SEARCH_URL}?${params}`, throttles.gameSearch);
    const games = [];
    for (const group of json.searchResults ?? []) {
      if (group.contentGroupType !== 'Game') continue;
      for (const g of group.contents ?? []) {
        if (g.isSponsored || (g.contentType && g.contentType !== 'Game')) continue;
        games.push({
          universeId: g.universeId,
          name: g.name,
          playerCount: Number(g.playerCount) || 0,
          canonicalUrlPath: g.canonicalUrlPath ?? null,
        });
        if (games.length >= GAMES_PER_SEARCH) return games;
      }
    }
    return games;
  }

  return { getSuggestions, searchGames, stats };
}
