# AZOBSS v1476 — PC Build & Hardware Maybank-Only Checkout

Based on full v1475.

## Change
- New PC Build & Hardware Shop checkout uses **Maybank only** temporarily.
- ToyyibPay and Stripe choices are removed from the PC Shop customer checkout only.
- Request Quote still requires no payment method.
- Backend forces every new `/api/pc-shop/orders` checkout order to `paymentMethod: Maybank`, regardless of client payload.
- Historical PC Shop orders keep their original payment method for audit; Admin saves do not silently rewrite old ToyyibPay/Stripe records.
- Admin PC Shop order workspace shows Payment Method read-only.
- Other AZOBSS payment flows (PA/BM, Software Tools, etc.) are unchanged.
- Live source pricing, automatic markup, final AZOBSS selling price, modal stability and all v1475 functionality are retained.

## Version / cache
- PC Shop frontend: v1476
- Admin PC Shop: v1476
- Backend PC Shop API version: v1476
- Global badge/cache: v1476
