# AZOBSS Patch 888 — JUPEM eBiz Multi-Step Login Form Fix

## Punca
Dokumentasi rasmi JUPEM menerangkan aliran Log Masuk sebagai:
1. Masukkan ID Pengguna.
2. Sahkan imej/frasa keselamatan dengan `Ya`.
3. Kemudian masukkan kata laluan.

Backend lama menganggap respons selepas ID Pengguna ialah borang kata laluan dan turut mengambil `action` daripada form pertama pada halaman. Jika JUPEM memaparkan halaman pengesahan frasa atau mempunyai lebih daripada satu form, kata laluan boleh dihantar ke form/action yang salah lalu JUPEM kembali ke halaman Log Masuk.

## Fix
- Parser form JUPEM ditambah.
- Borang kata laluan dipilih berdasarkan field `KataLaluan`, bukan form pertama.
- Jika halaman pengesahan frasa/imej keselamatan muncul, backend auto pilih kawalan `Ya/Yes/Betul/Sahkan/Teruskan`, preserve hidden fields + CSRF, dan submit peringkat itu dahulu.
- Selepas itu barulah kata laluan dihantar ke action borang kata laluan sebenar.
- Semua hidden field JUPEM dipreserve, bukan hanya token/ID/frasa yang diketahui.
- Fallback/session robustness patch 887 dikekalkan.
- `jupemStoreVersion` = 34.

## Deploy
Render backend wajib redeploy.
