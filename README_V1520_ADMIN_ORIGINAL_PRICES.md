# Release 1520 — Administrator original-price comparison

PC Build cards, details, legacy packages and Upgrade Parts show original source
costs only in the administrator view. The comparison includes the selling price,
the added amount, a mismatch warning against the server's recorded pricing policy,
source date, exact variant labels and original links. Viewnet records include the
original page number and source line; the original PDF is available through an
authenticated administrator endpoint.

Recorded prices are labelled as dated records, with no automatic source-sync claim.
The selling-price match indicator compares against recorded server pricing; it does
not certify that an external supplier has kept today's price or stock unchanged.

Source-price requests and the original PDF require the existing server-verified
administrator identity and return private/no-store responses. The original Viewnet
PDF and extracted costs are encrypted in the repository with AES-256-GCM using a
separate HKDF data key. Runtime uses PC_SOURCE_PRICE_KEY, or the existing deployment
SOLATTIME_ORDER_CIPHER_KEY with domain separation. The deployed data is sealed using
the existing deployment key; retain it for compatible decryption or reseal the two
encrypted assets when rotating it. No key or owner-private file is in this release.

Role loss clears in-memory records, aborts pending requests and removes private
panels, including those inside open product details. Visitors, customers and staff
continue to see the customer catalogue. Existing catalogue prices, IDs, original
images, selling-price PDF, checkout confirmation, orders, licences, photo editor
and GitHub publisher behavior are preserved.
