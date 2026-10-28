# AZOBSS v1362 — Ebook Owned Access No-Paywall Flash Fix

- Plain `/Software-Tools/#ebook` is no longer misdetected as a ToyyibPay payment return.
- RM19 purchase paywall renders only after backend explicitly returns `payment_required`.
- Loading/auth restoration/network timeout states use neutral access-check UI and never ask an existing buyer to pay again.
- `payment_pending` gets a dedicated payment-status card with recheck/continue controls instead of a fresh purchase paywall.
- Existing verified short access cache still opens the generator immediately while background verification runs.
- Temporary access check failures show Retry and explicitly warn not to make a second payment.
- Script cache version bumped to v1362.
