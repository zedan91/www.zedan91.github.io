# AZOBSS Patch 827 — Read-only selected address + Floor / Unit field

- Baseline: patch 826.
- The map-selected address is now read-only and can only be changed through **Cari Lokasi** or **Lokasi Semasa**.
- Added optional **Floor or unit number** above the selected address, inside the same location section.
- Floor/unit is saved in `serviceBookings`, included before the selected address in WhatsApp, restored from local storage, shown in Admin Service Bookings details, and included in CSV export.
- Selecting a new map location always refreshes the read-only address.
