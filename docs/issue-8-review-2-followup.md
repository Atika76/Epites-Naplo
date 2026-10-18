# SzakiPiac 360 – a második független ellenőrzés utáni javítás

Dátum: 2026. október 18.

- SzakiPiac: https://github.com/Atika76/szakipiac-2025/pull/9
- ÉpítésNapló: https://github.com/Atika76/Epites-Naplo/pull/1
- Feldolgozott észrevétel: https://github.com/Atika76/szakipiac-2025/pull/9#issuecomment-6252846121
- Mindkét tároló fejlesztési ága: `codex/issue-8-stabilization`; mindkét PR draft marad.

## A hiba oka és a javítás

A ChatGPT észrevétele helyes volt: a `saveSupabase()` minden sikertelen RPC után megtartotta a `cloudProject.unconfirmed` kérést. Hálózati bizonytalanságnál ez szükséges, de a szerver által biztosan elutasított hibás ajánlatkapcsolat is beragadt. A következő mentés a közben kijavított űrlap helyett először ezt ismételte.

A `kivitelezes-pro.html` mentésében a visszakapott, kifejezett PostgreSQL-validációs/engedélyezési elutasítás törli kizárólag a függő kérés másolatát. Engedélyezett hibakódok: 22xxx (hibás adat), 23xxx (integritási hiba), P0001 (az RPC üzleti elutasítása), 42501 (jogosultsághiány). Az eredeti projektazonosító és revízió megmarad; a javított adat ugyanabba a projektbe menthető. Ez az új mentésre és a korábbi bizonytalan kérés tisztázására egyaránt vonatkozik.

A hálózati kivétel, kapcsolatvesztés, gateway/timeout-hiba, ismeretlen hibakód és hiányos visszaigazolás továbbra is bizonytalan eredmény. Ezeknél a korábbi pontos kérés megmarad, és az eredményét előbb tisztázni kell. Nem vezetünk be automatikus felülírást, új projektazonosítót vagy revízió-visszaállítást. Revízióütközésnél az újratöltésre figyelmeztető szerveroldali védelem megmarad.

## Érintett fájlok

SzakiPiac:

- `kivitelezes-pro.html`: a kétféle mentési hiba kezelése.
- `tests/workflow.test.cjs`: négy új regressziós teszt, több INSERT/UPDATE és hibakód kombinációval.
- `tests/postgres-integration.cjs`: valódi adatbázisos elutasítás, visszagörgetés, kijavított INSERT/UPDATE, egy rekord.
- `tests/supabase-e2e.cjs`: a tényleges kliens mentési függvénye valódi Auth/JWT, REST/RLS és adatbázis mellett; valós 22P02/P0001 válasz, javítás és új mentés.
- `tests/browser-smoke.cjs`: hibás kapcsolás és kijavított mentés asztali/mobil felületen.
- `.github/workflows/verify-supabase-e2e.yml`: a teszt CLI-verziója 2.105.0-ra rögzítve. Egy futás a `latest` feloldásakor GitHub rate limit miatt megállt, még a tesztek előtt. Ez tesztinfrastruktúra-hiba volt; nem hallgatjuk el.
- A tesztjelentések frissítése.

ÉpítésNapló: csak dokumentáció. Az alkalmazáskód, napi dokumentálás, migrációk, éles beállítások változatlanok ebben a körben. Új hozzáférési vizsgálat: `docs/issue-8-supabase-access-preflight.md`.

## Teszteredmények

| Ellenőrzés | Esetek | Eredmény |
|---|---:|---|
| SzakiPiac Node.js | 29 | Sikeres |
| ÉpítésNapló Node.js | 10 | Sikeres, újrafuttatva |
| SzakiPiac PostgreSQL 17 / RLS | 23 | Sikeres |
| ÉpítésNapló PostgreSQL 17 / RLS | 21 | Sikeres, újrafuttatva |
| Két valódi helyi Supabase-stack | 10 | Sikeres |
| Összesen | **93** | **Mind sikeres** |

A négy új Node-tesztből a két hibajavítást bizonyító teszt a módosítás előtti kódon megbukott, a javítás után mind a négy sikeres. Lefedés: explicit elutasítás új és meglévő projektnél; elutasítás a korábbi kérés helyreállításakor; visszaadott hálózati/kapcsolati/gateway/timeout hiba; commit utáni hiányos visszaigazolás. A korábbi elveszett INSERT/UPDATE-válasz, közben szerkesztés, párhuzamos mentés és késői válasz tesztjei sikeresek maradtak.

