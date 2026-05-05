# V152 - Régi képnéző végleges kivágás / átirányítás

- A projektoldalon a régi `mediaViewerModal` nem jön létre.
- A régi `openMediaViewer`, `openMediaViewerFromTile`, `openReportMediaLink`, `v74OpenReportPhoto`, `v86/v100` útvonalak az új egységes képnézőre vannak kötve.
- Minden újonnan generált HTML riportból törlődnek a régi lightbox scriptek, és a V152 standalone képnéző kerül bele.
- Mobilon és asztali gépen ugyanaz a lapozós/nagyítós nézet jelenik meg.
