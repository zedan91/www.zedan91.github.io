# AZOBSS v1399 — Pembelian SolatTime automatik

## Aliran pelanggan

1. Pelanggan login akaun AZOBSS dengan e-mel yang disahkan.
2. Tekan Buy Now SolatTime pada Software Tools. Harga datang daripada katalog
   server yang sedia ada, termasuk pelarasan harga akaun melalui checkout biasa.
   Satu pembelian memberi satu lesen kekal untuk satu PC; tiada pakej tahunan atau
   harga baharu direka. Pakej download generik tidak digunakan untuk SolatTime.
3. Bayar menggunakan ToyyibPay atau Stripe melalui checkout website sedia ada.
4. Server menyemak status, amaun dan rujukan pesanan dengan API penyedia bayaran.
   Paparan success, harga browser atau status callback sahaja tidak mengeluarkan lesen.
5. Server menyimpan serial secara tersulit dalam transaksi Firestore sebelum
   mendaftarkannya dengan Worker. Pesanan yang sama menggunakan serial/ID yang sama
   walaupun callback serentak, respons Worker hilang atau backend dimulakan semula.
6. E-mel mengandungi serial dan pautan installer. Pelanggan boleh login semula dan
   tekan **Lesen SolatTime saya** pada Software Tools untuk membuka semula serial.
7. Admin melihat lesen pada tab SolatTime serta pesanan/bayaran, UID pelanggan,
   invois, resit, rujukan transaksi, ID lesen dan status e-mel. Butiran pesanan boleh
   memaparkan serial pembelian; Hantar semula e-mel menggunakan serial yang sama.

Serial manual lama dalam panel admin kekal menggunakan aliran asal. Rekod pesanan
automatik bermula dengan pembelian baharu selepas v1399; jualan lama tidak diberi
serial secara pukal tanpa pemadanan pemilik dan pengesahan bayaran.

## Tetapan Render

Servis sedia ada: **azobss-backend**. Dua rahsia khusus SolatTime diperlukan:

| Key | Sumber |
| --- | --- |
| SOLATTIME_ADMIN_TOKEN | ADMIN_TOKEN Worker lesen SolatTime yang sedia ada |
| SOLATTIME_ORDER_CIPHER_KEY | 32 bait rawak dalam format 64 aksara hex; berasingan daripada token admin dan AZDM |

Kunci penyulitan pemilik telah disediakan secara tempatan di luar Source/ZIP:
`../Owner-Private/solattime-order-cipher-key.txt` (relatif kepada folder Source).
Salin nilainya sendiri ke Render; jangan tampal dalam chat atau GitHub.
Gunakan nilai yang sama selepas deploy/restart. Simpan backup peribadi: menukar
atau kehilangan kunci menyebabkan serial pesanan lama gagal dinyahsulit. Kod
tidak menggantikan serial yang gagal dinyahsulit dengan serial baharu.

Tidak perlu SOLATTIME_LICENSE_URL; alamat Worker ditetapkan dalam kod. Tidak perlu
menyalin tetapan AZDM. Firebase Admin, ToyyibPay/Stripe dan perkhidmatan e-mel
menggunakan konfigurasi website yang sudah sedia ada. Jangan ubah nilainya.

## Urutan penerbitan

Pakej ini belum dideploy ke live. Ikut urutan berikut untuk mengaktifkan aliran:

1. **Worker/D1 dahulu.** Sumber Worker 0.9.4 dan migrasi disertakan dalam
   `backend/solattime-license/`. Ia ialah Worker SolatTime sedia ada, bukan Worker
   baharu. Dalam folder itu, gunakan sesi Cloudflare pemilik yang sudah login.
   Jangan ubah ADMIN_TOKEN, LICENSE_SIGNING_KEY, PUBLIC_KEY atau database ID.
   Jalankan migrasi baharu sekali sahaja:

   ```powershell
   npx wrangler d1 execute solattime-licenses --remote --file migrations/0003_purchase_issues.sql
   npx wrangler deploy
   ```

   Jangan jalankan semula 0001/0002 terhadap database yang sudah ada. Jika 0003
   pernah digunakan, semak `PRAGMA table_info(licenses)` dahulu dan jangan ulang
   ALTER TABLE yang sama. Migrasi hanya menambah purchase_key nullable dan indeks
   unik. Lesen/aktivasi/trial terdahulu dikekalkan; installer tidak perlu berubah.
