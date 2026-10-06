# AZOBSS Patch 856

Sound Effects catalog expansion and infinite-scroll loading.

- Catalog: 81 sounds (was 24).
- Initial render: 24 sounds.
- Automatically loads 24 more as user scrolls near the bottom; manual Load More button also available.
- Added Games, Reactions, TikTok Trends, and Anime catalog entries using official MyInstants embed URLs.
- Search/filter works across the complete catalog, not only the first 24.
- Iframes are lazy: hidden sounds do not load until revealed, reducing page weight.
- Download remains direct for entries with known official MP3 URL; other entries open the official sound page for its Download MP3 action, while local format conversion remains available after selecting the downloaded MP3.
