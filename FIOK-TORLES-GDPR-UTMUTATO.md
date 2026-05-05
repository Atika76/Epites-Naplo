# ÉpítésNapló AI PRO v8 – Fiók törlése + GDPR

## Ami bekerült

- Új `profile.html` oldal: Fiókom / adatvédelem
- Fiók végleges törlése `TÖRLÉS` megerősítéssel
- Új Supabase Edge Function: `delete-account`
- Új SQL: `supabase-pro-v8-account-delete-gdpr.sql`
- Törlési napló: `account_deletions`
- Admin fiók védelme: `cegweb26@gmail.com` nem törölhető ebből a felületből

## Supabase beállítás

1. SQL Editorban futtasd:

```sql
supabase-pro-v8-account-delete-gdpr.sql
```

2. Supabase Edge Functions közé töltsd fel:

```text
supabase/functions/delete-account/index.ts
```

3. Secrets / Environment variables:

```text
SUPABASE_URL = a projekt URL
SUPABASE_SERVICE_ROLE_KEY = service_role kulcs
ADMIN_EMAIL = cegweb26@gmail.com
```

A service_role kulcsot soha ne tedd frontend fájlba. Csak Edge Function secretként használd.

## Működés

A felhasználó a `Fiókom` menüben tudja törölni magát. A törlés:

- törli a profilját
- törli a projektjeit
- törli a naplóbejegyzéseit
- törli a hibajegyeit
- törli a publikus riport linkjeit
- törli az értesítéseit
- törli a push feliratkozásait
- törli az AI fotóelemzéseit
- végül törli az Auth felhasználót

