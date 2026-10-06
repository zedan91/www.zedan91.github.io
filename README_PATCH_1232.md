# AZOBSS Patch 1232 — Homepage Software Promo Banner Visibility Fix

Built from v1231.

## Fix
- Homepage `SOFTWARE PROMO` card no longer looks like its artwork has disappeared.
- Promo artwork is rendered brighter with a lighter bottom overlay.
- Wide banner artwork uses `cover`; square/logo artwork uses `contain` so the important graphic is not cropped away.
- Broken/stale promo image URLs automatically fall through through the product image, logo/GIF fields, local logo path and finally AZOBSS favicon.
- `blob:` image URLs are ignored because they cannot survive across browser sessions.
- Existing promo title, price, animation, click target and carousel behavior are preserved.
