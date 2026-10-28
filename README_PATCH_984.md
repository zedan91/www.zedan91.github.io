# AZOBSS Patch 984 — AZOBSSTV Schedule Title-Only + Signed-In Favorites/Recent

Package version: 1.0.984

Changes:
- Today's Schedule now displays only start/end time and programme title. Programme descriptions are no longer rendered in the sidebar schedule list.
- Favorites and Recent are now account-only persistent features.
- Guests cannot save Favorites; tapping a heart asks the user to sign in.
- Guest playback is not written to Recent.
- Favorites/Recent tabs show a sign-in message for guests.
- Signed-in Favorites/Recent are stored in per-user browser keys derived from the signed-in AZOBSS uid/username, so different accounts on the same browser do not share the same library.
- Legacy anonymous `azobsstv_favorites` and `azobsstv_recent` keys are ignored/removed so guest history is not reused.
- Auth changes are detected through AZOBSS storage/auth events and focus sync.
- Existing Mana-Mana text schedule, single official playback iframe, channel rail, icons, player, PA/BM, payments and other website systems remain unchanged.
