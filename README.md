# ÉpítésNapló AI PRO – 100% automatikus PayPal → Pro

## Mit tartalmaz?

- PayPal fizetés
- Supabase Edge Function PayPal ellenőrzéssel
- Sikeres fizetés után automatikus Pro aktiválás
- `payments` tábla
- Admin dashboard: regisztrált felhasználók + fizetések
- Projekt, napló, hibajegy mentés Supabase-be

## 1. GitHub feltöltés

A repo gyökerébe töltsd fel:

- index.html
- style.css
- script.js
- supabase-adapter.js
- favicon.svg

## 2. Supabase SQL

SQL Editorban futtasd le:

- supabase-schema.sql

## 3. Supabase Edge Function

Supabase CLI-vel vagy Dashboardon hozd létre:

- supabase/functions/paypal-activate/index.ts

## 4. Supabase Secrets

A functionhöz szükséges secretek:

- PAYPAL_ENV=live
- PAYPAL_CLIENT_ID=AQsaQCLj0og2wsfMoDKAqxJieD2cgXwWq5cssAJCJbO2KoYE8LGHCREyR4vMzMfKZK68qw6EY7IAxMYF
- PAYPAL_CLIENT_SECRET=IDE_A_PAYPAL_SECRET
- SUPABASE_URL=https://tcmihuwjlapfaonihdma.supabase.co
- SUPABASE_ANON_KEY=sb_publishable_TC5UHGi1CZGVFnz2py1HiQ_fn-wxy81
- SUPABASE_SERVICE_ROLE_KEY=IDE_A_SUPABASE_SERVICE_ROLE_KEY

## 5. Authentication URL

Supabase → Authentication → URL Configuration:

Site URL:
https://atika76.github.io/Epites-Naplo/

Redirect URLs:
https://atika76.github.io/Epites-Naplo/

## Fontos

A PayPal Client ID publikus. A PayPal Secret és Supabase Service Role Key titkos, ezeket soha ne tedd GitHubra.


## Csomag és admin javítás

- Admin fiók fizetés nélkül Business szintű hozzáférést kap.
- Több fizetős csomag:
  - Alap: 2 990 Ft / hó
  - Pro: 4 990 Ft / hó
  - Business: 8 990 Ft / hó
- A gombszerű, csak leíró címkék le lettek tisztítva.
- PayPal fizetés összege alapján aktiválódik a megfelelő csomag.


## Következő szint funkciók

- Dátum szerinti naplószűrés
- Kockázati szint szerinti szűrés
- Ügyfélnek küldhető riport
- PDF jelentés letöltése
- Megosztható ügyfélüzenet
- AI javítási javaslat
- AI anyagjavaslat


## Projekt törlés és módosítás

- Minden regisztrált felhasználó módosíthatja a saját projektjét.
- Minden regisztrált felhasználó törölheti a saját projektjét.
- Más felhasználó projektjéhez nem fér hozzá, mert a Supabase RLS user_id alapján véd.
- Projekt törléskor a kapcsolódó naplóbejegyzések és hibajegyek is törlődnek.

## Ügyfél link

Az ügyfél link formája:
https://epitesi-naplo.eu/#client-PROJEKT_ID

A jelenlegi verzióban a link kimásolható és a riportban megjelenik. A teljes publikus, jelszó nélküli ügyfélportálhoz külön public_reports tábla és publikus view javasolt.


## Admin minden fiókhoz hozzáfér teszteléshez

1. GitHubra töltsd fel a fájlokat.
2. Supabase SQL Editorban futtasd:
   `supabase-admin-full-access.sql`

Mit tud:
- Admin látja az összes regisztrált felhasználót.
- Admin látja az összes fizetést.
- Admin a "Megnézés" gombbal betöltheti egy felhasználó projektjeit, naplóit és hibáit.
- Admin tesztnézetből vissza tud lépni saját nézetre.
- Normál felhasználó csak a saját projektjét tudja módosítani/törölni.


## Admin csomag teszt

Admin fiókkal fizetés nélkül lehet váltani a csomagnézetek között:
- Próba
- Alap 2 990
- Pro 4 990
- Business 8 990
- Lejárt

