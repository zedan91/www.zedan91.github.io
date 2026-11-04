# Refresh PC storefront

Owner-run Windows 10/11 tool. Requires Python 3.11 with Windows en-US OCR installed.
Use an isolated venv; install requirements.txt, then run refresh.py from that venv.
Raw responses/audits stay outside the website in %TEMP%/azobss-pc-storefront-1512.
Set AZOBSS_CATALOG_WORK to an absolute outside-webroot directory to retain them.
The tool updates the dated public selling-price snapshot, trusted server catalogue,
exact local photos and legacy photo maps. It never deploys or places a ZIP in the
watched GitHub folder. Review audit reports and visual contact sheets before release.

Only public official catalogue pages are read. Respect HTTP 403 and Retry-After;
no challenge bypass, authentication scraping, order placement or supplier checkout.
Cached source pages expire after 24 hours. Each run records coverage/errors;
partial feeds must never be presented as complete supplier inventory.
Shopify variants are pinned to exact IDs; assigned gallery photos cannot be used
for a different variant. Retailer marks/price artwork are rejected, never erased.
Manufacturer logos are retained. All images preserve their complete canvas.
OCR is a screening aid; review logos that OCR can miss before publication.

Selling formula stays 15/12/10/9/8/7 percent by cost thresholds
RM2500/4000/6000/8000/10000, with RM250 minimum margin for systems and
RM150 for hardware, rounded upward to RM10. Never accept client prices.
Snapshots expire after 14 days: refresh at least weekly. The checkout rechecks only
selected items; imported stock/configuration still needs supplier confirmation
before an invoice/payment request. No automated supplier purchase is implemented.
