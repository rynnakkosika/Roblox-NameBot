#!/usr/bin/env python3
"""
roblox_nimet.py - Roblox-pelin nimigeneraattori Robloxin omasta hakudatasta.

Syötä pelkkä genre. Skripti tekee automaattisesti ~1000 hakua Robloxin
hakukenttään (samat ehdotukset kuin sovelluksessa), kerää top-ehdotukset ja
top-pelit pelaajamäärineen, pisteyttää sanat ja muodostaa nimiehdotukset.

Hakujen järjestys:
  1. genre                       ("forest")
  2. genre + kirjain             ("forest a" ... "forest z")
  3. löydetyt suosituimmat haut  (jokainen löydetty ehdotus haetaan itsekin)
  4. genre + kaksi kirjainta     ("forest aa" ... "forest zz")
  5. löydetyt haut + kirjain     ("forest animals a" ...)
  -> kunnes hakuja on tehty --hakuja kappaletta (oletus 1000).

Käyttö (Windows: py, Mac/Linux: python3):
  py roblox_nimet.py forest
  py roblox_nimet.py "tower defense"
  py roblox_nimet.py horror --hakuja 2000 --nimia 30

Kesto: n. 3-10 min / 1000 hakua. Haut tallentuvat välimuistiin
(cache_<genre>.json), joten keskeytetty ajo jatkuu siitä mihin jäi.
Uusi data: --uusi. Vain Pythonin vakiokirjasto.
"""

import argparse
import os
import threading
from concurrent.futures import ThreadPoolExecutor
import itertools
import datetime
import json
import math
import re
import string
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections import Counter, defaultdict

AUTOCOMPLETE_URL = "https://apis.roblox.com/games-autocomplete/v1/get-suggestion/{q}"
SEARCH_URL = ("https://apis.roblox.com/search-api/omni-search"
              "?searchQuery={q}&pageType=all&sessionId={sid}")
HEADERS = {"User-Agent": "Mozilla/5.0 roblox-name-helper", "Accept": "application/json"}
MAX_NAME_LEN = 50

STOPWORDS = {
    "the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "with", "by",
    "at", "is", "my", "your", "be", "it", "from", "vs", "x", "new", "update",
    "upd", "beta", "alpha", "free", "game", "roblox", "official", "release",
}

# Sanat, jotka kertovat pelityypin - nämä sijoitetaan nimen loppuun.
GENRE_SUFFIXES = {
    "simulator", "tycoon", "obby", "rp", "roleplay", "survival", "story",
    "battlegrounds", "defense", "td", "clicker", "incremental", "rng", "race",
    "racing", "parkour", "escape", "shooter", "fps", "pvp", "royale", "life",
    "adventure", "horror", "hunt", "battle", "arena", "world", "legends",
}
UPPER = {"rp": "RP", "td": "TD", "fps": "FPS", "pvp": "PVP", "rng": "RNG"}


def stem(w):
    """Karkea yksikkö/monikko-normalisointi päällekkäisyyksien estämiseksi."""
    return w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w

# ---------------------------------------------------------------- HTTP

_rate_lock = threading.Lock()
_pause_until = [0.0]


def get_json(url, retries=5):
    for attempt in range(retries):
        wait = _pause_until[0] - time.time()
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429:                      # liikaa hakuja -> yhteinen tauko
                with _rate_lock:
                    _pause_until[0] = max(_pause_until[0], time.time() + 10 * (attempt + 1))
                continue
            if attempt == retries - 1 or e.code in (400, 404):
                return None
        except Exception:  # noqa: BLE001
            if attempt == retries - 1:
                return None
        time.sleep(1.5 * (attempt + 1))
    return None


def autocomplete(query, top):
    """Palauttaa listan hakuehdotuksia (str) samassa järjestyksessä kuin Roblox."""
    data = get_json(AUTOCOMPLETE_URL.format(q=urllib.parse.quote(query)))
    out = []
    if not data:
        return out
    for e in data.get("entries", []) if isinstance(data, dict) else []:
        s = e.get("searchQuery") or e.get("canonicalTitle") or e.get("query")
        if s and s.lower() not in (x.lower() for x in out):
            out.append(s)
    return out[:top]


def top_games(query, top):
    """Palauttaa listan (nimi, pelaajia_nyt) hakutuloksen kärkipeleistä."""
    url = SEARCH_URL.format(q=urllib.parse.quote(query), sid=uuid.uuid4())
    data = get_json(url)
    games = []
    if not data:
        return games
    for group in data.get("searchResults", []):
        for c in group.get("contents", []) or []:
            name = c.get("name")
            if name and c.get("contentType", "Game") == "Game":
                games.append((name, int(c.get("playerCount") or 0)))
    return games[:top]

