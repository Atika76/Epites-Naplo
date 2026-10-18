> Frissítés (2026-10-18): a második független ellenőrzés új mentési hibájának javítása, 93 sikeres teszt és a 403-as hozzáférés vizsgálata: [legújabb tesztjelentés](issue-8-review-2-followup.md). Az alábbi 87 esetes jelentés az előző ellenőrzési kör eredménye.

# Issue #8 – frissített stabilizálási tesztjelentés

Dátum: 2026. október 18. Ág mindkét tárolóban: `codex/issue-8-stabilization`.

- SzakiPiac PR: https://github.com/Atika76/szakipiac-2025/pull/9
- ÉpítésNapló PR: https://github.com/Atika76/Epites-Naplo/pull/1
- Feldolgozott ellenőrzés: https://github.com/Atika76/szakipiac-2025/pull/9#issuecomment-6252493380
- Feldolgozott ellenőrzés: https://github.com/Atika76/Epites-Naplo/pull/1#issuecomment-6252493786

## Javítások és a konkrét okok

1. **Pages:** az előző változat minden publikálást kézire állított. A `deploy-pages.yml` most main-pushra automatikus, kézi indításkor main+megerősítés szükséges. Fejlesztési ágról egyik esemény sem telepíthet. A backend továbbra is csak kézi.
2. **Megszakadt mentés:** a változó `payload.saved_at` miatt az elveszett INSERT-válasz ismétlése téves ütközésbe futott. Az új `202610180002_project_save_retry.sql` csak ezt a technikai időbélyeget hagyja ki az összehasonlításból, minden üzleti payload- és skalármezőt ellenőriz. INSERT és UPDATE után is csak a közvetlen következő revízió ismerhető el biztonságos ismétlésként. A kliens megőrzi a visszaigazolatlan kérést (helyi mentésben is), előbb tisztázza annak eredményét, majd a közben módosított adatot az igazolt revízióval menti. Elavult vagy idegen rekord nem írható felül.
3. **Törölt Napló-projekt:** a SET NULL idegen kulcs mellett megmaradt a complete állapot. Az új `202610180002_deleted_import_recovery.sql` ezt `project_deleted` / deleted válasszal kezeli, normál újrapróbálásra nem készít új projektet. A jogosult fiók külön megerősítheti az elfogadott ajánlatból új projekt létrehozását. Az új feldolgozás minden lépése és darabszáma újraindul; párhuzamos megerősítések ugyanarra az új projektre futnak össze. A törölt napi bejegyzések és fotók nem állnak vissza. Régi, nem igazolt import törölt projektjéhez kézi ellenőrzés kell.
4. **Ügyféllink:** az elfogadott ajánlat új ügyféllinket készítő gombja letiltott, érthető magyarázattal. Más státuszoknál az eddigi lehetőség megmarad, a szerveroldali tiltás is megmarad.
5. **Célzott telepítés:** a két meglévő backend workflow csak az adott repo két issue-8 migrációját és az érintett importfüggvény(eke)t kezeli. Külön `migrate` és `functions` fázis; kizárólag kézi indítás, main, `DEPLOY_PRODUCTION` és előzetes tulajdonosi jóváhagyás. Nincs árkatalógus, PayPal, AI, értesítés vagy más séma/függvény újratelepítés.

## Sikeres automatizált tesztek

| Suite | Esetek | Eredmény |
|---|---:|---|
| SzakiPiac Node.js | 25 | Mind sikeres |
| ÉpítésNapló Node.js | 10 | Mind sikeres |
| SzakiPiac valódi PostgreSQL 17/RLS | 22 | Mind sikeres |
| ÉpítésNapló valódi PostgreSQL 17/RLS | 21 | Mind sikeres |
| Két valódi helyi Supabase: Auth + REST/RLS + Edge + DB | 9 | Mind sikeres |

Összesen **87 ellenőrzési eset**; a böngészős próbakör ezen felül futott. A korábbi tesztek újra lefutottak. Az eredeti 001 migrációk változatlanok; az új 002 migrációkat is kétszer futtatja az adatbázisteszt.

Ellenőrzött alkalmazáskód: SzakiPiac `b11c777` / integrációs futtató `e440987e8595a78e14f85768eeb90e406b06351e`, ÉpítésNapló `314d7ee24ac93299962ba3ec66584b2e51d68197`.

