// Reads a run request from a GitHub issue form body or workflow_dispatch inputs (env vars) and
// writes validated `genre` and `budget` to $GITHUB_OUTPUT. User text never reaches a shell.
//   ISSUE_BODY=... node src/collector/request.js
//   INPUT_GENRE=forest INPUT_BUDGET=1000 node src/collector/request.js

import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DEFAULT_BUDGET } from '../engine/constants.js';
import { validateBudget, validateGenre } from '../engine/text.js';

/** Parses the markdown GitHub produces from the issue form ("### Genre\n\nforest\n\n..."). */
export function parseIssueBody(body) {
  const fields = {};
  const parts = String(body ?? '').replace(/\r\n/g, '\n').split(/^###\s+/m);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl < 0) continue;
    const label = part.slice(0, nl).trim().toLowerCase();
    const value = part.slice(nl + 1).trim();
    fields[label] = value === '_No response_' ? '' : value;
  }
  return { genre: fields.genre ?? '', budget: fields.searches ?? fields.budget ?? '' };
}

/** @returns {{ok: true, genre, budget} | {ok: false, error}} */
export function readRequest(env) {
  const source = env.ISSUE_BODY ? parseIssueBody(env.ISSUE_BODY) : {
    genre: env.INPUT_GENRE ?? '',
    budget: env.INPUT_BUDGET ?? '',
  };
  const g = validateGenre(source.genre);
  if (!g.ok) return { ok: false, error: g.error };
  const budget = source.budget === '' ? DEFAULT_BUDGET : validateBudget(source.budget);
  if (!budget) return { ok: false, error: 'Searches must be 300, 1000 or 2000.' };
  return { ok: true, genre: g.genre, budget };
}

async function main() {
  const req = readRequest(process.env);
  const out = process.env.GITHUB_OUTPUT;
  const lines = req.ok
    ? [`ok=true`, `genre=${req.genre}`, `budget=${req.budget}`]
    : [`ok=false`, `error=${req.error.replace(/\n/g, ' ')}`];
  if (out) await appendFile(out, `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  return req.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((code) => process.exit(code));
}
