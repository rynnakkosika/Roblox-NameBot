// Records live Roblox data as test fixtures (T003). Makes real requests; run by hand only.
//   node tools/record-fixtures.js [budget] [genre ...]
// Writes tests/fixtures/{genre-slug}.raw.json.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRobloxClient } from '../src/collector/roblox.js';
import { collect } from '../src/collector/run.js';
import { slugify } from '../src/engine/text.js';

const [budgetArg, ...genreArgs] = process.argv.slice(2);
const budget = Number(budgetArg) || 300;
const genres = genreArgs.length ? genreArgs : ['forest', 'horror', 'tower defense'];
const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

await mkdir('tests/fixtures', { recursive: true });
for (const genre of genres) {
  log(`Recording "${genre}" (${budget} searches)`);
  const client = createRobloxClient({ log });
  const { raw, status } = await collect({ genre, budget, client, log });
  const file = `tests/fixtures/${slugify(genre)}.raw.json`;
  await writeFile(file, `${JSON.stringify(raw)}\n`);
  log(`${status}: ${raw.searches.length} searches, ${raw.gameSearches.length} game searches → ${file}`);
}
