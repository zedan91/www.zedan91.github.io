# AZOBSS v1089 — Navbar Logo First-Paint Size Lock

Baseline: v1088.

## Fix
- Fixed the AZOBSS home-link logo briefly blinking / growing during page load.
- The logo geometry is now locked before first paint, so later page CSS or global navbar JavaScript cannot resize it after it is already visible.
- Desktop logo size is fixed at `154 × 38 px`.
- Tablet / compact width (`<= 980px`) is fixed at `132 × 34 px`.
- Mobile (`<= 560px`) is fixed at `120 × 32 px`.
- The logo image now uses `object-fit: contain` from the first paint, matching the final global navbar state.
- Logo `transform`, `animation`, and `transition` are disabled to prevent accidental visual scaling.
- Applied to every HTML page in the package that uses the shared `market-brand` AZOBSS home logo.
- Shared stickybar CSS was also guarded with the same geometry for future consistency.

No changes to authentication, PA/BM, payments, lot processing, cart, pricing, backend, or other website logic.

Package version: `1.0.1089`
