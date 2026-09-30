# AZOBSS Patch 874 — Per-Sound Deep Link / Copy Link Fix

- Based on Patch 873.
- Fixes the per-card `Copy sound link` and `Share sound` actions so they create a dedicated AZOBSS deep link using `?sound=<catalog-id>` instead of a page hash.
- Example format: `/Sound-Effects/?sound=vine-boom-sound-70972`.
- Opening a per-sound deep link now filters the catalog to the exact referenced sound only, instead of opening the normal full sound catalog with the card merely prioritised.
- The sound ID comes from the stable catalog/original ID and is URL-encoded, so built-in, Recently Added and custom sounds can all use the same link format.
- If the deep-linked sound belongs to Recently Added, the page can resolve it after Recent data finishes loading.
- Clicking a category filter or typing in Search exits the one-sound deep-link view and returns to normal catalog browsing without reloading the page.
- Existing old `#sound-...` hash links are retained as a legacy fallback and continue to prioritise/scroll to a card.
- Page-level `Copy link` and `Share page` still copy/share the normal `/Sound-Effects/` page URL.
- Patch 873 admin auto-update, Patch 872 Unicode-safe MP3 downloads/full titles, multi-select downloads, robust infinite scroll, compact layout, single-play and category repair are retained.
- Frontend-only patch; no Render backend redeploy is required when the Patch 872+ backend is already deployed.
