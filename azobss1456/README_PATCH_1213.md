# AZOBSS v1213 — AZDM Logged-In Legacy Email Resolver Fix

Dibina terus daripada v1212 AZDM Purchase Completion.

## Punca
Frontend sudah login dan berjaya mendapat Firebase ID token, tetapi backend AZDM hanya memeriksa `decoded.email` + `decoded.email_verified` daripada token Firebase. Akaun AZOBSS lama/username boleh menggunakan alias `username@azobss.local` walaupun email sebenar sudah tersimpan pada profil Firestore. Akibatnya checkout/order AZDM memulangkan `Sahkan alamat email sebenar...` walaupun pengguna sudah login.

## Pembaikan
- Kekalkan Firebase UID/token sebagai identiti utama.
- Backend mencari `users` berdasarkan UID yang sama.
- Jika token menggunakan alias `.local` / status token lama belum verified, backend boleh menggunakan email sebenar daripada profil AZOBSS hanya apabila profil milik UID yang sama dan `verified` / `emailVerified` sudah true.
- Fallback tambahan membaca `usernameAuthEmails` berdasarkan UID yang sama.
- Email daripada browser/customer request tetap tidak dipercayai.
- Akaun tanpa email sebenar masih ditolak supaya serial tidak dihantar ke alamat `.local`.

Package version: `1.0.1213`.
