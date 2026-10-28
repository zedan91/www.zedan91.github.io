# AZOBSS v1223 — Firefox Long Session Stability Fix

Baseline: v1222.

Changes:
- Adds `/assets/js/azobss-long-session-stability.js` to all shipped HTML pages.
- AZOBSS repeating timers are visibility-aware and high-frequency DOM polling is throttled while the page is idle.
- Background tabs stop running AZOBSS interval callbacks until visible again.
- Long Firefox resume triggers a safe soft-recovery (resize/focus events + Firebase token refresh when available).
- Adds conservative orphan-overlay recovery for hidden/inactive full-screen modals that can intercept all clicks.
- Adds semantic `[hidden]` / closed modal pointer-event guards.
- Debounces repeated full-body country phone selector observers in both auth modules.
- Debounces common global modal/icon and floating action MutationObservers.
- No automatic page reload, so cart/form state is preserved.

Package version: 1.0.1223
