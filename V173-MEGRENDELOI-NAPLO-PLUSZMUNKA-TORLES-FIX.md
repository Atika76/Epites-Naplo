# V173 – Megrendelői napló + pluszmunka jóváhagyás + teljes törlés javítás

Ez a verzió hozzáadja azokat a fontos dolgokat, amiket megbeszéltünk:

## Új funkciók

1. **Megrendelői felület a projektoldalon**
   - Megrendelői link készítése.
   - Link másolása / email előkészítése / próba megnyitás.
   - A megrendelő külön felületen tud írni, de nem tudja átírni a kivitelező hivatalos naplóját.

2. **Megrendelői napló / visszajelzés**
   - Megjegyzés.
   - Kérdés.
   - Hibajelzés.
   - Jóváhagyási megjegyzés.

3. **Pluszmunka jóváhagyás**
   - Kivitelező rögzíti a pluszmunkát címmel, leírással és árral.
   - A megrendelő a saját linkjén elfogadhatja, kérdést írhat hozzá, vagy elutasíthatja.
   - A döntés nyoma megmarad a projektoldalon.

4. **Projekt törlés Supabase takarítással**
   - Új V173 RPC: `delete_project_full_v173`.
   - Törli a kapcsolódó megrendelői linkeket, megrendelői üzeneteket, pluszmunkákat, riportokat, jóváhagyásokat, média sorokat, naplóbejegyzéseket és a projektet.
   - A weboldali kliens a storage mappákat is megpróbálja takarítani több ismert bucketben.

## Fontos Supabase lépés

A ZIP feltöltése után a Supabase SQL Editorban futtasd le ezt a fájlt:

`supabase-v173-client-collab-clean-delete.sql`

Enélkül az új megrendelői modul csak részben vagy egyáltalán nem fog működni, mert új táblák és RPC-k kellenek hozzá.

## Érintett fájlok

- `project.html`
- `project-v173-client-collab-cleanup.js`
- `view.html`
- `view-v173-client-collab.js`
- `supabase-adapter.js`
- `style.css`
- `supabase-v173-client-collab-clean-delete.sql`

## Használat

1. Nyisd meg a projektet.
2. Görgess a **Megrendelői napló, jóváhagyás és pluszmunka** részhez.
3. Adj meg ügyfél nevet/emailt.
4. Nyomd meg: **Megrendelői link készítése**.
5. Küldd el a linket az ügyfélnek.
6. Rögzíts pluszmunkát, ha kell.
7. Az ügyfél a saját oldalán írhat és dönthet.

