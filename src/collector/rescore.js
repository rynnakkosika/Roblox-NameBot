// Re-scores saved raw data with the current engine, without contacting Roblox (T034).
//   node src/collector/rescore.js --all [--data web/data] [--check]
//   node src/collector/rescore.js --run <runId> [--data web/data] [--check]
// --check only reports whether the saved result is identical to a fresh score (SC-006).

import { readdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCHEMA_VERSION } from '../engine/constants.js';
import { score } from '../engine/index.js';
import { parseArgs } from './run.js';
import { indexEntry, mergeIndex, readJson } from './store.js';

export async function rescore({ data = 'web/data', runIds = null, check = false } = {}) {
  const rawDir = path.join(data, 'raw');
  const ids = runIds ?? (await readdir(rawDir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const report = [];
  const entries = [];
  for (const id of ids) {
    const raw = await readJson(path.join(rawDir, `${id}.json`), null);
    if (!raw) {
      report.push({ id, status: 'missing' });
      continue;
    }
    const fresh = score(raw);
    const file = path.join(data, 'runs', `${id}.json`);
    const saved = await readJson(file, null);
    const same = isDeepStrictEqual(saved, JSON.parse(JSON.stringify(fresh)));
    report.push({ id, status: same ? 'identical' : 'changed', topName: fresh.names[0]?.name ?? null });
    if (!check && !same) {
      await writeFile(file, `${JSON.stringify(fresh, null, 2)}\n`);
      entries.push(indexEntry(fresh));
    }
  }
  if (entries.length) {
    const indexFile = path.join(data, 'index.json');
    const index = await readJson(indexFile, { schemaVersion: SCHEMA_VERSION, runs: [] });
    await writeFile(indexFile, `${JSON.stringify(mergeIndex(index, entries), null, 2)}\n`);
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = parseArgs(process.argv.slice(2));
  const runIds = typeof args.run === 'string' ? [args.run] : null;
  if (!runIds && !args.all) {
    console.error('Use --all or --run <runId>.');
    process.exit(1);
  }
  rescore({ data: typeof args.data === 'string' ? args.data : 'web/data', runIds, check: Boolean(args.check) }).then(
    (report) => {
      for (const r of report) console.log(`${r.id}: ${r.status}${r.topName ? ` (top: ${r.topName})` : ''}`);
      if (args.check && report.some((r) => r.status !== 'identical')) process.exit(2);
    },
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
