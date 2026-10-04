# AZOBSS Patch v998 — AZOBSSTV Anime Compact Hero Height Fix

Remaining issue in v997:
- The blocked Anime panel itself became compact, but `.hero-grid` still used
  `align-items: stretch`.
- The right Channels + Episodes rail therefore determined the grid row height,
  stretching the left `.player-card` and leaving a large empty area below
  Now Playing.
- `syncHeroSideHeight()` could also keep both columns tied to the same height.

Fix v998:
- Compact Anime checking/blocked mode adds `.anime-compact-hero` to the hero grid.
- In this mode the grid uses `align-items: start`.
- The left player card uses its natural content height.
- Hero-side height synchronization is disabled only in compact Anime mode.
- Channels and Episodes on the right retain their natural independent height.
- When a source is embeddable or the Anime player closes, normal Live TV/16:9
  height synchronization is restored automatically.

Deployment:
- Frontend only.
- No Render backend redeployment required.
