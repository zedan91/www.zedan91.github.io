AZOBSS PC SHOP PHOTO EDITOR v1508 (FRONTEND ONLY)
================================================
Base: v1507 full website. No backend or package version update required.

WHAT IS NEW
- In /PC-Build/, Administrator can click a product/build picture and select
  'Edit Gambar' in the full-size image viewer.
- Tools: crop (free, 1:1, 4:3, 16:9, 3:4), brush, eraser, text,
  rectangle, ellipse, line, 90-degree rotate, H/V flip, brightness,
  contrast, saturation, grayscale, zoom preview, undo/redo/reset,
  import another local picture, export WebP/PNG/JPEG.
- Works in Chromium desktop and responsive mobile display.
- Original picture remains untouched until an administrator explicitly
  publishes a downloaded edited asset to GitHub.
- This is an ADMINISTRATOR-only editor UI; it does not grant access to
  unauthenticated visitors, staff, managers, or ordinary users.

IMPORTANT: PUBLISHING TO THE LIVE WEBSITE
- The current frontend is hosted on GitHub Pages (static assets). The
  editor does NOT upload arbitrary image files or write to GitHub or Render.
- Click 'Muat Turun Gambar Siap', and choose the format matching the old
  asset. Replace the exact file in the repository at the path shown in the
  editor's sidebar. Keep the original filename AND extension for existing
  image-map references to continue working.
- Commit to the GitHub Pages branch, then reload /PC-Build/ with Ctrl+F5.
- Downloading locally does NOT automatically change the image for customers.
- Do not add browser-side GitHub tokens; publishing should remain an
  authenticated/reviewable repository action.

INSTALL
- FULL: extract the full website ZIP to repository root, then commit frontend.
- MERGE PATCH: extract/overwrite patch contents into current v1507 repository.
- This patch includes a README, frontend CSS/JS, PC-Build/index.html and tests.
- Render backend does not need a NEW deployment for this frontend feature;
  Render can still auto-deploy if configured to rebuild on every repository push.
- DO NOT delete any existing PC-Build/images/products/ files.

TESTS
- npm run verify => 376/376 pass
- Browser smoke test => crop, undo, rotate, drawing, text, reset after
  history limit, export WebP; desktop and mobile, no JS errors.
