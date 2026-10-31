# AZOBSS v1471 — Software Tools Free Download File Link

Baseline: v1470 full website.

## Changes
- Added `Free Download File Link` above `Premium Download File Link` in Admin > Software Tools editor.
- Free software `Download Now` uses `freeDownloadFileLink` first, with legacy `downloadLink` fallback for older records.
- Premium software can expose a free/trial/reinstall download icon when `Free Download File Link` is filled; that icon uses only the configured free link.
- Premium paid fulfilment remains separate and continues to use `Premium Download File Link` / Cloudflare R2 after payment.
- Removed the old Software Tools Liyabudun trial-icon hard-code so the free icon no longer silently falls back to the obsolete 1.0.51 path.
- Updated the separate Liyabudun landing-page/backend fallback URL from 1.0.51 to the current 1.0.59 release shown in Admin, preventing stale 404 links outside the Software Tools card.
- Liyabudun card version now uses the stored item version instead of a hard-coded v1.0.51 label.
- `freeDownloadFileLink` is loaded into the editor, saved to Firestore payloads, and retained in JSON export/import normalization.
- Existing records remain backward compatible.
- Global cache/version badge updated to v1471.

## Expected behavior
- Free item: `Download Now` -> Free Download File Link.
- Premium item with trial/free link: download icon -> Free Download File Link.
- Premium purchase: Buy Now/payment -> paid fulfilment -> Premium Download File Link or R2.

No changes to pricing, payment gateways, licences, Pin Order, PA/BM, or v1470 Upgrade Parts layout.
