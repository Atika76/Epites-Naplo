# V132 – főoldali ügyfélriport PDF és gomb-visszajelzés fix

- A főoldali ügyfélriport PDF gomb már nem rejtett/offscreen html2pdf elemből dolgozik, mert az egyes böngészőkben üres PDF-et adott.
- A PDF gomb stabil nyomtatási/PDF mentési nézetet nyit, amely a látható ügyfélriport tartalmát használja.
- A bekarikázott ügyfélriport gombok kattintáskor visszajelzést adnak: riport készül, PDF készül, link készül, link másolása, üzenet készül, értesítés készül.
- V129, V130 és V131 javítások megtartva.
