# AZOBSS Patch 1216 — AZDM Delete Simple Confirmation

Tarikh: 05 Oct 2026

## Perubahan
- Admin > Software Key > AZDM > Delete tidak lagi meminta admin menaip nama customer.
- Klik `Delete` hanya membuka confirmation ringkas dengan pilihan `Batal` atau `OK, Delete`.
- Backend masih menerima `confirm_customer` secara dalaman menggunakan nama customer daripada row yang dipilih, jadi guard delete Worker v1215 kekal aktif tanpa input manual.
- Semua fungsi v1215 lain dikekalkan.
