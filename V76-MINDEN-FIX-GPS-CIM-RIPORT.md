# V76 - vegso stabilizalas

## Javitasok

- Az ugyfelriport PDF export tiszta, rejtett PDF-nezetbol keszul, nem a teljes publikus oldalbol.
- A PDF-ben a fotok kisebb racsban maradnak, nem nyulnak teljes oldalas kepekre.
- Az ugyfel jovahagyasakor a teljes riport HTML es szoveg snapshot is atadasra kerul a Supabase RPC-nek.
- A riport dokumentumkezelo Supabase fuggvenyei mindig betoltodnek, nem csak munkatars-mentes utan.
- A GPS koordinata alapjan a rendszer megprobal cimet keresni, kitolti a cim mezot, es a naplobejegyzesbe is beleirja.
- A `location_address` mezo mentese is tamogatott, ha a Supabase SQL-ben mar letre van hozva.

## Supabase

Ha meg nem futott, futtasd:

`supabase-pro-v71-jovahagyott-riport-pro.sql`

`supabase-pro-v75-report-documents-gps-address.sql`

Az elso kell az ugyfel-jovahagyas snapshot mentesehez. A masodik kell a mentett riport peldanyokhoz es az opcionalis `entries.location_address` mezohoz.
