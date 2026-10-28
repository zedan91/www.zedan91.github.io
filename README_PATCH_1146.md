# AZOBSS v1146 — Download/Test Spinner Single DOM Fix

Baseline: v1145.

Punca sebenar spinner tidak konsisten:
- PA/BM masih mempunyai spinner legacy v945 pada pseudo-element `::before` dan label pada `::after`.
- v1144/v1145 cuba melukis spinner baru pada `::after`, jadi dua sistem CSS bertindih.
- Admin `Test ↓` pula mempunyai selector CSS lebih spesifik daripada selector spinner umum.
- Re-render Purchase Records boleh menggantikan node button ketika download aktif.

Fix v1146:
- Download customer dan Admin Test menggunakan SATU spinner DOM sebenar `<span class="azobss-btn-spinner-v1146">`.
- Legacy busy `::before/::after` dinyahaktifkan semasa button busy.
- Re-render customer row dan admin detail row memasukkan semula spinner DOM jika download masih aktif.
- Spinner style diletak pada cascade paling akhir.
- Minimum busy visibility 900ms sedia ada dikekalkan.
- `/health` dan auto-wake v1145 dikekalkan.
- Kuota/exact-once/reset tidak berubah.
