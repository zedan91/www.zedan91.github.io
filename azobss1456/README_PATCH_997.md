# AZOBSS Patch v997 — AZOBSSTV Anime Embed-Blocked Compact Panel

Problem:
- When AnimeNana blocks iframe embedding through X-Frame-Options/CSP, AZOBSSTV
  previously kept the full 16:9 black player area even though no video could be shown.

Fix:
- Anime episode player starts in a compact "checking" layout.
- If embedding is allowed, AZOBSSTV automatically restores the normal 16:9 player.
- If embedding is blocked, the player stays compact:
  - episode title/status remains visible,
  - Open Source and Close buttons remain available,
  - a short blocked-embed message is shown,
  - the large empty black player area is removed.
- Now Playing, Episodes rail, Anime detail, Favorites/Recent, Live TV and EPG are unchanged.

Language:
- All new AZOBSSTV UI remains English, consistent with v996.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed.