- [SzakiPiac Node/PostgreSQL CI](https://github.com/Atika76/szakipiac-2025/actions/runs/39147408012)
- [ÉpítésNapló Node/PostgreSQL CI](https://github.com/Atika76/Epites-Naplo/actions/runs/39147408201)
- [Két Supabase teljes integrációs próba](https://github.com/Atika76/szakipiac-2025/actions/runs/39147700672)

### Új regressziós tesztek

- INSERT eljut az adatbázisba, HTTP-válasz elveszik, új timestamp: egy rekord, sikeres visszaigazolás.
- Megszakadt INSERT után a felhasználó tovább szerkeszt: a régi kérés eredményének tisztázása után az új adat menthető.
- Megszakadt UPDATE, illetve az adatbázist el sem érő kérés újrapróbálása.
- Üzleti mező módosítása nem álcázható időbélyeges ismétlésnek; idegen fiók nem ismételheti a mentést.
- Pages esemény/ág/megerősítés kombinációk, backend-függvények és migrációk pontos engedélylistája.
- Elfogadott és minden más ajánlatstátusz gombjainak tényleges generált HTML-je.
- Complete és partial projekt törlése, újbóli linkkérés, jogosulatlan helyreállítás, jogosult megerősítés, ismételt és egyidejű megerősítés.
- A törölt projektre mutató régi felületi link eltűnik; csak boolean true kapcsolja be a szerveren a helyreállítási igényt.

### Teljes, elkülönített Supabase-folyamat

A GitHub runneren két önálló, friss helyi Supabase-stack indult. Valódi GoTrue/Auth-bejelentkezés és JWT, PostgREST/RLS, PostgreSQL és a tárolók tényleges Edge Functionjei működtek együtt. Az egyik rendszerben létrehozott ajánlatot a publikus ügyfél-RPC elfogadta, majd a tényleges átadó a másik rendszer tényleges fogadójához továbbította, és ott jogosult felhasználó projektet indított.

Tesztelve: nem elfogadott ajánlat tiltása; elfogadott tartalom REST-módosításának tiltása; idegen célfiók tiltása; két egyidejű claim; közvetlen és opcionális KivitelezésPRO út ugyanazzal az ajánlati összeggel; projekt törlése és kifejezett újralétrehozása.

A teszt nem kapott hosted Supabase-tokent, nem használ éles secreteket, és csak az ideiglenes `issue8-source` / `issue8-naplo` Docker-stackekhez fér hozzá. A Napló peer checkout immutable commitra rögzített. Ez a források kétalkalmazásos integrációját igazolja, **nem** az ismeretlen éles Napló-séma egyezőségét. A tesztkörnyezet belső hálózata HTTP; az éles alkalmazásközi HTTPS/TLS és a hosztolt gateway beállításai külön ellenőrzendők.

## Böngésző és export

Edge, 1440×1000 és 390×844; mindkét méreten sikeres:

- tényleges felületi mentés commit utáni elveszett válasszal, újrapróbálás, egy rekord;
- új projekt, helyi mentés/visszatöltés, JSON export/import;
- elfogadott ajánlat betöltése, letiltott ügyféllink, új piszkozatmásolat;
- részleges importhiba, újrapróbálás, törölt projekt jelzése;
- helyreállítás megszakítása nem küld kérést; megerősítése explicit recovery flaget küld;
- 0 JavaScript-kivétel, 0 sikertelen hálózati kérés a próbafolyamatokban; nincs kalkulátor-szélességtúlcsordulás.

A böngészőtesztben az API kontrollált helyettesítést kapott. A Supabase E2E külön, valódi szolgáltatásokkal futott. A tényleges html2pdf könyvtár mindkét méreten PDF-et töltött le, érvényes PDF-fejléccel és nem üres fájllal (asztali: 404611 byte, mobil: 25134 byte). Teljes vizuális/tördelési és tartalmi PDF-összevetés nem történt; ezekből a fájlméretekből nem állítható teljes PDF-regressziós siker.

## Nem futott / élesítés előtt blokkoló feltételek

1. **Az ÉpítésNapló hosted projektjének tényleges séma-, RLS-, függvény- és konfigurációleltára továbbra sem elérhető.** A jelenlegi Supabase-fiók jogosultsága a `tcmihuwjlapfaonihdma` projektre 403-at ad (`supabase functions list --project-ref ...`). A hozzáférhető projektlistában nincs elkülönített kétappos hosted stagingpár sem. A szükséges hiány: jogosult hozzáférés e projekt séma/RLS/függvény/konfiguráció metadatainak ellenőrzéséhez. A Dockerben elvégzett valós Supabase-teszt nem pótolja ezt a kompatibilitásvizsgálatot.
2. A SzakiPiac éles sémájának az előző körben csak olvasva feltárt eltérései dokumentáltak: ajánlat UPDATE-policy hiánya, opcionális updated_at eltérés. Ebben a körben éles SQL nem futott.
3. Az éles hitelesítés/gateway/TLS/secret konfiguráció és a valós éles történeti adatokra vonatkozó migrációs preflight nem történt meg. Éles írásos teszt és éles deploy nem futott.
4. Hirdetések, Munkafigyelő, profil, fizetések, média, riportok és értesítések teljes üzleti E2E regressziója nem futott; kódjuk változatlan. A PDF teljes vizuális és üzleti tartalmi ellenőrzése is nyitott.
5. Node.js a TypeScript-eltávolító tesztsegédre ExperimentalWarning figyelmeztetést ad. A tényleges Edge Functionök külön valódi Supabase runtime-ban is lefutottak; a figyelmeztetés nem teszthiba.
6. A TERC jellegű részletes költségvetés fejlesztése még nem kezdődött el.

**Állapot:** a felsorolt javítások ellenőrzésre készültek el, a két PR továbbra is draft. Élesítésre késznek nem minősíthetők a hosted séma/konfiguráció és a fenti regressziós hiányok lezárása nélkül. Az ismert konkrét regressziók automatizált tesztjei sikeresek; teljes hibamentesség nem állítható.

## Reprodukálás

```sh
node --test tests/*.test.cjs
# Üres, erre a célra létrehozott helyi adatbázison:
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=issue8-local-test PGDATABASE=issue8_test node tests/postgres-integration.cjs
# A SzakiPiac külön GitHub workflow-ja két lokális Supabase-stacket indít:
# .github/workflows/verify-supabase-e2e.yml → node tests/supabase-e2e.cjs
```

A PostgreSQL-teszthám nem helyi hoszt vagy nem `issue8_test` adatbázis esetén megtagadja az írást. A Supabase E2E-futtató hosted token jelenlétében vagy CI-n kívül megtagadja az indulást.
