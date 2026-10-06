# AZOBSS v1211 — AZDM Default View dalam Software Key

Dibina terus daripada baseline v1210 yang diberikan pengguna.

## Perubahan

- Admin → Software Key kini membuka **AZDM** sebagai tab/view pertama secara default.
- SurveyCAD kekal sebagai tab kedua dan semua fungsi asal SurveyCAD dikekalkan.
- Initial HTML state, ARIA tab state dan state JavaScript diselaraskan supaya tiada flash SurveyCAD sebelum AZDM dimuatkan.
- Cache-buster `azobss-azdm-admin.js` dinaikkan ke `v=1211`.
- Tiada perubahan dibuat pada data lesen, backend AZDM, SurveyCAD records, package settings, commission, PA/BM atau modul lain.

## Semakan

- `admin/index.html`: AZDM `aria-selected=true`, SurveyCAD hidden pada load awal.
- `azobss-azdm-admin.js`: product default `azdm` dan initial `selectProduct('azdm')`.
- Package version: `1.0.1211`.
