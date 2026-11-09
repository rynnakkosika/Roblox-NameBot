import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRobloxClient } from '../src/collector/roblox.js';
import { collect, makeRunId } from '../src/collector/run.js';
import { parseIssueBody, readRequest } from '../src/collector/request.js';
import { mergeIndex, saveRun } from '../src/collector/store.js';
import { Throttle } from '../src/collector/throttle.js';
import { publish } from '../src/collector/publish.js';

function fakeClock(start = Date.UTC(2026, 10, 9, 10, 0, 0)) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
  };
}

function response(status, body = {}, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  };
}

const RATES = { autocomplete: { perWindow: 3, windowMs: 1000 }, gameSearch: { perWindow: 3, windowMs: 1000 } };

test('throttle never exceeds the configured rate', async () => {
  const clock = fakeClock();
  const th = new Throttle({ perWindow: 3, windowMs: 1000, clock });
  const stamps = [];
  for (let i = 0; i < 20; i++) {
    await th.take();
    stamps.push(clock.now());
  }
  for (let i = 3; i < stamps.length; i++) assert.ok(stamps[i] - stamps[i - 3] >= 1000);
});

test('throttle pauses until reset when no requests remain', async () => {
  const clock = fakeClock();
  const th = new Throttle({ perWindow: 100, windowMs: 60000, clock });
  await th.take();
  th.observe(new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '23' }));
  const before = clock.now();
  await th.take();
  assert.ok(clock.now() - before >= 23000);
});

test('429 is retried with exponential back-off', async () => {
  const clock = fakeClock();
  let calls = 0;
  const fetch = async () => {
    calls++;
    return calls <= 2 ? response(429) : response(200, { entries: [{ type: 1, searchQuery: 'forest' }] });
  };
  const client = createRobloxClient({ fetch, clock, rates: RATES });
  const start = clock.now();
  assert.deepEqual(await client.getSuggestions('forest'), ['forest']);
  assert.equal(calls, 3);
  assert.ok(clock.now() - start >= 2000 + 4000);
  assert.equal(client.stats.retries, 2);
});

test('gives up after 6 retries, back-off capped at 60 s', async () => {
  const clock = fakeClock();
  let calls = 0;
  const client = createRobloxClient({
    fetch: async () => {
      calls++;
      return response(503);
    },
    clock,
    rates: RATES,
  });
  await assert.rejects(client.getSuggestions('x'), /HTTP 503/);
  assert.equal(calls, 7);
  const waited = client.stats.waitedMs;
  assert.equal(waited, 2000 + 4000 + 8000 + 16000 + 32000 + 60000);
});

test('client errors other than 429 are not retried', async () => {
  let calls = 0;
  const client = createRobloxClient({
    fetch: async () => {
      calls++;
      return response(404);
    },
    clock: fakeClock(),
    rates: RATES,
  });
  await assert.rejects(client.getSuggestions('x'), /HTTP 404/);
  assert.equal(calls, 1);
});

test('requests send a generic User-Agent and the encoded prefix', async () => {
  let seen;
  const client = createRobloxClient({
    fetch: async (url, init) => {
      seen = { url, init };
      return response(200, { entries: [] });
    },
    clock: fakeClock(),
    rates: RATES,
  });
  await client.getSuggestions('tower defense a');
  assert.match(seen.url, /get-suggestion\/tower%20defense%20a$/);
  assert.equal(seen.init.headers['User-Agent'], 'Roblox-NameBot/1.0');
});

test('suggestions: at most 10, in order', async () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({ type: 1, searchQuery: `forest ${i}` }));
  const client = createRobloxClient({ fetch: async () => response(200, { entries }), clock: fakeClock(), rates: RATES });
  const s = await client.getSuggestions('forest');
  assert.equal(s.length, 10);
  assert.equal(s[0], 'forest 0');
});

test('game search skips sponsored games and keeps the first 10', async () => {
  const contents = (n, sponsored) =>
    Array.from({ length: n }, (_, i) => ({
      universeId: sponsored ? 900 + i : i,
      name: `Game ${i}`,
      playerCount: 100 - i,
      isSponsored: sponsored,
      contentType: 'Game',
      canonicalUrlPath: `/games/${i}/Game`,
    }));
  const body = {
    searchResults: [
      { contentGroupType: 'Game', contents: contents(2, true) },
      { contentGroupType: 'Game', contents: contents(8, false) },
      { contentGroupType: 'Avatar', contents: [{ name: 'hat' }] },
      { contentGroupType: 'Game', contents: contents(8, false).map((g) => ({ ...g, universeId: g.universeId + 50 })) },
    ],
  };
  const client = createRobloxClient({ fetch: async () => response(200, body), clock: fakeClock(), rates: RATES });
  const games = await client.searchGames('forest');
  assert.equal(games.length, 10);
  assert.ok(games.every((g) => g.universeId < 900));
  assert.equal(games[0].playerCount, 100);
});

