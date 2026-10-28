# AZOBSS Patch 1261 — Single Checkout Owner / Legacy Payment Handler Fix

## Root cause found
The live screenshot showed the checkout button text **`Preparing payment...`**. That exact English text is only produced by the legacy `azobssPayPaBmToyyib()` handler inside `azobss-global-auth.js`; the dedicated PA/BM storefront uses **`Menyediakan Pembayaran...`**.

The legacy handler was still binding `#payPaBmToyyibButton` on `/PA-BM/`. It calculates payment from old purchase-record rows and calls `/api/toyyib/create-pa-bm-bill` **without an `Authorization: Bearer <Firebase ID token>` header**. The backend therefore correctly returns HTTP 401 with `Please login again before proceeding to payment.`. This is why backend token-verifier patches alone could not solve it.

## Fix
- `/PA-BM/` now has exactly one checkout-button owner: `azobss-pabm-storefront.js`.
- `azobss-global-auth.js` explicitly refuses to bind the legacy `azobssPayPaBmToyyib` click handler on `/PA-BM/`.
- Global auth keeps only payment-return/recovery watchers there.
- Legacy PA/BM total refresh is also skipped on `/PA-BM/`, preventing it from overwriting the real cart total.
- Dedicated storefront marks the button with `data-azobss-checkout-owner="storefront-v1261"`.
- v1260 secure backend token verification is retained unchanged.
- v1259 cart core/Add to Cart is retained.

Package version: `1.0.1261`
