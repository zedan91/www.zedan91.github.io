# AZOBSS Patch 931 — Social Preview Crawler Compatibility Fix

- Rebuilds social previews for 8 public pages as 1200×630 progressive JPEG files.
- Uses short static URLs under `/social-preview/` and new v931 filenames to avoid stale image cache.
- Moves Open Graph/Twitter metadata to the beginning of `<head>` and removes duplicate social tags.
- Adds `og:image:url`, `og:image:secure_url`, `link rel=image_src`, and schema `itemprop=image` fallbacks.
- Keeps canonical URL and page UI/logic unchanged.
- Includes `/Tempah-Servis-IT/` as well as the seven v930 pages.

If WhatsApp/Facebook has already cached a page URL without a preview, the platform may still require a recrawl or a short cache expiry period. The new image URL itself is versioned to v931.
