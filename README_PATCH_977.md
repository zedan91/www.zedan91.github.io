# AZOBSS Patch 977 — AZOBSSTV source-label removal + provider wide-fit mirror

- Removes the visible `MYTV Mana-Mana` source label from channel cards, quick-channel rail and Now Playing metadata. Internal `group-title` remains unchanged for filtering/search.
- Adds an AZOBSSTV-owned transparent hotspot over the Mana-Mana in-video wide/fit icon. Because the provider is cross-origin, the parent cannot inspect/click that button directly. The hotspot mirrors the user action by toggling AZOBSSTV wide-player layout.
- Wide mode hides the right sidebar and extends the player across the available AZOBSSTV width, then recalculates the official iframe crop automatically. Clicking the same in-video position again restores the normal player + sidebar layout.
- Existing official-player auto-focus, scroll lock, 25-channel catalogue, icons, PA/BM, JUPEM, payment, CAD, Repair PC, auth and More menu are unchanged.
- Package/app/cache/backend health version: 1.0.977.
