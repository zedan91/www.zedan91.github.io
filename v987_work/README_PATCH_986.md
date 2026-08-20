# AZOBSS Patch 986 — AZOBSSTV Structured Schedule Title-Only Fix

- Baseline: v985.
- Fixes Today's Schedule entries that still contained programme synopsis/description text inside `title`.
- The backend headless Chromium extractor now reads rendered Mana-Mana schedule rows structurally from DOM elements and prefers the visually-bold programme-title element instead of flattening the whole row with `innerText`.
- The old flattened-text parser remains only as a fallback.
- Revlet structured fallback no longer returns a `description` property.
- Frontend still renders only `start`, `end`, and `title`.
- Existing signed-in-only Favorites/Recent and Home stickybar from v984/v985 are unchanged.

Package version: `1.0.986`
