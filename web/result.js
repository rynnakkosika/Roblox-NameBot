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
  root.replaceChildren(header(result.run), names(result));
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
      `${run.searchesMade} of ${run.budget} searches · ${run.gameSearchesMade ?? 0} game searches · collected ${formatDate(run.finishedAt)}`,
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