2. **Firestore.** Pastikan koleksi `solattimePurchaseFulfillment` hanya boleh
   dicapai Admin SDK server. Lihat patch rules dalam ZIP; jangan gantikan keseluruhan
   rules website. Rules yang sudah default-deny koleksi baharu tidak memerlukan
   grant baharu. Pastikan tiada wildcard allow yang membukanya. premiumOrders juga
   mesti mengekalkan sekatan penulisan bayaran kepada server/admin.
3. Tambah dua rahsia Render di atas. Deploy backend bersama lib baharu, kemudian
   deploy frontend daripada ZIP penuh. `render.yaml` turut mengekalkan pembaikan
   buildFilter v1398. Tiada nilai rahsia dalam Blueprint atau kod browser.
4. Semak tab SolatTime boleh memuatkan senarai. Cuba checkout sebagai pelanggan
   sebenar yang mempunyai e-mel disahkan; pastikan nama/harga daripada katalog betul.
5. Untuk pengesahan produksi, gunakan pembayaran ujian sandbox/test mode yang
   sudah dikonfigurasi, atau satu pembayaran sebenar yang diluluskan pemilik.
   Tiada transaksi kewangan sebenar dibuat semasa menyediakan pakej ini.

Backend akan menyekat checkout SolatTime jika rahsia, database, servis e-mel atau
keupayaan commerce Worker belum tersedia, supaya ia tidak menerima bayaran melalui
aliran baharu yang belum lengkap. Akaun pelanggan tidak pernah menerima token admin.

## API dan simpanan

- Pelanggan: GET /api/solattime/orders?cursor=... dan
  GET /api/solattime/order?order_id=... menggunakan Firebase ID token.
- Admin: POST /api/solattime/admin/orders, /order, /retry-email menggunakan
  Firebase ID token dan allow-list admin server yang sedia ada.
- Senarai: 25 pesanan setiap halaman, cursor ID dokumen, susunan ID pesanan.
  Carian admin pada halaman semasa. Tiada serial dalam respons senarai.
- premiumOrders menerima solattimeOrder/solattimeAccountUid untuk senarai berindeks,
  serta ringkasan pemenuhan. Invois/resit dan rekod jualan biasa dikekalkan.
- solattimePurchaseFulfillment menyimpan cipher AES-256-GCM dan lease transaksi.
  AAD mengikat cipher kepada pesanan, UID pemilik dan amaun. Tiada serial plaintext.
- Worker /admin/issue-order mengikat purchase_key unik kepada hash serial/ID lesen.
  Permintaan berulang tidak membuka semula lesen yang sudah disekat.
- Lease 120 saat melindungi pemprosesan serentak. Giliran yang gagal mencuba semula
  setiap minit apabila proses Render hidup, dengan backoff 30 saat hingga 1 jam.
  Restart membaca semula giliran durable. Render pelan free boleh tidur; retry
  bersambung apabila servis hidup. Semakan status pelanggan/admin juga boleh pulih.
- Status e-mel accepted bermaksud penyedia menerima mesej, bukan jaminan masuk inbox.
  Mesej SMTP yang diterima tetapi responsnya hilang mungkin dihantar semula dengan
  serial yang sama. Ini tidak mengeluarkan lesen tambahan.

Installer dalam e-mel/panel merujuk v1.0.32 yang sedia diterbitkan. Jika versi
installer berubah kemudian, kemas kini DOWNLOAD dalam lib/azobss-solattime-commerce.js.
Kandungan serial tidak dimasukkan ke localStorage/sessionStorage, URL atau log.

## Bukti semakan

Ujian Node merangkumi harga katalog sebenar dalam resolver, UID/e-mel disahkan,
padanan bukti bayaran, akses silang akaun, penyulitan/AAD, callback serentak,
respons Worker hilang, e-mel gagal, kunci salah, lease tamat, pagination dan giliran
durable. Ujian Worker sebenar dalam Miniflare/D1 mengesahkan pembelian idempotent,
aktivasi lesen kekal serta regresi lesen lama, pindahan, sekatan dan trial.
Paparan admin/pelanggan menggunakan data contoh tempatan; tiada lesen produksi
dikeluarkan dan tiada e-mel pelanggan sebenar dihantar semasa QA.

Rujukan protokol: [ToyyibPay](https://toyyibpay.com/apireference/),
[Stripe Checkout Session](https://docs.stripe.com/api/checkout/sessions/object),
[Firestore indexes](https://firebase.google.com/docs/firestore/query-data/index-overview).
