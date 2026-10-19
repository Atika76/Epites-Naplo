# A három független észrevétel célzott lezárása – 2026. október 19.

PR-ek: [SzakiPiac #9](https://github.com/Atika76/szakipiac-2025/pull/9), [Építési Napló #1](https://github.com/Atika76/Epites-Naplo/pull/1).

Kiinduló commitok: SzakiPiac `a8111aea6bd28b68d766ad87d6f3b5d935b78a4a`, Napló `fa7780b474f98fdec02d00bf66a49063de0a275a`.
Csak tesztek, bizonyítékok, dokumentáció és még nem telepített jogosultságjavaslatok változtak. Az alkalmazáskód, a négy alkalmazásmigráció és az Edge Functionök ebben a körben változatlanok. Az E2E workflow társprojekt-hivatkozása az új Napló-commitot rögzíti.

## 1. Migrációs hibainjektálás: jogos észrevétel, javítva

A JavaScript helyettesítőszövegében a `$$` egyetlen `$` jelet jelentett. A régi teszt emiatt SQL-szintaktikai hibával állt le. A PostgreSQL ezt is visszagörgeti, de ez **nem bizonyította a szándékos végső kivétel elérését**. A korábbi jelentés ennek bizonyító erejét túlértékelte; ezt a mostani ellenőrzés helyesbíti.

A `replace()` most függvényt kap, így a PostgreSQL `DO $$ ... $$` blokkja szó szerint megmarad. A végső, COMMIT előtti kivétel explicit `P0001` kódot és egyedi üzenetet ad. A teszt csak akkor sikeres, ha **mindkettő** megjelenik a PostgreSQL részletes hibaválaszában. Korábban bekövetkező szintaktikai vagy más hiba nem minősül sikeres hibainjektálásnak.

Mind a négy migrációnál:

1. Egy már létező tesztrekordot módosítunk és egy új rekordot beszúrunk a migráció tranzakciójában; új próbatáblát is létrehozunk.
2. Lefut a teljes migráció a végső, szándékos `RAISE EXCEPTION` pontig.
3. Új kapcsolaton összehasonlítjuk a katalógus ujjlenyomatát: oszlopok, megszorítások, táblák/jogok/RLS és függvények. Az új próbatábla sem maradhat meg.
4. A létező teszttábla teljes tartalma ismét pontosan az egyetlen eredeti rekord: sem UPDATE, sem INSERT nem szivárgott át.
5. Ezután a valódi migráció kétszer sikeresen fut, a korábbi rekordok és kapcsolatok megmaradnak.

Külön negatív teszt bizonyítja, hogy a `42601` szintaktikai hiba nem fogadható el `P0001` megszakításként. Ez szándékos hibaválasz-ellenőrzés, nem a migráció megszakítási próbája.

## 2. TRUNCATE/default ACL: az ellenőrzés indokolt, a korábbi REVOKE a valódi állapotra helyes

A két helyes fiókkal, a Supabase Management API **read-only** végpontján újra lekértük a `pg_default_acl` és `pg_class` metaadatait. `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`; üzleti rekordokat nem olvastunk és nem másoltunk. Éles GRANT/REVOKE/ALTER ROLE nem futott.

| Projekt / létrehozó szerep | Globális tábla-default ACL | `public` default ACL |
|---|---|---|
| SzakiPiac / postgres | nincs bejegyzés | anon és authenticated TRUNCATE: igen |
| SzakiPiac / supabase_admin | nincs bejegyzés | anon és authenticated TRUNCATE: igen |
| Napló / postgres | nincs bejegyzés | anon és authenticated TRUNCATE: igen |
| Napló / supabase_admin | nincs bejegyzés | anon és authenticated TRUNCATE: igen |

A globális grantot sémánkénti REVOKE nem tudja felülírni. Ezt a [PostgreSQL 17 hivatalos leírása](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html) és külön ellenpéldás teszt is igazolja. **A jelenlegi éles metaadatokban ilyen globális grant nincs**, ezért nincs indok globális REVOKE hozzáadására, amely más sémák alapjogosultságait is érintené.

Az új `tests/hosted-default-acl.json` projektenként külön rögzíti a teljes érintett default ACL-t, a lekérés idejét, forráshashét, a projektazonosítót és a public táblák TRUNCATE-grantjait. A lekérdezés mindkét létrehozónál `defaclobjtype='r'` és `(defaclnamespace=0 OR schema_name='public')` feltétellel vizsgálja a globális és sémahatókört; nem csak a talált TRUNCATE-sorokat menti.

A teszt:

- A valódi default ACL-eket visszaépíti; nem csak mesterséges `public GRANT TRUNCATE` sorokat használ.
- A public táblák teljes ACL-leltárát modellezi. A stabilizálási séma részét nem képező táblák kizárólag jogosultságteszthez használt üres helyőrzők; ez nem teljes számlázási/AI-séma kompatibilitási állítás.
- Az **eredeti, teljes** két REVOKE-fájlt futtatja, sorok kiszűrése nélkül, kétszer. Az anon/authenticated meglévő táblákra érvényes TRUNCATE-joga megszűnik; CRUD, egyéb ellenőrzött jogok, oszlopkorlátozások és a service_role TRUNCATE-joga megmarad.
- Mindkét létrehozó nevében ténylegesen létrehoz új public táblát: előtte mindkét böngészős szerep örökli a TRUNCATE-jogot, utána egyik sem; a többi rögzített alapjog megmarad.
- Szándékosan globális TRUNCATE-grantot ad a **helyi** tesztben: a séma-REVOKE ekkor tényleg kevés. A javaslatok új előfeltétel-ellenőrzése `P0001` hibával, teljes visszagörgetéssel leáll. Nem bővíti a javítást automatikusan globális jogváltoztatássá.
- A meglévő visszaállítási javaslatok pontosan helyreállítják az eredeti modellezett táblajogokat és default ACL-eket; a platformszerep módosítását egy normál tulajdonosi szerep továbbra sem hajthatja végre.

A `supabase_admin` módosítását kizárólag a helyi teszt superuser szerepe modellezi. Ez nem teszi képessé az éles postgres szerepet platformműveletre. Éles alkalmazásához továbbra is külön Supabase által jogosított operátor és tulajdonosi jóváhagyás kell; szereptagságot nem módosítottunk.

## 3. Napló RLS UPDATE: jogos bizonyítási hiány, a teszt pontosítva

Nem értek egyet azzal az esetleges következtetéssel, hogy a `diary_entries` idegen projektbe mozgatását az új policy kezdte tiltani. **A régi sémában sem UPDATE, sem ALL policy nincs ezen a táblán**, ezért minden böngészős UPDATE nulla érintett sort ad, a jogos tulajdonos saját szövegszerkesztése is. A korábbi teszt ezt helyesen várta, de a teszt neve összemosta az új védelemmel.

| Művelet | Régi szabály | Új korlátozás után |
|---|---|---|
| Saját user_id-val idegen projektbe INSERT – mind a négy gyermektábla | megengedett, teszttranzakcióban igazolt | `42501`, tiltott |
| Saját sor idegen projektbe UPDATE – entries/tasks/project_materials | megengedett, teszttranzakcióban igazolt | `42501`, tiltott, eredeti project_id megmarad |
| diary_entries idegen projektre UPDATE | már eleve 0 sor | továbbra is 0 sor |
| diary_entries jogos tulajdonosi szöveg-UPDATE | már eleve 0 sor | továbbra is 0 sor; nem nyitottunk új írási jogot |
| Jogos tulajdonosi napló INSERT/olvasás | megengedett | megmarad |
| entries/tasks/materials saját projekt alatti UPDATE | megengedett | megmarad |
| Korábbi projekt nélküli entries/diary_entries/tasks | megmarad | teljes tartalmuk megmarad és olvasható; új NULL-projekt sor is beszúrható |
| project_materials projekt nélküli sor | NOT NULL miatt eleve érvénytelen | változatlanul `23502`; a megszorítást nem lazítottuk |
| Meglévő admin olvasási és tényleges írási útvonalak | policy-függő | igazoltan megmaradnak; új napló-UPDATE jog nincs |
| service_role / SECURITY DEFINER elfogadott import | megengedett | teljes import és ismételt igénylés, egy projekt/bejegyzés/naplósor |

Az új teszt külön ellenőrzi minden eredeti policy változatlanságát és a pontosan nyolc új **RESTRICTIVE** szabályt. A diary UPDATE-korlátozás jelenleg további védelmi réteg, nem újonnan kimutatott rés bezárása. Ha később engedélyezett UPDATE-policy készülne, ez a korlátozás akkor is védené a projektkapcsolatot. A jelenlegi szabályokat nem lazítottuk és az RLS-javaslatot ebben a körben nem kellett átírni.

Az új NULL-projektes próba első helyi futása egy túl általános tesztfeltevés miatt megállt: a `project_materials.project_id` valójában kötelező. A tesztet a valós sémához igazítottuk, és most külön igazolja a `23502` hibát. Ez nem új alkalmazás- vagy adatbázishiba volt; sémamódosítás nem történt.

## Módosított fájlok

Mindkét repositoryban:

- `tests/hosted-migration-check.cjs`: szó szerinti dollárjelek, explicit kivétel, teljes visszagörgetési adatpróba.
- `tests/pg-helper.cjs`: SQLSTATE és üzenet ellenőrzésére szolgáló `sqlError()`.
- `tests/hosted-security.cjs`: valódi default ACL-ek és teljes javaslatok futtatása, globális ellenpélda, jogosultságmegőrzés és visszaállítás; Naplóban a régi/új RLS-viselkedés külön bizonyítása.
- `tests/hosted-default-acl.json`: új, kizárólag metaadatot tartalmazó, külön projektből származó pillanatkép.
- `docs/proposals/revoke-browser-truncate.sql`, `docs/proposals/revoke-platform-default-truncate.sql`: globális alapjog esetén leálló előfeltétel; az eredeti célzott REVOKE-ok változatlanok.
- `docs/issue-8-final-review-followup.md`: ez a jelentés; az előző jelentés elején hivatkozás a pontosításra.

Csak SzakiPiac: `.github/workflows/verify-supabase-e2e.yml` társprojekt-commitjának frissítése az ugyanebben a körben ellenőrzött Napló-változatra.

## Teszteredmények és értelmezési korlátok

A végleges, új commitok GitHub Actions futásainak linkje és eredménye az aktuális PR-leírásban, illetve a helyi jelentés záróblokkjában szerepel. A korábbi a811/fa778 futások nem számítanak az új tesztkód igazolásának.

- Node regressziók: SzakiPiac 29, Napló 11 sikeres.
- Eredeti szintetikus alapokon PostgreSQL/RLS: SzakiPiac 23, Napló 21 eset.
- Hosted katalógusból épített izolált sémán ugyanaz a 23 + 21 eset, mind a négy migráció helyes `P0001` megszakításával, ismételt futtatásával és adatmegőrzésével.
- Célzott security/default ACL/standalone/restore ellenőrzések: SzakiPiac 11, Napló 25 eset. A helyi Napló-futás 24 esete után hozzáadott közös SQLSTATE-negatív próba a végleges CI-n is ellenőrizendő; a SzakiPiac helyi futásában már szerepel.
- Két teljes szintetikus adatbázis-backup és visszaállítás: sorok, kapcsolatok, RLS és táblajogok összehasonlításával.
- A friss két-Supabase E2E-t újra lefuttatjuk a rögzített új társprojekttel; a sikerét kizárólag a tényleges aktuális joblog alapján állítjuk.

A két program üzleti JavaScriptje/HTML-je, PDF-exportja, fotókezelése, migrációi és Edge Functionjei változatlanok, ezért a korábban sikeres asztali/mobil és nyolc PDF-vizsgálatot ebben a célzott körben nem ismételjük. Ez nem új, tényleges készülékes vagy hosted HTTPS-staging próba. A két-Supabase teszt továbbra is izolált helyi stackeken fut, nem éles rendszereken.

## Maradt-e bizonyított kódhiba, mi akadályozza az élesítést?

A három észrevételből az igazolt teszthibát javítottuk, a bizonyítási hiányokat célzottan pótoltuk. Új, ebben a körben javítatlan alkalmazáskódhibát nem igazoltunk. A diary_entries böngészős UPDATE hiánya korábbi jogosultsági tulajdonság, nem az új javaslat regressziója; azt változatlanul dokumentáltuk.

**Ez továbbra sem élesítési jóváhagyás.** A korábban feltárt éles TRUNCATE/default ACL és idegen projekt alá beszúrási RLS-kockázatok az éles adatbázisokban még jelen vannak, mert a javító javaslatokat nem alkalmaztuk. Szükséges az utolsó független review, a hosted HTTPS-staging ellenőrzése, az éles DB/Auth és külön Storage-mentés tényleges visszaállíthatóságának operatív igazolása, továbbá a pontos változtatáscsomag tulajdonosi jóváhagyása. A platform-default külön jogosított operátort igényel.

Az előző jelentés élesítési/visszaállítási sorrendje változatlan. A globális default előfeltétel hibája megállási pont: új, külön ellenőrzés és jóváhagyás kell, nem automatikus globális REVOKE. Nincs main merge, éles migráció, jogosultságváltoztatás, function- vagy weboldal-telepítés.

A három konkrét kérdés lezárása után további általános fejlesztést nem kezdünk; az aktuális commitok utolsó független ellenőrzése következik.
