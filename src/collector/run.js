// Collector CLI (contracts/run-trigger.md):
//   node src/collector/run.js --genre <text> --budget <300|1000|2000> [--out web/data] [--issue <n>]
// Exit codes: 0 complete, 2 partial (saved), 1 failed (nothing saved).

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { MAX_CONSECUTIVE_FAILURES, SCHEMA_VERSION, TOP_SEARCHES_FOR_GAMES, DEFAULT_BUDGET } from '../engine/constants.js';
import { QueryPlanner, score, topSearchTexts } from '../engine/index.js';
import { slugify, validateBudget, validateGenre } from '../engine/text.js';
import { createRobloxClient } from './roblox.js';
import { saveRun } from './store.js';
import { realClock } from './throttle.js';

export function makeRunId(date, genre) {
  const iso = date.toISOString(); // 2026-11-09T10:15:00.000Z
  const stamp = `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
  return `${stamp}-${slugify(genre)}`;
}

/**
 * Runs one collection. Network access goes only through `client`.
 * @returns {Promise<{raw, result, status}>}
 */
export async function collect({ genre, budget, client, clock = realClock, log = () => {}, issue = null }) {
  const startedAt = new Date(clock.now());
  const runId = makeRunId(startedAt, genre);
  const planner = new QueryPlanner({ genre, budget });
  const searches = [];
  let consecutiveFailures = 0;
  let aborted = false;

  for (;;) {
    const item = planner.next();
    if (!item) break;
    try {
      const suggestions = await client.getSuggestions(item.text);
      planner.record(item.text, item.step, suggestions);
      searches.push({ order: searches.length, step: item.step, text: item.text, suggestions });
      consecutiveFailures = 0;
      if (searches.length % 50 === 0) {
        log(`${searches.length}/${budget} searches (step ${item.step}: "${item.text}")`);
      }
    } catch (err) {
      consecutiveFailures += 1;
      log(`search "${item.text}" failed: ${err.message}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        aborted = true;
        log(`stopping: ${consecutiveFailures} searches failed in a row`);
        break;
      }
    }
  }

  const gameTexts = [genre, ...topSearchTexts(searches, genre, genre.split(' '), TOP_SEARCHES_FOR_GAMES)];
  const gameSearches = [];
  for (const text of gameTexts) {
    try {
      gameSearches.push({ text, games: await client.searchGames(text) });
    } catch (err) {
      log(`game search "${text}" failed: ${err.message}`);
    }
  }

  const status = searches.length === 0 ? 'failed' : aborted ? 'partial' : 'complete';
  const run = {
    runId,
    genre,
    budget,
    searchesMade: searches.length,
    gameSearchesMade: gameSearches.length,
    status,
    stopReason: aborted ? 'rate-limited' : planner.stopReason,
    startedAt: startedAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    finishedAt: new Date(clock.now()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    issue,
  };
  const raw = { schemaVersion: SCHEMA_VERSION, run, searches, gameSearches };
  const result = status === 'failed' ? null : score(raw);
  return { raw, result, status };
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const g = validateGenre(args.genre);
  if (!g.ok) {
    console.error(`Invalid genre: ${g.error}`);
    return 1;
  }
  const budget = validateBudget(args.budget ?? DEFAULT_BUDGET);
  if (!budget) {
    console.error('Invalid budget: use 300, 1000 or 2000.');
    return 1;
  }
  const out = typeof args.out === 'string' ? args.out : 'web/data';
  const issue = args.issue ? Number(args.issue) : null;
  const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

  log(`Collecting "${g.genre}" with ${budget} searches`);
  const client = createRobloxClient({ log });
  const { raw, result, status } = await collect({ genre: g.genre, budget, client, log, issue });
  log(`Done: ${raw.run.searchesMade} searches, ${raw.run.gameSearchesMade} game searches, ` +
    `${client.stats.retries} retries, status ${status}`);

  if (process.env.GITHUB_OUTPUT) {
    const lines = [`run_id=${raw.run.runId}`, `status=${status}`, `top_name=${result?.names[0]?.name ?? ''}`,
      `searches=${raw.run.searchesMade}`];
    await appendFile(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  }
  if (!result) {
    console.error('No search data was collected; nothing saved.');
    return 1;
  }
  await saveRun(out, raw, result);
  log(`Saved ${out}/runs/${raw.run.runId}.json`);
  result.names.slice(0, 10).forEach((n) => log(`  ${n.position}. ${n.name}`));
  return status === 'complete' ? 0 : 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
