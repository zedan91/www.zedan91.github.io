# AZOBSS Patch v999 — AZOBSSTV Channels Rail Player-Bottom Align Fix

Issue:
- In Anime compact/blocked mode the right `Channels` panel could use its
  natural content height and become very long because the Anime catalogue
  contains many items.
- The user wants the Channels panel to stop at the same bottom edge as the
  display/player card on the left.

Fix:
- AZOBSSTV now measures the current `.player-card` height and exposes it as
  `--az-player-card-height`.
- While Anime compact mode is active, `.channel-rail` uses exactly that height.
- The channel list scrolls inside the Channels panel instead of extending the
  page downward.
- The Episodes panel remains a separate card below Channels.
- Normal Live TV / regular hero height synchronization is unchanged.
- Mobile keeps a practical 280px Channels cap.

Language:
- English-only AZOBSSTV UI from v996 is retained.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed.
