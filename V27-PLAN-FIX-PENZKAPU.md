# V27 – Plan fix + pénzkapu javítás

Ez a verzió a V26 stabil alapra épül.

Javítva:
- `window.userPlan` már nem marad `undefined`.
- Betöltéskor lekéri a felhasználó csomagját a `subscriptions` / `profiles` adatokból.
- Admin fiók automatikusan Business jogosultságot kap.
- AI napi jelentés, PDF export, heti/lezáró riport letöltés és ügyfél link csak Starter / Pro / Business csomaggal működik.
- Trial/free módban felugró PRO magyarázat jelenik meg.

Teszt:
1. GitHubra feltöltés után Ctrl+F5.
2. Konzolban: `window.userPlan` → trial / starter / pro / business.
3. Trial felhasználóval AI/PDF/ügyfél link gomb → PRO figyelmeztetés.
4. Fizetés vagy admin csomagállítás után → funkciók feloldódnak.
