# AZOBSS v1275 — Market large detail + Software Tools style share + card delete

Changes in `/AZOBSS-Market/`:

- Listing Details is widened into a Carousell-like two-column product view: large photo/gallery on the left, item information/actions on the right.
- Main listing photo uses `object-fit: contain` so the whole photo remains visible, with the existing zoom viewer and next/previous controls preserved.
- Share buttons on both listing cards and Listing Details now use the same compact round-share visual language as Software Tools.
- Desktop Share opens a Software Tools-style share sheet with WhatsApp, Telegram, Facebook, Messenger, X, Email, and Copy Link. Mobile/coarse-pointer devices continue to use native Web Share when available.
- Administrator listing cards now have a red Delete button. Delete always shows an OK/Cancel confirmation before Firestore deletion.
- Listing Details Delete uses the same confirmation helper.
- v1274 admin-only create/update/delete Firestore rules remain unchanged and included in the package.
