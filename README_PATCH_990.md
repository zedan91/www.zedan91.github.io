# AZOBSS Patch v990 — Favorites/Recent Persistent Cloud Sync Fix

- Punca: Favorites/Recent v984-v989 disimpan hanya dalam localStorage dan menggunakan URL channel sebagai identity. Dynamic catalogue v989 boleh menghasilkan URL/metadata yang berbeza antara sesi, dan localStorage juga tidak boleh memulihkan library pada browser/peranti lain.
- Favorites/Recent kini menggunakan stable channel key (`mana2:<slug>` untuk Mana-Mana).
- Data pengguna sign-in disimpan ke Firestore `azobsstv_user_library/{firebaseUid}` melalui endpoint authenticated `/api/azobsstv/library`.
- Firebase ID token daripada `window.azobssGetFirebaseAuthHeaders()` disahkan oleh Firebase Admin backend.
- localStorage per-UID masih digunakan sebagai cache/offline fallback.
- Selepas logout, buka semula browser, atau login pada browser/peranti lain menggunakan akaun sama, library dimuatkan semula daripada Firestore.
- URL favorites lama dalam localStorage dimigrasi automatik kepada stable key.
- Guest masih tidak boleh menyimpan Favorites/Recent.
- Dynamic Mana-Mana catalogue/EPG v989 kekal.