Az adatbázist és a két teljes Supabase-stacket a GitHub elkülönített futtatókörnyezete indította, éles token nélkül. A PostgreSQL-teszt csak loopback és `issue8_test` adatbázis esetén enged írni. A Supabase E2E megtagadja az indulást hosted tokennel és CI-n kívül.

Ellenőrzött alkalmazáskód: SzakiPiac `5a95824d60b90f3b49feb14749e4f3137c866328`; ÉpítésNapló `a2c2da68c7d7feef13ff47e3e8477af0c0c4311d` (az E2E-ben rögzített `314d7ee24ac93299962ba3ec66584b2e51d68197` azonos alkalmazáskóddal, később csak dokumentáció változott).

- [SzakiPiac 29 Node + 23 PostgreSQL ellenőrzés](https://github.com/Atika76/szakipiac-2025/actions/runs/39149973135)
- [Két Supabase, 10 teljes integrációs eset](https://github.com/Atika76/szakipiac-2025/actions/runs/39149969202)
- [ÉpítésNapló 10 Node + 21 PostgreSQL, újrafuttatás](https://github.com/Atika76/Epites-Naplo/actions/runs/39148186421)

Asztali Edge 1440×1000 és mobilméret 390×844: a tényleges felületi mentés elutasítás utáni javítása, elveszett válasz utáni mentés, új projekt, helyi mentés/betöltés, JSON-export/import, ajánlatmásolás és letiltott ügyféllink, részleges/törölt import és megerősített helyreállítás mind sikeres. API-helyettesítéssel, 0 JavaScript-kivétellel, 0 sikertelen hálózati kéréssel, a kalkulátor szélességtúlcsordulása nélkül. A valódi API-kat a külön Supabase E2E vizsgálta.

A tényleges PDF-export mindkét méreten érvényes fejlécű, nem üres PDF-et adott (404505 / 25134 byte). A teljes PDF-tartalom és tördelés összevetése nem történt meg. Külön alkalmazásbuild nincs: a meglévő statikus HTML/JS-oldalak futottak; a beágyazott JavaScript szintaktikai tesztje is sikeres. Új csomag vagy függőség nem került az alkalmazásokba. A Node TypeScript-tesztsegéd ExperimentalWarning figyelmeztetése továbbra is jelen van, nem teszthiba.

## A 403-as hozzáférés vizsgálata és a korlátok

Újra reprodukáltuk a Management API 403-at a `tcmihuwjlapfaonihdma` projektre. A CLI a SzakiPiacot eléri, az ÉpítésNapló nem látszik a projektlistában. A repository két kliensfájlja valóban ezt a Napló-azonosítót használja. Bejelentkezett Dashboard-böngésző itt nem elérhető. A fiók/tagság/token pontos eltérése jogosult tulajdonosi ellenőrzés nélkül nem dönthető el.

Biztonságos első megoldás: a tulajdonos saját meglévő bejelentkezésében ellenőrzi a projektet és elvégzi a csak olvasó metadata-leltárt. Ha közvetlen agent-hozzáférés kell, külön jóváhagyás után az adott projektre korlátozott, csak olvasó scoped token jöhet szóba. Tagság- vagy jogosultságbővítést nem végeztünk. A részletes, hivatalos dokumentációra támaszkodó eljárás az ÉpítésNapló hozzáférési dokumentumában szerepel.

Nyitott: hosted séma/RLS/függvény/gateway-konfiguráció és történeti adatok migrációs előellenőrzése; teljes PDF-tartalmi/tördelési regresszió; minden érintetlen üzleti funkció teljes E2E-je. A sikeres helyi Supabase-tesztek nem bizonyítják az éles projekt kompatibilitását.

**Állapot:** a konkrét mentési hiba javítva és új független ellenőrzésre kész. Nem állítjuk, hogy a rendszer élesítésre kész. Mainbe összeolvasztás, éles telepítés, éles SQL, titok- vagy jogosultságmódosítás nem történt. A TERC jellegű fejlesztés még nem kezdődött el.
