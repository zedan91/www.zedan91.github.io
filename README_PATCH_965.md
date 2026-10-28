# AZOBSS Patch 965

## AZOBSSTV browser video compatibility fix

- Removes the Apple Bip Bop mixed AVC/HEVC demo master from the bundled default playlist because it can produce audio-only/black-video behavior on some Chromium/Windows decoder combinations.
- Keeps the official hls.js/Mux Big Buck Bunny HLS master and adds a fixed H.264/AAC rendition as the second verification channel.
- HLS.js playback now uses a more conservative non-low-latency configuration for VOD/test streams, caps quality to player size, and prefers an AVC/H.264 level when the manifest exposes one.
- Adds playback diagnostics: current resolution/codec are shown beside Now Playing; if audio is playing but `videoWidth` stays zero, AZOBSSTV reports that the browser could not decode video instead of silently showing a black player.
- Video element explicitly uses `object-fit: contain` and visible rendering hints.
- Version/cache-busters raised to 965 and service-worker cache changed to `azobsstv-v965`.
- No PerfectTV channel list is copied into the package. AZOBSSTV continues to support user/admin-supplied authorized M3U sources through the existing Playlist and Remote Config mechanisms.

## Unchanged

- PA/BM, JUPEM, payment, CAD converter, Repair PC, authentication and the stickybar More placement are unchanged.
