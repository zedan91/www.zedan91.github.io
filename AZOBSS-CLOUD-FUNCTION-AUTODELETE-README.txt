AZOBSS Firebase Cloud Function - Auto Delete Unverified Signup
=============================================================

Apa yang fungsi ini buat:
- Setiap 1 jam, Cloud Function akan scan Firebase Authentication users.
- Jika emailVerified = false dan umur akaun sudah lebih 24 jam, user akan dipadam.
- Ia juga cuba delete Firestore docs berkaitan UID yang sama:
  - users
  - usernameAuthEmails
  - onlineUsers
  - loginHistory

Penting tentang kos:
- Cloud Functions memang ada free-tier/usage rendah, tetapi Firebase biasanya memerlukan Blaze pay-as-you-go untuk deploy functions.
- Tiada caj bulanan tetap, tetapi billing account perlu disambung.
- Untuk trafik kecil AZOBSS, penggunaan function setiap 1 jam biasanya sangat kecil dan berpotensi kekal dalam free-tier, tetapi Google billing tetap bergantung pada penggunaan sebenar.

Cara deploy:
1. Install Node.js LTS.
2. Install Firebase CLI:
   npm install -g firebase-tools

3. Login Firebase:
   firebase login

4. Dalam folder project ZIP ini, run:
   firebase use --add
   Pilih Firebase project AZOBSS anda.

5. Install dependency function:
   cd functions
   npm install
   cd ..

6. Deploy function sahaja:
   firebase deploy --only functions:cleanupUnverifiedUsers

7. Check logs:
   firebase functions:log --only cleanupUnverifiedUsers

Nota:
- Deletion bukan tepat 24 jam. Ia bergantung scheduler, biasanya sekitar 24-25 jam.
- Jangan letak ayat auto-delete kepada user. Di website cukup tulis:
  "Please verify your email within 24 hours, then return and login."
