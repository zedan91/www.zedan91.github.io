# AZOBSS Patch 1034 — Movies Category / TMDB Genre Name Fix

Package/app version: 1.0.1034
Date: 2026-08-22

## Change
- Fixes the AZOBSSTV Movies category dropdown that exposed raw TMDB genre IDs such as `12`, `14`, `16`, `18`, `27`, `28`, `35`, `53`, `80`, `99`, `878`, `9648`, `10402`, `10749`, `10751`, `10752`, and `10770`.
- Adds the standard TMDB movie-genre mapping so those IDs are shown as readable labels such as Adventure, Fantasy, Animation, Drama, Horror, Action, Comedy, Thriller, Crime, Documentary, Science Fiction, Mystery, Music, Romance, Family, War, and TV Movie.
- Removes non-genre provider/group labels such as `1Tube` and `Movies` from the Movies category filter.
- Movies dropdown heading now reads `All movie genres` instead of the generic `All categories`.
- Frontend normalizes responses from an older Render backend too, so the visible dropdown is fixed immediately after deploying the static site.
- Backend 1Tube metadata normalizer now emits readable genre names directly and no longer injects `Movies` / `1Tube` into `categories`.
- Live TV, Anime, Radio, Favorites, Recent, playback and search behavior are unchanged.
- AZOBSSTV cache/service-worker/app/package version bumped to 1034.

## Deployment
Frontend deployment fixes the visible dropdown immediately. Render backend redeploy is recommended so future 1Tube API responses are clean at the source.
