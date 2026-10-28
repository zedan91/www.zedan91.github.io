# AZOBSS Patch v1001 — Anime All Episodes + Auto Focus

Changes:
- The docked `Episodes` panel now renders the COMPLETE episode list.
- The old moving 24-episode window has been removed.
- The Episodes panel no longer has an internal vertical scrollbar or max-height.
- All episodes appear directly on the AZOBSSTV page in numerical order.
- Clicking any episode:
  1. updates NOW PLAYING,
  2. highlights that episode,
  3. automatically scrolls the page back to the player area,
  4. briefly highlights the player card so the destination is obvious.
- Sticky-bar height is measured dynamically, so the player is not hidden under
  the fixed AZOBSS navigation bar.
- English-only UI is retained.

Deployment:
- Frontend only.
- No Render backend redeployment required.
