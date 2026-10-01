# AZOBSS Patch 1171 — AZOBSSTV Automatic A/V Lip-Sync Recovery

Baseline: 1.0.1170
Version: 1.0.1171
Date: 28 Sep 2026

This is a cumulative full-site package. All changes from 1170 are preserved.

## AZOBSSTV v1087
- Adds an automatic video-frame clock guard using `requestVideoFrameCallback` when supported.
- Detects persistent video-frame lag against the media playback clock instead of assuming cache size is the cause.
- Performs a soft micro-seek resync for moderate drift.
- Performs HLS decoder/media recovery for severe or repeated drift.
- Recovers after non-fatal HLS buffer stalls, fragment gaps and audio-track switches.
- Keeps live playback near the HLS live edge after long buffering, network resume or tab resume.
- Uses a more stability-oriented HLS configuration: standard latency mode, shorter back buffer, buffer-hole tolerance, watchdog/nudge recovery and lower catch-up rate.
- Mana-Mana official channels use native synchronized playback in Chrome/Edge too when the backend already supplies a direct HLS/DASH stream URL; otherwise the previous official iframe remains the fallback.
- Firefox native-stream compatibility from v1086 is preserved.
- The manual `A/V` button remains available as an immediate recovery control.
- Service Worker cache is bumped to `azobsstv-v1087`, so stale v1086 static cache is retired on activation.

## Preserved from 1170
- Invoice Deposit Terms remains opt-in and OFF by default.
- Full website, Admin, PA/BM, Software Tools and all existing assets are preserved.

## Files changed in 1171
- `package.json`
- `AZOBSSTV/index.html`
- `AZOBSSTV/assets/azobsstv.js`
- `AZOBSSTV/sw.js`
- `README_PATCH_1171.md`
