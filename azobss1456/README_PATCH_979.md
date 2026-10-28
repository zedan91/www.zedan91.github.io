# AZOBSS Patch 979 — AZOBSSTV Current Programme + Today Schedule

## Changes
- Removed `Player rasmi • Auto-focus` from **Now Playing**.
- For bundled Mana-Mana channels, AZOBSSTV now requests the public Mana-Mana channel page through a restricted backend endpoint and extracts **ON NOW / current programme title** plus **Today's Schedule**.
- The old Service / Playlist / EPG / Channels card at the bottom of the right sidebar is replaced by a scrollable **Today's Schedule** card for the currently selected channel.
- Current schedule row is highlighted and scrolled into view.
- Server endpoint is restricted to HTTPS `mana2.my` / `www.mana2.my` paths under `/channel/`, cached for 60 seconds, and does not accept arbitrary hosts.
- If Mana-Mana schedule extraction fails, Now Playing falls back to XMLTV EPG when available and otherwise shows `Maklumat rancangan tidak tersedia`.
- Existing official-player auto-focus, re-extend, iframe scroll lock, channel rail, icons and 25-channel catalogue remain unchanged.

Package version: `1.0.979`.