function fakeClient({ failAfter = Infinity } = {}) {
  let n = 0;
  return {
    async getSuggestions(text) {
      n++;
      if (n > failAfter) throw new Error('HTTP 429');
      const base = text.split(' ').slice(0, 2).join(' ');
      return [`${base} camp`, 'forest tycoon', `${text} q`, 'dark forest', 'forest animals'];
    },
    async searchGames(text) {
      return [{ universeId: text.length, name: `[NEW] ${text} Game 🌲`, playerCount: 1000, canonicalUrlPath: '/games/1/x' }];
    },
  };
}

test('collect makes exactly the budget of searches plus 10 game searches', async () => {
  const { raw, result, status } = await collect({ genre: 'forest', budget: 300, client: fakeClient(), clock: fakeClock() });
  assert.equal(status, 'complete');
  assert.equal(raw.searches.length, 300);
  assert.equal(raw.run.searchesMade, 300);
  assert.equal(raw.run.stopReason, 'budget');
  assert.equal(raw.gameSearches.length, 10);
  assert.equal(raw.gameSearches[0].text, 'forest');
  assert.equal(raw.run.runId, '20261109-100000-forest');
  assert.ok(result.names.length > 0);
});

test('10 failures in a row stop the run as partial', async () => {
  const { raw, status } = await collect({ genre: 'forest', budget: 300, client: fakeClient({ failAfter: 5 }), clock: fakeClock() });
  assert.equal(status, 'partial');
  assert.equal(raw.run.searchesMade, 5);
  assert.equal(raw.run.stopReason, 'rate-limited');
});

test('no data at all means failed', async () => {
  const { status, result } = await collect({ genre: 'forest', budget: 300, client: fakeClient({ failAfter: 0 }), clock: fakeClock() });
  assert.equal(status, 'failed');
  assert.equal(result, null);
});

test('runId is date-time plus genre slug', () => {
  assert.equal(makeRunId(new Date('2026-11-09T10:15:00Z'), 'tower defense'), '20261109-101500-tower-defense');
});

const entry = (runId, finishedAt, status = 'complete') => ({ runId, genre: 'g', budget: 300, searchesMade: 300, status, finishedAt, topName: 'X' });

test('index merge keeps entries from concurrent runs, newest first, no failed runs', () => {
  const index = { schemaVersion: 1, runs: [entry('a', '2026-11-09T10:00:00Z')] };
  const merged = mergeIndex(index, [entry('b', '2026-11-09T11:00:00Z'), entry('c', '2026-11-09T12:00:00Z', 'failed')]);
  assert.deepEqual(merged.runs.map((r) => r.runId), ['b', 'a']);
  const again = mergeIndex(merged, [entry('a', '2026-11-09T10:00:00Z', 'partial')]);
  assert.equal(again.runs.length, 2);
  assert.equal(again.runs[1].status, 'partial');
});

test('saveRun and publish write run files and merge index.json', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'namebot-'));
  try {
    const { raw, result } = await collect({ genre: 'forest', budget: 300, client: fakeClient(), clock: fakeClock() });
    const out = path.join(dir, 'out');
    const data = path.join(dir, 'data');
    await saveRun(out, raw, result);
    // Another run already published to data meanwhile.
    const other = await collect({ genre: 'horror', budget: 300, client: fakeClient(), clock: fakeClock(Date.UTC(2026, 10, 9, 9)) });
    await saveRun(data, other.raw, other.result);
    const merged = await publish(out, data);
    assert.deepEqual(merged.runs.map((r) => r.genre), ['forest', 'horror']);
    const saved = JSON.parse(await readFile(path.join(data, 'runs', `${raw.run.runId}.json`), 'utf8'));
    assert.equal(saved.run.genre, 'forest');
    const savedRaw = JSON.parse(await readFile(path.join(data, 'raw', `${raw.run.runId}.json`), 'utf8'));
    assert.equal(savedRaw.searches.length, 300);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('issue form body is parsed and validated', () => {
  const body = '### Genre\n\nTower Defense\n\n### Searches\n\n2000\n';
  assert.deepEqual(parseIssueBody(body), { genre: 'Tower Defense', budget: '2000' });
  assert.deepEqual(readRequest({ ISSUE_BODY: body }), { ok: true, genre: 'tower defense', budget: 2000 });
  assert.equal(readRequest({ ISSUE_BODY: '### Genre\n\n$(rm -rf /)\n\n### Searches\n\n300' }).ok, false);
  assert.equal(readRequest({ ISSUE_BODY: '### Genre\n\nforest\n\n### Searches\n\n500' }).ok, false);
  assert.deepEqual(readRequest({ INPUT_GENRE: 'horror', INPUT_BUDGET: '' }), { ok: true, genre: 'horror', budget: 1000 });
});

test('rescore reproduces saved results exactly (SC-006)', async () => {
  const { rescore } = await import('../src/collector/rescore.js');
  const dir = await mkdtemp(path.join(tmpdir(), 'namebot-'));
  try {
    const { raw, result } = await collect({ genre: 'forest', budget: 300, client: fakeClient(), clock: fakeClock() });
    await saveRun(dir, raw, result);
    const report = await rescore({ data: dir, check: true });
    assert.deepEqual(report.map((r) => r.status), ['identical']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
