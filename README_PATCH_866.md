# Patch 866 - Sound Effects Infinite Scroll Only

- Baseline: (865)-AZOBSS-SOUND-EFFECTS-COMPACT-GRID-HERO-FIX_20260809.zip
- Removed the visible `Load more sounds` button from `/Sound-Effects/`.
- The catalog now relies only on automatic infinite scrolling: when the bottom sentinel approaches the viewport, the next batch is rendered automatically.
- The fallback scroll listener remains for browsers without `IntersectionObserver` support.
- `Showing X of 7,210` status remains visible for progress reference.
- Compact grid, 7,210 catalog, filters/search, native single-play MP3 playback, Share/Copy Link, forced MP3 download, and admin-only Add Sound are unchanged.
