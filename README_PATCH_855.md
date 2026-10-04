# Patch 855 — Sound Effects Download Formats

- Baseline: (854)
- Adds a `Download` button to all 24 Sound Effects cards.
- MP3 uses the official MyInstants MP3 source URL for each sound. AZOBSS does not include or re-host any MP3 files in this package.
- Download dialog provides MP3, WAV, M4A and OGG.
- WAV/M4A/OGG conversion runs locally in the visitor browser using ffmpeg.wasm loaded on demand from unpkg.
- The page first attempts a direct CORS fetch of the official MP3. If the source blocks cross-origin access, it opens the official MP3 and asks the user to select the downloaded MP3 locally for conversion.
- Local conversion does not upload the chosen audio to AZOBSS.
- Existing playback, search, filters, per-sound share, page share and copy-link functions remain.
