// Writes run files and keeps web/data/index.json (contracts/result-files.md).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_VERSION } from '../engine/constants.js';

export function indexEntry(result) {
  const { run } = result;
  return {
    runId: run.runId,
    genre: run.genre,
    budget: run.budget,
    searchesMade: run.searchesMade,
    status: run.status,
    finishedAt: run.finishedAt,
    topName: result.names[0]?.name ?? null,
  };
}

/** Adds or replaces an entry by runId; newest first; only complete and partial runs. */
export function mergeIndex(index, entries) {
  const runs = new Map((index?.runs ?? []).map((r) => [r.runId, r]));
  for (const e of entries) runs.set(e.runId, e);
  const list = [...runs.values()]
    .filter((r) => r.status === 'complete' || r.status === 'partial')
    .sort((a, b) =>
      a.finishedAt === b.finishedAt
        ? (a.runId < b.runId ? 1 : -1)
        : a.finishedAt < b.finishedAt ? 1 : -1,
    );
  return { schemaVersion: SCHEMA_VERSION, runs: list };
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data, pretty = true) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, pretty ? 2 : 0)}\n`);
}

/** Saves result + raw files for one run and merges it into the folder's index.json. */
export async function saveRun(dataDir, raw, result) {
  const id = result.run.runId;
  await writeJson(path.join(dataDir, 'runs', `${id}.json`), result);
  await writeJson(path.join(dataDir, 'raw', `${id}.json`), raw, false);
  const indexFile = path.join(dataDir, 'index.json');
  const index = await readJson(indexFile, { schemaVersion: SCHEMA_VERSION, runs: [] });
  await writeJson(indexFile, mergeIndex(index, [indexEntry(result)]));
}
