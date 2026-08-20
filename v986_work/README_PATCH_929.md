# AZOBSS Patch 929 — Tempah Servis IT Social Preview

- Based on patch 928.
- Adds page-specific Open Graph and Twitter Card metadata to `/Tempah-Servis-IT/`.
- Uses the supplied AZOBSS Repair PC / Tempah Servis IT poster as the page social preview image.
- Social image URL: `/assets/img/tempah-servis-it/tempah-servis-it-social-preview-v929.png`.
- Adds canonical URL, `og:title`, `og:description`, `og:url`, `og:image`, image dimensions/type/alt, and Twitter large-card equivalents.
- Intended for WhatsApp, Facebook, Telegram, X and other link-preview clients that read Open Graph/Twitter metadata.
- Existing service booking UI, pricing, forms and backend behavior are unchanged.

Note: social platforms may cache an older preview. The versioned `-v929` image filename helps force a new image fetch after deployment.
