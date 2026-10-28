# AZOBSS Patch v1004 — 123animehub False JavaScript Player Filter

Observed problem:
- AZOBSSTV showed raw/minified JavaScript inside the Anime player.
- The resolver had incorrectly accepted a URL containing `embed` as a player page.
- In the inspected 123animehub data, `9animes.disqus.com/embed.js` appears on episode
  pages. `embed.js` is a comments JavaScript asset, not an Anime video player.

Fix:
- `.js`, `.css`, JSON, image, font and other static assets can never be selected
  as Anime iframe players.
- Disqus / Disqus CDN URLs are explicitly rejected.
- Generic script-string discovery is now restricted to HTML-like `/embed/`,
  `/player/`, `/watch/` or `/video/` routes.
- Backend verifies the final response Content-Type.
- Non-HTML responses are rejected.
- If Content-Type is missing/ambiguous, a small body probe must look like HTML
  and must not look like JavaScript.
- Redirects from a candidate to a static asset are rejected.
- Frontend has a second independent URL guard before assigning `iframe.src`.
- Status now says `verified HTML player` only after these checks pass.

Important:
- This fixes the raw-JavaScript display bug.
- It does not bypass X-Frame-Options/CSP.
- If 123animehub does not expose a genuine embeddable external HTML player for
  an episode, AZOBSSTV correctly falls back to `Open Source` instead of showing
  unrelated JavaScript.

Deployment:
- Website + Render backend required.
