# Patch 804 — Service Booking Date/Time Auto-Fill

- Membetulkan tarikh draf invois yang sebelum ini boleh menjadi **01/01/1970, 7:30 AM**.
- Apabila admin menekan **Buat Draf Invois**, medan **Sale Date & Time** kini diisi automatik menggunakan `createdAtMs` rekod tempahan.
- `createdAtMs` direkod oleh backend ketika pelanggan menekan **Hantar Tempahan melalui WhatsApp**.
- Jika rekod lama tiada `createdAtMs`, sistem cuba `createdAt`, `updatedAtMs`, `updatedAt`, kemudian barulah menggunakan waktu semasa.
- Cache-busting modul Sales & Receipts ditukar kepada versi `804`.
- Berdasarkan patch `(803)`.
