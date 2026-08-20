# AZOBSS Patch 980 — AZOBSSTV Mana-Mana Schedule SSR/Next.js Parser Fix

## Fix
- Fixes AZOBSSTV current programme / Today's Schedule retrieval from public `mana2.my/channel/...` pages.
- Patch 979 only parsed visible HTML after removing `<script>` blocks. Mana-Mana can serialize programme/schedule text inside Next.js hydration / React Server Component flight scripts, so the schedule can be visible in the browser/search index but absent from the old parser input.
- The backend schedule parser now reads three safe text sources without executing third-party JavaScript:
  1. visible server-rendered HTML text;
  2. plain JSON script payloads such as `__NEXT_DATA__`;
  3. Next.js `self.__next_f.push(...)` flight text and generic inline serialized text fallback.
- Supports both common schedule DOM orders: `start -> end -> title` and `start -> title -> end`.
- Adds a fallback corpus parser for collapsed schedule text such as `3:00 AM4:00 AM Programme Title...`.
- Current programme is derived from the schedule using `Asia/Kuala_Lumpur` time when an explicit ON NOW title is not available.
- `/api/azobsstv/mana2/schedule` now includes a `parser` diagnostic field.
- Health endpoint reports `manamana_schedule_parser: visible-html-plus-nextjs-flight`.
- 60-second schedule cache remains.

## Unchanged
- No third-party JavaScript is executed server-side.
- No cookies, login credentials, auth tokens, DRM material or private data are collected.
- Official Mana-Mana iframe player, auto-focus, re-extend, right channel rail, channel artwork, PA/BM, JUPEM, payment, CAD converter, Repair PC, auth and More menu remain unchanged.

Package version: 1.0.980
