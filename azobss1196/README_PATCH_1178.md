# AZOBSS Patch 1178 — PC Build Varied Natural Price Ending

- Keeps the v1177 tiered PC Build markup structure: <=RM2,500 15%; RM2,501–4,000 12%; RM4,001–6,000 10%; RM6,001–8,000 9%; RM8,001–10,000 8%; >RM10,000 7%.
- Minimum markup remains RM250 per build.
- Replaces the repetitive x,099/x,199/x,999 customer-price pattern with varied, more natural endings.
- Candidate endings use RM00 / RM20 / RM40 / RM50 / RM80 / RM90 and select from the nearest safe prices above the required markup base.
- Selection is deterministic by build ID, so the displayed ending does not jump randomly on every refresh.
- Live market-price changes still recalculate the selling price automatically every 5 minutes.
- Admin-only source / reference cost visibility from v1177 is preserved.
- Customer Copy Spec still hides source, cost and markup details.

Package version: `1.0.1178`.
