V60 - Bizonyitek-alapu AI valaszok

- Az AI valasz kulon kezeli a biztos adatot, az ovatos kovetkeztetest es a hianyzo/nem bizonyithato adatot.
- A napi mentesnel a feltoltott fotok es a beirt szoveg egyutt mennek AI kontrollra, ha az Edge Function elerheto.
- A helyi AI fallback is bizonyitek-alapu lett, nem allit biztosat foto vagy szoveges adat nelkul.
- Az ai-report-generate Edge Function promptja szigorubb lett: nem talalhat ki kepen lathato tenyt, ha nem kapott kepet.
- Az ai-vision-analyze Edge Function JSON valasza uj mezoket kapott: certain, assumptions, missingData, confidenceReason.
- Terkoves, viakolor, murva, tukor, agyazat es szegely munkaknal a tomorites, lejtes, retegrend es vizelvezetes ellenorzeset figyeli.
