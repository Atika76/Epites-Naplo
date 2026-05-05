# V149 - Supabase gyorsítás + kép/videó optimalizálás

Ez a verzió a V148 alapra épül.

## Javítások
- Erősebb kliens oldali képtömörítés feltöltés előtt.
- Nagy képeknél automatikusan kisebb méret és erősebb JPG tömörítés.
- Videóknál méretellenőrzés és támogatott böngészőkben WebM tömörítési próba feltöltés előtt.
- Privát videók signed URL-je session cache-be kerül, így nem kér új linket minden frissítésnél.
- Projektoldalon csak az aktuális projekt bejegyzéseit kéri le, nem az összes felhasználói bejegyzést.
- Rövid idejű kliens cache a projektekre, bejegyzésekre és riport záróadatokra.
- Új SQL index fájl: `supabase-v149-performance-indexes.sql`.

## Fontos
A videó tömörítés böngészőfüggő. iPhone Safari alatt korlátozott lehet, ilyenkor a rendszer nem hazudik tömörítést, hanem kisebb videót kér.
