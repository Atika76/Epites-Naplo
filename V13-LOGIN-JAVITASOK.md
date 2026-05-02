# ÉpítésNapló AI PRO v13 – login javítások

- Jelszó láthatóvá tétele szem ikonnal.
- Elfelejtett jelszó gomb a belépési ablakban.
- Új `reset-password.html` oldal.
- Admin panel ellenőrzés `profiles.is_admin` alapján is.

Supabase → Authentication → URL Configuration alatt add hozzá, ha kell:
`https://epitesi-naplo.eu/reset-password.html`
