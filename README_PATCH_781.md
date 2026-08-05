# Patch 781 — Tempah Servis IT Location Form Simplification

- Removes the duplicate visible `Lokasi tempat tinggal / pickup` field.
- Keeps `customerArea` as a hidden internal value for backend compatibility.
- Uses only the `Nama tempat / alamat dipilih` textarea as the customer-facing location field.
- Places `Cari Lokasi` and `Lokasi Semasa` buttons directly below the address box.
- Renames `Guna Lokasi Semasa` to `Lokasi Semasa`.
- Keeps coordinates, 10 km shop-radius validation, map picker, WhatsApp, Firestore and Admin records unchanged.
