# AZOBSS v1256 — Logged-In Checkout + Cart Remove Hard Fix

## Punca yang dibaiki
1. **Checkout nampak sudah login tetapi backend jawab `Please login again...`**
   - PA/BM frontend sebelum ini menghantar token Firebase cache sekali sahaja.
   - Jika token lama/rotated dalam tab lama atau Incognito, backend terus 401 walaupun UI masih memaparkan akaun login.
   - Backend pula hanya bergantung pada Firebase Admin `verifyIdToken`; jika verifier Admin gagal sementara atau config auth verifier tidak tersedia, identity terus dianggap tiada.
2. **Butang `×` dalam `Troli Anda` tidak membuang item**
   - Remove local cart masih berada pada bubbling async handler bersama cleanup Pending Payment.
   - Interaksi lain pada halaman boleh menahan bubbling; cleanup backend/Firestore juga tidak sepatutnya menentukan sama ada item local boleh dibuang.

## Fix
- Checkout kini mengambil **fresh Firebase ID token** (`reload()` + `getIdToken(true)`) dan retry sekali secara automatik jika backend membalas 401.
- Backend `deploy-server.js` dan `backend/server.js` kini ada **secure Firebase Identity Toolkit fallback** untuk mengesahkan ID token projek AZOBSS jika Firebase Admin token verification tidak berjaya. Token masih perlu sah; tiada trust pada localStorage atau username client.
- Butang `×` cart kini dimiliki oleh **capture-phase local cart remove handler**. Item dibuang dan UI dikemas kini serta-merta; cleanup rekod lama/pending dibuat best-effort di background dan kegagalannya tidak boleh memulihkan item semula.
- Flow Add to Cart v1255 dikekalkan.
- State button-grid + highlight v1251/v1252 dikekalkan.
- Failed/cancelled payment stay-in-cart v1250 dikekalkan.

Package version: `1.0.1256`
