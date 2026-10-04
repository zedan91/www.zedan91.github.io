# Patch 863 — AZOBSS Native MP3 Sound Button

- Replaces the MyInstants iframe/embed player on `/Sound-Effects/` with an AZOBSS-owned sound button.
- Playback uses the exact `mp3Url` from the 7,210-item crawler catalog directly; `embedUrl` is retained in the JSON only as source metadata and is no longer required for playback.
- Fixes cards showing `Page not found` inside embedded MyInstants frames.
- Uses one shared HTMLAudioElement for the whole page, so only one sound can play at a time.
- Pressing another sound stops/resets the current sound before the new sound starts.
- Pressing the currently playing sound button toggles it to STOP.
- The button appearance is isolated in `.sound-play-button`, `.sound-play-icon`, and `.sound-play-label` CSS so its design can be changed later without changing playback logic.
- Search, category filters, 24-card batching/infinite scroll, Share, Copy Link, forced MP3 download gateway, 7,210 catalog, and admin-only custom sound management are retained from v862.
- More Nav cache-buster and admin gate marker advanced to v863.

Generated: 2026-08-09
