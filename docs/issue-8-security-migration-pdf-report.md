# SzakiPiac 360 és ÉpítésNapló – jogosultságok, migrációk és PDF-regresszió

2026. október 19. Fejlesztési ág mindkét repositoryban: `codex/issue-8-stabilization`.

PR-ek: [SzakiPiac #9](https://github.com/Atika76/szakipiac-2025/pull/9), [ÉpítésNapló #1](https://github.com/Atika76/Epites-Naplo/pull/1). Egyik sincs merge-elve. Éles migráció, jogosultság-, szerepkör-, kulcs-, konfiguráció-, Edge Function- vagy weboldal-telepítés nem történt ebben a munkában. Az október 18-i jelentésben külön közölt CLI-szerepkör-inicializálás korábbi eseményét ez nem írja felül.

## 1. Közvetlen, csak olvasó ellenőrzés

Mindkét külön hitelesítés működik. A vizsgálat a hivatalos `/database/query/read-only` API-n, `BEGIN TRANSACTION READ ONLY` / `ROLLBACK` között, `supabase_read_only_user` szereppel történt. Nem használtunk login-szerepet automatikusan létrehozó `supabase link` vagy `db query --linked` parancsot. Csak katalógusokat és a Storage-bucket beállításait olvastuk, üzleti vagy személyes éles rekordokat nem másoltunk tesztadatbázisba.

| Rendszer | Projekt | public táblák | Effektív TRUNCATE anon | Effektív TRUNCATE authenticated |
|---|---|---:|---:|---:|
| SzakiPiac | `bxtpnotswnwrbycvfypz` | 20 | 16 | 17 |
| ÉpítésNapló | `tcmihuwjlapfaonihdma` | 32 | 30 | 32 |

A Napló `projects` tábláján az `aclexplode(relacl)` konkrét, közvetlen `TRUNCATE`-bejegyzést mutat mindkét böngészős szerepre, `postgres` grantorral. Az anon/authenticated szerep nem kapja ezt egy másik szerep tagságának öröklésével. A jelenlegi állapotnak megfelelő SQL: `GRANT TRUNCATE ON public.projects TO anon, authenticated;`. Ez az állapot SQL-beli leírása; a történetileg lefuttatott pontos GRANT ALL parancsot, dátumot és végrehajtót auditnapló nélkül nem lehet bizonyítani.

Az alapértelmezett ACL-ek is túl szélesek: a `public` sémában a `postgres` és a `supabase_admin` által később készített táblákra is adnak TRUNCATE-jogot ezeknek a szerepeknek. Így pusztán a mostani táblák jogainak visszavonása nem oldaná meg az új táblák problémáját.

Érintett érzékeny Napló-táblák például: `profiles`, `payments`, `subscriptions`, `entries`, `project_import_requests`, `project_imports`, `project_materials`, `report_documents`, `ai_credit_accounts`. A vizsgált public táblákon mindenhol be van kapcsolva az RLS. Ez nem korlátozza a TRUNCATE műveletet: az elkülönített próbában egy RLS miatt láthatatlan szintetikus rekordot az anon szerep TRUNCATE-tal törölni tudott. **Éles TRUNCATE-próba nem történt.** A normál REST felület ettől még nem kínál közvetlen TRUNCATE műveletet; a megállapítás nem bizonyított böngészős tömegtörlési támadás állítása. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

A repositoryk átvizsgált alkalmazáskódjában nincs szükséges TRUNCATE-hívás. A public függvénytörzsek katalóguskeresése sem talált közvetlen TRUNCATE-hivatkozást. Ez célzott vizsgálat, nem valamennyi fizetési, AI- és admin-RPC teljes biztonsági auditja.

### Minimális javaslat, még nem telepítve

- `docs/proposals/revoke-browser-truncate.sql`: kizárólag TRUNCATE visszavonása a rögzített public táblalistán anon/authenticated szereptől, és a `postgres` saját public-táblaalapértelmezéseinek szűkítése.
- `docs/proposals/revoke-platform-default-truncate.sql`: külön platformoperátori lépés a `supabase_admin` által létrehozott jövőbeli public táblákhoz.
- A két `restore-*-snapshot.sql` a rögzített eredeti jogosultságok visszaállítási terve; ezek sem automatikus migrációk. Használatuk újra széles jogokat adna, ezért külön jóváhagyáshoz kötött vészmegoldások.

A javaslat megőrzi a SELECT/INSERT/UPDATE/DELETE jogokat, a profiles oszlopszintű korlátozásait, a service_role jogait és az RLS-szabályokat. A szintén megfigyelt REFERENCES/TRIGGER/MAINTAIN jogokat nem vontuk össze egy általános REVOKE ALL lépéssel: azok külön indokolt felülvizsgálatot igényelnek. Nem kerültek a telepített migrációk közé a jogosultságjavaslatok, így egy későbbi célzott workflow sem futtatja őket véletlenül.

**Valós tulajdonosi korlát:** a hosted `postgres` nem superuser és nem tagja a `supabase_admin` szerepnek. Az összes vizsgált public tábla tulajdonosa postgres, így a saját tábláinak és saját alapértelmezéseinek javítása elkülöníthető. A platformszerep alapértelmezéseihez a Supabase által jogosított operátor/támogatás szükséges. Nem javasolt szereptagságot adni ennek megkerülésére. A teszt bizonyítja, hogy egy nem superuser tulajdonos a saját alapértelmezését módosíthatja, a platformszerepét nem. [ALTER DEFAULT PRIVILEGES szabályai](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

Ha majd engedélyezed ezt a külön éles biztonsági változtatást: a saját fiókodban az érintett projekt SQL Editorában a tulajdonosi scriptet kell külön átnézni; a platformrészhez Supabase-támogatástól kell kérni a konkrét `supabase_admin` default ACL rendezését. Ehhez nem kell jelszót vagy API-kulcsot chatbe küldeni. Most egyik műveletet sem kell elvégezned.

## 2. Technikai CLI-szerep

2026-10-19-én mindkét projektben ellenőrizve:

| Projekt | Szerep | Belépési érvényesség vége, Budapest | Lejárt | Aktív kapcsolatok |
|---|---|---|---|---:|
| Napló | cli_login_postgres | 2026-10-18 20:35:36 | igen | 0 |
| SzakiPiac | cli_login_postgres | 2026-10-18 18:26:45 | igen | 0 |

A szerep objektuma még létezik, LOGIN attribútuma true, superuser/BYPASSRLS attribútuma false. A postgres szerepre SET-joga van, automatikus öröklése nincs. Tehát potenciálisan erős technikai szerep, de az ellenőrzött jelszavas belépési érvényesség lejárt és fennmaradt kapcsolat nincs. Az objektum puszta léte alapján nincs igazolt sürgős törlési igény. Nem töröltük, nem frissítettük és nem módosítottuk; későbbi CLI-inicializálás újra érvényesíthetné, ezért az ilyen CLI-műveleteket továbbra is kerüljük az olvasó auditnál. Esetleges platformoldali takarítás külön tulajdonosi döntés.

## 3. Valós séma elkülönített visszajátszása

Új `tests/hosted-schema.sql` fixture-ök a tényleges katalógusból:

- SzakiPiac: a 3 érintett tábla, 59 eredeti oszlop, 8 eredeti constraint, 10 public policy, a megosztási függvények és trigger.
- Napló: a 8 import/napi tábla és profiles, összesen 112 oszlop, 22 constraint, 30 public policy, admin-/Auth-triggerfüggvények; külön a 11 Storage-policy.
- Az ACL-eket a közvetlen katalógusból állítottuk elő, beleértve a profiles oszlopszintű UPDATE-jogait. A Napló helperében/policy-jában lévő beégetett admin e-mailt `admin@example.test` tesztliterálra cseréltük; a feltétel szerkezete változatlan.
- Nem kerültek át éles rekordok vagy fájlok. Az Auth alapját a PostgreSQL-próbában meglévő teszthelper, a Supabase-próbában a valódi helyi Supabase adja. Nem állítjuk, hogy ez a teljes platform/billing/AI-séma másolata.

A gépen Docker/WSL nem volt elérhető. A GitHub üzemzavara miatt letöltött, telepítés nélküli PostgreSQL 17.11 futott kizárólag `127.0.0.1:55440` címen, saját ideiglenes adatkönyvtárral. A Windows PostgreSQL ékezetes útvonalproblémája miatt egy ellenőrzött E: mappahivatkozás mutat ugyanebbe a munkamappába; projektet nem költöztettünk és rendszer-szolgáltatást nem telepítettünk. [Hivatalos Windows bináriscsomag-lehetőség](https://www.postgresql.org/download/windows/).

A két 001/002 migráció sikeres a valódi érintett séma alakján; többször lefut. Az eredeti oszlopok/típusok, constraint-ek, indexek, meglévő policy-k és táblajogok megmaradnak. A Napló korábban hiányzó project_materials FK-it és a diary_entries timezone nélküli dátumtípusát a fixture ténylegesen megőrzi, nem helyettesíti tisztább új sémafeltételezéssel.

Minden migráció végére szándékos hibát injektáltunk: a tranzakció teljes DDL/policy/függvény/jogváltozása visszagördült, utána a rendes migráció sikeresen lefutott. A szintetikus régi projekt, napi bejegyzés/képhivatkozás, teendő, anyag, napló és importkapcsolat változatlan maradt. A régi elfogadott ajánlatból nem gyártottunk visszamenőleg ügyféldöntési bizonyítékot. A nem igazolt régi importok és törölt korábbi projektek óvatos, kézi döntést igénylő kezelése megmaradt.

Mindkét adatbázison teljes szintetikus `pg_dump` / üres tesztadatbázisba `pg_restore` próba is sikeres: az Auth/public rekordok, kapcsolatok, RLS és táblajogok megegyeznek. Ez **nem éles mentés vagy éles helyreállítás próbája**, és nem ment Storage-fájlbájtokat. A reprodukálható teszt: `tests/backup-restore.cjs`; csak külön opt-innel, loopback `issue8_test` adatbázison és tesztjelöléssel indul.

## 4. Talált és javított felületi hibák

**SzakiPiac PDF:** a html2pdf képernyőméretű, overflow:hidden exportfedvénye mobilon levágta/kiürítette az A4 képet. Az exportmásolat geometriáját a rajzolás előtt rögzítjük. A hosszú tételek egészben törnek, a rövid ajánlat felesleges második oldala megszűnt.

**KivitelezésPRO PDF:** ugyanez az üres mobilfájl; a 950 px minimumszélességű költségtábla utolsó oszlopai lemaradtak; a hosszú inputértékek levágódtak. Az exportmásolatban tördelhető szöveg helyettesíti a szerkesztőmezőket, a teljes táblázat A4 szélességű, a fényképet oldalhatár nem vágja ketté. A szerkesztő eredeti mezői és napi működése nem változnak.

**Napló gyors fotóválasztás:** a 300 ms késleltetésű feltöltési kosár inicializálója eldobhatta a listener indulása előtt kiválasztott fájlt. Három soros javítás az eredeti `project.js` inicializálásában: az ott már kijelölt fájlokat is beolvassa és azonosító alapján összevonja. Az új regressziós teszt a régi kódon megbukott, a javítotton sikeres. A következő bejegyzés nem örökli az előző fotóját. Napi funkciót nem építettünk át.

## 5. Ellenőrzések és bizonyítási korlátok

| Ellenőrzés | Eredmény |
|---|---|
| SzakiPiac Node regresszió | 29 sikeres |
| Napló Node regresszió | 11 sikeres, az új fotóversenyteszttel |
| Eredeti PostgreSQL/RLS suite | SzakiPiac 23, Napló 21 sikeres |
| Ugyanezek a hosted katalógusból felépített sémán | 23 + 21 sikeres |
| Szándékosan megszakított migráció és újrafuttatás | mind a 4 migráció sikeres helyreállítási próbája |
| Jogosultság/önálló működés/rollback/role-boundary tesztek | SzakiPiac 7, Napló 9 sikeres |
| Teljes szintetikus DB-backup/restore | 2 sikeres |
| Korábbi mentési/import-böngészőregresszió | 1440 és 390 px, sikeres; nincs JS-/hálózati hiba vagy oldal-túlcsordulás |
| Valódi napi űrlap + kép mentés, következő kép nélküli nap, visszatöltés, lezáró riport | mindkét nézet sikeres, mock tárolással, nincs konzol-/API-/hálózati hiba |
| Letöltött PDF-ek tartalom- és képi vizsgálata | 8 minta sikeres, Poppler-render + pypdf/Pillow + vizuális ellenőrzés |

A PDF-minták: 1 tételes ajánlat 1 oldal (nettó 6000, bruttó 7620 Ft); 35 tételes 3 oldal (nettó 210000, ÁFA 56700, bruttó 266700 Ft), KivitelezésPRO 6 oldal (bruttó 3246628 Ft), Napló-riport 3 oldal (3 naplósor, 1 kép, 12700 Ft szintetikus számla), asztalon és mobilon. Nincs üres oldal, a magyar ékezetek és a fénykép látszanak. Az automatizált képpontpróba külön elutasítja az üres oldalt és a kettévágott mintafotót. A SzakiPiac PDF továbbra is raszteres html2pdf-kimenet; nem állítjuk, hogy kereshető szöveges vagy PDF/A dokumentum. A Napló meglévő nyomtatási HTML-jét a böngésző PDF-motorjával is ellenőriztük; a fizikai nyomtatódialógust nem automatizáltuk.

A Node TypeScript-stripping experimental figyelmeztetése ismert tesztkörnyezeti figyelmeztetés, nem alkalmazáshiba. A statikus HTML/JS projekteknek nincs külön csomagolt buildfolyamatuk; a létező tesztek, JavaScript-parse, böngészőfuttatás és git diff-ellenőrzés futott.

**Két valódi Supabase-stack:** az E2E most a hosted public sémákat, a Napló valódi Storage-policy-jait és privát 100 MB-os bucketbeállítását használja. A teszt a minimális TRUNCATE-szűkítés után fut: ajánlat → anon elfogadás → tényleges Edge-átadás → párhuzamos claim, opcionális KivitelezésPRO, idegen user, visszaállítás; továbbá önálló napi REST-műveletek és valódi privát Storage-feltöltés/visszaolvasás/idegen user tiltása. A küldő JWT-ellenőrzése bekapcsolt, a fogadó két függvényéé a tényleges konfigurációnak megfelelően saját hitelesítésre épül. Ezt csak a friss CI-futás eredménye alapján szabad sikeresnek minősíteni. A legutóbbi elfogadott régi 10 E2E eset nem helyettesíti az új 12-es suite-ot.

A GitHub október 19-én Actions/Pages/Webhooks üzemzavart jelzett; több futás sorban állt, egy E2E-futás lépések/log nélkül failure állapotot kapott. Ezt nem számítjuk sikeres tesztnek. A végső futások linkje és állapota a PR leírásában/az alábbi frissítési blokkban szerepel. [GitHub státusz](https://www.githubstatus.com/).

Nem ellenőrzött: fizikai telefon kamerája/GPS/mobil nyomtatómenü; az összes meglévő PayPal, AI, admin, ügyfélüzenet és billing funkció teljes végigkattintása; több száz oldalas/óriási fotós PDF; éles HTTPS-hostolt staging teljes gateway-konfigurációja. Ezekre nem állítunk új sikeres eredményt. A meglévő napi UI-próba mock API-t használ, nem éles mentést.

## 6. Élesítési sorrend – későbbi külön jóváhagyáshoz

1. Független ChatGPT-kódellenőrzés a két aktuális PR-headen; minden friss CI legyen zöld. Új hosted HTTPS-staginghez a tulajdonosnak külön, engedélyezett tesztprojektet/ágat és a szükséges erőforráskeretet kell biztosítania. Nem kérünk titkos kulcsot chatben és nem hozunk létre automatikusan fizetős erőforrást.
2. Tulajdonosi jóváhagyás a pontos immutable commitokra, migrációkra, három Edge-függvényre, frontendekre és a külön jogosultságcsomagra. A platform-default részhez Supabase által jogosított operátor szükséges. A két projekt azonosítóját minden lépés előtt vissza kell ellenőrizni.
3. Jóváhagyott éles mentés: mindkét teljes adatbázis (Auth és jogosultságok is), a három érintett Edge jelenlegi forrása/verziója/JWT-konfigurációja és frontend-verziók. A Storage-bájtokról külön mentés kell, a DB-mentés nem helyettesíti. Titkokat védett tárolóban, nem Gitben/chatben. A választott backup/PITR szolgáltatás elérhetőségét és visszaállíthatóságát előre igazolni kell.
4. Az érintett ajánlat/cloud-mentés/import írások rövid karbantartási ablakát előre elkészített és tesztelt módon biztosítani. Nem feltételezünk létező feature flaget. A Napló napi dokumentálását nem kapcsoljuk le általános rendszerátépítéssel.
5. Célzott backend, ellenőrzött commitból: Napló 001/002 SQL → SzakiPiac 001/002 SQL → csak Napló create/claim importfüggvények → csak SzakiPiac sender. Köztes read-only preflight, verzió-/policy-/RPC-jogleltár; nem az összes Supabase-funkció újratelepítése.
6. A main-only workflow őreit megtartani. Mivel a fejlesztési ágbeli backend-workflow csak mainről indítható és a SzakiPiac main merge automatikus frontend-publikálást indít, a „workflow lefuttatása merge előtt” önmagában nem végrehajtható. A backend előkészítést külön jóváhagyott, célzott kiadási eljárásból, az ellenőrzött commitból kell elvégezni; nem szabad fejlesztési ág automatikus élesítésével megkerülni ezt.
7. A kompatibilis Napló frontend után a SzakiPiac frontendje, csak külön merge/publikálási jóváhagyással. A helyi PDF- és napi-fotófix a frontendkiadás része. Egyik main merge-jét sem végeztük el.
8. Külön engedélyezett ellenőrző rekordokkal éles smoke, egyetlen átadás/ismételt átadás/idegen user/napló/kép/letöltés, naplók figyelése. Jóváhagyás nélkül most nem írunk ilyen éles tesztrekordot sem.

### Visszaállítás

Először az új importok/érintett írások megállítása; a napi új adatokat és új médiafájlokat megőrizni. A javított bizalmi határt, elfogadott ajánlatvédelmet és additív oszlopokat nem bontjuk le automatikus down/DROP migrációval. A régi sender/claim vak visszatelepítése visszahozná a korábbi hibákat; elsődlegesen kompatibilis frontend/Edge visszaállítás vagy célzott előremenő javítás szükséges. Teljes DB-visszaállítás csak külön tulajdonosi jóváhagyással és a mentés óta keletkezett napi adatok megőrzési/összefésülési tervével. A forrásajánlat UUID/importkérés/projekt összerendeléseket mindkét oldalon egyeztetni kell, ne teljes ajánlattartalom újrafeladásával duplikáljunk.

A TRUNCATE-proposal visszaállításához a pontos korábbi ACL alapján készült snapshot-scriptek vannak; ezek használata külön biztonsági döntés, nem automatikus gyengítés. Az alkalmazásműködés helyreállításához várhatóan nincs rájuk szükség, mert a vizsgált működés nem használ TRUNCATE-ot.

**Állapot:** a konkrét fejlesztési hibák javítva, a hozzáférés rendezett, a helyi sémás és PDF-próbák sikeresek. Élesítésre késznek csak a friss teljes E2E eredménye, a még nyitott staging/backup-operatív lépések és a független ellenőrzés után nevezhető. TERC-fejlesztés még nem indult; a meglévő PRO+ későbbi továbbfejlesztése marad a cél.
