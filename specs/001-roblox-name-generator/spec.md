# Feature Specification: Roblox-NameBot Name Generator

**Feature Branch**: `001-roblox-name-generator`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Roblox-NameBot: a tool that comes up with a search-optimised name for a
Roblox game from Roblox's own search data. The user types only the game's genre; the tool runs
about 1000 searches against Roblox game search, collects the top 10 autocomplete suggestions of
each, expands searches in a fixed order, fetches top games and player counts, scores everything
and shows 25 name suggestions, description keywords, top searches and top games. Used as a link
in a browser, also on a phone; earlier genres stay browsable. No login, no automatic renaming."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get name suggestions for a genre (Priority: P1)

A Roblox developer opens the tool's link, types a genre such as "forest", "horror" or
"tower defense", picks how many searches to run (300, 1000 or 2000; 1000 by default) and starts
a run. The tool searches Roblox on its own, then shows 25 game-name suggestions, best first, each
with a copy button.

**Why this priority**: the name list is the product. Everything else is supporting evidence.

**Independent Test**: start a run for "forest" with 300 searches, wait for it to finish and
check that 25 names appear, best first, every one obeying the name rules (FR-020 to FR-026), and
that the copy button puts the exact name on the clipboard.

**Acceptance Scenarios**:

1. **Given** the start page, **When** the user enters "tower defense", chooses 1000 and starts,
   **Then** the page confirms the run has started and shows the expected waiting time.
2. **Given** a finished run for "anime tower defense", **When** the user opens its result,
   **Then** every name contains "Anime Tower Defense" as one unbroken phrase, e.g.
   "Anime Tower Defense X" is allowed but "Tower Anime Defense" never appears.
3. **Given** a finished run, **When** the user taps a name's copy button, **Then** exactly that
   name is on the clipboard and the button briefly confirms the copy.
4. **Given** the user enters an empty genre or only symbols, **When** they try to start,
   **Then** the run is not started and the page says a genre is needed.

---

### User Story 2 - See why the names were suggested (Priority: P2)

On the same result page the user sees keywords to use in the game description, the most popular
searches with their rank and how often they appeared, and the top games for the genre with their
current player counts, plus when the data was collected and how many searches it is based on.

**Why this priority**: the user picks the final name and writes the description; the evidence
makes the suggestions trustworthy and gives description keywords for free.

**Independent Test**: open a finished result and check that the four sections (names, keywords,
top searches, top games) are present, that searches are ordered by score with rank and
appearance count, and that games show a player count.

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the result opens, **Then** the user sees a keyword list for
   the game description that can be copied in one tap as comma-separated text.
2. **Given** a finished run, **When** the user looks at top searches, **Then** each row shows the
   search text, its score position and in how many searches it appeared.
3. **Given** a finished run, **When** the user looks at top games, **Then** each game shows its
   name, current player count and a link to its Roblox page.
4. **Given** a finished run, **When** the user looks at the result header, **Then** it shows the
   genre, chosen search budget, searches actually made and collection date and time.

---

### User Story 3 - Browse earlier genres on any device (Priority: P3)

The user opens the same link later, on a phone or a computer, and sees a list of every genre run
so far with its date. Tapping one opens its full saved result without searching Roblox again.

**Why this priority**: runs take minutes; results must survive and be revisited, compared and
shared as a link.

**Independent Test**: after two runs ("forest", "horror"), open the link on another device and
check that both appear in the history, newest first, and each opens its own saved result.

**Acceptance Scenarios**:

1. **Given** earlier runs exist, **When** the user opens the link on a phone 360 px wide,
   **Then** the history list and every result section are readable without horizontal
   scrolling.
2. **Given** the genre "forest" was already run, **When** the user runs "forest" again,
   **Then** the new result is saved as a separate dated entry and the old one remains.
3. **Given** a result is open, **When** the user copies the page address and opens it elsewhere,
   **Then** the same result opens directly.

### Edge Cases

