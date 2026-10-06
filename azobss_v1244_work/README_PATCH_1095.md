# AZOBSS Patch 1095 — PA Lot-to-PA Auto Resolver Fix

- Membetulkan Peta Pilihan PA apabila JUPEM map layer berjaya menemui lot tetapi medan Nombor PA kosong.
- Selepas WGS84 / klik peta menemui lot, backend kini menjalankan carian tahap kedua melalui rekod **Lot Kadaster JUPEM** menggunakan negeri sebenar + Nombor Lot.
- Padanan menggunakan Nombor Lot serta konteks Daerah, Mukim/Bandar dan Seksyen untuk memilih PA dengan selamat.
- Jika semua rekod padanan membawa Nombor PA yang sama, PA boleh dipulihkan walaupun sebahagian konteks JUPEM kosong.
- Jika terdapat beberapa Nombor PA yang masih samar / seri, sistem **tidak meneka** dan Add to Cart kekal disabled.
- Panel kanan kini memaparkan `Status PA` dan menukar teks lama `PA tidak tersedia` kepada `PA belum ditemui` / `Nombor PA belum ditemui` supaya tidak memberi gambaran bahawa lot itu pasti tiada PA.
- Apabila resolver berjaya, Nombor PA dipaparkan dan butang `Tambah PA... ke Troli` aktif seperti biasa.
- Cache resolver 5 minit ditambah untuk mengurangkan query berulang ke JUPEM.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1095.
- BM/SBM, GPS, Syit Piawai, Lot Kadaster Berdigit/C3 dan payment flow tidak diubah.
