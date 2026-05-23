# V175 – szerepkör, menü és fizetési blokkok rendberakása

Ez a verzió nem igényel új Supabase SQL-t.

## Javítások

- Egyszerűbb fejléc menü:
  - vendégnek: Főoldal, Mire jó?, Demo, Csomagok, Belépés / Regisztráció
  - belépett felhasználónak: Főoldal, Projektjeim, Riportok, Csomagom, Fiókom
  - adminnak: külön Admin menüpont
- Admin menük és technikai rendszerblokkok csak adminnak jelennek meg.
- Regisztráció nélkül is olvasható bemutató blokk került a főoldalra.
- Demo magyarázó rész regisztráció nélkül is megnyitható.
- Aktív Alap / Pro / Business csomagnál és adminnál a fizetési blokkok nem foglalják a főoldalt.
- Aktív csomagnál külön rövid státuszkártya látszik: csomag, fiók, AI kredit.
- A régi „Admin áttekintés” marketing kártya kikerült a publikus bemutatóból.
- A projektoldali lenyitható blokkok plusz/mínusz ikonja szinkronizálva lett.

## Fontos

- Nincs új adatbázis tábla.
- Nincs új RPC.
- Nincs új Supabase SQL.
- A V173 megrendelői és törlési SQL továbbra is elég.
