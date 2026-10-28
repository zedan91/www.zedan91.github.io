# AZOBSS Patch v1000 — AZOBSSTV Anime Episodes Below Hero / No Blank Gap

Issue visible after v999:
- Channels was correctly capped to the player-card bottom.
- However, the Episodes card still remained under Channels inside the right hero column.
- CSS Grid therefore used the total height of Channels + Episodes as the hero row height,
  leaving a large empty area under the compact player / NOW PLAYING card.

Fix v1000:
- In Anime compact/checking/blocked mode:
  1. Channels remains in the right column and stays aligned exactly with the player bottom.
  2. Episodes is automatically moved below the entire hero row.
  3. The browser/Anime section follows directly after the Episodes card.
- The docked Episodes card uses:
  - 4 columns on desktop,
  - 2 columns on medium screens,
  - 1 column on mobile,
  - internal vertical scrolling when needed.
- When Anime embedding is allowed, or the Anime player closes, Episodes is moved back
  to the normal right-side card automatically.
- Live TV layout is unchanged.
- English-only AZOBSSTV UI from v996 is retained.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed.
