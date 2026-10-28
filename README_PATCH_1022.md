# AZOBSS v1022 — Movies Autoplay Watch Action

- Replaces the Movies hero `Open Source` wording with `▶ Watch Movie`.
- Every 7Movies `/movie/:id` route is converted at runtime to the same page with `?autoplay=1`. Existing query parameters are preserved and `autoplay=1` is forced.
- Adds a large center Play button on the Movie Hero artwork; both Play controls open the autoplay playback page.
- The Movies sidebar/status text now instructs users to use `Watch Movie`, not `Open Source`.
- The 7Movies page still opens separately because its full page is not reliably frameable inside AZOBSSTV; no CSP/X-Frame-Options bypass or media URL extraction is used.
- Cache/service-worker/app version advanced to 1.0.1022.
