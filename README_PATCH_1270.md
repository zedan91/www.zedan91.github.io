# Patch 1270 — Admin Test Payment Single Secure Fallback Fix

- Membetulkan `Test Payment (Admin)` di `/PA-BM/` yang boleh nampak tetapi tidak memberi respon / gagal ketika storefront ES module belum sempat bind.
- Menambah secure classic/global-auth fallback khusus Admin Test Payment; jika storefront berjaya load kemudian, storefront clone button dan menjadi owner tunggal.
- Admin Test Payment kini menunggu Firebase Auth hydrate sehingga 10 saat menggunakan `azobssWaitForFirebaseAuthToken()` dan retry token refresh pada 401/403.
- Storefront Admin Test juga tidak lagi membuat one-shot `auth.currentUser` check; ia menggunakan fresh checkout token/waiter yang sama.
- Fallback menghantar cart semasa + `Authorization: Bearer <Firebase ID token>` ke `/api/admin/test-pa-bm-payment` dan mengekalkan backend sebagai authority untuk Admin role serta pricing.
- Selepas test payment paid, backend clear durable `paBmCartDrafts` supaya cart ujian tidak muncul semula selepas browser restart.
- Cart/Add-to-Cart, Lot Kadaster map v1269, checkout ToyyibPay, state picker dan payment recovery lain tidak diubah.
