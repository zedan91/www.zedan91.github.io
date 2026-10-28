# AZOBSS v1401 — Pautan lesen dalam akaun

Pautan e-mel /Software-Tools/?solattime_orders=1 dahulu membuka panel sebelum
modul Firebase siap dimuatkan atau sesi login selesai dipulihkan. Panel terus
memaparkan permintaan login walaupun header menunjukkan nama akaun tersimpan.

Panel kini menunggu helper autentikasi sebenar dan pemulihan Firebase, memaparkan
status pengesahan sementara, kemudian memuatkan pesanan menggunakan ID token
sebenar. Login yang siap selepas ralat memuatkan semula panel yang masih terbuka.
Butang Cuba semula tersedia jika sesi lambat/gagal. Menutup panel, logout atau
bertukar UID membatalkan hasil lama dan mengosongkan butiran serial. Profil
localStorage tidak digunakan sebagai bukti autentikasi. Semakan UID pemilik
pesanan pada server kekal wajib.

## Fail untuk deploy

Hanya tiga fail produksi berubah berbanding v1400:

- assets/js/azobss-solattime-orders.js
- Software-Tools/index.html
- admin/index.html

Kedua-dua halaman menggunakan cache tag v1401. Gantikan tiga fail itu bersama-sama
daripada ZIP PATCH, atau gunakan ZIP website penuh v1401. Pembaikan prestasi v1400
dikekalkan. Tiada perubahan backend Render, Worker Cloudflare, database, kunci,
lesen atau installer diperlukan. Elakkan menindih data katalog hidup dengan data
lama; ZIP PATCH mengandungi tiga fail di atas sahaja dan panduan ini.

Pakej ini belum diterbitkan ke website live oleh Codex. 49 ujian Node lulus,
termasuk pemulihan sesi lambat, guest kemudian login, penutupan semasa menunggu,
logout semasa respons API belum tiba, pertukaran akaun dan timeout dengan retry.
Pratonton browser menggunakan skrip produksi dan data contoh tempatan.

Pada 24 Oktober 2026 pengguna memberi screenshot bayaran Stripe berjaya, lesen
1/1 PC dan e-mel serial diterima. Itu bukti pengguna bagi aliran Stripe, bukan
ujian pembayaran yang dibuat Codex. Laluan FPX belum disahkan melalui pembayaran.
