# AZOBSS Patch 1264 — Browser Restart Pending Cart Owner Recovery

## Diagnosis sebenar
- v1263 sudah betul untuk tab close / ToyyibPay cancel kerana local cart/payment backup kekal.
- Jika seluruh browser/private window ditutup, browser storage boleh hilang (terutamanya Incognito / clear-site-data-on-exit), jadi recovery mesti datang semula daripada server `premiumOrders` pending.
- v1263 memang mempunyai `/api/pa-bm/payment-recovery`, tetapi terdapat race semasa full browser restart: Firebase `auth.currentUser` boleh wujud dahulu sedangkan `saveUser(fullUser)` / username AZOBSS belum siap.
- Recovery v1263 ketika itu boleh menulis item ke key sementara `azobss_pabm_store_cart_v1_guest`. Selepas profile siap, cart owner bertukar ke username (contoh `zedan0001`), lalu UI membaca key username dan cart nampak kosong.
- `azobss-auth-changed` juga bukan event yang dijamin berlaku selepas normal Firebase auth hydration; jadi recovery server tidak boleh bergantung pada event itu sahaja.

## Fix v1264
- Pending server recovery **tidak dibenarkan menulis ke guest cart** jika username AZOBSS belum tersedia; payload recovery ditangguhkan sementara.
- Selepas `saveUser(fullUser)` berjaya dalam `onAuthStateChanged`, sistem:
  1. migrate sebarang guest cart/payment-backup lama ke owner username,
  2. flush deferred pending recovery,
  3. force `/api/pa-bm/payment-recovery` sekali lagi dengan Firebase ID token yang sudah hydrate.
- Jika browser/private storage memang sudah dibersihkan sepenuhnya, selepas pengguna login semula, latest unresolved PA/BM pending order dari server akan membina semula `Troli Anda` pada owner key username yang betul.
- Existing v1263 payment recovery endpoint dan item payload digunakan; **tiada backend schema baru** diperlukan.
- Add to Cart v1259, checkout v1262, pending order server recovery v1263, state picker dan paid-only purchase list tidak diubah.

> Nota: Dalam Incognito/Private mode, Chrome/Firefox memang memadam localStorage apabila semua private windows ditutup. v1264 tidak cuba melawan polisi browser; ia memulihkan cart pending daripada server selepas Firebase/AZOBSS login siap.

Package version: `1.0.1264`
