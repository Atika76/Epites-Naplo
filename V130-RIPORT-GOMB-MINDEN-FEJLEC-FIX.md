# V130 – Riport gomb minden fejlécben fix

- A közös fejléc Riport gombja többé nem nyitja meg a `view.html` oldalt azonosító nélkül.
- Projektoldalon mindig a „Riportok és átadás” ablak nyílik meg.
- Másik oldalról a rendszer visszavisz az utoljára megnyitott projektre és automatikusan megnyitja a riport központot.
- Ha valaki véletlenül a `view.html` oldalt nyitja meg azonosító nélkül, nem marad hibás ügyfélriport nézetben, hanem visszairányít a projekt riport központjához, ha ismert az utolsó projekt.
