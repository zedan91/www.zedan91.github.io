# AZOBSSTV v1030 — Real Audio-Reactive Radio Equalizer Fix

Package/app version: 1.0.1030

## Changes
- Replaces the cosmetic/random Radio equalizer animation with a real spectrum meter driven by the audio currently playing in the native AZOBSSTV radio engine.
- Uses Web Audio `AnalyserNode` with 12 logarithmic frequency bands (~55 Hz to 14 kHz), attack/decay smoothing, and frame-by-frame bar heights from real frequency energy.
- Uses `HTMLMediaElement.captureStream()` / `mozCaptureStream()` so analysis does not reroute or mute the radio audio.
- The AudioContext is primed from the station click / Restart Radio user gesture, then the analyser attaches only after playback starts.
- If the browser or a particular cross-origin station does not expose audio to `captureStream`, the equalizer stays still and marks itself unavailable rather than showing fake movement.
- Equalizer resets immediately on Stop, station changes, or when radio playback is stopped.
- Radio playback, Radio-Online.my catalogue/logo source, Movies, Anime, Live TV and other features are otherwise unchanged.
- Frontend-only change; no Render redeploy required.
- Cache/service-worker/cache-busters updated to v1030.
