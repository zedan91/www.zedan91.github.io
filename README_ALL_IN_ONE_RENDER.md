# AZOBSS Lucky Draw Lock Join After Winner

Deploy seperti biasa.

Apa yang berubah:
1. Frontend Lucky Draw membaca winner bulan semasa.
2. Jika winner sudah ada, status user akan papar join ditutup.
3. Button Join Lucky Draw disabled selepas Run Draw.
4. Backend endpoint /api/lucky-draw/entries juga menolak join baru jika winner bulan semasa sudah wujud.
5. Admin Reset Winner akan buka semula join bulan itu jika diperlukan.

Firebase Rules: tiada perubahan diperlukan.
