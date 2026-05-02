# ÉpítésNapló AI PRO v10 – Login upgrade

## Mi változott?

- Jelszavas belépés bekerült.
- Új regisztráció külön fülön van.
- Emailes magic link külön fülre került, nem ez az alapértelmezett.
- Magic link gomb 30 másodperces védelemmel működik, hogy ne legyen Supabase `email rate limit exceeded` hiba.
- A nyers Supabase hibák helyett érthető magyar üzenetet kap a felhasználó.
- Bejelentkezve továbbra sem jelenik meg a Regisztráció gomb.

## Fontos Supabase beállítás

Supabase Dashboard → Authentication → Providers → Email

Ajánlott:
- Email provider: enabled
- Confirm email: igény szerint. Ha be van kapcsolva, regisztráció után email megerősítés kell.
- Password sign in: legyen engedélyezve.

## Használat

1. Új felhasználó: Belépés / Regisztráció → Új regisztráció → név, email, jelszó.
2. Már regisztrált felhasználó: Belépés jelszóval.
3. Email link csak tartalék megoldásként.

Ehhez a verzióhoz nem kell új SQL-t futtatni.
