# Issue #8 – tesztjelentés

## Ellenőrzési eredmények – 2026. október 18.

| Ellenőrzés | SzakiPiac | ÉpítésNapló |
|---|---:|---:|
| Node.js automatizált próbák | 20 sikeres | 6 sikeres |
| Valódi PostgreSQL 17 / RLS ellenőrzési esetek | 19 sikeres | 14 sikeres |
| Migráció első és második futtatása | Sikeres | Sikeres |
| Párhuzamos adatbázis-kapcsolatok | Elfogadás/módosítás két sorrendben | Két egyidejű import |

Összesen 59 automatizált ellenőrzési eset. A PostgreSQL-próbák GitHub Actionsben, külön, frissen indított PostgreSQL 17 konténeren futottak; nem az éles adatbázison. Az auth.uid()/auth.jwt() tesztsegédek a kérési identitást modellezik, a táblák, jogosultságok, RLS, tranzakciók és ütköző kapcsolatok valódi PostgreSQL-műveletek.

- SzakiPiac ellenőrzött kód: `a26d92e2148c3b66d964bc14d3aa7c46a16bfbfa`; [sikeres CI](https://github.com/Atika76/szakipiac-2025/actions/runs/39145215179).
- ÉpítésNapló ellenőrzött kód: `d17144f4bca1367bfc419944d83b08db8bd8e499`; [sikeres CI](https://github.com/Atika76/Epites-Naplo/actions/runs/39145217453).

### Böngészős próbák

Microsoft Edge, 1440×1000 asztali és 390×844 mobilméret. Az adatbázishívások kontrollált helyettesítéssel futottak, éles API-írás nélkül:

- KivitelezésPRO első és második mentése, új projekt külön rekorddal.
- Böngészős helyi mentés és visszatöltés után a megfelelő felhős rekord frissül.
- JSON export és import után új felhős projekt készül, a tételek megmaradnak.
- Elfogadott ajánlat betöltése, másolatból új piszkozat.
- Részleges importnál látható anyaghiba és valós 0/1 darabszám, kézi projektmegnyitás és ismételt próbálkozás.
- A vizsgált folyamatokban 0 JavaScript-kivétel, 0 sikertelen hálózati kérés, a kalkulátorban egyik vizsgált szélességnél sem volt vízszintes túlcsordulás.

A reprodukálható böngészőteszt a SzakiPiac `tests/browser-smoke.cjs` fájlja; mindkét munkapéldány közös könyvtárból kiszolgálva, a gépen már rendelkezésre álló Playwrighttal futtatható. Nem települt új projektfüggőség.

### Célzott adatbázis- és hibatűrési próbák

- Saját/idegen/admin hozzáférés, hamis elfogadás INSERT és UPDATE útvonalon, lezárt tartalom és tulajdonos átírásának tiltása.
- Az elküldött tartalom is rögzített. Az új link snapshotot kap, a régi elfogadásokhoz nem készül utólag új döntési bizonyíték.
- Lejárt/visszavont link, ismételt döntés, új ajánlatverzió.
- Optimista projektverzió-ütközés: elavult mentés visszautasítva, más tulajdonos nem írható felül.
- Párhuzamos elfogadás és módosítás: mindkét sorrendben az eredeti ajánlat marad meg; nincs sikeres tartalomcsere.
- Párhuzamos Napló-import: egy projekt és egy kezdőbejegyzés.
- Injektált PostgreSQL-anyaghiba: részleges állapot és 0 anyag, 1 feladat; javítás utáni újrapróbálás nem duplikál feladatot.
- Injektált kezdőbejegyzés-hiba: az összes kritikus írás visszagördül; a hibastátusz megmarad; újrapróbálás sikeres.
- Korábbi importok nem kerülnek automatikus törlésre/összevonásra; régi nem igazolt függő import tiltott, meglévő korábbi projekt tulajdonosi ellenőrzéssel megnyitható.

### Ismert korlátok és élesítési feltételek

1. **Élesítés előtt blokkoló feltétel:** az ÉpítésNapló éles séma/RLS/függvény leltára nem volt elérhető. A jelenlegi Supabase-hozzáférés 403-at ad a projekt management végpontjára. Az elkülönített tesztek a tárolóban lévő sémával futottak. Ez nem bizonyítja az éles séma egyezőségét.
2. A SzakiPiac éles táblasémája, ajánlatkezelő függvényei, triggerei és érintett RLS-szabályai csak olvasó lekérdezéssel ellenőrizve. Eltérés: az éles ajánlattáblának nincs UPDATE policy-ja; a migráció saját/admin UPDATE-szabályt ad hozzá tartalom- és állapotvédő triggerrel. Az éles ajánlattáblán nincs updated_at oszlop sem; az új migráció ezt nem követeli meg.
3. Valós Supabase Auth + Edge Function + két éles adatbázis közötti teljes folyamat nem futott le. Ehhez jóváhagyott, elkülönített Supabase tesztprojektek vagy az élesítés előtti ellenőrzött staging szükséges. Éles írási teszt nem történt.
4. A PDF teljes tartalmi/renderelési regressziója és az éles keresés, profil, hirdetések, Munkafigyelő, fizetés, értesítések nem kaptak teljes végponttól végpontig tesztet. E részek üzleti kódja nem változott; az index.html inline kódja szintaxisellenőrzést kapott.
5. A statikus projektekben nincs meglévő build/test csomag. Node.js 24 alatt az érintett böngészőkódok szintaxisa és a valódi Edge-handlerek helyettesített környezetben ellenőrizve; külön Deno/Supabase telepítési build nem futott. A Node TypeScript-eltávolítója ExperimentalWarning figyelmeztetést ad; ez nem teszthiba.
6. Az új import az ajánlat tulajdonosának azonos e-mail-című Napló-fiókjához kötött. Eltérő e-mail-című fiókok közötti új importhoz külön, kifejezett összerendelési folyamat szükséges; tokenbirtoklás alapján nem rendelünk idegen fiókhoz projektet.
7. A régi adatbázisban már korábban módosított vagy kézzel elfogadottra állított tartalmak eredeti hitelessége utólag nem állapítható meg a kódból. Nem készült mesterséges új elfogadás, és nem történt automatikus történeti javítás.
8. A TERC jellegű részletes költségvetés nem része ennek a stabilizálási változtatásnak.

### Reprodukálás

```sh
node --test tests/*.test.cjs
# Csak az erre a célra létrehozott, üres, lokális issue8_test adatbázison:
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=issue8-local-test PGDATABASE=issue8_test node tests/postgres-integration.cjs
```

A SQL-teszthám kifejezetten megtagadja a futást nem helyi hoszt vagy nem `issue8_test` adatbázis esetén. A CI nem használ GitHub Supabase-secreteket.