- Roblox refuses requests for a while (rate limit): the run waits and retries, so the search
  count still reaches the budget; if Roblox keeps failing, the run ends early and saves what it
  has, marked as partial with the number of searches made.
- The search expansion runs out of new searches before the budget (a very narrow genre): the run
  ends early, saves the result and states the actual number of searches.
- Fewer than 25 valid names can be built: the page shows the ones that pass all rules and says
  why there are fewer.
- The genre is longer than 50 characters, or so long that no name with a game-type word fits:
  the genre is rejected before the run, or names are built without a game-type word, respectively.
- The genre itself contains a game-type word ("tower defense" contains "Defense"): it counts as
  the one game-type word and stays last; no second game-type word is added.
- The genre contains plural/singular or mixed case ("Forests", "HORROR"): matching is case-
  insensitive and treats singular and plural as the same word.
- Suggestions or game names contain tags ("[UPDATE]", "(NEW)"), emojis, version numbers or
  filler words: they are cleaned before scoring and never appear in names or keywords.
- Two runs are started at the same time: both complete and are saved as separate entries.
- A run is in progress when the user opens the link: the history shows it as running.

## Requirements *(mandatory)*

### Functional Requirements

**Starting a run**

- **FR-001**: Users MUST be able to start a run by entering only a genre (1–50 characters,
  letters, digits and spaces) and choosing a search budget of 300, 1000 (default) or 2000.
- **FR-002**: The system MUST NOT require the user to log in to the tool or to Roblox, and MUST
  NOT change anything on Roblox.
- **FR-003**: After starting, the page MUST show that the run is in progress and an estimated
  finishing time, and MUST show the result automatically or on reload when it is ready.

**Collecting search data**

- **FR-004**: For every search made, the system MUST record the top 10 autocomplete suggestions
  Roblox shows for that text, in Roblox's order.
- **FR-005**: The system MUST generate searches in this order, skipping any text already searched:
  1. the genre alone;
  2. the genre + a space + one letter a–z ("forest a" … "forest z");
  3. every suggestion found so far, in order of discovery, until all suggestions found in steps 1–2
     have been searched (suggestions found in this step are added to the queue of step 5);
  4. the genre + two letters aa–zz;
  5. the highest-scoring searches found so far + a letter a–z, best first, re-ranked as data
     arrives.
- **FR-006**: The system MUST stop when the chosen number of searches has been made, or earlier
  if no unsearched text remains.
- **FR-007**: The system MUST fetch the top 10 games for the genre and for each of the 9
  highest-scoring searches (10 game searches, not counted against the budget), recording each
  game's name, current player count and Roblox page link.
- **FR-008**: The system MUST respect Roblox's request limits, waiting and retrying when told
  to slow down, and MUST mark a run partial if it cannot complete.

**Scoring**

- **FR-010**: A suggestion's score MUST increase the higher it is ranked in a search's list
  (rank 1 scores most, rank 10 least) and with every additional search it appears in.
- **FR-011**: Appearances in broad searches MUST weigh more than in narrow ones; a search's
  weight MUST fall as its text gets longer than the genre (e.g. "forest" > "forest a" >
  "forest animals qx").
- **FR-012**: Words in top games' names MUST add to the score in proportion to the game's
  current player count, with diminishing returns so one huge game cannot dominate.
- **FR-013**: Before scoring, texts MUST be cleaned: bracketed or capitalised tags ([UPDATE],
  (NEW), 🎃EVENT), emojis, symbols, version numbers and filler words (the, of, a, an, and, in, on,
  game, roblox, …) are removed; text is compared case-insensitively.
- **FR-014**: The system MUST derive a ranked keyword list (single words and two-word phrases)
  from the cleaned, scored searches and game names, excluding filler words.

**Building names**

- **FR-020**: The system MUST produce up to 25 names ordered by score, best first.
- **FR-021**: Each name MUST have 2–5 words and at most 50 characters, in Title Case.
- **FR-022**: Each name MUST contain every word of the genre, and a multi-word genre MUST appear
  as one unbroken phrase in its original order.
