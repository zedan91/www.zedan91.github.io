# AZOBSS v1323 — AZDM Stripe Checkout

This patch adds Stripe as a second payment option to the AZOBSS Download Manager (AZDM) plan checkout while keeping ToyyibPay / FPX unchanged.

## Customer flow

- The AZDM plan dialog can show both **Pay via ToyyibPay** and **Pay via Stripe**.
- Stripe uses the trusted server-side AZDM package quote; browser-submitted prices are ignored.
- Stripe Checkout is created in MYR and currently uses card payment through the existing AZOBSS Stripe account configuration.
- After Stripe reports a paid Checkout Session, the existing AZDM fulfilment flow issues the required serial key(s) and sends them to the verified AZOBSS account email.
- Returning from Stripe also triggers a server-side Stripe Session verification, so fulfilment can recover even if the webhook was delayed.
- `My Orders` displays which payment gateway was used.

## Server configuration

The integration reuses the existing AZOBSS Stripe settings:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (recommended for immediate automatic fulfilment)

The existing `/api/stripe/webhook` endpoint already handles paid Checkout Sessions and now also finalizes AZDM orders because they are stored in the same trusted premium-order system.

AZDM's licence service, Firebase/Firestore and email configuration remain required. If Stripe is not configured, the Stripe button is hidden while ToyyibPay continues to work. If ToyyibPay is not configured but Stripe is, AZDM can still remain purchasable through Stripe.

## Compatibility

- Existing pending ToyyibPay orders are unchanged.
- Stripe and ToyyibPay use separate checkout request fingerprints in the browser so switching payment method does not accidentally reuse another gateway's order.
- Render-native AZDM order IDs (`azdm-<uuid>`) are now accepted by the authenticated status endpoint, fixing return/status polling for the local AZDM checkout flow.
