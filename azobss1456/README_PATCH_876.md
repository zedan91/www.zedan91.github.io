# AZOBSS Patch 876 — Sound Duration + Icon-Only Player

Date: 2026-08-10
Baseline: (875)-AZOBSS-SOUND-EFFECTS-LOW-QUOTA-FAVORITES-FIX_20260810.zip

## Changes
- Sound Effects play button no longer shows the PLAY / STOP words; only the ▶ / ■ symbol is shown.
- Each rendered sound card now shows the audio duration inside the play button, e.g. `0:03`, `0:42`, `1:05`.
- Duration is loaded from MP3 metadata only for cards that are actually rendered by the existing infinite-scroll batches; the full 7,000+ catalog is not probed at once.
- Metadata probing is limited to 6 concurrent audio probes to avoid a request burst.
- Loaded durations are cached in browser localStorage (`azobss_sound_duration_cache_v876`) so revisiting/re-rendering known sounds avoids repeated duration metadata loads.
- If metadata cannot be read, the duration shows `--:--` while all Play/Share/Copy/Download/Favorite functions remain available.
- Existing Favorites, per-sound deep links, admin auto-update, multi-select download, full titles, Unicode-safe download, and robust infinite scroll are preserved.

## Deployment
Frontend-only patch. No Render backend redeploy and no Firestore Rules change are required solely for this duration/player UI change.
