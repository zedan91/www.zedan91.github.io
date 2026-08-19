# AZOBSS Patch 982 — AZOBSSTV Mana-Mana Guide Mirror / Overlap Fix

- Deep audit found no duplicate schedule functions in `AZOBSSTV/assets/azobsstv.js` and no duplicate backend handler functions. The issue was not a JavaScript function collision.
- The bundled Mana-Mana channel UI now has one primary data path: the already-working public `mana2.my/channel/...` page itself.
- The current-program title and Today's Schedule are shown by two clipped, non-autoplay provider iframes. AZOBSSTV does not read cross-origin DOM or bypass provider controls; it only displays the public regions already visible on Mana-Mana.
- This removes the race between the 2024-era Revlet guide definition, HTML/Next.js parsing, and the 2026 Mana-Mana platform.
- Legacy `/api/azobsstv/mana2/schedule` remains for compatibility but is no longer required for bundled official Mana-Mana UI.
- Legacy Revlet fallback is hardened: POST-first token request, GET retry when no sessionId, published UTC-style timezone hint, and known channel IDs no longer depend on the channel-catalog request.
- Cache/service worker/app/package version: 982.
