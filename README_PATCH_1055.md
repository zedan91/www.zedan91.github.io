# AZOBSS Patch 1055 — PA/BM ToyyibPay Return + Payment Recovery Fix

## Baseline
Based on v1054. Stickybar/UI layout changes from v1054 are retained and not redesigned in this patch.

## Problem
A PA/BM customer can successfully pay through ToyyibPay but lose the original browser return/session (banking-app switch, different tab/browser, stale return URL, or a callback/order lookup race). This can leave the customer unsure whether the purchase is available even though payment was made.

## Fix
1. PA/BM ToyyibPay `billReturnUrl` is now always the canonical AZOBSS `/PA-BM/?payment=return&orderId=...` URL. The global `TOYYIB_RETURN_URL` environment variable can no longer override PA/BM returns.
2. PA/BM orders persist their canonical `returnUrl` and recovery version.
3. New authenticated endpoint: `GET /api/pa-bm/payment-recovery`. After Firebase login, the backend finds the customer's recent PA/BM orders and verifies unresolved ToyyibPay bills directly with ToyyibPay.
4. If a paid transaction is verified, the existing idempotent finalizer is used so the same order becomes Paid/Receipt and its `purchaseLogs` rows are synchronized.
5. The PA/BM page automatically runs the server recovery check after login, pageshow, focus, and tab resume. It does not depend on localStorage or the original ToyyibPay return tab.
6. If a ToyyibPay callback arrives before its order can be found, a sanitized recovery event is stored in Firestore `paymentRecoveryEvents`. A retryable HTTP 503 is returned when an order/bill reference exists instead of silently acknowledging an unmatched payment as successful.
7. Recovery events are marked resolved after their order is successfully recovered/finalized.
8. Existing v1050 checkout idempotency, 6-digit invoice/receipt numbering, PA/BM 5-download/7-day rules, and historical numbering behavior are unchanged.

## Security
- Payment recovery requires a valid Firebase ID token.
- The backend only considers PA/BM orders that belong to the authenticated user.
- A pending/unsafe local status never unlocks a purchase: ToyyibPay API verification is still required before recovery finalizes payment.
- Stored orphan callback data is sanitized to payment reference/status fields only.

## Deployment
Both website assets and `deploy-server.js` changed. Deploy the website and redeploy the Render backend.

Package version: `1.0.1055`.
