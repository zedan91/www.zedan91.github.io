# AZOBSS Patch 1085 — AZOBSSTV Fast Artwork + Makan Malaysia Maps Fallback

Baseline: 1084.

## AZOBSSTV
- Anime and Radio now use progressive catalogue rendering instead of creating every card at once.
- Anime initial render: 48 cards; Radio: 56 cards; more cards append automatically near the bottom and via Load more.
- Right-side rail is capped for Anime/Radio so 2,500+ DOM nodes are no longer created at once.
- First visible artwork uses eager/high-priority loading.
- Radio always paints bundled local SVG/PNG artwork before any provider artwork.
- Provider artwork upgrades are viewport + idle-time only so they do not compete with first paint.
- Anime fallback SVG artwork is generated only for cards actually rendered, not for all 2,524 catalogue rows during JSON parsing.
- AZOBSSTV cache/service-worker/app asset version bumped to 1085.

## Makan Malaysia
- Added Google Maps `gm_authFailure` handling.
- The direct JavaScript map remains hidden until Places returns successfully, preventing the `Sorry! Something went wrong` panel from flashing.
- If Maps JavaScript API / Places / billing / key restrictions reject the request, the normal Google Maps embed becomes the clean fallback automatically.
- Direct scroll zoom remains enabled whenever the JavaScript API is authorised.

## Unchanged
- Google Sign-In v1084 flow is untouched.
- No Firestore Rules changes required for this patch.
- No PA/BM, payment, pricing, or backend logic changes.

Package version: 1.0.1085
- Live Radio refresh now preserves a previously loaded bundled station icon by slug instead of replacing it with a slower remote logo.
