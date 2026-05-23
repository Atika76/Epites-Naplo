# V180 – értesítés-takarítás és admin gomb javítás

Alap: V179 / V175b működő verzió.

## Javítások

- Projekt törlés után a `notifications` táblában maradt régi `client_link` jellegű projekt-értesítéseket is megpróbálja takarítani.
- Ha a `notifications` táblában nincs `project_id` oszlop, akkor a saját felhasználóhoz tartozó, projekt nevével egyező régi projekt-értesítéseket törli.
- A fejlécből eltűnt a külön, nem funkcionáló `Admin/Felhasználó` jelvénygomb.
- A valódi `Admin` menüpont megmaradt, és továbbra is csak admin jogosultságnál jelenik meg.
- Nem kell új Supabase SQL.
