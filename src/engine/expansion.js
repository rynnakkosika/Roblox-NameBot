// Search expansion order (FR-005, FR-006). The collector asks next() for the text to search and
// feeds the suggestions back with record(). No network access here.

import { STEP5_RERANK_EVERY } from './constants.js';
import { breadthWeight, rankPts } from './scoring.js';

export const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** The form a suggestion takes when it is searched itself. */
export function normalizeQuery(text) {
  return String(text ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class QueryPlanner {
  /**
   * @param {{genre: string, budget: number, rerankEvery?: number}} options
   *   genre is the validated, lower-case genre.
   */
  constructor({ genre, budget, rerankEvery = STEP5_RERANK_EVERY }) {
    this.genre = genre;
    this.genreWords = genre.split(' ');
    this.budget = budget;
    this.rerankEvery = rerankEvery;
    this.made = 0;
    this.stopReason = null;
    this.seen = new Set();
    this.queued3 = new Set();
    this.queues = {
      1: [genre],
      2: LETTERS.map((l) => `${genre} ${l}`),
      3: [],
      4: LETTERS.flatMap((a) => LETTERS.map((b) => `${genre} ${a}${b}`)),
    };
    this.scores = new Map();
    this.step5Bases = [];
    this.step5Done = new Set();
    this.sinceRerank = Infinity;
  }

  get done() {
    return this.stopReason !== null;
  }

  /** @returns {{text: string, step: number} | null} */
  next() {
    if (this.stopReason) return null;
    if (this.made >= this.budget) {
      this.stopReason = 'budget';
      return null;
    }
    for (const step of [1, 2, 3, 4]) {
      const queue = this.queues[step];
      while (queue.length) {
        const text = queue.shift();
        if (!this.seen.has(text)) {
          this.seen.add(text);
          return { text, step };
        }
      }
    }
    const text = this.#nextStep5();
    if (text) {
      this.seen.add(text);
      return { text, step: 5 };
    }
    this.stopReason = 'exhausted';
    return null;
  }

  /** Feeds back the suggestions Roblox returned for a search made with next(). */
  record(text, step, suggestions) {
    this.made += 1;
    const weight = breadthWeight(text, this.genreWords);
    suggestions.slice(0, 10).forEach((raw, i) => {
      const key = normalizeQuery(raw);
      if (!key) return;
      this.scores.set(key, (this.scores.get(key) ?? 0) + weight * rankPts(i + 1));
      if (step <= 2 && !this.seen.has(key) && !this.queued3.has(key)) {
        this.queued3.add(key);
        this.queues[3].push(key);
      }
    });
  }

  /** Step 5: best-scoring searches found so far + a letter, re-ranked as data arrives. */
  #nextStep5() {
    if (this.sinceRerank >= this.rerankEvery) {
      this.step5Bases = [...this.scores.entries()]
        .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
        .map(([text]) => text);
      this.sinceRerank = 0;
    }
    for (const base of this.step5Bases) {
      if (this.step5Done.has(base)) continue;
      for (const letter of LETTERS) {
        const text = `${base} ${letter}`;
        if (!this.seen.has(text)) {
          this.sinceRerank += 1;
          return text;
        }
      }
      this.step5Done.add(base);
    }
    if (this.sinceRerank > 0) {
      // New suggestions may have arrived since the last ranking; look once more.
      this.sinceRerank = Infinity;
      return this.#nextStep5();
    }
    return null;
  }
}