# ---------------------------------------------------------------- tekstin käsittely

def clean_title(t):
    t = re.sub(r"[\[\(\{【].*?[\]\)\}】]", " ", t)        # [UPDATE], (NEW!) jne.
    t = re.sub(r"[^\w\s'&-]", " ", t, flags=re.UNICODE)  # emojit ja merkit pois
    return re.sub(r"\s+", " ", t).strip()


def words(t):
    out = []
    for w in clean_title(t).lower().split():
        w = w.strip("-'&")
        if len(w) < 2 or w in STOPWORDS or w.isdigit():
            continue
        out.append(w)
    return out

# ---------------------------------------------------------------- analyysi

def plan_queries(genre, found, done):
    """Palauttaa seuraavat haut prioriteettijärjestyksessä (vaiheet 1-5)."""
    letters = string.ascii_lowercase
    stage = [genre] + [f"{genre} {c}" for c in letters]
    best = [s for s, _ in sorted(found.items(), key=lambda kv: (kv[1]["rank"], -kv[1]["hits"]))]
    stage += best
    stage += [f"{genre} {a}{b}" for a in letters for b in letters]
    stage += [f"{s} {c}" for s in best[:60] for c in letters]
    return [q for q in dict.fromkeys(q.lower() for q in stage) if q not in done]


def collect(genre, top, limit, cache_file, workers=4):
    cache = {}
    if cache_file and os.path.exists(cache_file):
        with open(cache_file, encoding="utf-8") as f:
            cache = json.load(f)
        print(f"  välimuistista {len(cache.get('queries', {}))} hakua ({cache.get('date', '?')})")
    queries = cache.get("queries", {})              # haku -> [ehdotukset]

    def found_from(qs):
        found = {}
        for q, sugg in qs.items():
            # lyhyt/laaja haku (esim. "forest") kertoo suosiosta enemmän kuin
            # kapea haku ("forest animals qx") -> painotetaan pituuden mukaan
            breadth = (len(genre) + 2) / (len(q) + 2)
            for rank, s in enumerate(sugg):
                d = found.setdefault(s, {"rank": rank, "hits": 0, "score": 0.0})
                d["rank"] = min(d["rank"], rank)
                d["hits"] += 1
                d["score"] += (top - rank) * breadth
        return found

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        while len(queries) < limit:
            todo = plan_queries(genre, found_from(queries), queries)
            if not todo:
                break
            batch = todo[: min(workers * 4, limit - len(queries))]
            for q, res in zip(batch, pool.map(lambda q: autocomplete(q, top), batch)):
                queries[q] = res
            n = len(queries)
            rate = n / max(time.time() - t0, 1)
            print(f"\r  hakuja {n}/{limit}  löydettyjä ehdotuksia {len(found_from(queries))}"
                  f"  ({rate:.1f}/s)   ", end="", flush=True)
            if cache_file:
                with open(cache_file, "w", encoding="utf-8") as f:
                    json.dump({"date": str(datetime.date.today()), "queries": queries}, f)
            time.sleep(0.2)
    print()

    found = found_from(queries)
    # top-pelit: genre + 9 suosituinta hakua
    game_queries = [genre] + [s for s, _ in sorted(found.items(),
                              key=lambda kv: (kv[1]["rank"], -kv[1]["hits"]))][:9]
    games = {}
    for q in dict.fromkeys(game_queries):
        print(f"  top-pelit: {q}")
        for name, p in top_games(q, top):
            games[name] = max(p, games.get(name, 0))
        time.sleep(0.3)
    return found, sorted(games.items(), key=lambda g: -g[1])


def score_words(suggestions, games, top):
    score = Counter()
    phrase_score = Counter()
    for s, d in suggestions.items():
        # sijoitus + kuinka monessa (laajassa) haussa ehdotus näkyi
        weight = d["score"]
        ws = words(s)
        for w in set(ws):
            score[w] += weight
        for a, b in zip(ws, ws[1:]):
            phrase_score[f"{a} {b}"] += weight
    for name, players in games:
        weight = 2 + math.log10(players + 1) * 2       # suositut pelit painavat enemmän
        for w in set(words(name)):
            score[w] += weight
    return score, phrase_score


