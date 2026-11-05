# Website (1515): supplier information in administrator view

Supplier name, original-product link and recorded source-price time render only
for the existing administrator role. Removed the technical selling-price/source
status tagline. Applied to the modern store, legacy PC packages, details modal,
fallback product cards and copied legacy specifications. Role changes rerender
cards and remove administrator source blocks from an already-open modal.

This is a presentation change, not a new access-control boundary for public
supplier feeds or public catalogue files. Backend authentication, orders, prices,
markup, catalogue records and photos are unchanged. Existing image editor remains.

46 targeted commerce/source-visibility tests pass. Local browser role controls
verified visitors, customers, staff and admins without touching real auth accounts,
orders, payments or emails. Only the full website ZIP is delivered.
