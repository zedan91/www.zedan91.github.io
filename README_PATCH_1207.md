# AZOBSS v1207 — Lesen AZDM, pakej beberapa PC dan support

Dibina daripada ZIP v1206 yang diberikan pada 3 Oktober 2026. Fail asal v1206 dipelihara; perubahan Firefox PDF Share v1206 kekal.

## Customer

Di Software Tools, customer menggunakan akaun AZOBSS sedia ada. Customer hanya memilih pakej dan bilangan PC. Nama dan email tidak perlu dimasukkan semula. Server menyemak sesi Firebase dan email yang sudah disahkan.

| Pakej | Harga |
| --- | --- |
| 1 Tahun | RM25 bagi setiap PC |
| Lifetime, 1 PC | RM50 |
| Lifetime, 2 PC atau lebih dalam SATU pembelian | RM40 bagi setiap PC |

Contoh Lifetime: 2 PC RM80, 3 PC RM120. Membeli 1 PC dua kali berasingan tidak mendapat diskaun pakej. Had satu checkout ialah 100 PC; hubungi support untuk pesanan lebih besar.

Bayaran dibuat melalui ToyyibPay. Selepas bayaran disahkan melalui API ToyyibPay, sistem mengeluarkan satu serial AZDM untuk setiap PC dan menghantar semua serial dalam satu email. Customer masih menggunakan cara download AZDM yang sedia ada di AZOBSS. Bahagian ini tidak menggantikan fail installer, URL download atau aturan download produk yang sedia ada.

Email serial menggunakan `license@azobss.com` sebagai penghantar selepas domain disahkan. Balasan email dihantar kepada `zedan9107@gmail.com` melalui Reply-To. Support turut dipaparkan melalui WhatsApp `+60 11-3560 0723` dan chat AZOBSS.

Customer boleh menyemak pesanan AZDM dalam bahagian **Pesanan AZDM saya**. Rekod ini disimpan dalam D1 dan tidak menambah serial AZDM ke sistem activation-code generik AZOBSS. Ia belum digabungkan dengan halaman Sales & Receipts / My Purchases generik; pembayaran lain kekal menggunakan aliran asal.

## Status sebenar pakej

Kod dan ujian tempatan siap. Pakej ini belum diterbitkan ke www.azobss.com atau Render. Cloudflare Worker baru belum dideploy dan migrasi baru belum dijalankan di D1 production. Bayaran dan email dalam ujian ialah simulasi, bukan bayaran sebenar atau email customer.

Butang bayaran akan kekal tidak aktif selagi sambungan belum lengkap. Jangan tandakan sistem live sehingga ujian Sandbox dan email penerima milik owner berjaya.

## Persediaan owner

1. Kemas kini laman/Render menggunakan pakej v1207 ini. Entry point masih `node deploy-server.js`.
2. Gunakan ZIP backend Cloudflare AZDM yang disertakan secara berasingan. Jangan letakkan backend owner itu di folder laman GitHub Pages.
3. Kekalkan `ADMIN_TOKEN`, `LICENSE_SIGNING_KEY`, `PUBLIC_KEY`, database dan Worker sedia ada. Jangan jana semula identiti tandatangan; installer customer menggunakan public key sedia ada.
4. Tetapkan secrets Worker berikut melalui Cloudflare atau Wrangler: `SHOP_SERVICE_TOKEN` (64 aksara hex rawak), `ORDER_CIPHER_KEY` (64 aksara hex rawak), `TOYYIBPAY_SECRET`, `TOYYIBPAY_CATEGORY`, `RESEND_API_KEY`. Untuk live, secret dan category ToyyibPay boleh menggunakan merchant AZOBSS sedia ada. Untuk Sandbox, gunakan credentials Sandbox yang berasingan.
5. Tetapkan Render `AZDM_SHOP_SERVICE_TOKEN` sama tepat dengan secret Worker `SHOP_SERVICE_TOKEN`; `AZDM_LICENSE_URL=https://azdm-license.zedan9107.workers.dev`. Secret ini untuk sambungan backend sahaja, bukan kod akses admin dan bukan serial customer.
6. Render menggunakan konfigurasi Firebase Admin sedia ada. Pengesahan token merangkumi semakan token dibatalkan. Akaun email `.local` perlu menggunakan email sebenar yang disahkan sebelum membeli lesen.
7. Sahkan domain penghantar di Resend supaya `license@azobss.com` dibenarkan menghantar email. Tetapan mailbox atau forwarding alamat itu berasingan; Reply-To dalam email lesen sudah menuju Gmail support owner.
8. Dalam folder backend Cloudflare: jalankan `npm ci`, `npm test`, kemudian `npm run migrate:remote` dan `npm run deploy`. Migrasi 0002/0003 adalah tambahan; jangan padam 0001 atau database lama.
9. Untuk ujian ToyyibPay, tetapkan `TOYYIBPAY_SANDBOX=true` dan `SHOP_ENABLED=true` selepas semua secrets lengkap. Semak checkout melalui akaun owner untuk 1 PC dan 2 PC; semua domain pembayaran mesti Sandbox.
10. Uji email kepada akaun owner sahaja dahulu. Selepas ujian sebenar itu berjaya, gunakan credentials ToyyibPay live dan `TOYYIBPAY_SANDBOX=false`. `SHOP_ENABLED=true` membuka pembelian; `false` menutup pembelian baru. Pesanan yang sudah dibuat masih boleh disahkan dan email diulang apabila sambungan email lengkap.

Pembelian baru tidak menggunakan fallback pembayaran manual apabila backend gagal kerana fallback tersebut tidak menjamin serial automatik.

## Pemulihan email dan lesen

Callback berulang atau serentak tidak menghasilkan serial tambahan. Email yang gagal sementara akan dicuba semula dengan payload dan serial sama. Jadual Worker setiap 5 minit menyemak beberapa bayaran tertunda serta email menunggu.

Resend menerima request tidak bermakna email sudah sampai ke inbox. Semak spam dan rekod provider jika customer tidak menerima email. Selepas provider menerima email, payload serial yang dienkripsi dipadam dari outbox; database lesen menyimpan hash serial sahaja. Untuk email gagal atau status tidak pasti, owner boleh semak **Pesanan & email serial** di admin AZDM. Percubaan automatik berhenti sebelum tetingkap idempotency provider tamat; owner boleh memilih retry apabila perlu. Jangan ubah `ORDER_CIPHER_KEY` ketika masih ada email menunggu.

Lesen 1 tahun bermula selepas bayaran disahkan. Setiap serial terhad kepada satu PC aktif. Offline sehingga 30 hari masih terhad kepada tarikh tamat lesen. Deactivate sendiri mempunyai tempoh tunggu pindah PC 24 jam; admin Reset PC boleh melepaskan PC segera.

## Ujian

- 5 ujian bridge Render: akaun disahkan, email/UID browser palsu diabaikan, tetamu/akaun tidak sah ditolak, kuantiti dan hak akses pesanan.
- 10 ujian pembayaran dalam Cloudflare workerd + D1 tempatan: harga, callback palsu/jumlah salah, pembelian berulang, kegagalan API HTTP 200, callback serentak, aktivasi satu serial bagi setiap PC, retry email, pemulihan callback hilang, had 100 PC.
- 7 ujian lesen asal termasuk dataset 5,000 customer.
- Ujian browser desktop 1366px dan telefon 390px: jumlah dinamik, kuantiti salah, checkout simulasi dan status email selepas kembali.

Rujukan rasmi: [ToyyibPay API](https://toyyibpay.com/apireference/), [Firebase ID token](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
