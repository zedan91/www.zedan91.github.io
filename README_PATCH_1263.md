# AZOBSS Patch 1263 — Pending Payment Server Cart Recovery

## Diagnosis sebenar
- v1262 sudah membolehkan checkout masuk ke ToyyibPay.
- Admin masih nampak `PENDING` kerana backend `premiumOrders` memang menyimpan bill yang belum dibayar untuk idempotency/recovery. Itu bukan `Senarai Pembelian Terkini` paid user.
- Cart pengguna pula ialah browser storage. Sebelum v1263, payment-cart backup sudah disimpan sebelum redirect tetapi **tidak dipulihkan pada fresh page load**; ia hanya dipulihkan selepas event return/cancel tertentu.
- Jika tab/browser ditutup ketika berada di ToyyibPay, callback/return event mungkin tidak pernah berlaku. Backend masih tahu order pending, tetapi frontend tidak mempunyai item untuk membina semula Troli Anda.
- `reconcileEmptyStoredCart()` lama juga cuba membersihkan pending bila browser cart kosong, sedangkan requirement sekarang ialah pending/cancelled payment mesti kekal/recover ke cart.

## Fix v1263
- Restore `payment_cart_backup` pada setiap fresh `/PA-BM/` load dan selepas Firebase auth hydrate.
- Empty local cart tidak lagi dianggap arahan untuk auto-delete server pending order.
- `/api/pa-bm/payment-recovery` kini pulangkan item + payment URL milik user authenticated untuk latest unresolved PA/BM order.
- Bila cart kosong tetapi server masih ada pending order, item dibina semula automatik ke `Troli Anda`.
- Cart yang dipulihkan ditanda `restoredFromPending` + resume metadata supaya `Teruskan Pembayaran` sambung bill ToyyibPay yang sama.
- Secure global-auth checkout fallback juga boleh terus resume bill recovered yang sama jika storefront ES module belum siap.
- Pending tetap boleh dilihat Admin > Sales & Receipts sebagai payment attempt untuk audit/recovery, tetapi helper `azobssUpdatePaBmPurchaseLogsForOrder()` kekal skip semua unpaid statuses; hanya paid/verified masuk `Senarai Pembelian Terkini`.

Package version: `1.0.1263`
