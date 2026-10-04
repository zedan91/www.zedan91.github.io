# AZOBSS Patch 1080 — Makan Malaysia Direct Zoom + Home Navbar Exact Sync

Baseline: v1079

## Navbar
- Makan Malaysia now uses the exact Home `market-sticky-bar` markup.
- Same Home user tools, Bookmarks, Cart, Notifications and Chat icons are present.
- Same `azobss-more-nav.js` logic is retained; Makan Malaysia stays highlighted under More.
- The Home logo path is normalized to `/images/logo-azobss.jpg` for the subfolder.

## Google Maps
- Adds Google Maps JavaScript API direct-map mode with `gestureHandling: greedy` and mouse-wheel zoom.
- Normal mouse wheel can zoom the map without Ctrl when the Maps JavaScript API loads successfully.
- Uses Google Places text search to show live food pins and clickable Google result popups.
- Existing Google Maps iframe remains as an automatic fallback if the Maps JavaScript API / Places API is unavailable or denied.
- Google Maps links and Directions remain unchanged.

### Google Cloud requirement
For direct zoom mode, the AZOBSS Google Cloud project must have **Maps JavaScript API** and **Places API** enabled for the browser key. Restrict the browser key by HTTP referrer to `azobss.com/*` and `www.azobss.com/*`. If those APIs are not enabled, the page safely falls back to the iframe, where Google requires Ctrl/Cmd + scroll.

Package version: `1.0.1080`
