# V53 – Ügyfélriport média fix

Javítások:

- A publikus ügyfélriportban nem jelenik meg többé nyers `data:` / JSON / script szöveg.
- A riport HTML-be nem injektálunk külön script blokkot, mert a biztonsági tisztítás nyers szövegként megjeleníthette.
- A képek/videók „Megnyitás új lapon” linkjei már normál `<a target="_blank">` linkként működnek, nem `window.open()` hívással.
- Csökkentve lett a böngésző popup blokkolás esélye.
- Ha hibás médiaadat kerülne a riportba, az nem kerül olvashatatlan szövegként az ügyfél elé.

Supabase SQL nem szükséges ehhez a javításhoz.

Megjegyzés: ha a `public-report-media` Edge Function kódja változott a csomagban, érdemes külön deployolni Supabase Edge Functions alatt.
