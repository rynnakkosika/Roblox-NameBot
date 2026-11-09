# Contract: Viewer routes (UI)

Static single page `index.html` at the repository root (GitHub Pages serves the root of the
default branch, so the page can import both `web/*.js` and `src/engine/*.js` without a build
step), hash routes so every result has its own link (FR-033).

| Route | Shows |
|---|---|
| `#/` | Start form (genre, budget 300/1000/2000, "Start run" button → issue link), running runs with ETA, history list newest first (genre, date, budget, status, top name). |
| `#/run/{runId}` | Header (genre, budget, searches made, status, collected at); Names (25, copy button each); Description keywords (copy-all as comma-separated); Top searches (20 rows: rank, text, popularity % of the top search with a bar, appearances); Top games (name, players, link). |

Behaviour:

- Genre validated in the form with the same rules as the collector (shared engine function).
- Running list comes from the GitHub issues API (R5); if that call fails, the section is hidden,
  the rest of the page still works.
- Unknown `runId` → "Result not found" with a link back to `#/`.
- Copy uses the Clipboard API with a selectable-text fallback; the button shows "Copied" for 1.5 s.
- Layout works from 360 px wide with no horizontal scroll; light and dark colour schemes.

## Added after the MVP: popular searches page

| Route | Shows |
|---|---|
| `#/searches` | The 100 most popular searches across all genres, using the newest run of each genre, each tagged with its genre. |
| `#/searches/{genre}` | All saved popular searches (up to 50) for one genre, plus a link to its name suggestions. |

- A genre picker switches between "All genres" and one genre; the choice is in the address, so
  every view has its own link.
- Popularity index 0–100, shown as a percentage: a search's score as a percentage of its genre's most popular search,
  because scores from runs of different sizes are not comparable. Logic in
  `src/engine/popular.js`.
- The site header has "Names" and "Popular searches" links; result pages show 20 searches and
  link to the full list.
