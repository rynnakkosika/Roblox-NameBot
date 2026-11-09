# Contract: Starting a run

## Issue form `.github/ISSUE_TEMPLATE/run.yml`

- Title: `Run: {genre}` (pre-filled by the viewer).
- Label: `namebot-run` (applied by the template).
- Fields (ids are used for URL pre-fill):
  - `genre` — input, required, max 50 chars.
  - `budget` — dropdown: `300`, `1000` (default), `2000`.

Viewer link, built from the start form:

```text
https://github.com/{owner}/{repo}/issues/new?template=run.yml&title=Run%3A+{genre}&genre={genre}&budget={budget}
```

The issue body GitHub produces is parsed as:

```text
### Genre

tower defense

### Searches

1000
```

## Workflow `.github/workflows/namebot.yml`

Triggers:

- `issues: [opened]` — runs only if the issue has label `namebot-run` **and**
  `github.event.issue.author_association` is `OWNER` or `COLLABORATOR` (people the owner invited under Settings → Collaborators); otherwise the job is skipped silently.
- `workflow_dispatch` with inputs `genre` (string) and `budget` (choice 300/1000/2000).

Steps: checkout → `node src/collector/run.js --genre … --budget … [--issue N]` → commit
`web/data/**` (pull --rebase, retry ×3 on push conflict; GitHub Pages "deploy from branch"
rebuilds automatically) → comment on the issue with the result link
`https://{owner}.github.io/{repo}/#/run/{runId}` and close it. On failure the issue gets a comment
with the reason and is closed with label `namebot-failed`.

Permissions: `contents: write`, `issues: write`.
Timeout: 45 min. No other secrets.

## Collector CLI

```text
node src/collector/run.js --genre <text> --budget <300|1000|2000> [--out web/data] [--issue <n>]
node src/collector/rescore.js [--run <runId> | --all]
```

Exit codes: 0 complete, 2 partial (still saved), 1 failed (nothing saved).
