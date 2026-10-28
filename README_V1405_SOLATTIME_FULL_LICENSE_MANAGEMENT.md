# v1405 — Pengurusan lesen SolatTime lengkap

Panel SolatTime kini memaparkan pelanggan, Gmail/e-mel, telefon, serial asal dengan
Salin, status, penggunaan PC, tempoh Kekal dan tarikh dikeluarkan. Edit menyimpan
nama serta maklumat hubungan. Reset PC, Sekat/Buka sekatan dan Delete mempunyai
pengesahan. Susun atur padat v1404, tab Lesen/Pesanan & Pembayaran/Audit dan aliran
pembayaran sedia ada dikekalkan.

## Serial dan maklumat pelanggan

- Serial manual baharu dari panel website disimpan secara disulitkan sebelum
  dikeluarkan. Retry permintaan yang sama menggunakan serial yang sama.
- Serial pembelian sedia ada dipulihkan daripada rekod pemenuhan bayaran asal,
  hanya jika ID lesen, hash, identiti pembeli dan konteks bayaran sepadan.
- Lesen lama yang hanya mempunyai hash tidak boleh ditukarkan semula menjadi
  serial. Gunakan Pautkan serial dan masukkan serial asal; hash mesti sepadan.
- Serial yang diimport melalui panel website turut disimpan secara disulitkan.
  Panel asal Worker masih mengeluarkan serial sekali sahaja; gunakan panel website
  jika mahu serial manual disimpan dan dipaparkan semula.
- Edit maklumat hubungan admin tidak menukar pemilik akaun pembelian, e-mel
  transaksi/penghantaran, harga, serial, aktivasi atau tempoh lesen. Jika simpanan
  profil gagal selepas nama diterima servis lesen, refresh dan ulang simpan Edit.

## Reset PC dan Delete

Reset PC melepaskan aktivasi semasa dan menaikkan generasi lesen. Sync biasa
tidak boleh mengambil semula pemilikan; aktivasi mesti dibuat secara jelas.
PC yang offline menerima perubahan apabila kembali online dan sync.

Delete ialah pemindahan ke arkib yang boleh dipulihkan: lesen disekat, PC dilepas,
tetapi hash/serial dan rekod pembelian dikekalkan. Pilih Paparan → Arkib (Delete)
untuk Pulihkan rekod. Rekod pulih dalam keadaan Disekat tanpa PC; buka sekatan
secara berasingan selepas semakan. Tiada fungsi padam kekal dalam panel ini.
Retry bayaran/import tidak boleh menghidupkan semula lesen arkib.

## Konfigurasi dan pemasangan

1. Cloudflare Worker 0.9.5 dan migrasi 0004 telah diterbitkan pada 24 Oktober 2026.
   Pakej salinan ada dalam backend/solattime-license. Jangan jalankan migrasi
   ALTER TABLE 0004 sekali lagi jika medan deleted sudah wujud.
2. Upload kandungan ZIP penuh ke repositori website sedia ada atau gunakan PATCH
   pada v1404. Jangan padam fail atau tetapan sedia ada. Deploy backend Render juga
   kerana deploy-server.js dan dua modul lib berubah; frontend sahaja tidak cukup.
3. Kekalkan SOLATTIME_ADMIN_TOKEN dan SOLATTIME_ORDER_CIPHER_KEY sedia ada.
   Cipher key ialah 64 aksara hex yang sama dengan pembelian SolatTime. Jangan
   jana semula/rotate: serial tersimpan memerlukan kunci asal. Tiada env var baru.
4. Firestore Admin SDK mesti tersedia seperti aliran pembelian sedia ada. Vault
   menggunakan koleksi private solattimePurchaseFulfillment yang sama, doc
   license_<UUID>, state vault-* berasingan daripada antrean retry pembayaran.
   Kekalkan rules deny akses browser pada koleksi ini. Tiada grant browser baru.
5. Serial manual menggunakan AES-256-GCM, kunci HKDF berasingan dan AAD ID lesen;
   serial pembayaran mengekalkan codec/konteks asal. Token dan cipher tidak masuk
   browser atau ZIP. Hanya admin AZOBSS boleh mendapatkan serial melalui bridge.
6. Selepas deploy frontend dan Render, buka Keys & Digital Access → SolatTime.
   Refresh: semak serial pembelian sedia ada. Uji Edit/Reset/Delete dengan rekod
   ujian sahaja. Jangan menggunakan lesen pelanggan sebenar untuk QA.

Worker sudah live; ZIP ini belum diterbitkan ke website/Render oleh Codex.
Lesen SolatTime kekal offline, trial 30 hari, aplikasi/installer 1.0.32, feed
kemas kini dan integrasi AZDM tidak berubah.

## Pengesahan

66 ujian website dan 10 ujian Worker lulus, termasuk issue serentak, respons
hilang/retry, pemulihan serial bayaran, cipher salah, pemadanan serial lama,
auth/whitelist, reset generasi, arkib dan cubaan pengaktifan semula melalui sync.
Browser tempatan dengan data contoh mengesahkan Edit, Reset PC, Delete,
Pulihkan rekod dan Pautkan serial. Tiada reset/delete pada pelanggan sebenar,
pembayaran sebenar atau penghantaran e-mel dibuat dalam kerja ini.
