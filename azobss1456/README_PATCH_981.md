# AZOBSS Patch 981 — AZOBSSTV Mana-Mana Revlet TV Guide API Fix

- Replaces the unreliable schedule extraction from the rendered `mana2.my/channel/...` HTML as the primary path.
- Uses the structured public Mana-Mana/Revlet TV-guide flow documented by the WebGrab+Plus `mana2.my.ini` site definition:
  1. obtain a short-lived Mana-Mana session ID from `mytv-api.revlet.net`;
  2. obtain the public TV-guide channel catalogue;
  3. resolve the selected AZOBSSTV channel name to the Revlet channel ID;
  4. request today's programmes from `mytv-tvguide.revlet.net/service/api/v1/static/tvguide`.
- The browser sends the channel name and existing `tvg-id` to the AZOBSSTV schedule endpoint so the backend can resolve channels reliably.
- TV1/TV2/BERITA RTM/SELANGOR TV have known guide-ID seeds; all other bundled channels are resolved from the live public channel catalogue.
- Session and channel catalogue are cached for 10 minutes; programme schedule is cached for 60 seconds.
- Existing v980 HTML/Next.js parser remains as a fallback only.
- No session token is exposed to the browser or stored persistently.
- Health endpoint: version `1.0.981`, parser `revlet-tvguide-api-with-html-fallback`.
