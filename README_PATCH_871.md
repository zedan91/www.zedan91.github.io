# PATCH 871 — Sound Effects Multi-Select Download

Baseline: `(870)-AZOBSS-SOUND-EFFECTS-ULTRA-COMPACT-ICON-ACTIONS-FIX_20260809.zip`

## Changes
- Adds a compact checkbox to every Sound Effects card.
- Selected cards stay selected while scrolling, filtering, searching, and while more cards are rendered by infinite scroll.
- A floating bulk toolbar appears only when at least one sound is selected.
- Toolbar actions: `Select Shown`, `Clear`, and `Download`.
- `Download` queues the selected MP3 files through the existing AZOBSS `/api/sound-effects/download` gateway, one file at a time.
- Bulk progress is shown while downloads are started.
- Browser may request permission for multiple automatic downloads; no backend change is required from baseline 868/869/870.
- Existing compact grid, icon-only per-card actions, robust infinite scroll, single-play, Recent Update Sounds, category repair, search/filter, Share, Copy Link and individual MP3 download are preserved.

## Notes
- `Select Shown` selects only cards currently rendered on screen/in the DOM, not all matching results. This prevents accidental download of hundreds/thousands of files.
- Selection is kept in memory for the current page session and is not persisted after refresh.
