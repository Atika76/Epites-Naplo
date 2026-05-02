# V38 – főoldal tisztítás, fejléc és vendég mód javítás

Ebben a verzióban a V37 működő alap maradt, de a megbeszélt terméklogika szerint letisztult a rendszer.

## Javítások

- Egységesebb fejléc/navigáció minden fő oldalon.
- Auth villanás csökkentése: a navigáció nem mutat félkész belépési állapotot.
- Főoldal egyszerűsítve: a részletes naplózási blokkok nem a főoldalon vannak.
- A főoldalon projektindítás és projektlista marad, a munka a részletes projektoldalon folytatódik.
- Főoldalról elrejtve:
  - Hibák / javítások blokk
  - Riport előnézet blokk
  - Pénztermelő PRO eszközök blokk
  - részletes főoldali naplóbejegyzési mezők
- Vendég mód: a látogató látja az oldalt és a funkciókat, de használatkor regisztrációs popup jelenik meg.
- Regisztrációs üzenet: 1 hét ingyenes próba, 1 projekttel.
- A V37 GPS, képfeltöltési kosár, videó és egyéb munkafázis javításai megmaradtak.

## Supabase

Ehhez a V38 változáshoz nem kell új SQL-t futtatni.
