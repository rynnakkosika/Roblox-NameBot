// Where runs are started and how long they take. Change OWNER/REPO if the repository moves.
export const OWNER = 'rynnakkosika';
export const REPO = 'roblox-namebot';
export const ISSUE_TEMPLATE = 'run.yml';
export const SEARCHES_PER_MINUTE = 90;
export const OVERHEAD_MINUTES = 2;
export const DATA_DIR = 'web/data';

export function etaMinutes(budget) {
  return Math.ceil(budget / SEARCHES_PER_MINUTE + OVERHEAD_MINUTES);
}

export function issueUrl(genre, budget) {
  const params = new URLSearchParams({
    template: ISSUE_TEMPLATE,
    title: `Run: ${genre}`,
    genre,
    budget: String(budget),
  });
  return `https://github.com/${OWNER}/${REPO}/issues/new?${params}`;
}
