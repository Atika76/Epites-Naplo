# ÉpítésNapló AI PRO – V153 CLEAN végleges stabil alap

Ez a csomag a V152-ből készült stabilizált, tisztított verzió.

## Mit javít
- Egyetlen végleges képnéző: `unified-photo-viewer-v153.js`
- A projektoldal már nem tölti be külön a régi V77/V87/V103/V121/V134 stb. javító scripteket, ezek egy `project-v153-stabilizer.js` fájlba kerültek.
- A riport HTML-ekből a régi képnéző scriptek automatikusan ki vannak takarítva.
- Ügyfélriport profibb blokkot kap: munka állapota, mai munka, következő lépés, fotódokumentáció.
- Admin panelen új rendszerállapot + „Projekt-maradványok takarítása” gomb van.
- Kép/videó optimalizáló megmaradt.
- AI kredit magyarázat érthetőbb lett.

## Supabase
Futtatható új SQL:
`supabase-v153-clean-stabilization.sql`

Ez hozzáadja az admin takarítás RPC-t és néhány gyorsító indexet.

## Fontos feltöltéskor
A régi V-s JS fájlok már nincsenek behivatkozva. Ha teljesen tiszta GitHub repót akarsz, a régi `project-v...js` és `unified-photo-viewer-v14x/v15x.js` fájlokat törölni lehet, mert a V153 már az új fájlokat használja.
