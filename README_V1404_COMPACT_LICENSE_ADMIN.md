# AZOBSS v1404 — Panel lesen lebih padat

Panel SolatTime dan AZDM menggunakan ruang atas yang lebih kecil:

- Tiga kad maklumat menjadi satu jalur tiga lajur yang nipis.
- Borang pengeluaran serial manual ditutup secara lalai. Tekan Keluarkan serial
  SolatTime/AZDM untuk membukanya; medan, ID dan handler borang asal dikekalkan.
- Tajuk dan carian menggunakan baris yang sama pada desktop lebar. Padding,
  jarak, ketinggian tab/kawalan dan jarak baris jadual SolatTime dikurangkan.
- Pada skrin kecil, carian membalut ke baris sendiri dan kawalan sekurang-kurangnya
  38px tinggi. Teks bantuan masih dipaparkan dan borang boleh digunakan dengan keyboard.

Dalam pratonton lebar 1280px, jarak dari atas panel produk hingga bawah tab
berkurang daripada 517px ke 248px untuk SolatTime (52%) dan 401px ke 232px untuk
AZDM (42%). Ukuran ini menggunakan fixture data tempatan dan borang manual tertutup;
hasil pada website bergantung pada lebar panel, font dan saiz paparan pengguna.
Kedua-dua borang diperiksa boleh dibuka semula dan medan asal dipaparkan.

## Deploy

ZIP PATCH mengandungi admin/index.html, assets/css/azobss-license-admin-compact.css
dan panduan ini sahaja. Ekstrak di root website dengan laluan folder dikekalkan,
atau gunakan ZIP website penuh. Stylesheet baharu dimuatkan selepas stylesheet
panel asal menggunakan cache tag v1404. Tiada perubahan JavaScript, backend,
Worker, database, lesen, pembayaran atau installer. Semua form asal disahkan sama
byte demi byte; ID halaman juga dibandingkan dengan v1403. Semakan visual dibuat
menggunakan markup dan script produksi dengan data contoh tempatan.

Pakej ini belum diterbitkan ke website live oleh Codex. Nama fail keluaran kini
bermula dengan nombor versi dalam kurungan mengikut pilihan pemilik: (1404).
