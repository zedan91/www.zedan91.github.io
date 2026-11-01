# AZOBSS v1485 — PC Shop live-source recovery

- Fixes v1484 over-filtering that reduced PC Builds to a single DOTATECH card.
- Uses the 18 exact retailer product mappings already curated in `PC-Build/pc-build-data.json` (Ideal Tech + ALL IT) plus other exact retailer records with full specs.
- Public source is always the original retailer; AZOBSS is not reintroduced as a duplicate PC Build source.
- Every visible build still requires current price, explicit availability, exact source image, 7+ detailed component rows, and CPU/GPU identity match against the same live product page.
- Adds retailer HTML fallback through Jina Reader when Render/datacenter direct requests are blocked (e.g. HTTP 403). Unknown availability remains hidden.
- Hardware catalog uses the same live-only rule and contains exact-source GPU, motherboard and exact single-SKU case candidates. No public snapshot price is stored.
- Image proxy now serves the image discovered/verified during the same live product check rather than generic local artwork.
- Preserves v1484 privacy, stale-cart rejection, single-item Buy Now, order/invoice flow and strict checkout revalidation.
