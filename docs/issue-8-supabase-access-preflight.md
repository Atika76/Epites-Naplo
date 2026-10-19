# ÉpítésNapló – a 403-as hozzáférés biztonságos rendezése

Dátum: 2026. október 18. Ez vizsgálati eredmény és jóváhagyásra váró hozzáférési eljárás; nem telepítési engedély.

## Ellenőrzött tények

- A `supabase-adapter.js` és az `import-szakipiac.html` egyaránt a `tcmihuwjlapfaonihdma` projektre mutat. A projektazonosítót nem változtattuk meg.
- A meglévő CLI-hitelesítéssel a `supabase projects list --output json` sikeres. A SzakiPiac látszik, az ÉpítésNapló nem. A CLI nincs környezeti tokennel felülírva.
- A `supabase functions list --project-ref tcmihuwjlapfaonihdma --output json` 403: `Your account does not have the necessary privileges to access this endpoint`.
- Ez a Management API hozzáférési elutasítása, nem az alkalmazás adatbázisának RLS-hibája. RLS lazítása, service_role kulcs használata vagy frontend-átírás nem megoldás erre.
- Ebben a Codex-munkamenetben nincs elérhető, bejelentkezett böngésző a Dashboard vizsgálatához. A fiók tagságát, a token hatókörét és a tényleges hosted projekt létezését a 403 mögött nem tudtuk igazolni. Az eltérő fiók, a hiányzó tagság és a tokenkorlátozás egyelőre lehetséges ok, nem bizonyított diagnózis.
- Nem változott éles adat, séma, kulcs, tagság vagy telepített függvény; nem küldtünk meghívót, nem hoztunk létre tokent, és nem változtattunk a CLI bejelentkezésén.

## A legkisebb szükséges továbblépés

1. A tulajdonos a saját meglévő bejelentkezésével nyissa meg a [projektet](https://supabase.com/dashboard/project/tcmihuwjlapfaonihdma). Ellenőrizze az azonosítót, a szervezetet és a bejelentkezett fiókot. Ha a projekt ott sem elérhető, előbb a tulajdonosi fiókot / helyes projektazonosítót kell tisztázni; az alkalmazást találomra más projektre átállítani tilos.
2. Ha a Dashboard elérhető, hasonlítsa össze a CLI-hitelesítéshez használt fiókkal, és nézze meg a meglévő token jogosultságait. A scoped token akkor is adhat 403-at, ha a tulajdonos a Dashboardon hozzáfér. A token csak szűkítheti a fiók saját jogosultságait. [Hivatalos PAT-leírás](https://supabase.com/docs/guides/platform/personal-access-tokens).
3. Első választás: a jogosult tulajdonos a saját munkamenetében végezze el a kizárólag olvasó leltárt, és titkok nélkül adja át az eredményt. Ehhez nem kell új személyt meghívni vagy szélesebb hozzáférést adni az agentnek.
4. Ha közvetlen ellenőrzés kell, kizárólag külön jóváhagyás után, az adott projektre korlátozott, rövid ideig érvényes scoped token javasolt: Project Settings / Database / Edge Functions **Read**, szükség szerint Migrations **Read**. Auth Config Read csak a hitelesítési konfiguráció külön vizsgálatához szükséges. Új tokent biztonságos helyi hitelesítési módon kell megadni, nem chatben vagy GitHubon. A meglévő titkokat nem kell cserélni vagy megosztani.
5. Tagság módosítása csak akkor indokolt, ha a jogosult tulajdonos igazolta annak hiányát. A Read-Only szerep és a projektre szűkített tagság Team/Enterprise csomagfüggő; ezért nem feltételezzük, hogy elérhető. Nem javaslunk csomagváltást vagy Owner/Admin jogot az ellenőrzés kedvéért. Ha nincs megfelelő szűkítés, a tulajdonos által elvégzett olvasó leltár marad a javaslat. [Hivatalos hozzáférési szabályok](https://supabase.com/docs/guides/platform/access-control).

## Az olvasó előellenőrzés elfogadási feltételei

- A projektre vonatkozó jogosult olvasás sikeres; a két import Edge Function neve, verziója, forrása és JWT-ellenőrzési beállítása leltározott. Nem kell függvényt meghívni vagy telepíteni.
- A migrációk előtt ténylegesen létező `projects`, `entries`, `project_materials`, `tasks`, `diary_entries`, `project_import_requests`, `project_imports`, `shared_bundle_entitlements` táblák oszlopai, típusai, alapértékei, kulcsai, indexei, RLS-policyjai, triggerei és jogosultságai összevethetők a repositoryval. A hiányzó táblát hiányzóként kell jelenteni; nem automatikusan létrehozni.
- Az érintett adatbázisfüggvények definíciói, futtatási jogosultságai és a migrációs előzmények ellenőrzöttek. A katalóguslekérdezés kifejezett `BEGIN TRANSACTION READ ONLY` / `ROLLBACK` keretben történjen, vagy az API dokumentált read-only végpontján. Nincs `supabase link`, `db push`, ideiglenes login-szerepkör létrehozása vagy DDL ehhez a körhöz.
- A handoff végpont és a szükséges titkok meglétét a tulajdonos ellenőrzi, titkos értékek közzététele nélkül. A TLS/gateway/Auth-kompatibilitást és a régi rekordok migrációs feltételeit külön jegyzőkönyv zárja le. Éles üzleti rekordok tartalmát ne másoljuk publikus PR-be.
- E leltár után is külön tulajdonosi jóváhagyás kell minden éles jogosultságmódosításhoz, migrációhoz és telepítéshez. A két helyi Supabase-stack sikeres tesztje önmagában nem jelent élesítési engedélyt.

**Jelen állapot:** a 403 reprodukálva, a megkerülés kizárva. A konkrét fiók/tagság/token eltérés eldöntéséhez a jogosult tulajdonos fenti ellenőrzése hiányzik. Az éles kompatibilitási vizsgálat továbbra is nyitott.
