# AZOBSS v1286

Homepage Banner Manager drag/resize interaction fix.

- Fixes the root cause in v1285: the full-screen admin modal was above the homepage and intercepted pointer input, so the banner behind it could not be dragged or resized.
- Admin panel is now a docked non-blocking panel on the right. The homepage remains directly interactive while the panel is open.
- Banner drag works directly on the banner.
- Yellow bottom-right handle resizes the selected banner.
- Disables native browser link/image drag while editing.
- Uses non-passive pointer move during an active edit gesture.
- Keeps numeric X/Y/Width/Height controls and Firestore save flow.
- Adds Administrator role recognition in addition to admin.
- Existing v1285 Firestore rules remain compatible.
