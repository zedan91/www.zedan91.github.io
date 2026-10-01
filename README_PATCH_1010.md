# AZOBSS Patch v1010 — Blocked Anime Play Stays in AZOBSSTV

Problem:
- In v1009, pressing the large center Play button on a source that blocks iframe
  playback navigated the current browser tab to the 123animehub episode page.
- This looked like a normal Live TV play button, so the navigation was unexpected.

Fix:
- The large center Play button NEVER navigates away from AZOBSSTV when the source
  blocks in-page playback.
- Pressing it keeps the user on AZOBSSTV and shows an inline explanation.
- The top action is renamed to `Open Source` and is now the only explicit action
  that opens the original provider page.
- If the resolver finds a genuine embeddable HTML player for another episode,
  that episode still plays inside AZOBSSTV normally.
- The Live-TV-style 16:9 fallback layout, Channels panel and Episodes panel remain.

Important:
- This does not bypass X-Frame-Options/CSP. If the provider blocks framing,
  AZOBSSTV cannot force the real video into its iframe.

Deployment:
- Frontend only.
- Render backend does not need redeployment.
