# AZOBSS Patch 840 — Compact Service Booking Cards + Bulk Delete

- Service Bookings cards are compact by default to show more records on screen.
- Each compact card keeps booking ID/date/customer, device, status, estimate and final price visible.
- Click **Lihat semua** (or the compact row) to expand all existing information and admin actions.
- Every card now has a selection checkbox.
- Added **Pilih semua dipaparkan** master checkbox and **Delete Selected** button.
- Bulk delete uses one authenticated backend request and Firestore batch deletion, avoiding repeated reloads/reads for every selected record.
- Existing invoice, WhatsApp, price, status, CSV and 90-second cache functions are retained.
