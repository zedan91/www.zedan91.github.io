# AZOBSS v1285 — Admin Homepage Banner Manager

## New
- Homepage banners are now manageable by Administrator only.
- Admin gets a small `⚙ Banner` control on the homepage.
- Add multiple banners by uploading an image.
- Every banner has its own destination link. It can point to an internal AZOBSS page such as `/Software-Tools/` or to an external `https://...` URL.
- Admin can drag a banner to move it and use the yellow bottom-right handle to resize it on desktop.
- Position and size can also be entered manually using X, Y, width and height fields.
- Each banner can be shown/hidden, opened in a new tab, and configured to avoid the centered social icons.
- Mobile automatically stacks banners so they do not overlap the social icons or each other.
- The existing Exabytes banner remains as the built-in fallback and can be edited/saved into Firestore.

## Persistence / security
- Banner records use Firestore collection `homeBanners`.
- Public visitors can read enabled banner data; only Administrator can create/update/delete banner documents.
- Uploaded images are kept small before saving. Normal small images are preserved; larger images are compressed to WebP.
- The package includes the merged production rules file:
  `FIREBASE-RULES-AZOBSS-v1285-HOME-BANNER-ADMIN-MANAGER.txt`.
- Firebase Rules must be deployed once for admin save/delete to work globally. Website deployment alone cannot deploy Firestore rules.

## Baseline retained
- v1284 center safe-zone behavior is retained and generalized to every managed banner.
- v1283 centered/static social icons remain unchanged.
- Full website package.
