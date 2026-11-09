// Result page: run header and the name suggestions with copy buttons.

import { DATA_DIR } from './config.js';
import { copyButton, fetchJson, formatDate, h } from './dom.js';

export async function renderResult(root, runId) {
  root.replaceChildren(h('p', { class: 'muted' }, 'Loading result…'));
  let result;
  try {
    result = await fetchJson(`${DATA_DIR}/runs/${encodeURIComponent(runId)}.json`);
  } catch {
    root.replaceChildren(
      h('section', { class: 'card' },
        h('h2', {}, 'Result not found'),
        h('p', {}, 'This run does not exist yet. If it just finished, wait a minute and reload.'),
        h('a', { href: '#/' }, '← All runs'),
      ),
    );
    return;
  }
  document.title = `${titleGenre(result.run.genre)} · Roblox-NameBot`;
  root.replaceChildren(
    header(result.run),
    names(result),
    keywords(result),
    topSearches(result),
    topGames(result),
  );
}

/** "today", "yesterday", "5 days ago", "3 months ago". */
export function dataAge(iso, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function formatPlayers(n) {
  return Number(n).toLocaleString('en-US');
}

function titleGenre(genre) {
  return genre.replace(/\b\w/g, (c) => c.toUpperCase());
}

function header(run) {
  const status = run.status === 'partial'
    ? h('p', { class: 'warning' }, `Partial run: Roblox kept refusing requests, so only ${run.searchesMade} of ${run.budget} searches were made.`)
    : null;
  return h(
    'section',
    { class: 'run-header' },
    h('a', { href: '#/', class: 'back' }, '← All runs'),
    h('h2', {}, titleGenre(run.genre)),
    h(
      'p',
      { class: 'meta' },
      `${run.searchesMade} of ${run.budget} searches · ${run.gameSearchesMade ?? 0} game searches · ` +
        `collected ${formatDate(run.finishedAt)} (${dataAge(run.finishedAt)})`,
    ),
    status,
  );
}

function names(result) {
  const list = h(
    'ol',
    { class: 'names' },
    result.names.map((n) =>
      h(
        'li',
        {},
        h('span', { class: 'pos' }, String(n.position)),
        h('span', { class: 'name' }, n.name),
        copyButton(n.name),
      ),
    ),
  );
  return h(
    'section',
    { class: 'card' },
    h('h3', {}, 'Name suggestions'),
    result.namesNote ? h('p', { class: 'muted' }, result.namesNote) : null,
    list,
  );
}

function keywords(result) {
  const words = (result.keywords ?? []).map((k) => k.text);
  if (!words.length) return null;
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', {}, 'Keywords for the description'), copyButton(words.join(', '), 'Copy all')),
    h('p', { class: 'muted' }, 'Words and phrases players search for, best first.'),
    h('ul', { class: 'chips' }, words.map((w) => h('li', {}, w))),
  );
}

function topSearches(result) {
  const rows = result.topSearches ?? [];
  if (!rows.length) return null;
  return h(
    'section',
    { class: 'card' },
    h('h3', {}, 'Most popular searches'),
    h(
      'p',
      { class: 'muted' },
      'Ranked by how high and how often each appeared in Roblox search suggestions. ' +
        'Roblox does not publish search counts.',
    ),
    h(
      'ol',
      { class: 'searches' },
      rows.map((s) =>
        h(
          'li',
          {},
          h('span', { class: 'pos' }, String(s.rank)),
          h('span', { class: 'text' }, s.text),
          h('span', { class: 'count' }, `in ${s.appearances} searches`),
        ),
      ),
    ),
  );
}

function topGames(result) {
  const games = result.topGames ?? [];
  if (!games.length) return null;
  return h(
    'section',
    { class: 'card' },
    h('h3', {}, 'Top games right now'),
    h('p', { class: 'muted' }, 'Players online when the data was collected.'),
    h(
      'ol',
      { class: 'games' },
      games.map((g) =>
        h(
          'li',
          {},
          h(
            'span',
            { class: 'text' },
            g.url ? h('a', { href: g.url, target: '_blank', rel: 'noopener' }, g.name) : g.name,
            h('span', { class: 'found' }, `found by “${g.foundBy}”`),
          ),
          h('span', { class: 'count' }, formatPlayers(g.playerCount)),
        ),
      ),
    ),
  );
}
