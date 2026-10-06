# AZOBSS v1196 — Larger Editable Payout QR

Built from v1195.

## Changes
- Admin > Commission Manager > Payout Requests now displays payout QR at ~300×300 instead of 130×130.
- Clicking the QR or **Besarkan QR** opens a large full-screen preview (up to ~540×540) for easier phone scanning.
- Added **Edit / Tukar QR** on each payout request. Administrator can upload a replacement QR or remove the QR; the change is saved back to the Staff/Manager payout profile.
- Staff > My Payout > Payout Profile now has an explicit **Edit / Tukar QR** control and a larger ~240×240 preview.
- Admin payout request pagination corrected to 5 records per page.
- QR uploads are still validated, compressed and size-limited before Firestore save.
- package.json: 1.0.1196
