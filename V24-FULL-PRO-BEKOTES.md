# V24 – Full PRO bekötés

A V23 stabil bejelentkezési és admin alapja megmaradt. A módosítások csak a projekt napló / pénzügyi riport részre kerültek.

## Bekerült

- külön „Csak GPS mentése” gomb
- mentés előtti automatikus időjárás/GPS ellenőrzés
- Open-Meteo időjárás API-kulcs nélkül
- előtte / utána / általános fotók külön mezőként továbbítva Supabase felé
- anyagfelhasználás mentése és összesítése
- számlák mentése és költségösszesítő
- heti riport nyomtatás + külön HTML letöltés
- lezáró riport nyomtatás + külön HTML letöltés
- költségriport nyomtatás + külön HTML letöltés

## Fontos

A böngésző közvetlenül nem készít valódi PDF fájlt könyvtár nélkül. A megoldás stabil: a riport nyomtatható, vagy HTML-ként letölthető, majd a böngészőből „Mentés PDF-ként” használható.

## Supabase

Ha azt akarod, hogy az előtte/utána fotók külön oszlopban is mentődjenek, futtasd le:

`supabase-pro-v24-full-pro-bekotes.sql`

Ha nem futtatod le, a rendszer akkor sem omlik össze: visszaesik a régi, stabil mentési módra.
