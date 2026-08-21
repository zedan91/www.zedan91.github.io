# AZOBSS v1025 — AZOBSSTV TV Guide Tab Removal

- Baseline: v1024.
- Removed the visible **TV Guide** tab from AZOBSSTV navigation because **Today's Schedule** already provides the schedule/EPG view for the selected Live TV channel.
- Today's Schedule remains unchanged and continues to use the existing EPG loading logic.
- Live TV, Movies (1Tube), Anime, Radio (Mana-Mana), Favorites and Recent are unchanged.
- The internal legacy guide renderer is retained but no longer exposed in the UI, minimizing regression risk to existing EPG code.
- AZOBSSTV static cache/app version bumped to 1.0.1025 / cache v1025.
- No Render backend redeploy is required for this UI-only patch.
