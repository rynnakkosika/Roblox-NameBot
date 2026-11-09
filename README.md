# Roblox-NameBot

Roblox-pelin nimigeneraattori, joka hyödyntää Robloxin omaa hakudataa.

Syötät pelkän genren. Skripti tekee automaattisesti ~1000 hakua Robloxin
hakukenttään, kerää suosituimmat hakuehdotukset ja top-pelit
pelaajamäärineen, pisteyttää sanat ja muodostaa hakukoneoptimoituja
nimiehdotuksia (max 50 merkkiä).

## Käyttö

Tarvitaan vain Python 3 (ei lisäpaketteja).

```
py roblox_nimet.py forest
py roblox_nimet.py "tower defense"
py roblox_nimet.py horror --hakuja 2000 --nimia 30
```

| Valinta | Selitys |
|---|---|
| `--hakuja` | montako hakua tehdään (oletus 1000) |
| `--nimia` | montako nimiehdotusta tulostetaan (oletus 20) |
| `--top` | ehdotuksia/pelejä per haku (oletus 10) |
| `--uusi` | ohita välimuisti ja hae kaikki uudelleen |

## Miten haut valitaan

1. genre (`forest`)
2. genre + kirjain (`forest a` … `forest z`)
3. jokainen löydetty suosittu haku haetaan itsekin
4. genre + kaksi kirjainta (`forest aa` … `forest zz`)
5. suosituimmat löydetyt haut + kirjain

Laajat haut painavat pisteissä enemmän kuin kapeat. Mitä useammassa haussa
ehdotus näkyy ja mitä korkeammalla, sitä enemmän pisteitä sen sanat saavat.

Kesto n. 3–10 min / 1000 hakua. Haut tallentuvat tiedostoon
`cache_<genre>.json`, joten keskeytetty ajo jatkuu siitä mihin jäi.
Tulos tallentuu tiedostoon `roblox_nimet_<genre>.txt`.

## Huom

Robloxin hakuehdotus- ja hakurajapinnat eivät ole virallisesti dokumentoituja,
joten ne voivat muuttua. Jos skripti sanoo "Ei dataa", tarkista osoitteet
tiedoston alusta (`AUTOCOMPLETE_URL`, `SEARCH_URL`).
