# ÉpítésNapló AI PRO v5 - Android APK útmutató

Ez a ZIP már PWA mobil appként működik. Ez azt jelenti, hogy Androidon a böngészőből telepíthető ikonként.

## Gyors telepítés telefonra
1. Nyisd meg: https://epitesi-naplo.eu
2. Chrome vagy Samsung Internet menü
3. Hozzáadás a kezdőképernyőhöz / Install app
4. Innentől appként indul.

## Valódi APK később
APK-hoz javasolt út: Capacitor vagy Bubblewrap/TWA.
A weboldal már tartalmazza a szükséges alapokat:
- manifest.webmanifest
- sw.js service worker
- mobil app telepítő gomb
- offline gyorsítótár

## Push értesítés
A böngészős engedélyezés működik. Távoli automata push küldéshez OneSignal vagy Firebase kulcs kell.
