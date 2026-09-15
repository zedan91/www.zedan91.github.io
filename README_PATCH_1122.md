# AZOBSS Patch 1122

## PA duplicate state follows selected state

- When the same PA number exists in several states, the state explicitly selected by the user has priority if that exact PA also exists there.
- Adds a tolerant exact-PA lookup fallback using shorter PA prefixes because the source search can occasionally omit an exact PA when queried with the full number while showing it in a prefix search.
- The fallback still accepts only an exact PA number match, so a prefix result cannot accidentally select another PA.
- Auto-detect to another state remains available only when the selected state genuinely has no exact PA match.
- If the selected state's PA exists but current cadastral geometry cannot be resolved, the selected state is retained and the existing historical-lot/general server wording is shown instead of switching state.
- Cache-busters for /PA-BM/ map/search assets bumped to v1122.

Package version: 1.0.1122
Frontend + backend deploy required.
