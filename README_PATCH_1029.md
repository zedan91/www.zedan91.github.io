# AZOBSSTV v1029 — Native Radio Audio Playback Fix

Date: 2026-08-22
Package/app version: 1.0.1029
Baseline: v1028

## Problem
The v1028 Radio UI used Radio-Online.my for catalogue/artwork, but playback still depended on loading each Radio-Online.my station page in a hidden cross-origin iframe. The station page requires its own Play interaction, which AZOBSSTV cannot trigger across origins. Result: station selection and artwork changed correctly but no audible audio started.

## Fix
- Radio-Online.my remains the metadata/catalogue and artwork source.
- Removed hidden Radio-Online.my iframe as the radio audio engine.
- Added a native AZOBSSTV `<audio>` engine.
- Added client-side public Radio Browser directory lookup for Malaysian station streams using multiple mirrors.
- Candidate ranking favours Malaysia, healthy stations, HTTPS, common audio codecs and exact station-name matches.
- Stream lookup is cached locally for 12 hours for faster subsequent starts.
- Supports normal MP3/AAC/OGG/Opus streams and HLS via the existing hls.js when an HLS candidate is selected.
- Selecting a new Radio station stops the previous station before connecting.
- Selecting non-Radio content stops Radio audio to avoid audio overlap.
- Restart Radio retries a cached stream immediately when possible; a fresh directory lookup is used after a genuine playback failure.
- If browser autoplay policy blocks the first async playback, the UI asks the user to press Restart Radio once; the resolved stream is already cached so the retry is immediate.
- Equalizer animation now reflects actual audio playback state instead of always animating.

## Unchanged
- Radio-Online.my station catalogue and real station artwork from v1028.
- Native AZOBSSTV Radio visual UI.
- Radio Today's Schedule remains hidden.
- Live TV, Movies, Anime, Favorites and Recent behavior unchanged.
- No Render redeploy is required for this v1029 audio resolver because it runs in the frontend.

## Validation
- `node --check AZOBSSTV/assets/azobsstv.js` passed.
- Service worker/cache-busters updated to v1029.
- Package version updated to 1.0.1029.
