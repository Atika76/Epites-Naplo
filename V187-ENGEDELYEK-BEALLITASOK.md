# V187 - Engedélyek és app beállítások

- Új `permissions-v187.js` modul került be a weboldalba.
- A fejlécben elérhető lett az `Engedélyek` gomb.
- Egy helyről kérhető az értesítés, kamera/mikrofon és GPS/helyadat jogosultság.
- Ha egy engedély már blokkolva van, a felület megmondja, hogy az Android/app vagy böngésző beállításokban kell visszakapcsolni.
- Android 13+ miatt a release app manifestje is megkapja a `POST_NOTIFICATIONS` jogosultságot.
