// Hash router: #/ start page and history, #/run/{runId} a saved result,
// #/searches and #/searches/{genre} popular searches.

import { renderResult } from './result.js';
import { renderSearches } from './searches.js';
import { renderStart } from './start.js';

const root = document.getElementById('app');

function setActiveNav(page) {
  for (const a of document.querySelectorAll('nav.site-nav a')) {
    if (a.dataset.page === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function route() {
  const hash = window.location.hash || '#/';
  window.scrollTo(0, 0);
  const run = hash.match(/^#\/run\/([^/?#]+)$/);
  const searches = hash.match(/^#\/searches(?:\/([^/?#]+))?$/);
  if (run) {
    setActiveNav('runs');
    renderResult(root, decodeURIComponent(run[1]));
  } else if (searches) {
    setActiveNav('searches');
    renderSearches(root, searches[1] ? decodeURIComponent(searches[1]) : null);
  } else {
    setActiveNav('runs');
    document.title = 'Roblox-NameBot';
    renderStart(root);
  }
}

window.addEventListener('hashchange', route);
route();
