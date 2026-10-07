# AZOBSS v1253 — PA/BM Table Add-to-Cart Hard Fix

- Fixes PA **Carian Umum** blue cart buttons that could react but leave **Troli Anda** at `0 item`.
- The storefront capture handler now owns both **add** and **remove** for PA/GPS/BM/SBM/Syit result-table cart buttons, instead of depending on separate search-module bubbling handlers for the first add.
- Cart owner identity is stable while Firebase Auth restores: saved AZOBSS user identity is preferred before transient `auth.currentUser`, preventing an item from being written under one localStorage key and immediately rendered from another.
- Local Add to Cart accepts an already-saved AZOBSS login while Firebase Auth is hydrating; checkout still requires the proper Firebase session/token.
- Keeps v1252 state selection highlight, v1251 all-state button grid, and v1250 failed/cancelled-payment-stays-in-cart behavior.
- PA/BM script cache-busters bumped to `v=1253`; package version `1.0.1253`.
