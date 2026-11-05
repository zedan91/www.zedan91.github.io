# Release 1521 — Price loading and truthful product images

Original-price reads now wait for Firebase restoration, retry once with a refreshed
token after 401/403, and recover when the existing auth-ready events fire. The
administrator's previously configured API-key fallback follows the existing order
dashboard behavior; all protected endpoints still verify admin access on the server.
Login, connection, missing-record and server-data failures now have distinct wording
instead of implying that the product price itself cannot be verified.

The health payload reports only source-data readiness, record count and PDF readiness
or a bounded error code. Original costs, PDF contents and encryption keys remain
protected. No price, stock, order, invoice or licence data is altered by diagnostics.

Upgrade Parts no longer borrows a different model's photo for a category. M350S uses
the original unaltered Logitech Pebble Mouse 2 M350s graphite PNG from the manufacturer.
Unsupported category photos and uncertain series matches use labelled illustrations;
illustrations have no photo-zoom control and cannot open the model-photo viewer.
Retained series photos remain explicitly labelled. Catalogue IDs, option labels,
prices, source cost data and both original/selling-price PDFs are unchanged.

The manufacturer photo source and hash are recorded outside public Source in
Verification/v1521-Logitech-Image-Source.json. The current image audit is
Verification/v1521-Image-Corrections.json. Do not rerun the historical category-photo
fallback without applying the current image policy.
