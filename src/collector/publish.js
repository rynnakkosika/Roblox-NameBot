// Copies a finished run from a work folder into web/data and merges index.json, so the
// workflow can redo this cleanly on top of the latest main if a push races another run.
//   node src/collector/publish.js --from out --data web/data

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCHEMA_VERSION } from '../engine/constants.js';
import { parseArgs } from './run.js';
import { mergeIndex, readJson } from './store.js';
import { writeFile } from 'node:fs/promises';

export async function publish(from, data) {
  for (const sub of ['runs', 'raw']) {
    const src = path.join(from, sub);
    const dst = path.join(data, sub);
    await mkdir(dst, { recursive: true });
    for (const f of await readdir(src).catch(() => [])) {
      if (f.endsWith('.json')) await copyFile(path.join(src, f), path.join(dst, f));
    }
  }
  const empty = { schemaVersion: SCHEMA_VERSION, runs: [] };
  const fromIndex = await readJson(path.join(from, 'index.json'), empty);
  const dataIndex = await readJson(path.join(data, 'index.json'), empty);
  const merged = mergeIndex(dataIndex, fromIndex.runs);
  await writeFile(path.join(data, 'index.json'), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = parseArgs(process.argv.slice(2));
  publish(args.from ?? 'out', args.data ?? 'web/data').then(
    (merged) => console.log(`index.json now lists ${merged.runs.length} runs`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
