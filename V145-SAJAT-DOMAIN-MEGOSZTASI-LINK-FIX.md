# V145 – Saját domaines megosztási link fix

Csak a megosztási URL logikája változott.

## Javítás
- A rendszer már nem a hosszú Supabase Edge Function linket küldi ki.
- Megosztáskor ezt használja: `https://epitesi-naplo.eu/share.html?riport=TOKEN&v=145`
- Ez szebb Facebookon, Messengerben, WhatsAppban és Viberben.
- A `share.html` továbbra is megnyitja a valódi `view.html` ügyfélriportot.
- A Web Share API-ból kikerült a felesleges hosszú előszöveg, hogy WhatsAppban nagyobb eséllyel kártyaként jelenjen meg.

## Fontos
A Facebook/Messenger/WhatsApp cache-el. Teszteléshez mindig új ügyfélriport linket kell készíteni.
