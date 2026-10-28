# AZOBSS v1403 — Panel SolatTime seperti AZDM

Panel admin SolatTime kini menyatukan lesen, pesanan dan audit dalam satu kad dengan
tab Lesen, Pesanan & Pembayaran dan Audit. Carian, Semua dan Refresh dikongsi.
Bilangan tab menunjukkan rekod pada halaman yang dimuatkan; tanda + bermaksud
halaman seterusnya tersedia. Pagination lesen dan pesanan kekal berasingan.

Lesen boleh disusun mengikut tarikh, nama atau status. Pesanan dan Audit menggunakan
susunan tarikh, nama atau jumlah. Carian meliputi pelanggan/ID lesen, nama, e-mel,
telefon, UID akaun, ID pesanan, invois, resit dan rujukan transaksi yang dimuatkan.
Lesen yang mempunyai padanan ID dalam halaman pesanan turut boleh ditemui melalui
butiran hubungan pesanan itu. Carian dan susunan tidak melangkaui halaman semasa.
Serial tidak dimuatkan atau diindeks untuk carian umum.

Audit ialah ringkasan daripada rekod pesanan dan status lesen semasa. Ia memaparkan
pesanan dibuat, bayaran disahkan, serial siap apabila state mengesahkannya,
penerimaan e-mel oleh penyedia serta status PC/sekatan jika lesen sepadan dimuatkan.
Masa diambil daripada medan sebenar. Masa serial/aktivasi/sekatan yang tidak direkodkan
tidak direka. Butiran membuka dialog pesanan sedia ada untuk UID, transaksi, serial,
installer dan status e-mel. Rekod manual tanpa pesanan kekal pada tab Lesen.

Pengeluaran serial, import lesen lama, sekatan/pemulihan, dialog butiran serta
pengesahan penghantaran semula e-mel dikekalkan. Lesen SolatTime masih kekal,
trial 30 hari dan pindahan PC melalui aplikasi. Tiada reset PC, delete, tempoh
AZDM atau pemulihan serial manual direka sebagai sebahagian susunan ini.

## Deploy

ZIP PATCH v1403 mengandungi fail produksi yang berubah sejak v1402 dan panduan ini.
Ekstrak di root website dengan laluan folder dikekalkan, atau gunakan ZIP penuh.
Fail produksi ialah admin/index.html, Software-Tools/index.html,
assets/css/azobss-solattime-admin.css, assets/js/azobss-solattime-admin.js,
assets/js/azobss-solattime-orders.js dan assets/js/azobss-solattime-workspace.js.
Deploy bersama-sama supaya cache tag v1403 memuatkan script yang sepadan.
Tiada perubahan backend Render, Worker Cloudflare, database, token atau installer.
Tiada katalog JSON di dalam PATCH. Menu akaun v1402, pembaikan sesi v1401 dan
prestasi v1400 dikekalkan. Pakej ini belum diterbitkan ke website live oleh Codex.

59 ujian Node lulus. Pratonton browser menggunakan markup admin dan script produksi
dengan data contoh: tab, bilangan halaman, carian bersama, lesen, pesanan, audit dan
Refresh diperiksa. Tiada rekod pelanggan atau bayaran produksi diubah dalam QA.
