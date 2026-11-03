AZOBSS v1509 - PC BUILD/HARDWARE PHOTO EDITOR: SAVE & AUTO-PUBLISH TO GITHUB
=============================================================================
Base: v1508. Changes are limited to PC-Build editor/viewer, backend secured
publication API, the PC-Build page's versioned imports and global version badge.

IMPORTANT: MERGE PATCH is recommended on top of the CURRENT LIVE GitHub repo.
Do NOT delete PC-Build/images/products/ -- the user has already vendored real
hardware images in the GitHub repository. A full ZIP baseline could predate
those GitHub Actions image commits.

FEATURE
- Administrator opens product/build image -> Edit Gambar -> edit ->
  "Simpan & Terbitkan (WebP)".
- Image is exported to WebP in the browser and submitted to the Render backend.
- Backend checks a VERIFIED Firebase ID token against its trusted admin allowlist.
  Browser ADMIN_KEY and any mere UI role flag do NOT authorize GitHub publishing.
- Server checks MIME/actual decoded image, max 7MB input, 8MP / 3200px bounds.
- Backend converts to optimized WebP, creates/overwrites a stable path in:
  PC-Build/images/products/admin-edit-<productId>.webp
- Exactly ONE GitHub commit updates the image file, the relevant local image
  map (byId and byName), and PC-Build/index.html map cache-buster. Hardware:
  local-hardware-map-v1505.js; PC Builds: local-image-map-v1502.js.
- After the GitHub Pages deployment, the exact local asset is what visitors see.
- This works for previously external image sources; the stable product ID is
  carried from the G1/G2 cards. Manual download remains an alternative.
- Only the existing AZOBSS repo and branch configured by the server are touched.

ONE-TIME SETUP (REQUIRED; THE USER MUST DO THIS IN THEIR ACCOUNT)
1) GitHub -> Settings -> Developer settings -> Personal access tokens ->
   Fine-grained tokens -> Generate new token.
   Resource owner: zedan91; Repository access: ONLY www.zedan91.github.io.
   Repository permissions: Contents -> Read and write.
   Metadata read is automatic. Do not enable unnecessary permissions.
   Use a suitable expiration/rotation policy and copy the token securely.
2) Render -> azobss-backend -> Environment -> Add Environment Variable:
   AZOBSS_GITHUB_TOKEN = [secret fine-grained PAT]
   AZOBSS_GITHUB_REPO = zedan91/www.zedan91.github.io
   AZOBSS_GITHUB_BRANCH = main
   Save & deploy. Keep this secret ONLY on Render; never in GitHub source,
   .env committed to Git, website JavaScript, screenshot, or ChatGPT.
3) Deploy the v1509 merge patch to the repository root. Render backend MUST
   redeploy for v1509 because the secured API is new.
4) Login as AZOBSS Administrator -> /PC-Build/ -> open hardware photo ->
   Edit Gambar -> crop/edit -> Simpan & Terbitkan (WebP) -> confirm.
   A commit link and saved asset path will appear on success.
5) GitHub Pages will build/publish asynchronously. Reload /PC-Build/ after the
   GitHub Pages deployment succeeds. Chrome may need Ctrl+F5.

SECURITY / SAFETY
- No Github token in static frontend.
- No anonymous, staff, manager, or ADMIN_KEY-only GitHub writes.
- User explicitly confirms each publish (not silently auto-publishing).
- GitHub errors are reported without the credential.
- Only fixed PC-Build/images/products/admin-edit-<id>.webp paths; no arbitrary
  directory writes and no uploading directly to the Render filesystem.
- A failed operation does not switch the live map to an unpublished image.
- If a protected branch rejects direct commits, allow relevant service access
  or use a different reviewed publication workflow.
- A Render auto-deploy can be triggered by the GitHub commit if enabled.

REGRESSION
- npm run verify => 378/378 passes; includes mocked GitHub API commit test.
- Actual live GitHub write REQUIRES configuring AZOBSS_GITHUB_TOKEN and
  cannot be confirmed from a local test without the user's secret.
