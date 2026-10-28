# AZOBSS Patch 928 — Strict Visible-Line Selection + Exact Selected-Lot AOI

Patch ini membetulkan kes lot jiran seperti **20075** masih muncul dalam drawing walaupun garisan biru rujukan hanya benar-benar melintasi lot sebelumnya (contohnya 20074 / 25052).

Perubahan utama:
- Semakan local tidak lagi memilih lot hanya kerana satu vertex/sliver geometri berada sangat sedikit di dalam petak/bulatan.
- Lot dianggap terpilih apabila:
  - lot memang berada dalam kawasan rujukan;
  - kawasan rujukan berada di dalam satu lot besar; atau
  - garisan biru benar-benar memotong sempadan lot pada sekurang-kurangnya dua titik dengan span lintasan bermakna (minimum 1 m).
- Untuk pemilihan **Rujukan Kawasan**, semakan geometri menggunakan inset dalaman 1 m yang tidak kelihatan pada skala peta untuk menolak sliver/topology noise di luar garisan.
- Sentuhan bucu, shared-edge, dan overlap kurang daripada toleransi tersebut tidak lagi mencukupi untuk memilih lot jiran.
- `Area_of_Interest` untuk JUPEM GP tidak lagi menggunakan satu envelope/bounding box besar. AOI kini dibina daripada **geometri penuh lot yang tepat telah dipilih**.
- Ini penting kerana jika GP JUPEM mengabaikan selection/filter pada `Layers_to_Clip`, AOI sendiri masih hanya meliputi lot terpilih; lot jiran dalam bounding box tidak boleh terseret masuk.
- Drawing kekal **natural/full cadastral boundary**. Lot terpilih tidak dipotong pada garisan biru.
- `Layers_to_Clip` cuba input layer+OBJECTID yang lebih kecil dahulu dan fallback kepada exact selected feature set; dalam kedua-dua kes **AOI exact-selected-lot** menjadi guard utama supaya lot jiran tidak terseret masuk.
- Capabilities dinaikkan ke v7 dengan `exportMode=natural-exact-aoi-line-selected-lots-v928`, `exactVisibleLineCrossing=true`, `exactSelectedLotAoi=true`, dan `envelopeAoiDisabled=true`.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=928`.

Render backend mesti redeploy kerana pembetulan utama berada dalam `deploy-server.js`.
