// All tunable values for Roblox-NameBot. Logic modules read from here; tuning never touches
// logic (constitution, Technical Constraints).

export const ENGINE_VERSION = '1.3.0';
export const SCHEMA_VERSION = 1;

// Search budget (FR-001).
export const BUDGETS = [300, 1000, 2000];
export const DEFAULT_BUDGET = 1000;
export const MAX_GENRE_CHARS = 50;

// Collection (FR-004, FR-007).
export const SUGGESTIONS_PER_SEARCH = 10;
export const TOP_SEARCHES_FOR_GAMES = 9;
export const GAMES_PER_SEARCH = 10;
export const MAX_CONSECUTIVE_FAILURES = 10;
export const MAX_RETRIES = 6;
export const BACKOFF_START_MS = 2000;
export const BACKOFF_MAX_MS = 60000;

// Roblox rate limits, kept below the advertised 100/60 s and 4/s (research R6).
export const RATES = {
  autocomplete: { perWindow: 90, windowMs: 60000 },
  gameSearch: { perWindow: 3, windowMs: 1000 },
};

// Step 5 of the expansion re-ranks its base searches after this many queries.
export const STEP5_RERANK_EVERY = 26;

// Scoring (FR-010 to FR-012, research R7).
export const BREADTH_DECAY = 0.6;
export const FRAGMENT_LENGTH = 2; // words this short count as half a word of narrowing
export const FRAGMENT_WEIGHT = 0.5;
export const GAME_WEIGHT = 0.5;
export const PHRASE_SHARE = 0.5; // share of a suggestion's score given to each two-word phrase

// Naming (FR-020 to FR-026).
export const MAX_NAMES = 25;
export const MAX_NAME_CHARS = 50;
export const MIN_NAME_WORDS = 2;
export const MAX_NAME_WORDS = 5;
export const MODIFIER_POOL = 40;
export const TYPE_POOL = 6;
export const SUGGESTION_CANDIDATES = 300;
export const PHRASE_BONUS = 1.0;
export const TYPE_BONUS = 0.5;
export const ADJACENT_BONUS = 0.5; // rewards word pairs players actually type in that order
// Suggestions that do not contain the genre (fuzzy matches such as "first" for "forest f")
// count this much towards word scores.
export const OFF_GENRE_FACTOR = 0.1;
// Each earlier pick that used the same word multiplies a candidate's score by this, so the
// 25 names are not all variations of one word.
export const DIVERSITY_DECAY = 0.8;
export const MIN_WORD_LENGTH = 2;

// Result sizes (contracts/result-files.md).
export const TOP_SEARCHES = 50;
export const TOP_KEYWORDS = 30;
export const TOP_GAMES = 30;

// Words removed before scoring (FR-013). Includes update tags that survive emoji removal.
export const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
  'is', 'are', 'be', 'my', 'your', 'our', 'you', 'me', 'we', 'it', 'its', 'this', 'that',
  'game', 'games', 'roblox', 'rblx', 'new', 'best', 'top', 'official', 'free', 'beta', 'alpha',
  'update', 'updated', 'updates', 'upd', 'event', 'release', 'released', 'changes', 'fix',
  'fixed', 'fixes', 'sale', 'open', 'opened', 'reopened', 'soon', 'mini', 'hot', 'lobby',
  'testing', 'test', 'wip', 'demo', 'edition', 'version', 'ver', 'part', 'chapter',
]);

// Game-type words: at most one per name and always last (FR-023). Lower case.
export const TYPE_WORDS = [
  'simulator', 'tycoon', 'obby', 'rp', 'roleplay', 'survival', 'defense', 'battlegrounds',
  'clicker', 'incremental', 'racing', 'shooter', 'story', 'escape', 'parkour', 'rpg',
  // Roblox subgenres that work as a closing game-type word (Creator Hub genre list).
  'sandbox', 'runner', 'royale', 'deathmatch', 'quiz', 'platformer', 'minigame',
];

// Display case for words that are not plain Title Case.
export const WORD_CASE = {
  rp: 'RP', rpg: 'RPG', pvp: 'PvP', pve: 'PvE', fps: 'FPS', ww2: 'WW2', ww1: 'WW1', ufo: 'UFO',
  tv: 'TV', ai: 'AI', ohio: 'Ohio', npc: 'NPC', npcs: 'NPCs', dj: 'DJ', mm2: 'MM2', rng: 'RNG',
  tds: 'TDS', scp: 'SCP', fnaf: 'FNAF', ugc: 'UGC', vr: 'VR', ps: 'PS', ii: 'II', iii: 'III',
};

// Singular/plural exceptions: word → canonical stem (research R8).
export const STEM_EXCEPTIONS = {
  bus: 'bus', buses: 'bus', series: 'series', species: 'species', news: 'news', gas: 'gas',
  obby: 'obby', obbies: 'obby', rpg: 'rpg', rpgs: 'rpg', its: 'its', this: 'this',
  wolves: 'wolf', knives: 'knife', knife: 'knife', leaves: 'leaf', elves: 'elf', thieves: 'thief',
  lives: 'life', life: 'life', halves: 'half', shelves: 'shelf', wives: 'wife', wife: 'wife',
  mice: 'mouse', geese: 'goose', men: 'man', women: 'woman', children: 'child', teeth: 'tooth',
  feet: 'foot', people: 'person', heroes: 'hero', potatoes: 'potato', tomatoes: 'tomato',
  axes: 'axe', yes: 'yes', boss: 'boss', chaos: 'chaos', anime: 'anime', always: 'always',
};
