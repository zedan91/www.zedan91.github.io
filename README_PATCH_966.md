# AZOBSS Patch 966 — AZOBSSTV Mana-Mana Catalogue Integration

## What changed
- Replaced the two demo-only channels with a MYTV Mana-Mana catalogue.
- 24+ current Mana-Mana channel cards are included from public channel pages observed on `mana2.my`.
- Seven channels with public broadcaster streams play directly inside AZOBSSTV: TV1, TV2, TV OKEY, SUKAN+, TV ALHIJRAH, TVS and BERITA RTM.
- Added MPEG-DASH playback through official dash.js CDN for RTM MPD streams.
- Channels whose portable public stream endpoint is not bundled are marked `Buka Mana-Mana` and open the official channel page instead of trying to reuse expiring/authorization-bound URLs.
- Default-free playlist URLs are trusted only when they come from the AZOBSSTV default playlist; custom playlist domain policy remains unchanged.

## Important
This patch deliberately does not hard-code temporary `auth_key` / token URLs found in third-party indexes. Those URLs can expire and may be authorization-bound.

## Unchanged
PA/BM, JUPEM, payment, CAD converter, Repair PC, login/auth, and sticky navigation remain unchanged.
