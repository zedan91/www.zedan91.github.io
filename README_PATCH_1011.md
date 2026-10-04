# AZOBSS Patch v1011 — Anime Reliable Embed Watchdog + Safe Fallback

Problem:
- Some third-party Anime pages appear embeddable during a server-side header check but the browser can still fail to render the iframe reliably.
- A blocked source must not make the main Play control look broken or unexpectedly navigate away from AZOBSSTV.
- Wrapping another provider inside an additional iframe does not solve X-Frame-Options/CSP and can make playback less reliable.

Fix:
- Keep v1010 behavior: no attempt is made to bypass X-Frame-Options or CSP.
- Verified HTML embed candidates are loaded with a 12-second browser-side watchdog.
- If the iframe emits an error or never finishes loading, AZOBSSTV automatically returns to the normal 16:9 Anime fallback display instead of leaving a blank/broken player.
- Blocked/fallback mode now uses an explicit external-link icon instead of a misleading Play icon.
- Clicking the large fallback action opens the public source in a NEW TAB, keeping AZOBSSTV open in the original tab.
- The toolbar `Open Source` action also opens a new tab.
- Popup blocking is reported inline instead of navigating the current page.
- Normal verified embeddable players continue to play inside AZOBSSTV.

Why this method:
- Browser framing restrictions are security controls. They cannot be reliably overridden by frontend code.
- A nested wrapper such as WCOFun -> another provider -> player adds another cross-origin layer and does not remove the original frame policy.
- The stable approach is: in-page only when genuinely permitted; otherwise explicit external playback without destroying the AZOBSSTV session.

Deployment:
- Frontend changes only for normal v1011 behavior.
- Existing backend resolver remains compatible; no Render redeploy is required.

Version:
- Package: 1.0.1011
- AZOBSSTV cache/app version: 1011
