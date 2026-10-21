# AZOBSS v1373 — Ebook Prompt Architect + Direct Route Performance

## UI / copy
- Reworks `/Software-Tools/#ebook` into a clearly AZOBSS-specific **Publisher Lab / Ebook Prompt Architect** interface.
- Replaces the previous generic form/preview presentation with a staged workflow: **Asas Projek → Arah Penulisan → Skala Ebook → Kawalan Ketepatan → Arahan AI Siap Guna**.
- Rewrites user-facing labels and descriptions while preserving the same generator purpose and underlying prompt/PDF production behavior.
- Existing paid RM19 lifetime access, ToyyibPay flow, prompt fields, saved prompt storage and generated prompt engine remain compatible.

## Performance
- Root cause found: Ebook lived inside the very large Software Tools document, so direct `#ebook` loads also paid the cost of the software catalog and its many product-specific runtime patches.
- Adds an early `#ebook` direct-route flag.
- On direct Ebook loads, clears the unused software catalog DOM before the long tail of product patch scripts runs.
- Bypasses 20+ catalog-only inline patch runtimes (cart, product card, download, promo and shared-product observers) on direct Ebook loads, while keeping normal `/Software-Tools/` script ordering unchanged.
- Consolidates Ebook CSS into one v1373 stylesheet instead of loading legacy base + v1372 override separately.
- Extends short access cache from 5 to 20 minutes and defers cached entitlement revalidation by 1.8s, keeping first interaction responsive.
- Prompt history rendering is lazy and only happens when the user opens the archive.

## Compatibility
- Normal `/Software-Tools/` catalog loads keep the existing product modules and behavior.
- Navigating to Ebook after a normal Software Tools load remains supported.
- Payment return detection remains compatible with `?ebook_payment=return` and legacy return handling.
