# AZOBSS Patch 1094 — PA WGS84 Auto-State Lot Info Fix

- Fix Peta Pilihan PA apabila koordinat/klik berada dalam negeri lain daripada negeri yang dipilih.
- WGS84 kini menggunakan negeri pilihan sebagai pilihan pertama, kemudian auto-detect layer JUPEM negeri sebenar berdasarkan lokasi.
- Contoh: negeri dipilih SELANGOR tetapi koordinat berada di W.P. KUALA LUMPUR — lot KL tetap ditemui dan panel kanan memaparkan Nombor PA, Nombor Lot, Negeri, Daerah, Mukim dan Seksyen.
- `Tambah ke Troli` kini menggunakan negeri sebenar daripada lot yang ditemui, bukan negeri lama yang dipilih.
- Carian menggunakan Nombor Lot masih memerlukan negeri dipilih untuk mengelakkan padanan nombor lot yang sama antara negeri.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1094.
- BM/SBM dan aliran lain tidak diubah.
