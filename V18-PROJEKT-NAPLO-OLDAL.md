# V18 – Külön projekt napló oldal

## Mi változott?

- A főoldali projektkártya megmarad rövid áttekintőnek.
- A korábbi „Napi folytatás” helyett a gomb most külön oldalra visz:
  - `project.html?id=PROJEKT_ID`
- Az új projektoldalon áttekinthetően lehet:
  - napi bejegyzést írni,
  - több képet feltölteni,
  - AI előszűrést látni,
  - a projekt teljes idővonalát visszanézni.

## Új fájlok

- `project.html`
- `project.js`
- `logout.html`
- `V18-PROJEKT-NAPLO-OLDAL.md`

## Kilépés javítás

A Kilépés gomb most egy külön `logout.html` oldalra visz, amely törli a Supabase sessiont, a helyi cache-t, majd visszairányít a főoldalra. Ez megbízhatóbb, mint amikor ugyanazon az oldalon próbálta frissítés nélkül átállítani az állapotot.

## SQL

Ehhez a verzióhoz nem kell új SQL, mert a meglévő `entries` táblát használja.
