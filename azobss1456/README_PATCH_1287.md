# AZOBSS v1287

Homepage managed banner first-load size flash fix.

- Managed banners are cloaked until Firestore `homeBanners` settings finish loading.
- The saved X/Y/width/height are applied before the banner becomes visible.
- Prevents the legacy/default 455x103 banner from appearing first and then jumping to the admin-saved size.
- If Firestore cannot be read, the built-in fallback banner is revealed after the read attempt completes.
- No fade/size transition is added; reveal is static.
- v1286 admin drag/resize behavior remains unchanged.
