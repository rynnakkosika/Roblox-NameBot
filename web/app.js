// Hash router: #/ start page and history, #/run/{runId} a saved result.

import { renderResult } from './result.js';
import { renderStart } from './start.js';

const root = document.getElementById('app');

function route() {
  const hash = window.location.hash || '#/';
  const match = hash.match(/^#\/run\/([^/?#]+)$/);
  window.scrollTo(0, 0);
  if (match) {
    renderResult(root, decodeURIComponent(match[1]));
  } else {
    document.title = 'Roblox-NameBot';
    renderStart(root);
  }
}

window.addEventListener('hashchange', route);
route();
