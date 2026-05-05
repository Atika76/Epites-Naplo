# V144 – share-report nyers HTML és ékezet javítás

Csak a `supabase/functions/share-report/index.ts` módosult.

Javítások:
- emberi megnyitáskor a share-report funkció azonnal a valódi `view.html?riport=...` oldalra irányít;
- Facebook/Messenger/WhatsApp bot továbbra is megkapja az OG meta adatokat;
- UTF-8 válasz explicit `text/html; charset=utf-8` fejléccel;
- mojibake jellegű `SÃ¡valap` szövegek javítása a megosztási cím/leírás előtt.
