# AZOBSS Patch v1008 — Anime Right-Side Episodes + Fixed Player Layout

Changes requested:

1. Remove the bottom Anime detail card
- `Back to Anime`, `Source Page`, poster/meta detail card and its extra empty space
  are no longer rendered below the Anime browser.
- Clicking an Anime now selects Episode 1 immediately and keeps the normal Anime
  grid/search visible.

2. Move the useful description into Source Player
- Source Player fallback now shows the selected Anime title, year, episode count,
  available genres and the Source Player explanation inside the player panel.

3. Episodes stays below Channels
- The Episodes card is never moved below the entire hero anymore.
- In Anime Source Player/compact mode it lives directly below Channels in the
  right column.
- Channels and Episodes each use internal scrolling when there are many rows.

4. Fix Live TV/player card stretching
- The root cause was `.hero-grid { align-items: stretch }`.
- A long Channels list could stretch the entire grid row and therefore stretch
  the left player card, leaving a large blank area under NOW PLAYING.
- v1008 uses natural player-card height (`align-items: start`).
- JavaScript then caps the right side to exactly the player-card height.
- Long Channels / Schedule lists scroll inside fixed-size cards instead of
  enlarging the player/page.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed.
