# V52 - kép és videó megnyitás javítás

## Javítások

- A publikus ügyfélriportban a "Megnyitás új lapon" gomb már nem sima `href` linkként működik, hanem külön média néző oldalt nyit.
- A `data:` képek is megnyithatók új lapon, mert a rendszer HTML nézőlapba ágyazza őket.
- A videók új lapon nyitása is működik akkor, ha a videóhoz friss Supabase signed URL érkezik.
- Ha a videó linkje csak betöltés után válik elérhetővé, a rendszer létrehozza a működő "Videó megnyitása új lapon" linket.
- PDF exportból a nem működő média-link feliratok kikerülnek, mert a PDF-ben ezek nem valódi interaktív gombok.
