# V178 – tiszta fejléc és konkrét helyre rendezett funkciók

Alap: V175b működő verzió.

## Javítások

- A fejlécből kikerült a külön `Csomagok` gomb.
- Adminnak csak egy `Admin` menüpont marad, ami a külön `admin-panel.html` oldalra visz.
- A főoldali `Admin áttekintés` blokk el van rejtve, mert az admin kezelésnek külön helye van.
- Kilépett látogató fejlécében látszik a `Rendszerfunkciók` menüpont.
- A `Rendszerfunkciók` blokk a főoldalon vendégként is olvasható.
- A túl magyarázós `Mire használható` blokk ki lett véve.
- A működő V175b fizetési/csomag logika megmaradt: aktív csomagnál nem mutat nagy fizetési blokkokat.
- Nincs új Supabase SQL.

## Fejléc logika

- Vendég: Főoldal / Rendszerfunkciók / Belépés-Regisztráció
- Felhasználó: Főoldal / Napló / Riport / Fiókom / Kilépés
- Admin: Főoldal / Napló / Riport / Fiókom / Admin / Kilépés
