# AZOBSS Patch 889 — JUPEM eBiz Direct Login Current Form Fix

## Punca yang dibetulkan
Halaman Log Masuk JUPEM semasa boleh memaparkan `IDPengguna` dan `KataLaluan`
dalam borang yang sama. Backend terdahulu memulakan POST ID sahaja dahulu,
kemudian cuba meneka peringkat seterusnya. Ini boleh menyebabkan flow yang
tidak sepadan dengan borang semasa.

## Fix
- GET halaman Log Masuk terlebih dahulu.
- Parse form sebenar yang mengandungi `IDPengguna` + `KataLaluan`.
- Jika kedua-duanya ada, submit terus dalam satu POST ke `action` form sebenar.
- Preserve semua hidden field, CSRF token dan query token yang dibekalkan JUPEM.
- Sertakan named submit button seperti `Log Masuk` jika form memerlukannya.
- Jika halaman JUPEM menggunakan flow lama berperingkat, fallback 888 masih digunakan.
- Kesan tepat mesej `Salah ID Pengguna atau Kata Laluan`.
- Tidak log username atau password.
- `jupemStoreVersion` = 35.

## Deploy
Render backend wajib redeploy.
