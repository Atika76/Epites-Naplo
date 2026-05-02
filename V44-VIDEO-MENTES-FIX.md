# V44 - Projekt videó mentés fix

- Mobilon akkor is videófájlként kezeli a feltöltést, ha a telefon nem ad `video/*` MIME típust, de a fájlnév `.mp4`, `.mov`, `.m4v`, `.webm`, `.3gp`, `.mpeg` vagy `.avi`.
- A projekt napi bejegyzés videója mentéskor bekerül a `video_urls` mezőbe és az `ai_json.videos` / `ai_json.videoUrls` adatokba is.
- Ha a Supabase táblában még hiányzik a `video_urls` oszlop, a rendszer nem dobja el a videó hivatkozását, hanem az `ai_json` mezőben megtartja.
- A `supabase-pro-v44-video-mentes-fix.sql` létrehozza vagy javítja a `project-videos` bucketet, a `video_urls` mezőt és a szükséges Storage policy-ket.
- Cache verzió: `v44`.
