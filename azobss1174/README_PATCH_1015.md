# AZOBSSTV v1015 — Live TV A/V Sync Recovery

## Scope
Live TV playback only. Anime and Movies behavior is unchanged.

## Fix
- Adds an `A/V` button beside PiP for one-click audio/video resync.
- Official Mana-Mana cross-origin players cannot expose their internal audio/video clocks to AZOBSSTV. For those channels the A/V action performs a clean official-player reload, which is the browser-safe way to rebuild the provider media pipeline.
- Official Live TV auto-resyncs after the tab has been in the background for more than 12 seconds and after network reconnection. This targets a common Chromium source of lip-sync drift.
- Direct HLS Live TV uses a shorter live buffer, HLS low-latency mode, live-edge limits, audio-frame drift/keyframe discontinuity settings, and a 4-second live-sync guard.
- Direct/native live playback auto-recovers after a sustained stall and jumps back toward the live edge when the playback buffer falls too far behind.
- No stream extraction, DRM/token bypass, CSP/X-Frame-Options bypass, or proxying of the official Mana-Mana iframe was added.

## Version
- App: `1.0.1015`
- Service worker cache: `azobsstv-v1015`
