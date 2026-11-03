# AZOBSS v1507 — PC Build Image Zoom Close Fix

Frontend-only patch based on v1506.

- Fixes the PC Build / Hardware Shop product image lightbox close button after image zoom.
- Close button is captured by the viewer overlay itself and remains above the zoomed image.
- Pointer/touch close, keyboard activation, Escape, and backdrop click are supported.
- Zoom state is cleared before closing and focus is restored to the originating product image button.
- Cache-busters for PC Shop CSS/JS are bumped to v1507.
- No backend behavior, pricing, checkout, local-image mapping, G1/G2 catalog logic, or Firebase behavior is changed.
- Render backend redeploy is not required for this frontend-only patch.
