# (117)-AZOBSS-LUCKY-DRAW-LOCK-JOIN-AFTER-WINNER

Patch kecil untuk Lucky Draw sahaja.

Perubahan:
- Jika winner bulan semasa sudah dipilih, Join Lucky Draw akan ditutup untuk bulan itu.
- Button Join Lucky Draw akan disabled bila winner sudah wujud.
- Backend juga block direct POST join selepas winner bulan semasa wujud.
- Reset Winner akan buka semula join jika syarat referral cukup.

Tidak sentuh Login/Register, My Purchases, Software, CAD, atau PA/BM.
Firebase Rules tidak perlu update.
