# AZOBSS Patch 953 — Purchase Download Hard Icon/Spinner Conflict Fix

- Found the real conflict: older high-specificity rules such as `.compact-table-row .user-pa-download:not(.is-pending-status){min-width:112px!important}` were overriding the v952 30px icon rule.
- Owner/admin table also had an older 8-column grid with only 155px for `Tindakan`, overriding the newer 7-column layout and causing overlap.
- Generic PA/BM download button is now hard-forced to a 27x22px icon-only `↓` button using a higher-specificity selector.
- Busy state uses a real animated spinner element only; a MutationObserver re-normalizes the button even if an older/cached renderer writes `Download`, `Downloading...`, or `Opening Download...` later.
- Download count and admin Reset are compacted and aligned.
- Desktop owner/admin and normal grids now reserve a dedicated action track so `Tempoh` cannot collide with the action controls.
- Lot Kadaster ZIP/DWG controls are explicitly excluded. Backend/quota/download logic unchanged.
- Module cache-buster raised to v953.
