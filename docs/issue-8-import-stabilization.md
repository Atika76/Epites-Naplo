# Issue #8 – biztonságos SzakiPiac-import

Feladat: https://github.com/Atika76/szakipiac-2025/issues/8

Alap: `4b480c77655bedf807693bc841e7b20722e30549`. Fejlesztési ág: `codex/issue-8-stabilization`.

## Szerződés és biztonság

- Csak meglévő szerveroldali importtitokkal hitelesített v2 üzenet hozhat létre új importkérést.
- Az ajánlatverzió UUID-ja a közös forrásazonosító; a `kivitelezes_projektek:` kivétel megszűnt. A böngésző `source_status` mezője önmagában semmit nem engedélyez.
- A szerver által küldött elfogadási idő és tulajdonosi e-mail megmarad. Claimkor valódi bejelentkezés és a célfiók egyezése kell; a token önmagában nem jogosít idegen projekt átvételére.
- A regisztráló és importáló RPC csak `service_role` számára hívható, a bejelentkezett/anon böngészőszerepkörök számára nem.
- A KivitelezésPRO előkészítési adatai a payloadban kiegészítésként megőrződnek; nem írják át az elfogadott ajánlat tételeit, ügyfelét vagy összegét.

## Tranzakció, ismétlés és hiba

Új migráció: `supabase/migrations/202610180001_szakipiac_import_stabilization.sql`.

Előfeltétel a meglévő projekt-/naplóséma és `supabase/szakipiac_import_schema.sql` táblái/oszlopai. Az éles séma hozzáférési hiba miatt még nem igazolt; ez élesítés előtt blokkoló feltétel.

Az ajánlat azonosítójára vett tranzakciós zárolás közös a regisztráció és claim során. A v2 kérésekre részleges UNIQUE index vonatkozik, a régi rekordokat ez nem módosítja. A projekt, kezdőbejegyzés és importkapcsolat együtt készül; bármelyik kritikus írás hibájánál mind visszagördül, a request pedig `failed` állapotot és hibarészletet kap.

Az anyag-, feladat- és naplóírás külön újrapróbálható lépés. A `completed_steps`, `inserted_counts`, `import_warnings`, `last_error` és `import_status` tartós. Sikeres lépést az újrapróbálás nem ismétel meg. A darabszám tényleges INSERT eredményén alapul. Részleges állapotban nincs automatikus zöld továbblépés; a figyelmeztetés, projektlink és újrapróbálás elérhető.

Korábbi importokat nem törlünk és nem deduplikálunk. Korábbi, már átvett projekt tulajdonosi ellenőrzéssel megnyitható, teljességi figyelmeztetéssel. Régi, még függő és nem igazolt linkhez új indítás kell az elfogadott ajánlatból. Több régi, már átvett projekt ugyanarra a forrásra kézi ellenőrzést igényel.

## Telepítés és visszaállítás

Az első fejlesztési push commitja `d4cbab6`: az éles backend már akkor kézi, mainre és explicit bemenetre korlátozott. Az ellenőrzési workflow helyi PostgreSQL-konténert használ, éles secretek nélkül.

A két migráció és backend összehangolt, jóváhagyott telepítése szükséges. Sorrend: séma/RLS előellenőrzés és staging; mindkét migráció; Napló v2 fogadó/claim; SzakiPiac átadó; frontendek. Az éles manuális workflow új migrációs lépést is tartalmaz, de nem futott.

Visszaállításkor az importindítást kell leállítani, a meglévő projekteket és állapotokat megőrizve. Nem szabad a régi, elfogadást megkerülő útvonalat vagy token alapján idegen fiókba importálást visszakapcsolni. Az additív mezőknek nincs automatikus törlő down-migrációja.

A napi projektoldal, média, riportok, csomagok és értesítések kódja változatlan. A közös csomagjogosultság korábbi átvétele az igazolt projektimport után megmarad.

Páros változtatás: https://github.com/Atika76/szakipiac-2025/tree/codex/issue-8-stabilization

Részletes eredmények és korlátok: [tesztjelentés](issue-8-test-report.md).
