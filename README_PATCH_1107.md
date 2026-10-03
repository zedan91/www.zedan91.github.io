# AZOBSS v1107 — BM/SBM Earth + MyLot-style JUPEM Overlay

Baseline: v1106.

Kajian MyLot JUPEM:
- MyLot menyediakan pilihan peta asas Google Satellite / Google Road / Tiada.
- Lapisan kadaster yang diterangkan kepada pengguna ialah NDCDB Lot, Relative NDCDB Lot dan C3 Lot.
- Klik pada lot digunakan untuk melihat maklumat lot.

Perubahan v1107:
- Peta Pilihan BM dan SBM mempunyai butang `Earth` untuk tukar daripada peta jalan kepada imej satelit.
- Earth mode menggunakan imej satelit Esri World Imagery yang stabil dan tidak bergantung pada tile Google/MyLot yang tidak didokumenkan.
- Overlay rasmi JUPEM NDCDB kekal dan C3 turut diaktifkan dalam Earth mode melalui backend AZOBSS sedia ada.
- Butang `MyLot ↗` membuka aplikasi MyLot JUPEM rasmi dalam tab baharu.
- Dalam Earth mode, single-click pada mana-mana lot memaparkan Nombor Lot, Nombor PA (jika ada), Negeri, Daerah, Mukim/Bandar, Seksyen dan WGS84.
- Single-click tidak mengubah titik carian BM/SBM. Double-click sahaja menetapkan lokasi carian baharu seperti v1102+.
- Pin BM/SBM, pin lokasi carian, highlight pilihan, garisan putus-putus dan label jarak dikekalkan.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1107.
- Frontend sahaja; Render backend tidak perlu redeploy kerana endpoint lot/PA dan tile JUPEM sedia ada digunakan.

Nota penting:
- MyLot ialah aplikasi JavaScript dan endpoint tile dalaman asalnya tidak didokumenkan secara awam. v1107 tidak hot-link endpoint dalaman yang rapuh. Ia meniru pengalaman MyLot Earth menggunakan satellite basemap + data kadaster rasmi JUPEM yang AZOBSS sudah gunakan.
- Relative NDCDB tidak dipaparkan sebagai layer tersendiri kerana endpoint JUPEM/eBiz sedia ada yang disahkan AZOBSS tidak mengekspos layer Relative NDCDB secara berasingan.
