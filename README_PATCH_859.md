# AZOBSS Patch 859 — Sound Effects Direct MP3 Download

- Baseline: `(858)-AZOBSS-SOUND-EFFECTS-ADMIN-ONLY-ADD-SOUND-FIX_20260809.zip`
- `/Sound-Effects/` Download is now MP3-only.
- Removed the WAV / M4A / OGG format chooser, local converter, ffmpeg.wasm loader and MP3 fallback picker.
- Every sound card now uses a direct MyInstants media URL under `https://www.myinstants.com/media/sounds/<sound-name>.mp3` when an exact official MP3 URL was not already known.
- Existing known exact official MP3 URLs are preserved where their media filename differs from the page slug.
- Example: `Awkward Moment` resolves to `https://www.myinstants.com/media/sounds/awkward-moment.mp3`.
- Card action is now `↓ MP3`; clicking it immediately opens/starts the direct MP3 media download without an AZOBSS format popup.
- Custom admin-added MyInstants sounds also derive their direct MP3 URL from the sound slug, stripping the trailing numeric page ID.
- Admin-only Add Sound protection from patch 858 is retained.
- Search, filters, lazy/infinite loading, Share and Copy Link are retained.
