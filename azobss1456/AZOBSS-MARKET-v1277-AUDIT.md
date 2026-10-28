# AZOBSS Market v1277

## Changes
- Extra-slim `Buy & Sell New or Pre-Owned` hero to reduce vertical space.
- Desktop description is forced to one line with ellipsis; on very small screens it is hidden.
- Firefox-safe image pipeline: preserves the original image data when it fits the Firestore budget, avoiding Canvas entirely for common uploads.
- Large images use `createImageBitmap` when available, asynchronous `canvas.toBlob()` JPEG encoding, a white transparency flattening layer, and a readback flush before encoding.
- Increased per-image/combined image budgets while remaining below the Firestore document size ceiling.
- Transparent image stages use a neutral/light background instead of appearing as a black empty panel.

## Verification
- `npm test`: 45/45 passed.
- Extracted Marketplace ES module: `node --check` passed.
- `npm run check`: passed.
