AZOBSS PA/BM Admin Delete Purchase Records Fix

Dibuat:
- Admin boleh Show purchase details.
- Admin boleh Delete satu-satu item PA/BM dalam details.
- Admin boleh buang semua Pending Payment untuk seorang user.
- Admin boleh buang semua rekod purchase list untuk seorang user.
- User biasa tidak nampak delete button.

Nota Firebase Rules:
Jika button Delete/Pending/All tidak berjaya di live site, update Firestore Rules supaya collection purchaseRecords membenarkan admin delete. Rujuk fail FIREBASE-RULES-AZOBSS-FINAL.txt yang sudah dikemaskini dalam ZIP ini.
