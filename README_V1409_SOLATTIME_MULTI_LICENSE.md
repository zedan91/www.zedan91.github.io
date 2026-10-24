# SolatTime quantity checkout and AZDM plan order

AZDM choices now group each term together: 1 Year 1 PC, 1 Year 2+ PCs,
Lifetime 1 PC, Lifetime 2+ PCs. Existing prices and plan IDs are unchanged.

SolatTime Buy Now accepts 1–100 licences. The displayed current per-licence price
is multiplied by quantity; the server independently reads the trusted catalogue
price, validates quantity and computes the total for both payment methods.
No SolatTime bulk discount is introduced.

Each purchased PC receives a distinct permanent serial. The existing encrypted
fulfilment record reserves the entire set before issuing any licence. Each slot
has a stable Worker purchase key, issuance progress is saved after each slot,
and retries reuse the same keys. The email and account/admin order detail list
all serials separately. Admin licence lists resolve each slot back to its parent
purchase without exposing serials in public order lists.

Old one-licence purchases and encryption contexts remain supported. No new
environment variables, Worker deployment or SQL migrations are required.
Deploy the complete website and Render backend together before live purchases.
