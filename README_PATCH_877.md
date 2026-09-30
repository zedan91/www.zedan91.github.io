# AZOBSS Patch 877 — Sound Effects Remaining-Time Countdown

Baseline: (876)-AZOBSS-SOUND-EFFECTS-DURATION-ICON-ONLY-PLAYER-FIX_20260810.zip

Changes in `/Sound-Effects/`:
- The duration label now becomes a live remaining-time countdown while a sound is playing.
- Example: `0:12 → 0:11 → 0:10 → ... → 0:00`.
- The countdown uses the shared single `Audio()` player, so only the active card is updated.
- When playback is stopped, finishes, errors, or another sound starts, the previous card returns to its full cached duration.
- Existing lazy metadata loading and duration localStorage cache remain unchanged.
- No Render/backend or Firestore rules change is required for this patch.
