# AZOBSS Patch 1262 — Checkout Binding Gap / Secure Fallback Fix

## Diagnosis sebenar
- v1261 membuang legacy `azobss-global-auth.js` checkout handler pada `/PA-BM/` untuk mengelakkan request tanpa Authorization.
- Namun ia menganggap `azobss-pabm-storefront.js` pasti sempat load dan bind butang.
- Screenshot live menunjukkan Add to Cart berfungsi tetapi `Teruskan Pembayaran` tidak memberi apa-apa respon. Itu hanya boleh berlaku apabila legacy handler sudah dibuang tetapi storefront belum/tidak sempat memasang `proceedToPayment`.
- Jadi terdapat **checkout binding gap**: button visible + enabled, tetapi zero effective click owner.

## Fix
- `azobss-global-auth.js` kini memasang **secure checkout fallback** pada `/PA-BM/` sebaik global auth siap.
- Fallback membaca cart semasa daripada classic cart core, mengambil Firebase ID token sebenar daripada `auth.currentUser`, dan menghantar `Authorization: Bearer <token>`.
- Jika token 401, refresh token dan retry sekali.
- Jika storefront ES module berjaya load kemudian, `bindPaymentButton()` clone button dan fallback lama hilang secara automatik; storefront menjadi owner tunggal.
- Jika storefront gagal load/import/runtime, checkout tetap berfungsi melalui secure fallback — tiada lagi button senyap.
- Payment cart backup + pending return hint masih disimpan supaya cancel/failed payment kekal dalam Troli Anda.
- Fallback tidak mempercayai localStorage sebagai auth; Firebase ID token tetap wajib.

## Preserved
- Cart core v1259 (Add to Cart yang telah disahkan live berfungsi) dikekalkan.
- Backend cryptographic Firebase token verifier v1260 dikekalkan.
- Legacy purchaseLogs checkout kekal disabled pada `/PA-BM/`.

Package version: `1.0.1262`
