# AZOBSS v1106 — BM/SBM JUPEM Cadastral Lot Overlay Fix

Baseline: v1105.

Perubahan:
- Peta Pilihan BM dan SBM kini memuatkan overlay lot kadaster JUPEM yang sama seperti Peta Pilihan PA / Lot Kadaster.
- Garisan sempadan lot dan nombor lot di kawasan sekeliling akan kekal kelihatan pada zoom yang disokong JUPEM.
- Polygon lot/PA rujukan berwarna kuning, pin lokasi carian, pin BM/SBM, garisan putus-putus jarak dan label jarak dikekalkan.
- Double-click untuk menetapkan titik carian baharu dikekalkan; drag/single-click tidak menukar titik carian.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1106.
- Frontend sahaja; backend/Render tidak perlu redeploy.
