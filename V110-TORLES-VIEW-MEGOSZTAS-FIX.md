# V110 javítások

Ez a verzió a V108/V109 alapot tartja meg, de javítja a konkrét hibákat:

- Ügyfélriport oldal új, tiszta `view.html` fájllal: nincs duplikált régi script, nincs beragadt mentés.
- Képnéző marad az oldalon, nem dob vissza főoldalra.
- Előző/következő lapozó megmaradt.
- Ikon és Facebook/Messenger OG előnézet megerősítve.
- Ügyfél visszajelzés mentése tisztább: megtekintve / elfogadom / kérdésem van.
- Projekt törlés: új Supabase RPC támogatás, hogy ne timeoutoljon és ne maradjanak bent régi riport, dokumentum, média sorok.

Fontos: a teljes törléshez futtasd le a `supabase-pro-v110-fast-delete-cleanup.sql` fájlt a Supabase SQL Editorban.
