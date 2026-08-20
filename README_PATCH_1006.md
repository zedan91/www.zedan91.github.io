# AZOBSS Patch v1006 — Anime Source Player Fallback Mode

Requested behavior:
- If an Anime episode cannot be embedded inside AZOBSSTV, use a fallback experience
  similar to Live TV's provider-player flow.

Important browser limitation:
- A third-party page that sends X-Frame-Options/CSP blocking cannot legally/technically
  be forced into an AZOBSSTV iframe without bypassing that protection.
- v1006 therefore uses a normal top-level browser Source Player window. This does not
  strip or bypass X-Frame-Options/CSP.

Behavior:
- Verified embeddable HTML player -> still displays inside AZOBSSTV.
- Embedding blocked -> compact panel switches to `Source Player mode`.
- `Source Player` / `Watch in Source Player` opens the original public episode page in
  one named browser window/tab.
- After Source Player mode is activated once, choosing another episode reuses the same
  window instead of creating many tabs.
- AZOBSSTV continues to update NOW PLAYING, episode highlight, Favorites/Recent and
  auto-focus independently.
- If the browser blocks popups, the Source Player button remains available.

Deployment:
- Frontend only.
- Render backend does NOT need to be redeployed.
