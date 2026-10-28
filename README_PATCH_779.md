# Patch 779 — Service radius from AZOBSS shop

- Service radius remains 10 km, now measured from the AZOBSS shop coordinate: `3.255511332218502, 101.69410874034087`.
- The customer map, current-location check, pin validation, saved-location note, search result distance and backend validation all use the shop as the center.
- Customer-facing wording now says distance from the AZOBSS shop, not generic Batu Caves.
- WhatsApp, Admin Service Bookings and CSV labels are updated.
- Admin recalculates distance from stored latitude/longitude so older records display distance to the shop correctly without a Firestore migration.
