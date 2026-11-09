// Popular searches page: #/searches (all genres) and #/searches/{genre}.

import { latestRunPerGenre, popularSearches } from '../src/engine/popular.js';
import { DATA_DIR } from './config.js';
import { fetchJson, formatDate, h } from './dom.js';

const ALL_LIMIT = 100;

function titleCaseGenre(genre) {
  return genre.replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function renderSearches(root, genre = null) {
  document.title = 'Popular searches · Roblox-NameBot';
  root.replaceChildren(h('p', { class: 'muted' }, 'Loading searches…'));

  let runs;
  try {
    runs = latestRunPerGenre((await fetchJson(`${DATA_DIR}/index.json`)).runs);
  } catch {
    root.replaceChildren(h('p', { class: 'muted' }, 'Could not load the run history.'));
    return;
  }
  if (!runs.length) {
    root.replaceChildren(
      h('h2', {}, 'Popular searches'),
      h('p', { class: 'muted' }, 'No runs yet. ', h('a', { href: '#/' }, 'Start one'), '.'),
    );
    return;
  }

  const selected = genre && runs.some((r) => r.genre === genre) ? genre : null;
  const wanted = selected ? runs.filter((r) => r.genre === selected) : runs;
  const results = (
    await Promise.all(
      wanted.map((r) => fetchJson(`${DATA_DIR}/runs/${encodeURIComponent(r.runId)}.json`).catch(() => null)),
    )
  ).filter(Boolean);
  const rows = popularSearches(results, { genre: selected, limit: selected ? Infinity : ALL_LIMIT });

  const picker = h(
    'select',
    { id: 'genre-filter', 'aria-label': 'Genre' },
    h('option', { value: '', selected: !selected }, `All genres (${runs.length})`),
    runs.map((r) => h('option', { value: r.genre, selected: r.genre === selected }, titleCaseGenre(r.genre))),
  );
  picker.addEventListener('change', () => {
    window.location.hash = picker.value ? `#/searches/${encodeURIComponent(picker.value)}` : '#/searches';
  });

  const run = selected ? results[0]?.run : null;
  const intro = selected && run
    ? `The ${rows.length} most popular Roblox searches containing “${selected}”, from ` +
      `${run.searchesMade} searches collected ${formatDate(run.finishedAt)}.`
    : `The ${rows.length} most popular searches across all genres, from the newest run of each genre.`;

  root.replaceChildren(
    h(
      'section',
      { class: 'run-header' },
      h('a', { href: '#/', class: 'back' }, '← All runs'),
      h('h2', {}, 'Popular searches'),
    ),
    h(
      'section',
      { class: 'card' },
      h('label', { for: 'genre-filter', class: 'filter-label' }, 'Show'),
      picker,
      h('p', { class: 'muted' }, intro),
      h(
        'p',
        { class: 'muted' },
        'Popularity 100% = the most popular search of its genre; 50% = half as popular. Roblox does not publish search ' +
          'counts; popularity comes from how high and how often a search appeared in Roblox’s ' +
          'search suggestions.',
      ),
      rows.length ? searchList(rows, !selected) : h('p', { class: 'muted' }, 'No searches saved for this genre.'),
      selected && run
        ? h('p', { class: 'more' }, h('a', { href: `#/run/${encodeURIComponent(run.runId)}` }, `Name suggestions for ${titleCaseGenre(selected)} →`))
        : null,
    ),
  );
}

export function searchList(rows, showGenre) {
  return h(
    'ol',
    { class: 'popular' },
    rows.map((r) =>
      h(
        'li',
        {},
        h('span', { class: 'pos' }, String(r.rank)),
        h(
          'span',
          { class: 'text' },
          r.text,
          showGenre
            ? h('a', { class: 'tag', href: `#/searches/${encodeURIComponent(r.genre)}` }, r.genre)
            : null,
          h('span', { class: 'bar', 'aria-hidden': 'true' }, h('span', { style: `width:${Math.max(2, r.index)}%` })),
        ),
        h(
          'span',
          { class: 'count', title: `Popularity ${r.index}% of the genre's top search, seen in ${r.appearances} searches` },
          h('strong', {}, `${r.index}%`),
          h('br'),
          `in ${r.appearances} searches`,
        ),
      ),
    ),
  );
}
