# PA/BM cart follow-up (1437)

The paid-purchases link now targets /PA-BM/#userPaPurchasePanel explicitly.
Its click handler scrolls and focuses the existing purchase list in place,
avoiding the root base URL that previously sent the relative fragment Home.
The link is also available while payment verification is pending.

The existing authenticated purchaseLogs stream now updates cart status as soon
as a server snapshot confirms the exact current order and bill. It requires
the signed-in customer's UID, paid status and a paid timestamp, rejects cached
and locally pending writes, and ignores consumed returns and unrelated orders.
An in-flight HTTP verification is aborted after confirmation; slow background
cart sync does not block the paid UI. Gateway verification remains the fallback.
Download authorization and checkout pricing are unchanged.

32 targeted tests passed. A local browser fixture using synthetic server data
verified immediate cart clearing during a stalled HTTP request and in-page
navigation to the purchase list. No real payment or customer record was changed.
Full website ZIP based on verified (1436), preserving all manual (1435) updates.