- **FR-023**: A name MUST contain at most one game-type word (from the game-type list, see
  Assumptions) and, if present, it MUST be the last word. If the genre ends in a game-type word
  ("tower defense"), the genre phrase is the end of the name.
- **FR-024**: A name MUST NOT repeat a word, including a singular/plural pair ("Animal Animals").
- **FR-025**: Near-identical names MUST be removed, keeping the higher-scored one: names that
  differ only by word order, singular/plural, or one filler-like word count as near-identical.
- **FR-026**: Names MUST be built only from words found in the collected search data or the
  genre itself.

**Result page and history**

- **FR-030**: The result page MUST show: the 25 names with a copy button each; description
  keywords with a copy-all button; the top 20 searches with score position and appearance count;
  the top games with player counts, deduplicated, ordered by player count.
- **FR-031**: Every result MUST show the genre, budget, searches made, partial/complete status
  and collection date and time.
- **FR-032**: Every finished run MUST be saved permanently and appear in a history list on the
  start page, newest first, with genre and date; a running run MUST appear as running.
- **FR-033**: Each saved result MUST have its own link that opens it directly.
- **FR-034**: The page MUST work in current desktop and phone browsers down to 360 px width.

### Key Entities

- **Run**: one collection for a genre: genre, budget, searches made, status (running, complete,
  partial, failed), start and finish time; owns everything below.
- **Search**: one text sent to Roblox autocomplete: text, expansion step (1–5), weight, the up
  to 10 suggestions returned in order.
- **Suggestion score**: a cleaned suggestion text with its total score, best rank seen and number
  of searches it appeared in.
- **Top game**: a game found for the genre or a top search: name, cleaned name, current player
  count, page link, which search found it.
- **Keyword**: a word or two-word phrase with its score, for the game description.
- **Name suggestion**: a generated name with score, position 1–25 and the searches that support
  it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start a run from a phone in under 30 seconds, typing nothing but the
  genre.
- **SC-002**: A 1000-search run finishes and its result is viewable within 20 minutes of starting;
  a 300-search run within 8 minutes.
- **SC-003**: 100% of displayed names pass every name rule (FR-021 to FR-026), checked
  automatically over results for at least 10 different genres.
- **SC-004**: For a typical genre, at least 25 valid names are produced in 9 out of 10 runs.
- **SC-005**: A saved result opens in under 3 seconds on a phone and is still available, unchanged,
  at least 6 months later.
- **SC-006**: Re-scoring the same saved search data always yields the identical names and order.
- **SC-007**: In a 1000-search run, the run is never blocked by Roblox for exceeding limits for
  longer than a total of 2 minutes.

## Assumptions

- Single user (the developer who owns the tool); results are not private and anyone with the
  link can view them. Starting a run may require the owner's existing account on the site that
  hosts their projects (already signed in on their phone and computer); the tool itself has no
  login.
- "Top 10 suggestions" are the suggestions Roblox's own game-search box shows for the typed text;
  "current player count" is the live player count Roblox reports at collection time.
- Searches are in English; names are English Title Case. The tool's own interface is in English,
  like the user's other GitHub projects.
- The 10 game searches (genre + 9 top searches) are in addition to the chosen budget.
- Game-type words come from one maintained list (initially Simulator, Tycoon, Obby, RP,
  Roleplay, Survival, Defense, Battlegrounds, Clicker, Incremental, Racing, Shooter, Story,
  Escape, Parkour). The list can be tuned without changing the rules.
- Genre words count as present when they appear in singular or plural ("animal" matches
  "Animals"), but the phrase is kept in the user's word order.
- Result history is kept indefinitely; deleting a result is done by the owner outside the tool.
- Out of scope: logging in, renaming a game on Roblox automatically, thumbnails/icons,
  non-English markets, comparing runs over time.
