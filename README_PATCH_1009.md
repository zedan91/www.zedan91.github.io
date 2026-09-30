# AZOBSS Patch v1009 — Anime Live-TV-Style Same-Tab Fallback

Requested:
- Blocked Anime episodes should look like the Live TV display.
- Do not open another browser tab/window.

Changes:
- A blocked Anime source now stays as a normal 16:9 player-sized display.
- Poster/backdrop, large Play button, Anime title, episode and metadata are shown
  inside the player area instead of the compact Source Player text box.
- Channels + Episodes remain on the right and scroll internally within a fixed
  player-height column.
- The old reusable popup/tab Source Player behavior is removed.
- `Watch Source` and the large center Play button open the original public episode
  in the CURRENT browser tab, not a new tab.
- Browser Back returns to AZOBSSTV.
- If the backend finds a genuine embeddable HTML player, it still plays directly
  inside AZOBSSTV as before.

Important limitation:
- This patch does not strip or bypass X-Frame-Options/CSP.
- A provider that explicitly blocks framing cannot be forced to play inside the
  AZOBSSTV iframe. For those episodes, same-tab source navigation is the compliant
  fallback.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed.
