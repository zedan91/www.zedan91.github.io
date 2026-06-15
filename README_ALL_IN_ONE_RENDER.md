# AZOBSS Lucky Draw Winner History

Patch ini sambung daripada baseline 117.

## Apa yang ditambah
1. Lucky Draw ada panel Winner History.
2. Backend membaca fail winner bulanan dari `lucky-draw-winners`.
3. Endpoint baru: `/api/lucky-draw/winner-history?limit=24`.
4. Setiap history memaparkan:
   - Bulan
   - Nama winner
   - Username winner
   - Jumlah peserta bulan itu
   - Masa winner dipilih
5. Run Draw akan refresh Winner History.
6. Reset Winner akan refresh Winner History.

## Nota
- Firebase Rules tidak perlu update.
- Deploy seperti biasa ke GitHub/Render.
