# V51 - riport leírás és ügyfél jóváhagyás javítás

## Javítások

- A Szöveges leírás mező külön, átlátható blokkot kapott a főoldali és projekt napi mentésnél.
- Az ügyfélriport Napi dokumentáció része olvashatóbb: a bejegyzés szövege listás/kártyás megjelenést kap.
- A régi, már legenerált összefolyt riportszöveget a publikus riport oldal betöltéskor megpróbálja kártyákra bontani.
- A halvány ügyfél jóváhagyási checkbox és gombok kontrasztja javítva.
- A riportban előforduló `NaN Ft` érték 0 Ft-ra normalizálódik, és az új költségszámítás nem enged NaN összeget.

## Gemini API kulcs

A `GEMINI_API_KEY` továbbra sem kerülhet kódba vagy ZIP-be. Supabase Edge Function Secretként kell beállítani.
