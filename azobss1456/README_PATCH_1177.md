# AZOBSS Patch 1177 — PC Build Tiered Markup + Admin-only Price Source

- Applies AZOBSS selling-price markup automatically on top of the live/fallback Malaysia market reference price.
- Markup tiers: <=RM2,500 15%; RM2,501–4,000 12%; RM4,001–6,000 10%; RM6,001–8,000 9%; RM8,001–10,000 8%; >RM10,000 7%.
- Minimum markup is RM250 per build.
- Final customer price is rounded upward to a clean x,099/x,199/.../x,999 style while preserving the intended margin.
- Customer cards show only `Harga AZOBSS`; source store/name is no longer rendered for normal users.
- Administrator sees the source line, reference cost and applied markup percentage.
- Copy Spec also hides source/cost/markup for normal users and includes them only for Administrator.
- Live price refresh remains every 5 minutes; each refreshed market cost is re-marked-up without compounding previous markup.

Package version: `1.0.1177`.
