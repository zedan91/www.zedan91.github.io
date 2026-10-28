# AZOBSS v1131 — Forgot Password + Google/Password Same-Account Fix

## Tujuan
Membetulkan dua isu Authentication tanpa mengubah Membership/Referral/Lucky Draw/PA-BM access v1130.

## Perubahan
1. **Forgot password berfungsi semula**
   - Punca: handler click berganda menukar `hidden` dua kali, jadi kotak reset terbuka lalu terus tertutup semula.
   - Handler kini singleton menggunakan `data-azobss-forgot-bound` dan menghentikan bubbling yang menyebabkan double-toggle.
   - Fallback handler berganda lama dibuang.
   - Live Likes auth fallback juga berkongsi guard yang sama supaya halaman yang memuat dua module tidak double-toggle.

2. **Satu Firebase account boleh guna Google + email/password**
   - Firebase menyokong beberapa provider pada UID yang sama apabila credential di-link.
   - Jika Sign up email/password mendapat `auth/email-already-in-use`, AZOBSS kini menunjukkan butang `Verify Google & Enable Password Login`.
   - User mesti memilih Google account dengan email yang sama. Selepas ownership disahkan, `EmailAuthProvider.credential()` di-link kepada Firebase user sedia ada melalui `linkWithCredential()`.
   - Tiada Firebase user kedua dicipta dan profil AZOBSS sedia ada dikekalkan.
   - Jika provider `password` memang sudah ada, AZOBSS tidak overwrite password; user diarahkan ke Sign in / Forgot Password.

3. **Settings untuk Google-only account**
   - `Settings > Reset Password` berubah automatik kepada `Add Password Sign-In` jika account hanya mempunyai Google provider.
   - Current Password disembunyikan kerana belum ada password.
   - Selepas password ditambah, account boleh login menggunakan Google ATAU email/password pada UID yang sama.
   - Account yang sudah ada password kekal menggunakan flow Reset Password biasa dengan reauthentication.

## Tidak berubah
- Manual Admin PA/BM access v1130.
- Membership, Referral Invite Code dan Lucky Draw tidak memberi PA/BM access.
- Main backend / Lucky Draw backend tidak berubah.

## Deploy
Frontend sahaja. Tidak perlu redeploy Render backend.
