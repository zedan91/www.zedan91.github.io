# AZOBSS v1212 — AZDM Shop Render Secret Wiring Fix

Dibina daripada baseline v1211.

## Perubahan
- Menambah `AZDM_SHOP_SERVICE_TOKEN` sebagai secret `sync: false` dalam `render.yaml`.
- Ini melengkapkan deklarasi environment Render yang diperlukan oleh `/api/azdm/catalog`, `/api/azdm/checkout`, `/api/azdm/status` dan `/api/azdm/orders`.
- Tiada token sebenar dimasukkan ke dalam ZIP/repository. Nilai secret mesti sama dengan `SHOP_SERVICE_TOKEN` pada Cloudflare Worker AZDM.
- Tiada perubahan pada harga, package settings, lesen sedia ada, Admin Software Key, SurveyCAD, commission, PA/BM atau modul lain.

## Penting untuk go-live
Kod Render hanya akan membuka pembelian apabila `AZDM_SHOP_SERVICE_TOKEN` ialah 64 aksara hex yang sah dan Worker AZDM menerima token yang sama. Worker juga perlu `SHOP_ENABLED=true` serta konfigurasi ToyyibPay/email yang lengkap.

Jika secret Render belum diisi, UI akan kekal memaparkan `Pembelian belum dibuka. Hubungi Support untuk bantuan.` — ini tingkah laku selamat yang disengajakan.
