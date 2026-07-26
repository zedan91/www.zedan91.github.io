# AZOBSS Patch 607

## JUPEM Lot Kadaster download button readiness fix

- A paid Lot Kadaster record no longer shows a permanently locked `Tengah Proses...` button merely because a background JUPEM readiness probe is temporarily unavailable.
- The row now keeps a clickable `Download` button while the record is paid, within its validity period, and below the download limit.
- The authoritative JUPEM readiness check still runs after the user clicks Download. The quota is not consumed while JUPEM reports that the file is still being prepared.
- Active click-time status text uses `Sedang Proses...`.
- Edited module cache versions were raised to v607.

Frontend only. Render backend and Firebase Rules do not need changes.
