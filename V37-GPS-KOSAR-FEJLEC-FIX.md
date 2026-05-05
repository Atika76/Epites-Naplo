# V37 – GPS biztonság, feltöltési kosár, fejléc és auth finomítás

Javítások:
- A fejléc/navigáció minden oldalon teljesebben, tördelve jelenik meg, mobilon sem tűnik el.
- Az automatikus GPS mentés már nincs alapból bekapcsolva.
- Mentés előtti GPS/időjárás lekérés csak külön bepipálással és megerősítéssel fut.
- Új „Munka helyszíne / cím” mező került a projekt napi naplóhoz.
- Fotó/videó feltöltési kosár: több külön kiválasztás összeadódik, nem írja felül az előző választást.
- A kosárban bélyegkép/lista látszik, és fájl törölhető mentés előtt.
- A főoldali gyors napló továbbra is működik, de új projekt létrehozás után felajánlja a részletes projektoldal megnyitását.
- Auth villanás csökkentve: a be-/kilépési állapot nem villan fel vendégként induláskor.

Supabase módosítás ehhez a verzióhoz nem szükséges.
