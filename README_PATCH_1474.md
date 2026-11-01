# AZOBSS v1474 — Modal Stability & Freeze Recovery

Baseline: full v1473.

## Root causes addressed
- PC Shop order submit / My Orders used network requests without a hard timeout. On a slow or sleeping backend the modal could remain in `Submitting…` or `Loading…` indefinitely.
- Older AZOBSS modal systems use direct `document.body.style.overflow = "hidden"`. If an exceptional close path or BFCache restore leaves the overlay closed but the body lock active, the page feels frozen.
- Full-screen backdrop blur adds unnecessary GPU/compositor work, especially in Firefox.

## Changes
- Customer PC Shop requests now use bounded timeouts with clear retry/recovery.
- My Orders shows `Cuba Lagi` after timeout/error instead of remaining stuck.
- PC Shop modal supports Escape, restores focus, aborts stale modal listeners, and always releases its scroll lock.
- PC Shop backdrop blur removed; internal modal body remains independently scrollable.
- Admin PC Shop Orders load/save now use bounded timeouts; Escape/backdrop/close always release lock.
- Core Admin authenticated fetch helpers now enforce a 30 second default timeout, including authenticated retry.
- Global Auth adds a conservative v1474 stale-modal recovery guard. It only clears `body overflow:hidden` when no known blocking AZOBSS modal/drawer is visibly open. Recovery runs after close clicks, Escape, focus, pageshow/BFCache and visibility return.
- Global badge/cache updated to v1474.

## Preserved
- v1473 checkout payment whitelist: Maybank / ToyyibPay / Stripe.
- Real PC/hardware/laptop images and curated catalog.
- Shopping cart, Buy Now, Request Quote, order tracking, Sales & Receipts integration.
- All pre-v1473 website functionality.
