# AZOBSS Patch 978 — AZOBSSTV restore-button + Mana-Mana artwork verification

- Fixes the wide/extend control behavior from v977: after AZOBSSTV enters wide-player mode, the formerly transparent hotspot becomes a clearly visible circular **restore / fit-back** button that mirrors the Mana-Mana return icon. Clicking it restores the normal player + right sidebar layout. `Esc` also restores the normal layout.
- Rechecked the bundled Mana-Mana public channel catalogue and refreshed several current channel-page destinations (BERITA RTM, NHK WORLD, RT International, SELANGOR TV, SIARA TV, USIM TV) while preserving the official-player strategy.
- Replaces the misleading abbreviation-only channel artwork for the affected catalogue entries. Recognizable real logo artwork is now used for TV5 ENJOY TV, BERNAMA, The Indonesia Channel, CNA, Al Jazeera, EURONEWS, ARIRANG, TaiwanPlus, RT and TVIKIM. Remaining entries without a reliable packaged logo use a full-name channel tile instead of arbitrary abbreviations.
- Corrected local artwork is used consistently in both the main channel grid and the right-side quick-channel rail. If an image ever fails, the existing text fallback remains available.
- Existing official-player auto-focus, iframe scroll lock, right-side channel rail, Service card, 25 bundled channels, PA/BM, JUPEM, payment, CAD converter, Repair PC, auth and More menu remain unchanged.
- Package/app/cache/backend health version: 1.0.978.
