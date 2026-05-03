# V109 - Ügyfél visszajelzés + válasz fix

Ez a verzió a V108-ra épül.

Megtartva:
- V108 riport képnéző javítás: képre kattintás nem dob vissza főoldalra.
- V108 lapozó képnéző.
- V108 favicon / ikon javítás.
- V108 Messenger/Facebook OG előnézeti kép.
- Login/Supabase alapbeállítások érintetlenek.

Javítva / erősítve:
- A meglévő `report_approvals` táblából betölti az ügyfél visszajelzéseket.
- Látszik nálad: Megtekintve / Jóváhagyva / Kérdése van.
- A kérdés vagy megjegyzés szövege megjelenik a projektoldalon.
- Saját példány HTML és PDF/nyomtatás gomb megmarad.
- Új: válasz rögzítése ügyfél kérdésére.
- A válasz a meglévő `report_documents` táblába mentődik `client_question_reply_v109` típussal.
- Ha az ügyfél megadott emailt, a válasz után megnyílik az email kliens is.

Nem kell új táblát létrehozni, ha a V71/V76/V90 környéki SQL-ek már futottak.
