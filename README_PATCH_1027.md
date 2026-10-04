# AZOBSS Patch 1027 — Real Radio Logos + Full Station Names + Radio Schedule Removal

- Radio no longer forces AZOBSSTV-created station artwork over Mana-Mana public metadata.
- Public/provider Radio `logo` is now preferred; local v1026 SVG artwork is only an image-load fallback.
- Card and right-rail image loaders retry the local fallback artwork before falling back to initials.
- Radio grid uses 4 columns on desktop and allows station names to wrap to two lines so names such as NASIONAL FM, RADIO KLASIK and BERNAMA RADIO are readable.
- Today's Schedule is hidden while the Radio tab is active or a Radio station is playing.
- Radio playback no longer requests schedule/EPG metadata. Live TV Today's Schedule and Anime Episodes remain unchanged.
- App/cache version: 1.0.1027.
- Includes `AZOBSSTV/tools/mana2-radio-console-inspector.js`, a console inspector that auto-downloads public Radio metadata/logo fields as JSON without collecting media/stream URLs.