def generate_names(seeds, score, phrase_score, n):
    seed_words = [w for s in seeds for w in words(s)]
    top_words = [w for w, _ in score.most_common(14)]
    top_phrases = [p for p, c in phrase_score.most_common(8) if c > 1]

    cands = defaultdict(float)

    def add(parts):
        parts = [p for p in parts if p]
        tokens = " ".join(parts).split()
        stems = [stem(t) for t in tokens]
        if len(stems) != len(set(stems)) or not 2 <= len(tokens) <= 5:
            return
        # genresana (Simulator, Tycoon, Obby...) vain yksi ja aina loppuun
        kinds = [t for t in tokens if t in GENRE_SUFFIXES]
        if len(kinds) > 1 or (kinds and tokens[-1] != kinds[0]):
            return
        name = " ".join(UPPER.get(t, t.capitalize()) for t in tokens)
        if len(name) > MAX_NAME_LEN:
            return
        s = sum(score[t] for t in tokens)
        s *= 1.15 if any(t in seed_words for t in tokens) else 0.8   # genren sana mukana
        s /= 1 + 0.15 * max(0, len(tokens) - 3)                      # liian pitkä rankaisu
        cands[name] = max(cands[name], s)

    for a, b in itertools.permutations(top_words, 2):
        add([a, b])
    for a, b, c in itertools.permutations(top_words[:9], 3):
        add([a, b, c])
    for p in top_phrases:
        for w in top_words[:8]:
            add([w, p]); add([p, w])

    ranked = sorted(cands.items(), key=lambda kv: -kv[1])
    # vältä lähes identtisiä nimiä (sama sanajoukko eri järjestyksessä)
    seen, out = set(), []
    for name, s in ranked:
        key = frozenset(stem(t) for t in name.lower().split())
        if key in seen:
            continue
        seen.add(key)
        out.append((name, s))
        if len(out) >= n:
            break
    return out

# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Roblox-pelin nimiehdotukset hakudatan perusteella")
    ap.add_argument("genre", nargs="+", help='pelin genre, esim. forest tai "tower defense"')
    ap.add_argument("--hakuja", type=int, default=1000, help="montako hakua tehdään (oletus 1000)")
    ap.add_argument("--top", type=int, default=10, help="ehdotuksia/pelejä per haku (oletus 10)")
    ap.add_argument("--nimia", type=int, default=20, help="nimiehdotuksia (oletus 20)")
    ap.add_argument("--uusi", action="store_true", help="älä käytä välimuistia")
    args = ap.parse_args()

    genre = " ".join(args.genre).lower().strip()
    slug = re.sub(r"\W+", "_", genre)
    cache_file = f"cache_{slug}.json"
    if args.uusi and os.path.exists(cache_file):
        os.remove(cache_file)
    print(f"Genre: {genre}  |  hakuja: {args.hakuja}")
    suggestions, games = collect(genre, args.top, args.hakuja, cache_file)
    seeds = [genre]

    if not suggestions and not games:
        print("\nEi dataa. Tarkista nettiyhteys - Roblox on voinut myös muuttaa rajapintaa.")
        sys.exit(1)

    score, phrase_score = score_words(suggestions, games, args.top)
    names = generate_names(seeds, score, phrase_score, args.nimia)

    lines = []
    lines.append("=== SUOSITUIMMAT HAKUEHDOTUKSET ===")
    lines.append(f"  (yhteensä {len(suggestions)} eri hakua löydetty)")
    for s, d in sorted(suggestions.items(), key=lambda kv: -kv[1]["score"])[:30]:
        lines.append(f"  {d['score']:>7.0f}  {s}   (paras sija #{d['rank'] + 1}, {d['hits']} haussa)")
    lines.append("\n=== TOP-PELIT (pelaajia nyt) ===")
    for name, p in games[:25]:
        lines.append(f"  {p:>9,}  {name}")
    lines.append("\n=== AVAINSANAT (pisteet) ===")
    lines.append("  " + ", ".join(f"{w} ({c:.0f})" for w, c in score.most_common(20)))
    if phrase_score:
        lines.append("\n=== YLEISET SANAPARIT ===")
        lines.append("  " + ", ".join(f"{p} ({c:.0f})" for p, c in phrase_score.most_common(10)))
    lines.append("\n=== NIMIEHDOTUKSET ===")
    for i, (name, s) in enumerate(names, 1):
        lines.append(f"  {i:>2}. {name:<{MAX_NAME_LEN}} {s:.0f}")
    lines.append("\nVinkki: lisää kuvaukseen myös muut avainsanat, ja nimen loppuun"
                 " voi myöhemmin lisätä tagin kuten [UPDATE].")

    report = "\n".join(lines)
    print("\n" + report)
    fname = f"roblox_nimet_{slug}.txt"
    with open(fname, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\nTallennettu: {fname}")


if __name__ == "__main__":
    main()
