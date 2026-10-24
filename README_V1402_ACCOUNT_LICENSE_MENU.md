# AZOBSS v1402 — Lesen & Pembelian Saya

Butang Lesen SolatTime saya di atas senarai software dibuang. Menu akaun sedia ada
My Purchases dinamakan semula Lesen & Pembelian Saya dan membuka satu panel:

- SolatTime: buka lesen/pesanan melalui panel sedia ada. Pada halaman lain,
  navigasi ke /Software-Tools/?solattime_orders=1. Pautan e-mel lama kekal berfungsi.
- AZDM: muatkan pesanan akaun menggunakan endpoint GET /api/azdm/orders yang
  sudah ada. Paparkan status bayaran dan penghantaran e-mel serial. Serial AZDM
  masih dihantar melalui e-mel; endpoint ini tidak memberikan serial kepada UI.
- Pembelian lain: buka paparan My Purchases asal untuk rekod, resit dan download.

Panel baharu dimuatkan hanya apabila menu ditekan. Tiada permintaan API atau polling
baharu semasa halaman dibiarkan terbuka. Tiada perubahan kepada bayaran, Worker,
database, serial, konfigurasi Render atau installer. Logout/pertukaran akaun
mengosongkan butiran dan membatalkan permintaan lama.

Pembaikan login pautan e-mel v1401 dan prestasi v1400 dikekalkan. 39 halaman yang
menggunakan shared global-auth dikemas kini pada cache tag dan teks menu statik
sahaja, supaya browser mendapatkan script menu baharu. UI menggunakan normalisasi
menu sedia ada dan satu handler yang menerima label lama serta baharu.

## Pemasangan website

Pakej belum diterbitkan ke website live oleh Codex. Gunakan ZIP website penuh v1402,
atau ekstrak ZIP PATCH v1402 di root website dengan struktur folder dikekalkan.
PATCH mengandungi fail produksi yang berubah sejak v1401 dan panduan ini sahaja.
Tiada data katalog JSON atau rahsia di dalam PATCH. Deploy semua fail PATCH
bersama-sama agar import script/CSS baharu dan cache tag sepadan.

56 ujian Node lulus, termasuk navigasi tiga kategori, deep link SolatTime, akses
AZDM berautentikasi, paparan guest, respons lama selepas pertukaran akaun dan
handler menu lama/baharu. Pratonton browser menggunakan template menu, handler,
lazy opener dan script produksi dengan data contoh tempatan. Tiada transaksi
kewangan atau lesen produksi dikeluarkan dalam kerja ini.
