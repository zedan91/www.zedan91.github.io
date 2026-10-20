# AZOBSS v1350 — Ebook Generate Prompt Runtime Fix

- Fix critical Ebook Generator runtime bug: `getFormState()` was referenced but missing in v1349.
- Added `getFormState()` to collect Topic, Author, Audience, Tone, Language, Design, Size and Max Pages.
- Added try/catch around prompt generation so JavaScript errors are shown in the UI instead of failing silently.
- Keeps v1349 behavior: Ebook category button filters Ebook products only; Ebook Generator remains under More.
- Direct PDF Production Prompt behavior from v1348 remains unchanged.
