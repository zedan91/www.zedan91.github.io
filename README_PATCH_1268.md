# AZOBSS v1268 — Lot Kadaster Auth Hydration Wait Fix

## Problem diagnosed
The map itself opens in v1267, but `Sediakan & Tambah ke Troli` can show `Sesi log masuk tidak tersedia. Sila log masuk semula.` even while the navbar shows the user logged in.

The classic map bridge performed only a one-shot token lookup. On `/PA-BM/`, the saved AZOBSS profile/header can be restored before Firebase Auth has finished hydrating `auth.currentUser`. If the storefront token bridge is not ready at that exact moment, the map receives an empty token and reports a false logout.

## Fix
- `azobss-global-auth.js` now exposes a secure `azobssWaitForFirebaseAuthToken()` helper that waits on Firebase `onAuthStateChanged` instead of doing a one-shot `auth.currentUser` check.
- `azobss-pabm-early-bridge.js` waits up to 10 seconds for that authoritative Firebase token bridge.
- It first prefers `window.azobssGetPaBmAuthToken()` (the storefront helper, which itself waits for `onAuthStateChanged`).
- It then retries `window.azobssGetFirebaseAuthHeaders()` and performs a forced-token refresh attempt when available.
- It polls independently of module load order instead of returning an empty token immediately.
- The Lot Kadaster map remains a classic fallback and does not require a second Firebase app or insecure saved-login token.
- If Firebase really cannot restore the authenticated session after the wait, the existing secure login error is still shown.
- Cart, checkout, server cart persistence, state picker, and backend logic from v1267 are otherwise unchanged.

Package version: 1.0.1268
