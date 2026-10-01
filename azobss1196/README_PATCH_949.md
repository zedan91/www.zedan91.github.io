# AZOBSS Patch 949

- Fixes Latest Purchase List Lot Kadaster busy state so ZIP/DWG shows an explicit animated spinner only (no `Muat DXF...`, `Muat DWG...`, or elapsed text).
- Busy spinner is emitted by both purchase renderers and by the live download-lock updater, avoiding pseudo-element/CSS rule collisions.
- Reworks desktop grid widths: Tempoh is given its own 82px track and moved 8px left, while Tindakan gets a dedicated >=195px area with 10px separation.
- Removes the v948 translate-only rule that could leave the original grid overlap unchanged.
- Bumps purchase renderer module cache-busters to v949.
- Backend, download quota, actual file format logic, and Render Docker are unchanged.
