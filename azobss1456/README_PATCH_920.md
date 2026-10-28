# Patch 920 — Lot Kadaster Discount Checkout Exact Profile Sync

- Fix checkout mismatch when the frontend displays a per-user Lot Kadaster discount (for example RM44 with -40% = RM26.40) but the Render backend resolves a stale duplicate `users` document and returns the original price.
- Frontend price-adjustment state now remembers the exact Firestore `users/<docId>` used to calculate the displayed price.
- PA/BM checkout sends that profile document ID to the backend. The backend re-reads it and only accepts it after verifying it belongs to the authenticated Firebase UID/email.
- Fallback profile lookup now mirrors the frontend order: exact profile document, username document, authenticated local username, UID document, then up to 10 UID duplicates scored in favour of admin-managed/category-specific pricing.
- Checkout capability raised to v10 and cache busting raised to v920.
- Added a server-side expected-amount preflight before creating a ToyyibPay bill, preventing orphan bills if pricing ever becomes out of sync again.
- `deploy-server.js` and the alternate `backend/server.js` are both updated.
