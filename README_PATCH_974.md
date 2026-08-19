# AZOBSS 974 — AZOBSSTV Mana-Mana Auto-Focus / Cookie-Banner Crop Fix

## Scope
- `/AZOBSSTV/` official Mana-Mana player only.

## Fix
- Mana-Mana iframe remains cross-origin (`mana2.my`), so browser Same-Origin Policy prevents AZOBSSTV from programmatically clicking the provider's cookie `Accept` button or its internal expand control.
- v974 achieves the requested visible result without bypassing that boundary:
  - iframe virtual viewport increased to **1280×1080**; this moves Mana-Mana's fixed cookie banner below the clipped visible player region;
  - player automatically zooms/crops the Mana-Mana **16:9 video area** (`x=40, y=175, 700×394`) to fill the AZOBSSTV player;
  - this removes the schedule/header/cookie banner from the visible AZOBSSTV player and visually behaves like the provider's expand button had been activated;
  - pointer interaction remains on the real embedded player controls.
- Existing full AZOBSSTV player card, Now Playing, Favorites, 25-channel catalogue and official-page fallback remain unchanged.

## Version
- package: `1.0.974`
- PWA cache: `azobsstv-v974`
