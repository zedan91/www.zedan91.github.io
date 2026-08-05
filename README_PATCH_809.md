# Patch 809 — WhatsApp Service Message Formatting

Baseline: `(808)-AZOBSS-SALES-RECEIPTS-HARDWARE-AUTO-CATEGORY-FIX_20260805.zip`

Perubahan:
- Buang baris `Kawasan` dan `WGS84` daripada mesej Tempah Servis IT yang dihantar ke WhatsApp.
- Kekalkan pautan peta, jarak kedai, alamat ringkas dan cara serahan.
- Tambah jarak kemas sebelum tanda `:` pada bahagian maklumat peranti.
- Bold hanya nilai selepas `:` untuk Peranti, Saiz skrin, Jenis skrin, Serial dan Keadaan menggunakan format WhatsApp `*teks*`.
- Bold keseluruhan setiap baris servis yang dipilih.
- Selaraskan format pada mesej rasmi backend dan mesej fallback frontend.
