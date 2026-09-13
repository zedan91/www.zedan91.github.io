# AZOBSS v1105 — PA Status Text Tiada

Baseline: v1104.

Perubahan:
- Dalam detail Peta Pilihan PA, medan `Status PA` kini memaparkan `Tiada`.
- Mesej teknikal resolver seperti `Nombor PA dipadankan secara automatik melalui rekod Lot Kadaster JUPEM` tidak lagi dipaparkan sebagai Status PA.
- Logik pencarian/padanan nombor PA, maklumat lot, troli dan mesej ralat dalaman dikekalkan.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1105.
- Frontend sahaja; backend/Render tidak perlu redeploy.
