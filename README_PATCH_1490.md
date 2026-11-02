# AZOBSS v1490 — Retailer Image Resolver Recovery

- Keeps the 111 clear-price PC Build catalog.
- Resolves exact retailer images from product/category/search pages.
- Adds Shopify collection Products JSON resolver for DOTATECH, EMARQUE and Brightstar-style collection sources.
- Supports lazy image attributes, srcset/data-srcset, relative URLs, Markdown reader images and contextual product-name/model scoring.
- Adds source document/image resolution caching to avoid repeatedly fetching the same retailer listing page.
- Adds retailer search-page fallback for Ideal Tech, NB Plaza, Tech Hypermart, ILLEGEAR and supported Shopify stores.
- Restores real retry handlers for PC Build and Hardware images.
- If no exact image can be proven, the product stays visible but uses a compact placeholder rather than a large empty media block.
- No generic/AI replacement images are introduced.
