# AZOBSS v1212 — Sambung AZDM Purchase Flow yang belum siap

Dibina terus daripada baseline v1211. Perubahan ini menyelesaikan bahagian yang masih berhenti separuh jalan selepas v1207–v1211: modal **AZOBSS Download Manager → Pilihan pakej** sebelum ini boleh membaca harga, tetapi butang **Bayar melalui ToyyibPay** kekal disabled kerana Cloudflare shop `/integration/*` belum dideploy dan Admin → AZDM → Pesanan masih mendapat endpoint `Not found`.

## Perubahan utama

- Checkout AZDM kini mempunyai **Render-native fallback** menggunakan backend AZOBSS yang sedia ada. Ia menggunakan ToyyibPay, Firebase, email dan sambungan admin AZDM yang memang sudah digunakan oleh AZOBSS.
- Tidak lagi memerlukan `AZDM_SHOP_SERVICE_TOKEN` atau Worker shop tambahan untuk membuka pembelian customer. `AZDM_ADMIN_TOKEN` kekal server-side dan tidak dihantar ke browser.
- Harga tetap datang daripada katalog/pakej server. Browser tidak boleh menentukan harga sendiri.
- Checkout idempotent berdasarkan request UUID; retry tidak sengaja mencipta bil kedua untuk request yang sama.
- Selepas ToyyibPay disahkan melalui semakan API sedia ada, backend mengeluarkan **1 serial bagi setiap PC** melalui Worker lesen AZDM sedia ada.
- Serial disimpan dalam rekod pesanan dalam bentuk **AES-256-GCM encrypted** untuk membolehkan email gagal dicuba semula. Key diambil daripada `AZDM_ORDER_CIPHER_KEY` jika tersedia; jika tiada, key terbitan server daripada `AZDM_ADMIN_TOKEN` digunakan. Serial plaintext tidak dipulangkan melalui API customer/admin list.
- Email serial dihantar melalui konfigurasi email AZOBSS sedia ada. Jika pengeluaran serial atau email gagal, pesanan masuk status `review` dan boleh dicuba semula dari Admin → Software Key → AZDM → Pesanan & email serial.
- Admin AZDM order list kini membaca rekod pesanan daripada Render/Firestore, jadi ia tidak lagi bergantung pada endpoint Cloudflare `/admin/orders` yang sebelum ini `Not found`.
- Rekod AZDM kekal masuk ke `premiumOrders`, jadi pembayaran boleh ikut aliran nombor invoice/receipt, notification dan payment verification AZOBSS sedia ada tanpa menukar SurveyCAD, PA/BM atau download software lain.

## Syarat untuk butang pembayaran menjadi aktif

Backend mesti mempunyai konfigurasi sedia ada berikut: ToyyibPay secret + category, Firebase Admin, `AZDM_ADMIN_TOKEN`, dan email sender (Brevo atau SMTP). Jika salah satu belum tersedia, customer masih melihat keadaan selamat **Pembelian belum dibuka** dan tiada bil dibuat.

## Keselamatan / perkara yang dikekalkan

- ToyyibPay callback tidak terus dipercayai; pembayaran masih perlu lulus semakan ToyyibPay API sedia ada sebelum serial dikeluarkan.
- Cloudflare Worker lesen sedia ada, signing key, public key, database lesen dan token admin tidak ditukar.
- SurveyCAD kekal tab kedua dan AZDM kekal view default seperti v1211.
- Harga AZDM kekal: 1 Tahun RM25/PC; Lifetime RM50 untuk 1 PC; Lifetime 2 PC ke atas dalam satu checkout RM40/PC.

## Semakan

- `node --check deploy-server.js` lulus.
- `node --check lib/azobss-azdm.js` lulus.
- `node --check lib/azobss-azdm-admin.js` lulus.
- `npm run test:azdm`: 18/18 ujian lulus, termasuk 2 ujian baharu untuk Render-local customer shop dan local Admin order/retry fallback.
- Server dimulakan secara tempatan tanpa syntax/runtime crash pada bootstrap; proses dihentikan oleh timeout ujian.

Package version: `1.0.1212`.
