# V42 - Kiegészítés média és videó mentés fix

- A naplóbejegyzés alatti "Kiegészítés hozzáadása" gomb már szöveget, képet és videót is tud menteni.
- A kiegészítéshez adott képek bekerülnek a bejegyzés képei közé és az ügyfélriportban is megjelennek.
- A kiegészítéshez adott videók a `project-videos` Supabase Storage bucketbe töltődnek, majd a bejegyzés `video_urls` mezőjébe kerülnek.
- Az AI elemzés a kiegészítés után újraszámolja a bejegyzés összefoglalóját és javaslatait.
- A böngésző cache verzió `v42`, hogy feltöltés után ne a régi JavaScript fusson.

Megjegyzés: a videómentéshez szükséges, hogy a V30/V31 SQL beállítások és a privát `project-videos` bucket létezzenek a Supabase-ben.