Ez csak teszteléshez van. A valódi ügyfeleknél a csomagot a Supabase subscription és PayPal fizetés állítja.


## Fix 2

- A fiókállapot és az aktuális csomag kijelzés most ugyanazt a csomagot mutatja.
- Admin tesztnézetnél fent is ugyanaz látszik, mint a csomagdobozban.
- Az admin csomag teszt csak admin fióknál jelenik meg.


## AI + működő ügyfél link

Supabase-ben futtasd le:
`supabase-public-reports.sql`

Ez létrehozza a `public_reports` táblát.

Működés:
1. Felhasználó elkészíti a projekt riportot.
2. Megnyomja: Működő ügyfél link létrehozása.
3. A rendszer elmenti a riportot Supabase-be.
4. Kimásolja a linket.
5. Az ügyfél bejelentkezés nélkül megnyithatja:
   `https://epitesi-naplo.eu/#riport-TOKEN`

AI működés:
- A bejegyzés szövege alapján hibakockázatot ad.
- Javítási javaslatot ad.
- Anyaglistát ad.


## Messenger link javítás + admin üzenet

Supabase-ben futtasd újra:
`supabase-public-reports.sql`

Ez javítja:
- publikus riport olvasási jog
- `?riport=TOKEN` linkformátum Messengerhez
- admin hibabejelentés tábla
- admin üzenetlista

Email értesítéshez Supabase Edge Function:
`supabase/functions/notify-admin/index.ts`

Secrets:
- RESEND_API_KEY
- ADMIN_EMAIL
- RESEND_FROM_EMAIL

Ha ezek nincsenek beállítva, az üzenet akkor is mentődik Supabase-be, csak email nem megy ki.


## Felhasználói nézet javítás

- Az adminnak szóló szöveg normál felhasználónál nem jelenik meg.
- A belépés/kilépés gomb állapota frissül.
- A fiókállapot ugyanazt a csomagot mutatja, mint a csomagdoboz.
- Az admin tesztpanel csak adminnak látható.

## ÉpítésNapló AI PRO v3 – kommunikáció és értesítések

Újdonságok:
- Admin email központ: `cegweb26@gmail.com`
- Új „Üzenet az adminnak” felület
- Supabase `support_messages` tábla és admin nézet
- Ügyfél link + PDF export megtartva
- Email értesítés Resend Edge Function alappal
- SMS mező előkészítve későbbi Twilio / SMS szolgáltató bekötéshez

Telepítés:
1. Töltsd fel a fájlokat GitHub Pages-re felülírással.
2. Supabase SQL Editorban futtasd: `supabase-pro-v3-upgrade.sql`.
3. Supabase Edge Functions alatt deployold:
   - `notify-admin`
   - `notify-client`
4. Supabase Secrets alatt állítsd be:
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `ADMIN_EMAIL=cegweb26@gmail.com`

Megjegyzés: SMS küldéshez külön SMS szolgáltató szükséges. Addig a rendszer előkészíti és kimásolja az SMS szöveget.


## v4 újdonságok

- `admin-messages.html` külön admin inbox oldal.
- `view.html?riport=TOKEN` profi, csak olvasható ügyfélriport oldal.
- Értesítés panel a fő felületen.
- Ügyfél riport megnyitás követése: `opened_at`, `view_count`, `report_events`.
- Robusztus SQL: `supabase-pro-v4-upgrade.sql`.

Telepítés:
1. GitHubon tölts fel minden fájlt felülírással.
2. Supabase SQL Editorban futtasd: `supabase-pro-v4-upgrade.sql`.
3. Admin email: `cegweb26@gmail.com`.
4. Admin inbox: `https://epitesi-naplo.eu/admin-messages.html`.

## v6 üzleti okosítások
- Business ár: 8 990 Ft / hó bevezető ár kommunikációval
- Fizetős AI riport ajánlat: 390 Ft / riport, 10 db 2 990 Ft
- Automatikus anyaglista és költségbecslés
- Számla / díjbekérő előkészítő
- AI fotóelemzés előszűrés, későbbi Vision API bekötésre előkészítve

Supabase-ben futtasd: `supabase-pro-v6-upgrade.sql`
