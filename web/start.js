// Start page: genre form that opens the pre-filled GitHub issue, and the run history.

import { BUDGETS, DEFAULT_BUDGET } from '../src/engine/constants.js';
import { validateGenre } from '../src/engine/text.js';
import { DATA_DIR, etaMinutes, issueUrl } from './config.js';
import { fetchJson, formatDate, h } from './dom.js';

export async function renderStart(root) {
  const error = h('p', { class: 'error', role: 'alert', hidden: true });
  const notice = h('p', { class: 'notice', hidden: true });
  const genreInput = h('input', {
    id: 'genre',
    name: 'genre',
    type: 'text',
    maxlength: 50,
    autocomplete: 'off',
    autocapitalize: 'none',
    placeholder: 'forest, horror, tower defense…',
    required: true,
  });
  const budgetSelect = h(
    'select',
    { id: 'budget', name: 'budget' },
    BUDGETS.map((b) =>
      h('option', { value: b, selected: b === DEFAULT_BUDGET }, `${b} searches · ~${etaMinutes(b)} min`),
    ),
  );

  const form = h(
    'form',
    { class: 'card start', novalidate: true },
    h('label', { for: 'genre' }, 'Game genre'),
    genreInput,
    h('label', { for: 'budget' }, 'How many Roblox searches'),
    budgetSelect,
    error,
    h('button', { type: 'submit', class: 'primary' }, 'Start run'),
    h(
      'p',
      { class: 'hint' },
      'Opens a pre-filled GitHub issue. Submit it and the run starts; the result appears ' +
        'below and the issue gets a link when it is ready.',
    ),
    notice,
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const g = validateGenre(genreInput.value);
    if (!g.ok) {
      error.textContent = g.error;
      error.hidden = false;
      genreInput.focus();
      return;
    }
    error.hidden = true;
    const budget = Number(budgetSelect.value);
    const url = issueUrl(g.genre, budget);
    notice.textContent =
      `Submit the issue on GitHub to start "${g.genre}". ` +
      `The result should be ready in about ${etaMinutes(budget)} minutes.`;
    notice.hidden = false;
    // window.open returns null with "noopener", so detach the opener by hand instead.
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url;
  });

  const history = h('section', { class: 'history' }, h('h2', {}, 'Earlier runs'), h('p', { class: 'muted' }, 'Loading…'));
  root.replaceChildren(form, history);
  await renderHistory(history);
}

async function renderHistory(section) {
  let index;
  try {
    index = await fetchJson(`${DATA_DIR}/index.json`);
  } catch {
    section.replaceChildren(h('h2', {}, 'Earlier runs'), h('p', { class: 'muted' }, 'Could not load the run history.'));
    return;
  }
  const runs = index.runs ?? [];
  const list = runs.length
    ? h(
        'ul',
        { class: 'runs' },
        runs.map((r) =>
          h(
            'li',
            {},
            h(
              'a',
              { href: `#/run/${encodeURIComponent(r.runId)}` },
              h('span', { class: 'genre' }, r.genre),
              h('span', { class: 'top' }, r.topName ?? ''),
              h(
                'span',
                { class: 'meta' },
                `${formatDate(r.finishedAt)} · ${r.searchesMade} searches`,
                r.status === 'partial' ? ' · partial' : '',
              ),
            ),
          ),
        ),
      )
    : h('p', { class: 'muted' }, 'No runs yet. Start one above.');
  section.replaceChildren(h('h2', {}, 'Earlier runs'), list);
}
