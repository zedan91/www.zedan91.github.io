# Website (1513): storefront catalogue validation

This supersedes the initial (1512) catalogue snapshot. Supplier departments are
classified before generic words like Desktop/Laptop, so desktop cases, memory,
processors and peripherals no longer receive system categories or system margins.
Photos assigned to another Shopify variant are excluded. Zero-priced configurable
items are omitted rather than advertised at the minimum markup alone.

Final import: 5,060 exact available snapshot variants from six readable suppliers,
plus seven original approved product photos; 4,469 distinct complete-canvas images.
The snapshot holds 5,067 records. One original expired price is omitted by backend
validation (5,066 displayed at release); future availability can change that count.
584 laptop variants and 307 desktop/base configurations are in the imported data.
Supplier coverage is partial, not all ten shops: see README_V1512_PC_STOREFRONT.md.

The owner's existing markup formula is unchanged. Checkout rechecks selected IDs
and requires supplier price/stock/configuration confirmation before invoice/payment.
No automatic procurement or new payment-gateway integration is implemented.
Refresh dated snapshots at least weekly using tools/pc-storefront; reject 403/429
access failures and review image audit results before publishing. No schedule added.

43 targeted commerce tests pass, plus 15 category regressions from observed feed
records. Browser quantity, Add to Cart, Buy Now, local order receipt, photo zoom,
filtering and mobile layout verified without production payments/customer orders.
The complete (1511) owner site and its manual image-editor/publishing changes were
preserved by (1512); (1513) changes only the catalogue corrections and release badge.
