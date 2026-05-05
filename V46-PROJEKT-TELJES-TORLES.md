# V46 - Projekt teljes törlés

- Projekt törlésekor a rendszer először kiolvassa a projekthez tartozó naplóbejegyzések videó útvonalait.
- A `project-videos` Supabase Storage bucketből törli a projekt mappájában lévő videófájlokat.
- Ezután törli a kapcsolódó Supabase sorokat: riport jóváhagyások, publikus riportok, projekt tagok, anyagok, számlák, AI fotóelemzések, teendők és naplóbejegyzések.
- Végül törli magát a projektet.
- Ha a videó Storage törlés hibázik, a projekt törlése megáll, hogy ne maradjon árva videó a Supabase-ben.
- A `supabase-pro-v46-projekt-teljes-torles.sql` a szükséges törlési policy-ket állítja be.
- Cache verzió: `v46`.
