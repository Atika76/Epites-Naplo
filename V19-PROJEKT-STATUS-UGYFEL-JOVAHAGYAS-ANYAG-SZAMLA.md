# ÉpítésNapló AI PRO v19 – változások

## Új funkciók

1. **Projekt státusz és haladás**
   - Projektoldal tetején látszik: folyamatban / ellenőrzésre vár / elkészült / lezárva.
   - Haladás százalékos csíkkal.

2. **Ügyfél jóváhagyás**
   - A publikus ügyfélriport oldalán checkboxos jóváhagyás.
   - Mentődik név, email, dátum és böngésző információ.

3. **Automatikus időjárás + GPS**
   - Projekt napló oldalon gombbal lekérhető.
   - Open-Meteo alapján hőmérséklet, szél, csapadék, időjárási állapot.
   - GPS opcionális, a böngésző engedélyt kér hozzá.
   - Ha nem engedélyezed, kézzel is beírható.

4. **Napi anyagfelhasználás**
   - Minden napi bejegyzéshez több anyagsor rögzíthető.
   - Anyag neve, mennyiség, egység, megjegyzés.
   - Projekt összesítőben automatikusan megjelenik.

5. **Számlák és költségek külön oldalon**
   - Új oldal: `project-finance.html`.
   - PDF/kép számla csatolás.
   - Összeg megadása.
   - Automatikus költségösszesítés.

6. **Heti PDF és lezáró dokumentum**
   - Projektoldalon külön gomb.
   - Heti riport csak az elmúlt 7 nap bejegyzéseit nyomtatja.
   - Lezáró dokumentum tartalmazza a teljes naplót, anyagokat és számlaösszesítést.

## Nem változott / megmaradt
- Login és kilépés működés.
- Admin panel.
- Csomagok és AI kredit rendszer.
- Külön projekt napló oldal.
- Meglévő naplóbejegyzések.

## Telepítés
1. GitHubon írd felül a fájlokat.
2. Supabase SQL Editorban futtasd:
   `supabase-pro-v19-projekt-status-ugyfel-jovahagyas-anyag-szamla.sql`
3. Frissítsd a weboldalt Ctrl+Shift+R-rel.
