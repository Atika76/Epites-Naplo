# V182 – mobil fejléc görgetés javítás

Ez a javítás a V180 stabil alapból készült.

## Javítás

- Mobilon a fejléc továbbra is el tud tűnni, amikor lefelé haladsz az oldalon, hogy ne foglalja a helyet.
- Amint visszafelé görgetsz a lap teteje felé, a teljes fejléc azonnal megjelenik.
- A hamburger menü így nem csak a lap tetején érhető el.
- A menü nyitott állapotban nem rejtőzik el.
- Nem kell új Supabase SQL.

## Teszt

Telefonon nyisd meg a napló/projekt oldalt, görgess lejjebb, majd egy kicsit görgess visszafelé. A fejlécnek azonnal meg kell jelennie.
