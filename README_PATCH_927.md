# AZOBSS Patch 927 — Positive-Area Reference Intersection

Patch ini membetulkan lot luar yang terpilih walaupun garisan petak/bulatan hanya menyentuh bucu atau sempadan lot bersebelahan.

Perubahan utama:
- Query JUPEM cuba `esriSpatialRelRelation` dengan `relationParam=T********` supaya interior lot mesti benar-benar bertindih dengan interior kawasan rujukan.
- Jika server JUPEM tidak menerima relation tersebut, sistem fallback ke `Intersects` dan menjalankan semakan geometri local yang lebih ketat.
- Semakan local kini membezakan **overlap sebenar** dengan **boundary-only touch**:
  - lot di dalam kawasan rujukan dipilih;
  - lot yang garisan rujukan benar-benar melintasi dipilih;
  - lot yang cuma tersentuh pada satu bucu / shared edge tanpa keluasan bertindih tidak dipilih.
- Drawing masih kekal natural/full lot; tiada clipping pada garisan biru.
- Export kekal menggunakan exact selected feature set sahaja.
- Capabilities dinaikkan ke v6 dengan `exportMode=natural-positive-area-selected-lots-v927`, `positiveAreaReferenceIntersection=true`, dan `excludesBoundaryOnlyTouches=true`.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=927`.

Render backend perlu redeploy kerana perubahan utama berada dalam `deploy-server.js`.
