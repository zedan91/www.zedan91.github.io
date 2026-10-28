# AZOBSS Patch 1274 — Market Admin / Multi-Photo / Edit / Zoom / Share

Baseline: live/current repository state based on v1272. This patch changes `AZOBSS-Market/index.html` and adds Firebase rules files for the Market write restriction.

## Changes
- `+ Sell an Item` is hidden for normal users and available only to the AZOBSS Administrator identity.
- Publish/edit/delete are also guarded in the Market JavaScript; direct Firestore protection is provided by the v1274 rules file.
- Market photo conversion now paints an opaque white canvas before JPEG compression. This prevents transparent-source images from becoming a black rectangle in Firefox/other browsers.
- Up to 8 images per listing. The first image is the cover. Existing single-image records remain readable via `imageData` fallback.
- Listing Details now has `Edit Listing` and `Delete Listing` for Administrator only.
- Existing photos can be removed and reordered to cover position while editing; new photos can be added up to the 8-photo limit.
- Listing Details includes a thumbnail gallery. Clicking the main image opens a large viewer with Previous / Next controls, counter, keyboard arrows and Escape close.
- Share Link is available both on each front-page listing card and in Listing Details.
- Shared URL uses `?listing=<documentId>` and automatically opens the correct Listing Details when visited.
- WhatsApp Seller message includes the direct listing URL.

## Firebase rule deployment (required for true admin-only security)
Deploy the full rules file:
`FIREBASE-RULES-AZOBSS-v1274-MARKET-ADMIN-ONLY.txt`

or replace only the `marketListings` block using:
`AZOBSS-Developer-Files/FIREBASE-RULES-PATCH-1274-AZOBSS-MARKET-ADMIN-ONLY.txt`

The static website UI alone hides/blocks publishing, but the Firestore rules are what prevent a non-admin client from bypassing the UI.

## Storage note
Photos remain stored in the listing document for compatibility with the current Market architecture. To stay below Firestore's document size limit, images are compressed aggressively and capped at 8 photos / a safe combined payload.
