# AZOBSS Patch 864 — Anime & Manga Filter Key Fix

- Fixes `/Sound-Effects/` Anime & Manga showing `0 sounds`.
- Root cause: catalog normalization converts `Anime & Manga` to `anime-and-manga`, while the filter button used `anime-manga`.
- Button now uses `data-filter="anime-and-manga"`.
- `applyFilter()` also accepts legacy `anime-manga` as an alias for backward compatibility.
- Verified against `catalog-7210.json`: 742 built-in sounds are tagged `Anime & Manga`.
- All 7,210 catalog entries, native MP3 play button, single-play, search, other filters, share/copy, forced MP3 download, and admin-only custom sound management remain unchanged.
