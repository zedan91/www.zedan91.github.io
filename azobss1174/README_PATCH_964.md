# AZOBSS Patch 964

## AZOBSSTV channel bootstrap + stickybar More placement

- Fixed the empty AZOBSSTV Free view by shipping two legal developer/test HLS verification channels in both the backend `free.m3u` and a same-origin frontend fallback playlist.
- The frontend falls back to `/AZOBSSTV/data/free.m3u` only when the default AZOBSSTV Free backend playlist returns zero channels; custom user playlists are never replaced by the demo list.
- Bundled verification streams: Mux Big Buck Bunny test HLS and Apple Developer Bip Bop HLS example. These are test/demo sources, not rebroadcast TV channels.
- Fresh default config includes the two test-stream domains; exact bundled demo URLs are also trusted client-side so an older deployed Remote Config cannot make the bootstrap channels disappear.
- Moved the public `AZOBSSTV` stickybar item into the existing `More` dropdown. The standalone AZOBSSTV chip is removed from existing sticky navigation HTML to prevent a flash before JavaScript initializes.
- `More` is marked active while browsing `/AZOBSSTV/`, and its AZOBSSTV menu item receives the active state.
- Existing PA/BM, JUPEM, payment, CAD converter, Repair PC dropdown and authentication logic are unchanged.

## Deployment note

- Redeploy the Render backend to make `/api/azobsstv/playlist/free` serve the bundled verification channels.
- Even before the backend redeploy, the website has a same-origin fallback so the default AZOBSSTV page can still show the two verification channels.
