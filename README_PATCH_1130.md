# AZOBSS v1130 — Manual Admin PA/BM Access Preservation Fix

Package version: **1.0.1130**  
Baseline: `(1129)-AZOBSS-MEMBERSHIP-REFERRAL-LUCKY-DRAW-SHARE-UNLOCK-FIX_20260916.zip`

## Tujuan
Memastikan akaun `member` yang diberi **PA/BM Access = PA/BM allowed** secara manual melalui Admin Dashboard kekal boleh melihat butang/tab **PA / BM** dan membuka `/PA-BM/`. Membership, Referral Invite Code dan Lucky Draw tetap tidak pernah memberi PA/BM.

## Perubahan
- `adminPaBmAllowed` kini dianggap keputusan Admin Dashboard yang eksplisit walaupun profil lama tiada marker `adminPaBmOverride` / `paBmManagedBy`.
- `adminPaBmAllowed=true` => tab PA/BM dipaparkan dan direct `/PA-BM/` dibenarkan.
- `adminPaBmAllowed=false` => tab PA/BM disembunyikan dan direct `/PA-BM/` ditolak; nilai false mengatasi flag legacy yang mungkin tertinggal.
- `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` menggunakan resolver admin yang sama. Live-sync kini mempunyai helper admin sendiri supaya tidak bergantung pada function daripada ES module lain.
- Pre-paint navbar pada semua halaman diselaraskan supaya akaun manual admin tidak nampak tab hilang semasa page load.
- Firestore user-profile listener kini menyegarkan keputusan PA/BM secara live: jika admin tukar `PA/BM Access` ketika user sedang login, tab PA/BM boleh muncul/hilang tanpa perlu redeem code; direct `/PA-BM/` turut mengikuti keputusan terkini.
- Cache-buster auth dinaikkan ke `v1130`.
- Tiada perubahan pada Membership/Referral/Lucky Draw v1129, harga, checkout, PA/BM download, map atau payment.

## Akses PA/BM yang sah
1. Admin/owner.
2. User yang Admin Dashboard set `PA/BM Access = PA/BM allowed`.

Invite Code, referral, Membership dan Lucky Draw **tidak** grant PA/BM.
