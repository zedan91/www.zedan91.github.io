# AZOBSS v1224 — AZOBSS Market + Shop Tree

- Adds `/AZOBSS-Market/` for new and pre-owned listings.
- Replaces the top-level `Affiliate Shop` navbar link with `Shop ▾`.
- `Shop` contains `AZOBSS Market` and `Affiliate Shop`.
- Marketplace supports search, condition/category/location filters and sorting.
- Signed-in users can publish a listing with one compressed photo, price, condition, category, location, WhatsApp and description.
- Sellers can delete their own listing.
- Buyer contact is direct through WhatsApp; AZOBSS does not hold marketplace payment in this MVP.

## Firebase rule required
Deploy the merged rules file:
`AZOBSS-Developer-Files/FIREBASE-RULES-AZOBSS-PRODUCTION-LOCKED-v1224-MARKET.txt`

or merge only the block in:
`AZOBSS-Developer-Files/FIREBASE-RULES-PATCH-1224-AZOBSS-MARKET.txt`

Without the new `marketListings` rule, the page can open but creating/deleting listings may be denied by Firestore.
