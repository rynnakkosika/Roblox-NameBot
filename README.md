# Roblox-NameBot

Finds a search-friendly name for a Roblox game from Roblox's own search data. You type a genre
("forest", "horror", "tower defense"). The bot makes 300, 1000 or 2000 searches in Roblox's
game search, collects the top 10 suggestions each time, looks up the top games and their
player counts, and suggests 25 names, best first.

**Use it:** <https://rynnakkosika.github.io/Roblox-NameBot/> (also on a phone).

## How a run works

1. Type a genre on the page, pick the number of searches and tap **Start run**.
2. A pre-filled GitHub issue opens. Submit it. Only the repository owner's issues start a run.
3. GitHub Actions runs the searches (about 6 / 14 / 25 minutes for 300 / 1000 / 2000 searches,
   kept under Roblox's rate limits), saves the result to `web/data/` and comments on the issue
   with a link to it.
4. The result is listed under **Earlier runs** on the page and keeps its own link.

You can also start a run from the Actions tab: **NameBot run → Run workflow**.

Search order: the genre; genre + a–z; every suggestion found so far; genre + aa–zz; then the
best-scoring searches + a–z until the budget is used. Names have 2–5 words and at most 50
characters, contain the whole genre as one phrase, have at most one game-type word (Simulator,
Tycoon, Obby, RP, Survival, Defense…) and only as the last word, never repeat a word or a
singular/plural pair, and near-identical names are dropped. Weights and word lists are in
[`src/engine/constants.js`](src/engine/constants.js).

## Set up the repository (once)

1. Create the GitHub repository `Roblox-NameBot` and push this folder to `main`. If you use
   another owner or name, change `OWNER`/`REPO` in [`web/config.js`](web/config.js).
2. **Settings → Pages**: Deploy from a branch, `main`, folder `/ (root)`.
3. **Settings → Actions → General → Workflow permissions**: Read and write.
4. **Issues → Labels**: create a label `namebot-run` (the issue form adds it).

## Develop

No dependencies, no build. Node.js 20 or newer.

```bash
npm test
node src/collector/run.js --genre forest --budget 300 --out tmp-data
node tools/serve.js 8080
```

`npm test` uses recorded Roblox responses in `tests/fixtures/` and never calls Roblox.
The collector makes real requests. `tools/serve.js` serves the page at http://localhost:8080/.

Planning documents (Spec Kit): [`specs/001-roblox-name-generator/`](specs/001-roblox-name-generator/).
